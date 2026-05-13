<script setup lang="ts">
/**
 * Vue d'ensemble des 3 candidats avec leur score, pour permettre à l'utilisateur
 * de basculer entre eux.
 */
import type { AnalyzedRoute } from '../types'

const props = defineProps<{
  routes: AnalyzedRoute[]
  selectedId: string | null
}>()

const emit = defineEmits<{ (e: 'select', id: string): void }>()

function fmtKm(m: number): string {
  return (m / 1000).toFixed(1)
}
</script>

<template>
  <div class="rounded-md border border-slate-200 bg-white p-3">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
      Alternatives ({{ props.routes.length }})
    </h3>
    <ul class="space-y-2">
      <li v-for="(r, idx) in props.routes" :key="r.id">
        <button
          type="button"
          class="w-full rounded-md border px-3 py-2 text-left transition"
          :class="
            selectedId === r.id
              ? 'border-blue-600 bg-blue-50'
              : 'border-slate-200 hover:border-slate-400'
          "
          @click="emit('select', r.id)"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">
              <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] mr-2">
                {{ idx + 1 }}
              </span>
              {{ fmtKm(r.distanceM) }} km
            </span>
            <span class="font-mono text-xs text-slate-500">score {{ r.score.toFixed(3) }}</span>
          </div>
          <div class="mt-1 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
            <span>D+ {{ Math.round(r.elevationGainM) }}m</span>
            <span>Route {{ Math.round(r.terrain.route * 100) }}%</span>
            <span>Forêt {{ Math.round(r.terrain.forest * 100) }}%</span>
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>
