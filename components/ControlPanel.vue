<script setup lang="ts">
/**
 * Formulaire de génération — pensé pour vivre dans la bottom sheet / sidebar.
 * - Sélecteur Running / Trail (pilote le profil ORS + le scoring)
 * - Recherche d'adresse + géolocalisation
 * - Plages distance / D+ via sliders à deux poignées
 * - Pills pour le type de côte
 */
import { computed, reactive, ref, watch } from 'vue'
import {
  DEFAULT_DISTANCE_RANGE_KM,
  DEFAULT_ELEVATION_RANGE_M,
  DEFAULT_RESULTS_COUNT,
  DISTANCE_BOUNDS_KM,
  ELEVATION_BOUNDS_M,
  RESULTS_COUNT_OPTIONS,
  type ResultsCount,
} from '../config'
import { useGeocoding, type GeocodeResult } from '../composables/useGeocoding'
import { useGeolocation } from '../composables/useGeolocation'
import { useI18n } from '../composables/useI18n'
import { readJson, writeJson } from '../utils/storage'
import RangeSlider from './RangeSlider.vue'
import type { GenerationParams } from '../types'
import type { LatLng, NumberRange, RouteGenerationInput } from '../types/ors'

const { t } = useI18n()

export interface ControlPanelSubmit extends RouteGenerationInput {
  resultsCount: ResultsCount
}

interface FormState {
  mode: RouteGenerationInput['mode']
  useDistance: boolean
  /** Saisie en valeur exacte (sinon plage min–max). */
  distanceExact: boolean
  distanceKm: { min: number; max: number }
  /** Valeur cible quand `distanceExact`. */
  distanceTargetKm: number
  useElevation: boolean
  elevationExact: boolean
  elevationGainM: { min: number; max: number }
  elevationTargetM: number
  hills: RouteGenerationInput['hills']
  resultsCount: ResultsCount
  /** Running uniquement : router via BRouter+profil custom RAVeL/voies vertes. */
  preferGreenway: boolean
}

// v2 : `terrain` + `preferForest` remplacés par `mode` (running / trail).
const FORM_STORAGE_KEY = 'rungen:form:v2'

function defaultForm(): FormState {
  return {
    mode: 'running',
    useDistance: true,
    distanceExact: false,
    distanceKm: { ...DEFAULT_DISTANCE_RANGE_KM },
    distanceTargetKm: 10,
    useElevation: false,
    elevationExact: false,
    elevationGainM: { ...DEFAULT_ELEVATION_RANGE_M },
    elevationTargetM: 200,
    hills: 'vallonné',
    resultsCount: DEFAULT_RESULTS_COUNT,
    preferGreenway: false,
  }
}

/** Traduit des GenerationParams (URL/historique) en état de formulaire. */
function formFromParams(p: GenerationParams): FormState {
  const base = defaultForm()
  // Une plage min===max provient d'une saisie en valeur exacte.
  const dExact = p.distanceKm !== null && p.distanceKm.min === p.distanceKm.max
  const eExact = p.elevationGainM !== null && p.elevationGainM.min === p.elevationGainM.max
  return {
    mode: p.mode,
    useDistance: p.distanceKm !== null,
    distanceExact: dExact,
    distanceKm: p.distanceKm && !dExact ? p.distanceKm : base.distanceKm,
    distanceTargetKm: dExact ? p.distanceKm!.min : base.distanceTargetKm,
    useElevation: p.elevationGainM !== null,
    elevationExact: eExact,
    elevationGainM: p.elevationGainM && !eExact ? p.elevationGainM : base.elevationGainM,
    elevationTargetM: eExact ? p.elevationGainM!.min : base.elevationTargetM,
    hills: p.hills,
    resultsCount: (p.resultsCount as ResultsCount) ?? base.resultsCount,
    preferGreenway: !!p.preferGreenway,
  }
}

const props = defineProps<{
  start: LatLng | null
  loading: boolean
  /** Paramètres initiaux (lien partagé) — priment sur le localStorage. */
  initial?: GenerationParams | null
}>()

