<script setup lang="ts">
import { computed } from 'vue'
import { PACE_MIN_PER_KM } from '../config'
import type { AnalyzedRoute } from '../types'

const props = defineProps<{ route: AnalyzedRoute }>()

const distanceKm = computed(() => props.route.distanceM / 1000)
const durationMin = computed(() => distanceKm.value * PACE_MIN_PER_KM)
const hh = computed(() => Math.floor(durationMin.value / 60))
const mm = computed(() => Math.round(durationMin.value % 60))
const timeLabel = computed(() =>
  hh.value > 0 ? `${hh.value}h${mm.value.toString().padStart(2, '0')}` : `${mm.value}m`,
)
</script>

<template>
  <!-- Rangée de 4 stats type Komoot : gros chiffre + unité petite + label dessous -->
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
        <span class="text-stat tabular-nums">{{ Math.round(route.elevationGainM) }}</span>
        <span class="text-unit text-ink-500">m</span>
      </p>
      <p class="mt-1 text-label text-ink-500">Dénivelé</p>
    </div>

    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ Math.round(route.elevationLossM) }}</span>
        <span class="text-unit text-ink-500">m</span>
      </p>
      <p class="mt-1 text-label text-ink-500">Dén. nég.</p>
    </div>

    <!-- timeLabel : utilisé pour aria, reste accessible -->
    <span class="sr-only">{{ timeLabel }}</span>
  </div>
</template>
