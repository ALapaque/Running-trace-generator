<script setup lang="ts">
/**
 * Profil altimétrique (SVG natif) style Komoot : aire verte douce, ligne fine,
 * lignes de référence en pointillés, étiquettes m (axe Y) et km (axe X).
 *
 * Interactif : au survol (souris) ou au glissé (tactile), un curseur vertical
 * + une infobulle montrent altitude et distance au point pointé. Le point est
 * remonté via l'événement `hover` pour être matérialisé sur la carte.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from '../composables/useI18n'
import { CHART_COLORS } from '../config'
import type { RoutePoint } from '../types/ors'

const props = defineProps<{ points: RoutePoint[] }>()
const emit = defineEmits<{ (e: 'hover', point: RoutePoint | null): void }>()
const { t } = useI18n()

const VIEW_W = 640
const VIEW_H = 180
const PAD = { top: 8, right: 8, bottom: 28, left: 48 }
const MAX_SAMPLES = 200
const TOOLTIP_W = 116

interface Sample {
  x: number
  y: number
  point: RoutePoint
}
interface Computed {
  d: string
  area: string
  samples: Sample[]
  refLines: Array<{ y: number; label: string }>
  xTicks: Array<{ x: number; label: string }>
}

const path = computed<Computed>(() => {
  const pts = props.points
  if (pts.length < 2) {
    return { d: '', area: '', samples: [], refLines: [], xTicks: [] }
  }
  // Décimation : ~MAX_SAMPLES points, en gardant les RoutePoint (lat/lng).
  const step = Math.max(1, Math.floor(pts.length / MAX_SAMPLES))
  const sampled: RoutePoint[] = []
  for (let i = 0; i < pts.length; i += step) sampled.push(pts[i]!)
  const last = pts[pts.length - 1]!
  if (sampled[sampled.length - 1] !== last) sampled.push(last)

  const eles = sampled.map((p) => p.ele)
  const minRaw = Math.min(...eles)
  const maxRaw = Math.max(...eles)
  const maxDist = Math.max(last.distance / 1000, 0.001)

  // Snap des bornes Y à des paliers ronds pour des labels lisibles.
  const range = Math.max(20, maxRaw - minRaw)
  const stepEle = range > 800 ? 200 : range > 300 ? 100 : range > 100 ? 50 : range > 30 ? 20 : 10
  const minEle = Math.floor(minRaw / stepEle) * stepEle
  const maxEle = Math.ceil(maxRaw / stepEle) * stepEle
  const visibleRange = Math.max(stepEle, maxEle - minEle)

  const xScale = (km: number) => PAD.left + (km / maxDist) * (VIEW_W - PAD.left - PAD.right)
  const yScale = (m: number) =>
    PAD.top + (1 - (m - minEle) / visibleRange) * (VIEW_H - PAD.top - PAD.bottom)

  const samples: Sample[] = sampled.map((p) => ({
    x: xScale(p.distance / 1000),
    y: yScale(p.ele),
    point: p,
  }))
  const d = `M${samples.map((s) => `${s.x.toFixed(1)},${s.y.toFixed(1)}`).join(' L')}`
  const area = `${d} L${xScale(maxDist).toFixed(1)},${(VIEW_H - PAD.bottom).toFixed(1)} L${PAD.left},${(VIEW_H - PAD.bottom).toFixed(1)} Z`

  const refLines: Array<{ y: number; label: string }> = []
  for (let v = minEle; v <= maxEle; v += stepEle) {
    refLines.push({ y: yScale(v), label: `${v} m` })
  }

  const xTickCount = 4
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) => {
    const dist = (maxDist / xTickCount) * i
    return { x: xScale(dist), label: dist === 0 ? '0 m' : `${dist.toFixed(2)} km` }
  })

  return { d, area, samples, refLines, xTicks }
})

/** Résumé textuel du profil pour les lecteurs d'écran. */
const summary = computed(() => {
  const pts = props.points
  if (pts.length < 2) return t('elevation.title')
  const eles = pts.map((p) => p.ele)
  return t('elevation.summary', {
    dist: (pts[pts.length - 1]!.distance / 1000).toFixed(1),
    min: Math.round(Math.min(...eles)),
    max: Math.round(Math.max(...eles)),
  })
})