const emit = defineEmits<{
  (e: 'submit', payload: ControlPanelSubmit): void
  (e: 'pickStart', position: LatLng): void
  (e: 'update:valid', valid: boolean): void
}>()

// Priorité d'initialisation : URL partagée > localStorage > défauts.
const initialForm: FormState = props.initial
  ? formFromParams(props.initial)
  : { ...defaultForm(), ...(readJson<Partial<FormState>>(FORM_STORAGE_KEY) ?? {}) }

const form = reactive<FormState>(initialForm)

// Persiste le formulaire à chaque changement (restauré au prochain chargement).
watch(
  form,
  () => writeJson(FORM_STORAGE_KEY, { ...form }),
  { deep: true },
)

/** Au moins un critère actif + point de départ défini. */
const valid = computed(
  () => !!props.start && (form.useDistance || form.useElevation),
)
watch(valid, (v) => emit('update:valid', v), { immediate: true })

const geo = useGeolocation()

async function useCurrentPosition(): Promise<void> {
  try {
    const pos = await geo.request()
    emit('pickStart', pos)
    // Mise à jour programmatique du champ → ne pas relancer de recherche.
    suppressGeocode = true
    geocodeQuery.value = t('control.myLocation')
    geocodeResults.value = []
  } catch {
    // L'erreur est exposée via geo.error et affichée dans le template.
  }
}

const geocodeQuery = ref('')
const geocodeResults = ref<GeocodeResult[]>([])
const geocoding = ref(false)
let geocodeAbort: AbortController | null = null
/** Saute la prochaine recherche déclenchée par une mise à jour programmatique. */
let suppressGeocode = false
const { search } = useGeocoding()

async function runGeocode(): Promise<void> {
  if (!geocodeQuery.value.trim()) {
    geocodeResults.value = []
    return
  }
  geocodeAbort?.abort()
  geocodeAbort = new AbortController()
  geocoding.value = true
  try {
    geocodeResults.value = await search(geocodeQuery.value, 5, geocodeAbort.signal)
  } catch {
    geocodeResults.value = []
  } finally {
    geocoding.value = false
  }
}

let geocodeTimer: ReturnType<typeof setTimeout> | null = null
watch(geocodeQuery, () => {
  if (geocodeTimer) clearTimeout(geocodeTimer)
  // Changement programmatique (géoloc / sélection d'un résultat) : on ne
  // relance pas de recherche, sinon un résultat parasite réapparaît.
  if (suppressGeocode) {
    suppressGeocode = false
    return
  }
  geocodeTimer = setTimeout(runGeocode, 350)
})

function selectGeocode(r: GeocodeResult): void {
  suppressGeocode = true
  emit('pickStart', r.position)
  geocodeResults.value = []
  geocodeQuery.value = r.label
}

/**
 * Plage soumise pour un critère : `null` si inactif, `{v, v}` en valeur
 * exacte (une plage dégénérée que le pipeline/scoring gère déjà via la
 * tolérance), sinon la plage min–max.
 */
function rangeFor(
  use: boolean,
  exact: boolean,
  range: { min: number; max: number },
  target: number,
): NumberRange | null {
  if (!use) return null
  return exact ? { min: target, max: target } : { ...range }
}

function onSubmit(): void {
  if (!valid.value) return
  emit('submit', {
    start: props.start as LatLng,
    distanceKm: rangeFor(form.useDistance, form.distanceExact, form.distanceKm, form.distanceTargetKm),
    elevationGainM: rangeFor(
      form.useElevation,
      form.elevationExact,
      form.elevationGainM,
      form.elevationTargetM,
    ),
    mode: form.mode,
    hills: form.hills,
    resultsCount: form.resultsCount,
    preferGreenway: form.mode === 'running' ? form.preferGreenway : false,
  })
}

// Exposé au parent (page) pour qu'il puisse trigger le submit depuis le footer.
defineExpose({ submit: onSubmit })

/**
 * Applique une valeur saisie au clavier sur une borne de plage : snap au pas,
 * clamp aux bornes absolues, et empêche le croisement min/max. Resynchronise
 * le champ même quand la valeur retenue est identique (saisie hors bornes).
 */
