<script setup lang="ts">
/**
 * Formulaire de génération — pensé pour vivre dans la bottom sheet (mode `full`).
 * - Recherche d'adresse au sommet (sticky)
 * - Sliders distance / D+ avec affichage en grand
 * - Pills pour terrain et type de côte
 * - Toggle forêt
 * - CTA principal "Générer" en sticky bas
 */
import { reactive, ref, watch } from 'vue'
import {
  DEFAULT_RESULTS_COUNT,
  DISTANCE_BOUNDS_KM,
  ELEVATION_BOUNDS_M,
  HILL_LABELS,
  RESULTS_COUNT_OPTIONS,
  TERRAIN_LABELS,
  type ResultsCount,
} from '../config'
import { useGeocoding, type GeocodeResult } from '../composables/useGeocoding'
import { useGeolocation } from '../composables/useGeolocation'
import type { LatLng, RouteGenerationInput } from '../types/ors'

export interface ControlPanelSubmit extends RouteGenerationInput {
  resultsCount: ResultsCount
}

const props = defineProps<{
  start: LatLng | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: ControlPanelSubmit): void
  (e: 'pickStart', position: LatLng): void
}>()

const form = reactive({
  distanceKm: 10,
  elevationGainM: 150,
  terrain: 'mixte' as RouteGenerationInput['terrain'],
  preferForest: false,
  hills: 'vallonné' as RouteGenerationInput['hills'],
  resultsCount: DEFAULT_RESULTS_COUNT as ResultsCount,
})

const geo = useGeolocation()

async function useCurrentPosition(): Promise<void> {
  try {
    const pos = await geo.request()
    emit('pickStart', pos)
    geocodeQuery.value = 'Ma position'
    geocodeResults.value = []
  } catch {
    // L'erreur est exposée via geo.error et affichée dans le template.
  }
}

const geocodeQuery = ref('')
const geocodeResults = ref<GeocodeResult[]>([])
const geocoding = ref(false)
let geocodeAbort: AbortController | null = null
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
  geocodeTimer = setTimeout(runGeocode, 350)
})

function selectGeocode(r: GeocodeResult): void {
  emit('pickStart', r.position)
  geocodeResults.value = []
  geocodeQuery.value = r.label
}

function onSubmit(): void {
  if (!props.start) return
  emit('submit', {
    start: props.start,
    distanceKm: form.distanceKm,
    elevationGainM: form.elevationGainM,
    terrain: form.terrain,
    preferForest: form.preferForest,
    hills: form.hills,
    resultsCount: form.resultsCount,
  })
}

const terrainOptions: RouteGenerationInput['terrain'][] = [
  'route',
  'chemin_large',
  'single',
  'mixte',
]
const hillOptions: RouteGenerationInput['hills'][] = ['plat', 'vallonné', 'montagneux']
</script>

