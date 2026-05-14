<script setup lang="ts">
import { computed } from 'vue'
import { PACE_MIN_PER_KM } from '../config'
import { useCountUp } from '../composables/useCountUp'
import type { AnalyzedRoute } from '../types'

const props = defineProps<{ route: AnalyzedRoute }>()

// Valeurs animées (count-up) — réagissent au changement de parcours.
const distanceKm = useCountUp(() => props.route.distanceM / 1000)
const gainM = useCountUp(() => props.route.elevationGainM)
const lossM = useCountUp(() => props.route.elevationLossM)
const durationMin = useCountUp(() => (props.route.distanceM / 1000) * PACE_MIN_PER_KM)

const hh = computed(() => Math.floor(durationMin.value / 60))
const mm = computed(() => Math.round(durationMin.value % 60))
const timeLabel = computed(() =>
  hh.value > 0 ? `${hh.value}h${mm.value.toString().padStart(2, '0')}` : `${mm.value}m`,
)
</script>

<template>
  <!-- Rangée de 4 stats : gros chiffre animé + unité + label -->
  <div class="grid grid-cols-4 gap-2">
    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ distanceKm.toFixed(2) }}</span>
        <span class="text-unit text-ink-500">km</span>
      </p>
      <p class="mt-1 text-label text-ink-500">Distance</p>
    </div>

    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ hh > 0 ? hh : mm }}</span>
        <span class="text-unit text-ink-500">{{ hh > 0 ? 'h' : 'm' }}</span>
        <span v-if="hh > 0" class="text-stat-sm tabular-nums">{{ mm.toString().padStart(2, '0') }}</span>
        <span v-if="hh > 0" class="text-unit text-ink-500">m</span>
      </p>
      <p class="mt-1 text-label text-ink-500">Temps estimé</p>
    </div>

    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ Math.round(gainM) }}</span>
        <span class="text-unit text-ink-500">m</span>
      </p>
      <p class="mt-1 text-label text-ink-500">Dénivelé</p>
    </div>

    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ Math.round(lossM) }}</span>
        <span class="text-unit text-ink-500">m</span>
      </p>
      <p class="mt-1 text-label text-ink-500">Dén. nég.</p>
    </div>

    <span class="sr-only">{{ timeLabel }}</span>
  </div>
</template>