function commitRangeEdge(
  range: NumberRange,
  edge: 'min' | 'max',
  bounds: { min: number; max: number; step: number },
  decimals: number,
  e: Event,
): void {
  const el = e.target as HTMLInputElement
  const raw = el.valueAsNumber
  if (Number.isNaN(raw)) {
    el.value = range[edge].toFixed(decimals)
    return
  }
  const stepped = Math.round(raw / bounds.step) * bounds.step
  const clamped = Math.min(Math.max(stepped, bounds.min), bounds.max)
  range[edge] =
    edge === 'min' ? Math.min(clamped, range.max) : Math.max(clamped, range.min)
  el.value = range[edge].toFixed(decimals)
}

/**
 * Applique une valeur saisie au clavier sur une cible unique (mode exact) :
 * snap au pas + clamp aux bornes. Renvoie la valeur retenue.
 */
function commitTarget(
  current: number,
  bounds: { min: number; max: number; step: number },
  decimals: number,
  e: Event,
): number {
  const el = e.target as HTMLInputElement
  const raw = el.valueAsNumber
  if (Number.isNaN(raw)) {
    el.value = current.toFixed(decimals)
    return current
  }
  const stepped = Math.round(raw / bounds.step) * bounds.step
  const clamped = Math.min(Math.max(stepped, bounds.min), bounds.max)
  el.value = clamped.toFixed(decimals)
  return clamped
}

/** Dégradé de remplissage pour le slider de valeur exacte (portion atteinte). */
function sliderFill(value: number, min: number, max: number): string {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return `linear-gradient(to right, #2F6B3F 0 ${pct}%, #E7E2D5 ${pct}% 100%)`
}

/** Entrée → on quitte le champ (déclenche le commit) sans soumettre le formulaire. */
function blurTarget(e: Event): void {
  ;(e.target as HTMLInputElement).blur()
}

