<script setup lang="ts">
/**
 * Panneau de contrôle : tous les inputs utilisateur.
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

const terrainOptions: RouteGenerationInput['terrain'][] = ['route', 'chemin_large', 'single', 'mixte']
const hillOptions: RouteGenerationInput['hills'][] = ['plat', 'vallonné', 'montagneux']
</script>

<template>
  <form
    class="flex flex-col gap-5 p-5 overflow-y-auto bg-white border-l border-slate-200 h-full"
    @submit.prevent="onSubmit"
  >
    <header>
      <h1 class="text-lg font-bold text-slate-900">RunGen</h1>
      <p class="text-xs text-slate-500">Génère une boucle de running personnalisée.</p>
    </header>

    <section>
      <label class="field-label" for="address-search">Point de départ</label>
      <input
        id="address-search"
        v-model="geocodeQuery"
        type="text"
        placeholder="Recherche une adresse ou clique sur la carte"
        class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        autocomplete="off"
      />
      <ul
        v-if="geocodeResults.length"
        class="mt-1 max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white text-sm shadow"
      >
        <li
          v-for="r in geocodeResults"
          :key="r.label"
          class="cursor-pointer px-3 py-2 hover:bg-slate-100"
          @click="selectGeocode(r)"
        >
          {{ r.label }}
        </li>
      </ul>
      <p v-if="geocoding" class="mt-1 text-xs text-slate-400">Recherche en cours…</p>
      <p v-if="start" class="mt-2 text-xs text-slate-500">
        Coordonnées : {{ start.lat.toFixed(5) }}, {{ start.lng.toFixed(5) }}
      </p>
      <p v-else class="mt-2 text-xs text-amber-600">Clique sur la carte pour définir le départ.</p>
    </section>

    <section>
      <label class="field-label" for="distance">
        Distance cible : <span class="text-slate-900 font-semibold">{{ form.distanceKm.toFixed(1) }} km</span>
      </label>
      <input
        id="distance"
        v-model.number="form.distanceKm"
        type="range"
        :min="DISTANCE_BOUNDS_KM.min"
        :max="DISTANCE_BOUNDS_KM.max"
        :step="DISTANCE_BOUNDS_KM.step"
        class="w-full"
      />
    </section>

    <section>
      <label class="field-label" for="elevation">
        Dénivelé positif cible : <span class="text-slate-900 font-semibold">{{ form.elevationGainM }} m</span>
      </label>
      <input
        id="elevation"
        v-model.number="form.elevationGainM"
        type="range"
        :min="ELEVATION_BOUNDS_M.min"
        :max="ELEVATION_BOUNDS_M.max"
        :step="ELEVATION_BOUNDS_M.step"
        class="w-full"
      />
    </section>

    <section>
      <span class="field-label">Type de chemin</span>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="opt in terrainOptions"
          :key="opt"
          type="button"
          class="rounded-md border px-3 py-2 text-sm transition"
          :class="
            form.terrain === opt
              ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
              : 'border-slate-300 text-slate-700 hover:border-slate-400'
          "
          @click="form.terrain = opt"
        >
          {{ TERRAIN_LABELS[opt] }}
        </button>
      </div>
    </section>

    <section>
      <label class="flex items-center gap-3 cursor-pointer">
        <input v-model="form.preferForest" type="checkbox" class="h-4 w-4" />
        <span class="text-sm text-slate-800">Privilégier les portions en forêt</span>
      </label>
    </section>

    <section>
      <span class="field-label">Type de côte</span>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="opt in hillOptions"
          :key="opt"
          type="button"
          class="rounded-md border px-2 py-2 text-sm transition"
          :class="
            form.hills === opt
              ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
              : 'border-slate-300 text-slate-700 hover:border-slate-400'
          "
          @click="form.hills = opt"
        >
          {{ HILL_LABELS[opt] }}
        </button>
      </div>
    </section>

    <button class="btn-primary mt-2" type="submit" :disabled="!start || loading">
      <span v-if="loading">Génération en cours…</span>
      <span v-else>Générer le parcours</span>
    </button>
  </form>
</template>
