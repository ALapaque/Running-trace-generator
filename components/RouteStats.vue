<script setup lang="ts">
import { computed } from 'vue'
import { useCountUp } from '../composables/useCountUp'
import { useI18n } from '../composables/useI18n'
import type { AnalyzedRoute } from '../types'

const { t } = useI18n()

const props = defineProps<{
  route: AnalyzedRoute
  /** Allure de course en min/km, pour le temps estimé. */
  pace: number
}>()

// Valeurs animées (count-up) — réagissent au changement de parcours.
const distanceKm = useCountUp(() => props.route.distanceM / 1000)
const gainM = useCountUp(() => props.route.elevationGainM)
const lossM = useCountUp(() => props.route.elevationLossM)
const durationMin = useCountUp(() => (props.route.distanceM / 1000) * props.pace)

const hh = computed(() => Math.floor(durationMin.value / 60))
const mm = computed(() => Math.round(durationMin.value % 60))
const timeLabel = computed(() =>
  hh.value > 0 ? `${hh.value}h${mm.value.toString().padStart(2, '0')}` : `${mm.value}m`,
)
</script>

<template>
  <!-- 2 colonnes sur mobile (évite le chevauchement des gros chiffres), 4 sur large -->
  <div class="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4">
    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ distanceKm.toFixed(2) }}</span>
        <span class="text-unit text-ink-500">km</span>
      </p>
      <p class="mt-1 text-label text-ink-500">{{ t('stats.distance') }}</p>
    </div>

    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ hh > 0 ? hh : mm }}</span>
        <span class="text-unit text-ink-500">{{ hh > 0 ? 'h' : 'm' }}</span>
        <span v-if="hh > 0" class="text-stat-sm tabular-nums">{{ mm.toString().padStart(2, '0') }}</span>
        <span v-if="hh > 0" class="text-unit text-ink-500">m</span>
      </p>
      <p class="mt-1 text-label text-ink-500">{{ t('stats.time') }}</p>
    </div>

    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ Math.round(gainM) }}</span>
        <span class="text-unit text-ink-500">m</span>
      </p>
      <p class="mt-1 text-label text-ink-500">{{ t('stats.gain') }}</p>
    </div>

    <div class="flex flex-col items-start">
      <p class="flex items-baseline gap-1">
        <span class="text-stat tabular-nums">{{ Math.round(lossM) }}</span>
        <span class="text-unit text-ink-500">m</span>
      </p>
      <p class="mt-1 text-label text-ink-500">{{ t('stats.loss') }}</p>
    </div>

    <span class="sr-only">{{ timeLabel }}</span>
  </div>
</template>