const hillOptions: RouteGenerationInput['hills'][] = ['plat', 'vallonné', 'montagneux']
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="onSubmit">
    <!-- Type de course : sélecteur héro Running / Trail.
         Pilote le profil ORS (foot-walking vs foot-hiking + weighting green)
         et le scoring (bitume vs sentiers + forêt). -->
    <section>
      <span class="text-label uppercase text-ink-500">{{ t('mode.label') }}</span>
      <div
        class="mt-2 grid grid-cols-2 gap-2"
        role="radiogroup"
        :aria-label="t('mode.label')"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="form.mode === 'running'"
          :class="[
            'flex flex-col items-start gap-1.5 rounded-card border px-4 py-3 text-left transition active:scale-[0.98]',
            form.mode === 'running'
              ? 'border-olive-900 bg-olive-900 text-cream-50 shadow-card'
              : 'border-cream-300 bg-cream-100 text-ink-900 hover:bg-cream-200',
          ]"
          @click="form.mode = 'running'"
        >
          <Icon name="road" class="h-5 w-5" />
          <span class="text-sm font-semibold">{{ t('mode.running') }}</span>
          <span
            class="text-xs"
            :class="form.mode === 'running' ? 'text-cream-200' : 'text-ink-500'"
          >
            {{ t('mode.runningSub') }}
          </span>
        </button>

        <button
          type="button"
          role="radio"
          :aria-checked="form.mode === 'trail'"
          :class="[
            'flex flex-col items-start gap-1.5 rounded-card border px-4 py-3 text-left transition active:scale-[0.98]',
            form.mode === 'trail'
              ? 'border-olive-900 bg-olive-900 text-cream-50 shadow-card'
              : 'border-cream-300 bg-cream-100 text-ink-900 hover:bg-cream-200',
          ]"
          @click="form.mode = 'trail'"
        >
          <Icon name="pine" class="h-5 w-5" />
          <span class="text-sm font-semibold">{{ t('mode.trail') }}</span>
          <span
            class="text-xs"
            :class="form.mode === 'trail' ? 'text-cream-200' : 'text-ink-500'"
          >
            {{ t('mode.trailSub') }}
          </span>
        </button>
      </div>

      <!-- Running uniquement : opt-in re-routage BRouter vers les voies cyclables. -->
      <label
        v-if="form.mode === 'running'"
        class="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-card bg-cream-100 px-4 py-3 ring-1 ring-cream-300"
      >
        <span class="flex flex-col">
          <span class="text-sm font-semibold text-ink-900">{{ t('control.preferGreenway') }}</span>
          <span class="text-xs text-ink-500">{{ t('control.preferGreenwaySub') }}</span>
        </span>
        <span class="relative inline-flex h-5 w-9 shrink-0 items-center">
          <input v-model="form.preferGreenway" type="checkbox" class="peer sr-only" />
          <span class="absolute inset-0 rounded-pill bg-cream-300 transition peer-checked:bg-olive-900" />
          <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-pill bg-cream-100 shadow-card transition-transform peer-checked:translate-x-4" />
        </span>
      </label>
    </section>

    <!-- Réglages : départ, contraintes et préférences regroupés dans une
         carte à séparateurs pour une hiérarchie claire. -->
    <div class="divide-y divide-cream-300 rounded-card bg-cream-100 px-4 ring-1 ring-cream-300">
      <!-- Recherche adresse + ma position -->
      <section class="py-4">
      <label for="address-search" class="text-label uppercase text-ink-500">
        {{ t('control.start') }}
      </label>
      <div class="mt-1.5 flex gap-2">
        <div class="relative flex-1">
          <Icon
            name="search"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
          />
          <input
            id="address-search"
            v-model="geocodeQuery"
            type="text"
            :placeholder="t('control.searchPlaceholder')"
            class="w-full rounded-pill border border-cream-300 bg-cream-50 py-3 pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-500 focus:border-olive-900 focus:outline-none"
            autocomplete="off"
          />
        </div>
        <button
          type="button"
          class="flex shrink-0 items-center justify-center rounded-pill border border-cream-300 bg-cream-50 px-3 text-olive-900 transition hover:bg-cream-200 active:scale-95 disabled:opacity-60"
          style="min-width: 44px; min-height: 44px;"
          :aria-label="geo.loading.value ? t('control.locating') : t('control.useLocation')"
          :aria-busy="geo.loading.value || undefined"
          :disabled="geo.loading.value"
          @click="useCurrentPosition"
        >
          <Icon v-if="!geo.loading.value" name="locate" class="h-5 w-5" />
          <Icon v-else name="spinner" class="h-5 w-5 animate-spin text-olive-900" />
        </button>
      </div>
      <ul
        v-if="geocodeResults.length"
        class="mt-2 max-h-48 overflow-y-auto rounded-card border border-cream-300 bg-cream-50 text-sm shadow-card"
        role="listbox"
      >
        <li
          v-for="r in geocodeResults"
          :key="r.label"
          class="cursor-pointer px-4 py-3 text-ink-900 hover:bg-cream-200"
          role="option"
          @click="selectGeocode(r)"
        >
          {{ r.label }}
        </li>
      </ul>
      <p v-if="geo.error.value" class="mt-2 text-xs text-terracotta-600" role="alert">
        {{ geo.error.value }}
      </p>
      <p v-else-if="geocoding" class="mt-1 text-xs text-ink-500">{{ t('control.searching') }}</p>
    </section>

      <!-- Distance — plage min–max ou valeur exacte -->
      <section class="py-4">
      <div class="flex items-center justify-between">
        <label class="flex cursor-pointer items-center gap-2">
          <span class="relative inline-flex h-5 w-9 shrink-0 items-center">
            <input v-model="form.useDistance" type="checkbox" class="peer sr-only" />
            <span class="absolute inset-0 rounded-pill bg-cream-300 transition peer-checked:bg-olive-900" />
            <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-pill bg-cream-100 shadow-card transition-transform peer-checked:translate-x-4" />
          </span>
          <span class="text-label uppercase text-ink-500">{{ t('control.distance') }}</span>
        </label>
        <p v-if="form.useDistance" class="flex items-baseline gap-1">
          <input
            v-if="form.distanceExact"
            type="number"
            class="range-num text-stat-sm tabular-nums"
            :value="form.distanceTargetKm.toFixed(1)"
            :min="DISTANCE_BOUNDS_KM.min"
            :max="DISTANCE_BOUNDS_KM.max"
            :step="DISTANCE_BOUNDS_KM.step"
            inputmode="decimal"
            :aria-label="t('control.distance')"
            @change="form.distanceTargetKm = commitTarget(form.distanceTargetKm, DISTANCE_BOUNDS_KM, 1, $event)"
            @keydown.enter.prevent="blurTarget"
          />
          <template v-else>
            <input
              type="number"
              class="range-num text-stat-sm tabular-nums"
              :value="form.distanceKm.min.toFixed(1)"
              :min="DISTANCE_BOUNDS_KM.min"
              :max="DISTANCE_BOUNDS_KM.max"
              :step="DISTANCE_BOUNDS_KM.step"
              inputmode="decimal"
              :aria-label="`${t('control.distance')} ${t('control.min')}`"
              @change="commitRangeEdge(form.distanceKm, 'min', DISTANCE_BOUNDS_KM, 1, $event)"
              @keydown.enter.prevent="blurTarget"
            />
            <span class="text-unit text-ink-500">–</span>
            <input
              type="number"
              class="range-num text-stat-sm tabular-nums"
              :value="form.distanceKm.max.toFixed(1)"
              :min="DISTANCE_BOUNDS_KM.min"
              :max="DISTANCE_BOUNDS_KM.max"
              :step="DISTANCE_BOUNDS_KM.step"
              inputmode="decimal"
              :aria-label="`${t('control.distance')} ${t('control.max')}`"
              @change="commitRangeEdge(form.distanceKm, 'max', DISTANCE_BOUNDS_KM, 1, $event)"
              @keydown.enter.prevent="blurTarget"
            />
          </template>
          <span class="text-unit text-ink-500">km</span>
        </p>
        <span v-else class="text-xs text-ink-500">{{ t('control.unconstrainedF') }}</span>
      </div>

      <!-- Plage / valeur exacte -->
      <div
        v-if="form.useDistance"
        class="mt-3 inline-flex rounded-pill bg-cream-50 p-0.5 ring-1 ring-cream-300"
        role="radiogroup"
        :aria-label="t('control.distance')"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="!form.distanceExact"
          class="rounded-pill px-3 py-1.5 text-xs font-semibold transition"
          :class="!form.distanceExact ? 'bg-olive-900 text-white' : 'text-ink-500'"
          @click="form.distanceExact = false"
        >
          {{ t('control.modeRange') }}
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="form.distanceExact"
          class="rounded-pill px-3 py-1.5 text-xs font-semibold transition"
          :class="form.distanceExact ? 'bg-olive-900 text-white' : 'text-ink-500'"
          @click="form.distanceExact = true"
        >
          {{ t('control.modeExact') }}
        </button>
      </div>

      <RangeSlider
        v-show="form.useDistance && !form.distanceExact"
        v-model="form.distanceKm"
        class="mt-3"
        :min="DISTANCE_BOUNDS_KM.min"
        :max="DISTANCE_BOUNDS_KM.max"
        :step="DISTANCE_BOUNDS_KM.step"
        :aria-label="t('control.distance')"
        unit="km"
      />
      <input
        v-show="form.useDistance && form.distanceExact"
        type="range"
        class="mt-3 w-full"
        :value="form.distanceTargetKm"
        :min="DISTANCE_BOUNDS_KM.min"
        :max="DISTANCE_BOUNDS_KM.max"
        :step="DISTANCE_BOUNDS_KM.step"
        :style="{ background: sliderFill(form.distanceTargetKm, DISTANCE_BOUNDS_KM.min, DISTANCE_BOUNDS_KM.max) }"
        :aria-label="t('control.distance')"
        @input="form.distanceTargetKm = Number(($event.target as HTMLInputElement).value)"
      />
    </section>

      <!-- Dénivelé positif — plage min–max ou valeur exacte -->
      <section class="py-4">
      <div class="flex items-center justify-between">
        <label class="flex cursor-pointer items-center gap-2">
          <span class="relative inline-flex h-5 w-9 shrink-0 items-center">
            <input v-model="form.useElevation" type="checkbox" class="peer sr-only" />
            <span class="absolute inset-0 rounded-pill bg-cream-300 transition peer-checked:bg-olive-900" />
            <span class="absolute left-0.5 top-0.5 h-4 w-4 rounded-pill bg-cream-100 shadow-card transition-transform peer-checked:translate-x-4" />
          </span>
          <span class="text-label uppercase text-ink-500">{{ t('control.elevation') }}</span>
        </label>
        <p v-if="form.useElevation" class="flex items-baseline gap-1">
          <input
            v-if="form.elevationExact"
            type="number"
            class="range-num text-stat-sm tabular-nums"
            :value="form.elevationTargetM"
            :min="ELEVATION_BOUNDS_M.min"
            :max="ELEVATION_BOUNDS_M.max"
            :step="ELEVATION_BOUNDS_M.step"
            inputmode="numeric"
            :aria-label="t('control.elevation')"
            @change="form.elevationTargetM = commitTarget(form.elevationTargetM, ELEVATION_BOUNDS_M, 0, $event)"
            @keydown.enter.prevent="blurTarget"
          />
          <template v-else>
            <input
              type="number"
              class="range-num text-stat-sm tabular-nums"
              :value="form.elevationGainM.min"
              :min="ELEVATION_BOUNDS_M.min"
              :max="ELEVATION_BOUNDS_M.max"
              :step="ELEVATION_BOUNDS_M.step"
              inputmode="numeric"
              :aria-label="`${t('control.elevation')} ${t('control.min')}`"
              @change="commitRangeEdge(form.elevationGainM, 'min', ELEVATION_BOUNDS_M, 0, $event)"
              @keydown.enter.prevent="blurTarget"
            />
            <span class="text-unit text-ink-500">–</span>
            <input
              type="number"
              class="range-num text-stat-sm tabular-nums"
              :value="form.elevationGainM.max"
              :min="ELEVATION_BOUNDS_M.min"
              :max="ELEVATION_BOUNDS_M.max"
              :step="ELEVATION_BOUNDS_M.step"
              inputmode="numeric"
              :aria-label="`${t('control.elevation')} ${t('control.max')}`"
              @change="commitRangeEdge(form.elevationGainM, 'max', ELEVATION_BOUNDS_M, 0, $event)"
              @keydown.enter.prevent="blurTarget"
            />
          </template>
          <span class="text-unit text-ink-500">m</span>
        </p>
        <span v-else class="text-xs text-ink-500">{{ t('control.unconstrainedM') }}</span>
      </div>

      <!-- Plage / valeur exacte -->
      <div
        v-if="form.useElevation"
        class="mt-3 inline-flex rounded-pill bg-cream-50 p-0.5 ring-1 ring-cream-300"
        role="radiogroup"
        :aria-label="t('control.elevation')"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="!form.elevationExact"
          class="rounded-pill px-3 py-1.5 text-xs font-semibold transition"
          :class="!form.elevationExact ? 'bg-olive-900 text-white' : 'text-ink-500'"
          @click="form.elevationExact = false"
        >
          {{ t('control.modeRange') }}
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="form.elevationExact"
          class="rounded-pill px-3 py-1.5 text-xs font-semibold transition"
          :class="form.elevationExact ? 'bg-olive-900 text-white' : 'text-ink-500'"
          @click="form.elevationExact = true"
        >
          {{ t('control.modeExact') }}
        </button>
      </div>

      <RangeSlider
        v-show="form.useElevation && !form.elevationExact"
        v-model="form.elevationGainM"
        class="mt-3"
        :min="ELEVATION_BOUNDS_M.min"
        :max="ELEVATION_BOUNDS_M.max"
        :step="ELEVATION_BOUNDS_M.step"
        :aria-label="t('control.elevation')"
        unit="m"
      />
      <input
        v-show="form.useElevation && form.elevationExact"
        type="range"
        class="mt-3 w-full"
        :value="form.elevationTargetM"
        :min="ELEVATION_BOUNDS_M.min"
        :max="ELEVATION_BOUNDS_M.max"
        :step="ELEVATION_BOUNDS_M.step"
        :style="{ background: sliderFill(form.elevationTargetM, ELEVATION_BOUNDS_M.min, ELEVATION_BOUNDS_M.max) }"
        :aria-label="t('control.elevation')"
        @input="form.elevationTargetM = Number(($event.target as HTMLInputElement).value)"
      />
    </section>

      <!-- Côtes -->
      <section class="py-4">
      <span class="text-label uppercase text-ink-500">{{ t('control.hillType') }}</span>
      <div
        class="mt-2 flex flex-wrap gap-2"
        role="radiogroup"
        :aria-label="t('control.hillType')"
      >
        <button
          v-for="opt in hillOptions"
          :key="opt"
          type="button"
          role="radio"
          :aria-checked="form.hills === opt"
          :class="form.hills === opt ? 'pill-active' : 'pill-muted'"
          @click="form.hills = opt"
        >
          {{ t(`hillPref.${opt}`) }}
        </button>
      </div>
    </section>

      <!-- Nombre d'alternatives -->
      <section class="py-4">
      <span class="text-label uppercase text-ink-500">{{ t('control.alternativesCount') }}</span>
      <div
        class="mt-2 flex flex-wrap gap-2"
        role="radiogroup"
        :aria-label="t('control.alternativesCount')"
      >
        <button
          v-for="n in RESULTS_COUNT_OPTIONS"
          :key="n"
          type="button"
          role="radio"
          :aria-checked="form.resultsCount === n"
          :class="form.resultsCount === n ? 'pill-active' : 'pill-muted'"
          @click="form.resultsCount = n"
        >
          {{ n }}
        </button>
      </div>
      <p v-if="form.resultsCount >= 10" class="mt-2 text-xs text-ink-500">
        {{ t('control.quotaWarning') }}
      </p>
      </section>
    </div>

    <!-- Alerte : au moins un critère actif (distance ou dénivelé) requis. -->
    <p
      v-if="!form.useDistance && !form.useElevation"
      class="rounded-card bg-terracotta-500/10 px-4 py-3 text-xs text-terracotta-600"
      role="alert"
    >
      {{ t('control.atLeastOne') }}
    </p>

    <!-- CTA Générer : rendu par la page dans le footer du BottomSheet
         (via défineExpose `submit` + slot `#footer`). -->
    <button type="submit" class="hidden" aria-hidden="true" tabindex="-1">
      Submit (caché, déclenché par Enter dans un input)
    </button>
  </form>