// --- Curseur interactif ---
const svgEl = ref<SVGSVGElement | null>(null)
const cursorIndex = ref<number | null>(null)

const cursor = computed(() =>
  cursorIndex.value === null ? null : (path.value.samples[cursorIndex.value] ?? null),
)

/** Infobulle clampée pour rester dans le cadre. */
const tooltipX = computed(() => {
  if (!cursor.value) return 0
  return Math.min(
    Math.max(cursor.value.x - TOOLTIP_W / 2, PAD.left),
    VIEW_W - PAD.right - TOOLTIP_W,
  )
})
const tooltipLabel = computed(() => {
  if (!cursor.value) return ''
  const p = cursor.value.point
  return `${(p.distance / 1000).toFixed(2)} km · ${Math.round(p.ele)} m`
})

function updateCursor(e: PointerEvent): void {
  const svg = svgEl.value
  const samples = path.value.samples
  if (!svg || samples.length === 0) return
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0) return
  const svgX = ((e.clientX - rect.left) / rect.width) * VIEW_W
  // Échantillon le plus proche horizontalement.
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < samples.length; i++) {
    const dx = Math.abs(samples[i]!.x - svgX)
    if (dx < bestDist) {
      bestDist = dx
      best = i
    }
  }
  cursorIndex.value = best
  emit('hover', samples[best]!.point)
}

function clearCursor(): void {
  if (cursorIndex.value === null) return
  cursorIndex.value = null
  emit('hover', null)
}

/** Tactile : le curseur suit le doigt et disparaît au relâché. Souris : on
 *  garde l'affichage, c'est `pointerleave` qui le retire. */
function onPointerUp(e: PointerEvent): void {
  if (e.pointerType !== 'mouse') clearCursor()
}

// Le tracé change → l'index de curseur deviendrait obsolète.
watch(
  () => props.points,
  () => clearCursor(),
)
</script>

<template>
  <div>
    <header class="mb-2 flex items-center justify-between">
      <h2 class="text-base font-bold text-ink-900">{{ t('elevation.title') }}</h2>
    </header>
    <svg
      ref="svgEl"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      class="h-auto w-full"
      style="touch-action: pan-y"
      role="img"
      :aria-label="summary"
      @pointerdown="updateCursor"
      @pointermove="updateCursor"
      @pointerleave="clearCursor"
      @pointercancel="clearCursor"
      @pointerup="onPointerUp"
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

      <!-- Aire dégradée + ligne. `:key` rejoue l'anim au changement de tracé. -->
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

      <!-- Axe X -->
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
          v-for="(tk, i) in path.xTicks"
          :key="`xt-${i}`"
          :x="tk.x"
          :y="VIEW_H - PAD.bottom + 16"
          :text-anchor="i === 0 ? 'start' : i === path.xTicks.length - 1 ? 'end' : 'middle'"
        >
          {{ tk.label }}
        </text>
      </g>

      <!-- Curseur interactif (survol / glissé) -->
      <g v-if="cursor" aria-hidden="true">
        <line
          :x1="cursor.x"
          :x2="cursor.x"
          :y1="PAD.top"
          :y2="VIEW_H - PAD.bottom"
          :stroke="CHART_COLORS.line"
          stroke-width="1"
          stroke-dasharray="3 3"
        />
        <circle :cx="cursor.x" :cy="cursor.y" r="4" :fill="CHART_COLORS.line" stroke="#FCFBF7" stroke-width="2" />
        <g :transform="`translate(${tooltipX}, ${PAD.top})`">
          <rect :width="TOOLTIP_W" height="20" rx="6" fill="#FCFBF7" :stroke="CHART_COLORS.axis" stroke-width="1" />
          <text
            :x="TOOLTIP_W / 2"
            y="14"
            text-anchor="middle"
            font-size="11"
            font-weight="600"
            :fill="CHART_COLORS.text"
          >
            {{ tooltipLabel }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