<template>
  <form class="flex flex-col gap-6 pb-32" @submit.prevent="onSubmit">
    <!-- Recherche adresse + ma position -->
    <section>
      <label for="address-search" class="text-label uppercase text-ink-500">
        Point de départ
      </label>
      <div class="mt-1 flex gap-2">
        <div class="relative flex-1">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="address-search"
            v-model="geocodeQuery"
            type="text"
            placeholder="Recherche une adresse"
            class="w-full rounded-pill border border-cream-200 bg-cream-100 py-3 pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-500 focus:border-neon-cyan focus:outline-none"
            autocomplete="off"
          />
        </div>
        <button
          type="button"
          class="flex shrink-0 items-center justify-center rounded-pill border border-cream-200 bg-cream-100 px-3 text-neon-cyan transition hover:bg-cream-200 active:scale-95 disabled:opacity-60"
          style="min-width: 44px; min-height: 44px;"
          :aria-label="geo.loading.value ? 'Localisation en cours' : 'Utiliser ma position actuelle'"
          :aria-busy="geo.loading.value || undefined"
          :disabled="geo.loading.value"
          @click="useCurrentPosition"
        >
          <svg
            v-if="!geo.loading.value"
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
          <svg
            v-else
            class="h-5 w-5 animate-spin text-olive-900"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <ul
        v-if="geocodeResults.length"
        class="mt-2 max-h-48 overflow-y-auto rounded-card border border-cream-200 bg-cream-100 text-sm shadow-card"
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
      <p v-else-if="geocoding" class="mt-1 text-xs text-ink-400">Recherche en cours…</p>
      <p v-else-if="start" class="mt-2 text-xs text-ink-500">
        {{ start.lat.toFixed(5) }}, {{ start.lng.toFixed(5) }}
        — ou clique sur la carte pour repositionner.
      </p>
      <p v-else class="mt-2 text-xs text-terracotta-600">
        Clique sur la carte, recherche une adresse, ou utilise « ma position ».
      </p>
    </section>

    <!-- Distance -->
    <section>
      <div class="flex items-baseline justify-between">
        <label for="distance" class="text-label uppercase text-ink-500">Distance</label>
        <p class="flex items-baseline gap-1">
          <span class="text-stat-sm tabular-nums">{{ form.distanceKm.toFixed(1) }}</span>
          <span class="text-unit text-ink-500">km</span>
        </p>
      </div>
      <input
        id="distance"
        v-model.number="form.distanceKm"
        type="range"
        :min="DISTANCE_BOUNDS_KM.min"
        :max="DISTANCE_BOUNDS_KM.max"
        :step="DISTANCE_BOUNDS_KM.step"
        class="mt-2 w-full accent-olive-900"
      />
    </section>

    <!-- Dénivelé -->
    <section>
      <div class="flex items-baseline justify-between">
        <label for="elevation" class="text-label uppercase text-ink-500">Dénivelé positif</label>
        <p class="flex items-baseline gap-1">
          <span class="text-stat-sm tabular-nums">{{ form.elevationGainM }}</span>
          <span class="text-unit text-ink-500">m</span>
        </p>
      </div>
      <input
        id="elevation"
        v-model.number="form.elevationGainM"
        type="range"
        :min="ELEVATION_BOUNDS_M.min"
        :max="ELEVATION_BOUNDS_M.max"
        :step="ELEVATION_BOUNDS_M.step"
        class="mt-2 w-full accent-olive-900"
      />
    </section>

    <!-- Type de chemin -->
    <section>
      <span class="text-label uppercase text-ink-500">Type de chemin</span>
      <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Type de chemin">
        <button
          v-for="opt in terrainOptions"
          :key="opt"
          type="button"
          role="radio"
          :aria-checked="form.terrain === opt"
          :class="form.terrain === opt ? 'pill-active' : 'pill-muted'"
          @click="form.terrain = opt"
        >
          {{ TERRAIN_LABELS[opt] }}
        </button>
      </div>
    </section>

    <!-- Forêt -->
    <section>
      <label class="flex cursor-pointer items-center justify-between gap-3 rounded-card bg-cream-100 px-4 py-3">
        <span class="text-sm font-medium text-ink-900">Privilégier les portions en forêt</span>
        <span class="relative inline-flex h-6 w-11 shrink-0 items-center">
          <input
            v-model="form.preferForest"
            type="checkbox"
            class="peer sr-only"
          />
          <span class="absolute inset-0 rounded-pill bg-cream-300 transition peer-checked:bg-neon-cyan" />
          <span
            class="absolute left-0.5 top-0.5 h-5 w-5 rounded-pill bg-ink-900 shadow-card transition-transform peer-checked:translate-x-5"
          />
        </span>
      </label>
    </section>

    <!-- Côtes -->
    <section>
      <span class="text-label uppercase text-ink-500">Type de côte</span>
      <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Type de côte">
        <button
          v-for="opt in hillOptions"
          :key="opt"
          type="button"
          role="radio"
          :aria-checked="form.hills === opt"
          :class="form.hills === opt ? 'pill-active' : 'pill-muted'"
          @click="form.hills = opt"
        >
          {{ HILL_LABELS[opt] }}
        </button>
      </div>
    </section>

    <!-- Nombre d'alternatives -->
    <section>
      <span class="text-label uppercase text-ink-500">Alternatives à proposer</span>
      <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Nombre d'alternatives">
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
        Plus d'alternatives = plus de requêtes ORS consommées (~13 par génération).
      </p>
    </section>

    <!-- CTA sticky bas -->
    <div
      class="fixed inset-x-0 bottom-0 z-10 border-t border-cream-200 bg-cream-50/95 px-4 py-3 backdrop-blur"
      style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom));"
    >
      <button
        type="submit"
        class="btn-primary w-full"
        :disabled="!start || loading"
      >
        <span v-if="loading" class="inline-flex items-center gap-2">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          Génération en cours…
        </span>
        <span v-else class="inline-flex items-center gap-2">
          Générer le parcours
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </button>
    </div>
  </form>
</template>

<style scoped>
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
  box-shadow: 0 0 12px 0 rgba(0, 229, 255, 0.5);
  cursor: pointer;
}
input[type='range']::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: theme('colors.olive.900');
  border: 3px solid theme('colors.cream.50');
  box-shadow: 0 0 12px 0 rgba(0, 229, 255, 0.5);
  cursor: pointer;
}
</style>
