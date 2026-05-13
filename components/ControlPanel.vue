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
  DISTANCE_BOUNDS_KM,
  ELEVATION_BOUNDS_M,
  HILL_LABELS,
  TERRAIN_LABELS,
} from '../config'
import { useGeocoding, type GeocodeResult } from '../composables/useGeocoding'
import type { LatLng, RouteGenerationInput } from '../types/ors'

const props = defineProps<{
  start: LatLng | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', payload: RouteGenerationInput): void
  (e: 'pickStart', position: LatLng): void
}>()

const form = reactive({
  distanceKm: 10,
  elevationGainM: 150,
  terrain: 'mixte' as RouteGenerationInput['terrain'],
  preferForest: false,
  hills: 'vallonné' as RouteGenerationInput['hills'],
})

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
    <!-- Recherche adresse -->
    <section>
      <label for="address-search" class="text-label uppercase text-ink-500">
        Point de départ
      </label>
      <div class="relative mt-1">
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
          class="w-full rounded-pill border border-cream-200 bg-white py-3 pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-400"
          autocomplete="off"
        />
      </div>
      <ul
        v-if="geocodeResults.length"
        class="mt-2 max-h-48 overflow-y-auto rounded-card border border-cream-200 bg-white text-sm shadow-card"
        role="listbox"
      >
        <li
          v-for="r in geocodeResults"
          :key="r.label"
          class="cursor-pointer px-4 py-3 hover:bg-cream-100"
          role="option"
          @click="selectGeocode(r)"
        >
          {{ r.label }}
        </li>
      </ul>
      <p v-if="geocoding" class="mt-1 text-xs text-ink-400">Recherche en cours…</p>
      <p v-else-if="start" class="mt-2 text-xs text-ink-500">
        {{ start.lat.toFixed(5) }}, {{ start.lng.toFixed(5) }}
        — ou clique sur la carte pour repositionner.
      </p>
      <p v-else class="mt-2 text-xs text-terracotta-600">
        Clique sur la carte pour définir le point de départ.
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
          <span class="absolute inset-0 rounded-pill bg-ink-200 transition peer-checked:bg-olive-900" />
          <span
            class="absolute left-0.5 top-0.5 h-5 w-5 rounded-pill bg-white shadow-card transition-transform peer-checked:translate-x-5"
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
  border: 3px solid white;
  box-shadow: 0 2px 6px -1px rgba(26, 26, 26, 0.25);
  cursor: pointer;
}
input[type='range']::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: theme('colors.olive.900');
  border: 3px solid white;
  box-shadow: 0 2px 6px -1px rgba(26, 26, 26, 0.25);
  cursor: pointer;
}
</style>