</template>

<style scoped>
/* Valeurs de plage éditables : ressemblent au texte stat, deviennent un champ
   au survol / focus. content-box pour que `width: 4ch` = largeur du contenu. */
.range-num {
  box-sizing: content-box;
  width: 4ch;
  padding: 1px 4px;
  text-align: right;
  color: inherit;
  background: transparent;
  border-radius: 8px;
  appearance: textfield;
  -moz-appearance: textfield;
  transition: background-color 150ms ease, box-shadow 150ms ease;
}
.range-num:hover {
  background: theme('colors.cream.200');
}
.range-num:focus {
  outline: none;
  background: theme('colors.cream.100');
  box-shadow: 0 0 0 2px theme('colors.olive.900');
}
.range-num::-webkit-outer-spin-button,
.range-num::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='range'] {
  height: 6px;
  border-radius: 999px;
  background: theme('colors.cream.200');
  appearance: none;
  outline: none;
}
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: theme('colors.olive.900');
  border: 3px solid theme('colors.cream.50');
  box-shadow: 0 1px 4px rgba(42, 42, 38, 0.3);
  cursor: pointer;
}
input[type='range']::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: theme('colors.olive.900');
  border: 3px solid theme('colors.cream.50');
  box-shadow: 0 1px 4px rgba(42, 42, 38, 0.3);
  cursor: pointer;
}
</style>
