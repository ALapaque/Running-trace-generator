<script setup lang="ts">
/**
 * Profil altimétrique style Komoot : aire verte douce, ligne fine sage,
 * lignes horizontales de référence en pointillés gris clair,
 * étiquettes m sur l'axe Y (gauche), km sur l'axe X (bas).
 */
import { computed } from 'vue'
import { useElevationProfile } from '../composables/useElevationProfile'
import { useI18n } from '../composables/useI18n'
import { CHART_COLORS } from '../config'
import type { RoutePoint } from '../types/ors'

const props = defineProps<{ points: RoutePoint[] }>()
const { t } = useI18n()

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
      <h2 class="text-base font-bold text-ink-900">{{ t('elevation.title') }}</h2>
    </header>
    <svg
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      class="h-auto w-full"
      role="img"
      :aria-label="t('elevation.title')"
    >
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="CHART_COLORS.area" stop-opacity="0.5" />
          <stop offset="100%" :stop-color="CHART_COLORS.area" stop-opacity="0.06" />
        </linearGradient>
      </defs>

      <!-- Lignes de référence horizontales -->
      <g :stroke="CHART_COLORS.refLine" stroke-dasharray="3 4" stroke-width="0.8" fill="none">
        <line
          v-for="(r, i) in path.refLines"
          :key="`hl-${i}`"
          :x1="PAD.left"
          :x2="VIEW_W - PAD.right"
          :y1="r.y"
          :y2="r.y"
        />
      </g>
      <g :fill="CHART_COLORS.text" font-size="11">
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

      <!-- Aire dégradée + ligne verte. `:key` rejoue l'anim au changement de tracé. -->
      <path :key="`area-${path.d.length}`" class="chart-area" :d="path.area" fill="url(#area-grad)" />
      <path
        :key="`line-${path.d.length}`"
        class="chart-line"
        :d="path.d"
        pathLength="1"
        fill="none"
        :stroke="CHART_COLORS.line"
        stroke-width="2"
        stroke-linejoin="round"
      />

      <!-- Axes X -->
      <line
        :x1="PAD.left"
        :y1="VIEW_H - PAD.bottom"
        :x2="VIEW_W - PAD.right"
        :y2="VIEW_H - PAD.bottom"
        :stroke="CHART_COLORS.axis"
        stroke-width="0.8"
      />
      <g :fill="CHART_COLORS.text" font-size="11">
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
