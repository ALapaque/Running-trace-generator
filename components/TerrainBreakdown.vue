<script setup lang="ts">
import { computed } from 'vue'
import { PATH_COLORS } from '../config'
import type { TerrainStats } from '../types/osm'

const props = defineProps<{
  terrain: TerrainStats
  fallback?: boolean
}>()

interface Bar {
  key: string
  label: string
  ratio: number
  color: string
}

const bars = computed<Bar[]>(() => {
  return [
    { key: 'route', label: 'Route', ratio: props.terrain.route, color: PATH_COLORS.route },
    { key: 'chemin_large', label: 'Chemin large', ratio: props.terrain.chemin_large, color: PATH_COLORS.chemin_large },
    { key: 'single', label: 'Single', ratio: props.terrain.single, color: PATH_COLORS.single },
    { key: 'unknown', label: 'Inconnu', ratio: props.terrain.unknown, color: PATH_COLORS.unknown },
  ]
})
</script>

<template>
  <div class="rounded-md border border-slate-200 bg-white p-3">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Répartition du terrain</h3>
      <span v-if="fallback" class="text-[10px] uppercase tracking-wide text-amber-600">
        Analyse indisponible (fallback)
      </span>
    </div>
    <div v-if="fallback" class="text-xs text-slate-500">
      Overpass n'a pas répondu pour ce parcours. La classification est neutralisée — les scores
      ne dépendent que de la distance et du dénivelé.
    </div>
    <div v-else class="space-y-2">
      <!-- Barre empilée -->
      <div class="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          v-for="b in bars"
          :key="b.key"
          :title="`${b.label} : ${(b.ratio * 100).toFixed(0)}%`"
          :style="{ width: `${b.ratio * 100}%`, backgroundColor: b.color }"
        />
      </div>
      <ul class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <li v-for="b in bars" :key="b.key" class="flex items-center gap-2">
          <span class="inline-block h-2 w-2 rounded-full" :style="{ backgroundColor: b.color }" />
          <span class="text-slate-700">{{ b.label }}</span>
          <span class="ml-auto font-mono text-slate-500">{{ (b.ratio * 100).toFixed(0) }}%</span>
        </li>
      </ul>
      <div class="mt-1 text-xs text-slate-600">
        <span class="font-semibold text-emerald-700">Forêt : {{ (terrain.forest * 100).toFixed(0) }}%</span>
      </div>
    </div>
  </div>
</template>
