<script setup lang="ts">
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
  <section>
    <h3 class="mb-3 text-base font-bold text-ink-900">Alternatives</h3>
    <ul class="space-y-2" role="listbox" aria-label="Alternatives de parcours">
      <li v-for="(r, idx) in props.routes" :key="r.id">
        <button
          type="button"
          role="option"
          :aria-selected="selectedId === r.id"
          :class="[
            'flex w-full items-center gap-3 rounded-card border p-3 text-left transition',
            selectedId === r.id
              ? 'border-olive-900 bg-cream-100 shadow-card'
              : 'border-cream-200 bg-white hover:border-cream-400',
          ]"
          @click="emit('select', r.id)"
        >
          <span
            :class="[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-sm font-bold',
              selectedId === r.id ? 'bg-olive-900 text-white' : 'bg-cream-200 text-ink-700',
            ]"
            aria-hidden="true"
          >
            {{ idx + 1 }}
          </span>
          <div class="flex-1">
            <p class="flex items-baseline gap-1">
              <span class="text-lg font-bold tabular-nums">{{ fmtKm(r.distanceM) }}</span>
              <span class="text-xs text-ink-500">km</span>
              <span class="mx-2 text-ink-300">•</span>
              <span class="text-lg font-bold tabular-nums">{{ Math.round(r.elevationGainM) }}</span>
              <span class="text-xs text-ink-500">m D+</span>
            </p>
            <p class="mt-0.5 text-xs text-ink-500">
              Route {{ Math.round(r.terrain.route * 100) }}%
              · Chemin {{ Math.round(r.terrain.chemin_large * 100) }}%
              · Single {{ Math.round(r.terrain.single * 100) }}%
              <span v-if="r.terrain.forest > 0">· Forêt {{ Math.round(r.terrain.forest * 100) }}%</span>
            </p>
          </div>
          <span class="font-mono text-[11px] text-ink-400">score {{ r.score.toFixed(2) }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>
