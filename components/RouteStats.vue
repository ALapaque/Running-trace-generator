<script setup lang="ts">
import { computed } from 'vue'
import { PACE_MIN_PER_KM } from '../config'
import type { AnalyzedRoute } from '../types'

const props = defineProps<{ route: AnalyzedRoute }>()

const distanceKm = computed(() => props.route.distanceM / 1000)
const durationMin = computed(() => distanceKm.value * PACE_MIN_PER_KM)
const hh = computed(() => Math.floor(durationMin.value / 60))
const mm = computed(() => Math.round(durationMin.value % 60))
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="rounded-md border border-slate-200 bg-white p-3">
      <p class="text-[10px] uppercase tracking-wide text-slate-500">Distance</p>
      <p class="text-lg font-semibold text-slate-900">{{ distanceKm.toFixed(2) }} km</p>
    </div>
    <div class="rounded-md border border-slate-200 bg-white p-3">
      <p class="text-[10px] uppercase tracking-wide text-slate-500">D+</p>
      <p class="text-lg font-semibold text-slate-900">{{ Math.round(route.elevationGainM) }} m</p>
    </div>
    <div class="rounded-md border border-slate-200 bg-white p-3">
      <p class="text-[10px] uppercase tracking-wide text-slate-500">D-</p>
      <p class="text-lg font-semibold text-slate-900">{{ Math.round(route.elevationLossM) }} m</p>
    </div>
    <div class="rounded-md border border-slate-200 bg-white p-3">
      <p class="text-[10px] uppercase tracking-wide text-slate-500">Temps estimé</p>
      <p class="text-lg font-semibold text-slate-900">{{ hh }}h{{ mm.toString().padStart(2, '0') }}</p>
    </div>
  </div>
</template>
