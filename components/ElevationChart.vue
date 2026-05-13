<script setup lang="ts">
/**
 * Profil altimétrique léger en SVG natif (pas de Chart.js → bundle plus léger,
 * meilleure perf sur mobile, accessibilité plus simple).
 */
import { computed } from 'vue'
import { useElevationProfile } from '../composables/useElevationProfile'
import type { RoutePoint } from '../types/ors'

const props = defineProps<{ points: RoutePoint[] }>()

const profile = computed(() => useElevationProfile().build(props.points))

const VIEW_W = 600
const VIEW_H = 140
const PAD = { top: 8, right: 8, bottom: 22, left: 36 }

const path = computed(() => {
  const { labels, data } = profile.value
  if (labels.length === 0) return { d: '', area: '', minEle: 0, maxEle: 0, maxDist: 0 }
  const minEle = Math.min(...data)
  const maxEle = Math.max(...data)
  const maxDist = labels[labels.length - 1] ?? 1
  const xScale = (x: number) =>
    PAD.left + ((x / maxDist) * (VIEW_W - PAD.left - PAD.right))
  const range = Math.max(1, maxEle - minEle)
  const yScale = (y: number) =>
    PAD.top + (1 - (y - minEle) / range) * (VIEW_H - PAD.top - PAD.bottom)

  const points = labels.map((l, i) => `${xScale(l).toFixed(1)},${yScale(data[i]!).toFixed(1)}`)
  const d = `M${points.join(' L')}`
  const area = `${d} L${xScale(maxDist).toFixed(1)},${(VIEW_H - PAD.bottom).toFixed(1)} L${PAD.left},${(VIEW_H - PAD.bottom).toFixed(1)} Z`
  return { d, area, minEle, maxEle, maxDist }
})
</script>

<template>
  <div class="rounded-md border border-slate-200 bg-white p-3">
    <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Profil altimétrique</h3>
    <svg
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      class="w-full h-auto"
      role="img"
      aria-label="Profil altimétrique du parcours"
    >
      <path :d="path.area" fill="rgba(37,99,235,0.12)" />
      <path :d="path.d" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-linejoin="round" />

      <!-- Axes -->
      <line
        :x1="PAD.left"
        :y1="VIEW_H - PAD.bottom"
        :x2="VIEW_W - PAD.right"
        :y2="VIEW_H - PAD.bottom"
        stroke="#cbd5e1"
        stroke-width="0.6"
      />
      <text :x="PAD.left - 4" :y="PAD.top + 10" font-size="10" text-anchor="end" fill="#64748b">
        {{ Math.round(path.maxEle) }}m
      </text>
      <text
        :x="PAD.left - 4"
        :y="VIEW_H - PAD.bottom"
        font-size="10"
        text-anchor="end"
        fill="#64748b"
      >
        {{ Math.round(path.minEle) }}m
      </text>
      <text
        :x="VIEW_W - PAD.right"
        :y="VIEW_H - PAD.bottom + 14"
        font-size="10"
        text-anchor="end"
        fill="#64748b"
      >
        {{ path.maxDist.toFixed(1) }}km
      </text>
      <text :x="PAD.left" :y="VIEW_H - PAD.bottom + 14" font-size="10" fill="#64748b">0</text>
    </svg>
  </div>
</template>
