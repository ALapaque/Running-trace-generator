<script setup lang="ts">
import { computed, ref } from 'vue'
import ControlPanel from '../components/ControlPanel.vue'
import ElevationChart from '../components/ElevationChart.vue'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import MapView from '../components/MapView.vue'
import RouteAlternatives from '../components/RouteAlternatives.vue'
import RouteStats from '../components/RouteStats.vue'
import TerrainBreakdown from '../components/TerrainBreakdown.vue'
import { useGpxExport } from '../composables/useGpxExport'
import { useRoutePipeline } from '../composables/useRoutePipeline'
import type { LatLng, RouteGenerationInput } from '../types/ors'

const start = ref<LatLng | null>(null)
const selectedId = ref<string | null>(null)
let abort: AbortController | null = null

const pipeline = useRoutePipeline()
const gpx = useGpxExport()

const selectedRoute = computed(() => {
  if (!selectedId.value) return pipeline.results.value[0] ?? null
  return pipeline.results.value.find((r) => r.id === selectedId.value) ?? null
})

const loading = computed(
  () =>
    pipeline.stage.value === 'generating' ||
    pipeline.stage.value === 'analyzing' ||
    pipeline.stage.value === 'scoring',
)

function onPickStart(pos: LatLng): void {
  start.value = pos
}

async function onSubmit(payload: RouteGenerationInput): Promise<void> {
  abort?.abort()
  abort = new AbortController()
  try {
    const top = await pipeline.run(payload, abort.signal)
    selectedId.value = top[0]?.id ?? null
  } catch {
    // L'erreur est gérée dans le composable et affichée via errorMessage.
  }
}

function onSelectRoute(id: string): void {
  selectedId.value = id
}

function onDownload(): void {
  if (selectedRoute.value) gpx.exportRoute(selectedRoute.value)
}
</script>

<template>
  <div class="flex h-screen w-screen flex-col md:flex-row">
    <!-- Carte -->
    <div class="relative h-[60vh] w-full md:h-full md:flex-1">
      <MapView :start="start" :route="selectedRoute" @pickStart="onPickStart" />
      <LoadingOverlay :stage="pipeline.stage.value" :progress="pipeline.progress.value" />
    </div>

    <!-- Panneau de contrôle -->
    <aside class="flex h-full w-full flex-col md:w-[380px] md:shrink-0">
      <ControlPanel :start="start" :loading="loading" @submit="onSubmit" @pickStart="onPickStart" />

      <!-- Résultats -->
      <div
        v-if="pipeline.results.value.length"
        class="flex flex-col gap-3 border-l border-t border-slate-200 bg-slate-50 p-4"
      >
        <RouteAlternatives
          :routes="pipeline.results.value"
          :selectedId="selectedId"
          @select="onSelectRoute"
        />

        <template v-if="selectedRoute">
          <RouteStats :route="selectedRoute" />
          <TerrainBreakdown :terrain="selectedRoute.terrain" :fallback="selectedRoute.terrainFallback" />
          <ElevationChart :points="selectedRoute.points" />
          <button class="btn-primary" type="button" @click="onDownload">
            Télécharger GPX
          </button>
        </template>
      </div>

      <!-- Erreurs / warnings -->
      <div
        v-if="pipeline.errorMessage.value"
        class="border-l border-t border-red-200 bg-red-50 p-3 text-sm text-red-800"
        role="alert"
      >
        {{ pipeline.errorMessage.value }}
      </div>
      <div
        v-if="pipeline.quotaWarning.value && !pipeline.errorMessage.value"
        class="border-l border-t border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
      >
        Certaines requêtes ORS ont été refusées (quota partiellement dépassé). Les résultats restent valides.
      </div>
    </aside>
  </div>
</template>
