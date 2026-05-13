<script setup lang="ts">
/**
 * Profil altimétrique style Komoot : aire verte douce, ligne fine sage,
 * lignes horizontales de référence en pointillés gris clair,
 * étiquettes m sur l'axe Y (gauche), km sur l'axe X (bas).
 */
import { computed } from 'vue'
import { useElevationProfile } from '../composables/useElevationProfile'
import type { RoutePoint } from '../types/ors'

const props = defineProps<{ points: RoutePoint[] }>()

const profile = computed(() => useElevationProfile().build(props.points))

const VIEW_W = 640
const VIEW_H = 180
const PAD = { top: 8, right: 8, bottom: 28, left: 48 }

interface Computed {
  d: string
  area: string
  minEle: number
  maxEle: number
  maxDist: number
  /** Lignes de référence (3 paliers) en altitude. */
  refLines: Array<{ y: number; label: string }>
  xTicks: Array<{ x: number; label: string }>
}

const path = computed<Computed>(() => {
  const { labels, data } = profile.value
  if (labels.length === 0) {
    return { d: '', area: '', minEle: 0, maxEle: 0, maxDist: 0, refLines: [], xTicks: [] }
  }
  const minRaw = Math.min(...data)
  const maxRaw = Math.max(...data)
  const maxDist = labels[labels.length - 1] ?? 1

  // Snap des bornes Y à des paliers ronds (10/50/100) pour des labels lisibles.
  const range = Math.max(20, maxRaw - minRaw)
  const step = range > 800 ? 200 : range > 300 ? 100 : range > 100 ? 50 : range > 30 ? 20 : 10
  const minEle = Math.floor(minRaw / step) * step
  const maxEle = Math.ceil(maxRaw / step) * step
  const visibleRange = Math.max(step, maxEle - minEle)

  const xScale = (x: number) => PAD.left + (x / maxDist) * (VIEW_W - PAD.left - PAD.right)
  const yScale = (y: number) =>
    PAD.top + (1 - (y - minEle) / visibleRange) * (VIEW_H - PAD.top - PAD.bottom)

  const pts = labels.map((l, i) => `${xScale(l).toFixed(1)},${yScale(data[i]!).toFixed(1)}`)
  const d = `M${pts.join(' L')}`
  const area = `${d} L${xScale(maxDist).toFixed(1)},${(VIEW_H - PAD.bottom).toFixed(1)} L${PAD.left},${(VIEW_H - PAD.bottom).toFixed(1)} Z`

  const refLines: Array<{ y: number; label: string }> = []
  for (let v = minEle; v <= maxEle; v += step) {
    refLines.push({ y: yScale(v), label: `${v} m` })
  }

  const xTickCount = 4
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => {
    const dist = (maxDist / xTickCount) * i
    return { x: xScale(dist), label: dist === 0 ? '0 m' : `${dist.toFixed(2)} km` }
  })

  return { d, area, minEle, maxEle, maxDist, refLines, xTicks }
})
</script>

<template>
  <div>
    <header class="mb-2 flex items-center justify-between">
      <h3 class="text-base font-bold text-ink-900">Élévation</h3>
    </header>
    <svg
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      class="h-auto w-full"
      role="img"
      aria-label="Profil altimétrique du parcours"
    >
      <!-- Lignes de référence horizontales -->
      <g class="text-ink-300" stroke="currentColor" stroke-dasharray="3 4" stroke-width="0.6" fill="none">
        <line
          v-for="(r, i) in path.refLines"
          :key="`hl-${i}`"
          :x1="PAD.left"
          :x2="VIEW_W - PAD.right"
          :y1="r.y"
          :y2="r.y"
        />
      </g>
      <g fill="#6B6B6B" font-size="11">
        <text
          v-for="(r, i) in path.refLines"
          :key="`yl-${i}`"
          :x="PAD.left - 6"
          :y="r.y + 4"
          text-anchor="end"
        >
          {{ r.label }}
        </text>
      </g>

      <!-- Aire verte + ligne -->
      <path :d="path.area" fill="#D5E1B8" />
      <path :d="path.d" fill="none" stroke="#7FA866" stroke-width="2" stroke-linejoin="round" />

      <!-- Axes X -->
      <line
        :x1="PAD.left"
        :y1="VIEW_H - PAD.bottom"
        :x2="VIEW_W - PAD.right"
        :y2="VIEW_H - PAD.bottom"
        stroke="#D6D2C8"
        stroke-width="0.8"
      />
      <g fill="#6B6B6B" font-size="11">
        <text
          v-for="(t, i) in path.xTicks"
          :key="`xt-${i}`"
          :x="t.x"
          :y="VIEW_H - PAD.bottom + 16"
          :text-anchor="i === 0 ? 'start' : i === path.xTicks.length - 1 ? 'end' : 'middle'"
        >
          {{ t.label }}
        </text>
      </g>
    </svg>
  </div>
</template>
