<script setup lang="ts">
/**
 * Carte Leaflet plein écran (thème Outdoor naturel) :
 *  - Tiles CartoDB Voyager (clair, OSM data, parcs/eau colorés).
 *  - Marker rond vert forêt pour le départ, draggable.
 *  - Polyline colorée par type de chemin détecté — OU unicolore si l'analyse
 *    de terrain est indisponible (`route.terrainFallback`).
 *  - Marqueurs numérotés tous les ~10 % (1–10) sur la polyline.
 *  - `bottomInset` : hauteur du bottom sheet — le `fitBounds` réserve cet
 *    espace en bas pour que le tracé reste centré dans la zone visible.
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { LatLng } from '../types/ors'
import type { AnalyzedRoute } from '../types'
import { PATH_COLORS, ROUTE_DEFAULT_COLOR } from '../config'

const props = withDefaults(
  defineProps<{
    start: LatLng | null
    route: AnalyzedRoute | null
    /** Numéro de waypoints à afficher. Si false → polyline seule. */
    showWaypoints?: boolean
    /** Hauteur (px) occupée par le bottom sheet — réservée en bas du fitBounds. */
    bottomInset?: number
    /** Mode édition : affiche des waypoints déplaçables au lieu des markers fixes. */
    editable?: boolean
    /** Waypoints éditables (ordonnés, 0 = départ) — utilisés en mode édition. */
    editableWaypoints?: LatLng[]
  }>(),
  { showWaypoints: true, bottomInset: 0, editable: false, editableWaypoints: () => [] },
)

const emit = defineEmits<{
  (e: 'pickStart', position: LatLng): void
  (e: 'ready'): void
  (e: 'waypointMoved', index: number, position: LatLng): void
}>()

const mapEl = ref<HTMLDivElement | null>(null)

let map: import('leaflet').Map | null = null
let marker: import('leaflet').Marker | null = null
let routeLayer: import('leaflet').LayerGroup | null = null
let editLayer: import('leaflet').LayerGroup | null = null
let LRef: typeof import('leaflet') | null = null
/** rAF de l'animation « tracé qui se dessine » — annulé au redraw / démontage. */
let drawRaf = 0

async function loadLeaflet(): Promise<typeof import('leaflet')> {
  if (LRef) return LRef
  const mod = await import('leaflet')
  LRef = (mod as unknown as { default?: typeof import('leaflet') }).default ?? mod
  return LRef
}

function makeStartIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#2F6B3F;border:3px solid #FCFBF7;box-shadow:0 2px 6px rgba(42,42,38,0.35);"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function makeWaypointIcon(L: typeof import('leaflet'), n: number) {
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#FCFBF7;color:#2F6B3F;font-size:12px;font-weight:700;border:1.5px solid #2F6B3F;box-shadow:0 1px 4px rgba(42,42,38,0.3);">${n}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

/** Marker éditable (plus gros, halo « grab »). 0 = départ. */
function makeEditIcon(L: typeof import('leaflet'), n: number) {
  const isStart = n === 0
  const bg = isStart ? '#2F6B3F' : '#FCFBF7'
  const fg = isStart ? '#FCFBF7' : '#2F6B3F'
  const label = isStart ? '★' : String(n)
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${bg};color:${fg};font-size:13px;font-weight:700;border:2px solid #2F6B3F;box-shadow:0 0 0 4px rgba(47,107,63,0.18),0 2px 6px rgba(42,42,38,0.35);cursor:grab;">${label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

/** Padding fitBounds qui réserve la place du bottom sheet en bas. */
function boundsPadding(): {
  paddingTopLeft: [number, number]
  paddingBottomRight: [number, number]
} {
  return {
    paddingTopLeft: [40, 56],
    paddingBottomRight: [40, Math.round(props.bottomInset) + 40],
  }
}

function fitRoute(): void {
  if (!map || !LRef || !props.route) return
  const b = LRef.latLngBounds(props.route.points.map((p) => [p.lat, p.lng]))
  map.fitBounds(b, boundsPadding())
}

onMounted(async () => {
  if (!mapEl.value) return
  const L = await loadLeaflet()
  const initial = props.start ?? { lat: 50.4108, lng: 4.4446 } // Charleroi par défaut

  map = L.map(mapEl.value, {
    zoomControl: false,
    attributionControl: true,
  }).setView([initial.lat, initial.lng], 13)

  // CartoDB Voyager — clair, OSM data, parcs verts / eau bleue (ton outdoor).
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map)

  marker = L.marker([initial.lat, initial.lng], {
    draggable: true,
    icon: makeStartIcon(L),
  }).addTo(map)

  marker.on('dragend', () => {
    if (!marker) return
    const pos = marker.getLatLng()
    emit('pickStart', { lat: pos.lat, lng: pos.lng })
  })

  map.on('click', (e) => {
    if (!marker) return
    marker.setLatLng(e.latlng)
    emit('pickStart', { lat: e.latlng.lat, lng: e.latlng.lng })
  })

  routeLayer = L.layerGroup().addTo(map)
  editLayer = L.layerGroup().addTo(map)
  emit('ready')
})

onBeforeUnmount(() => {
  cancelAnimationFrame(drawRaf)
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => props.start,
  async (s) => {
    if (!s || !marker || !map) return
    await loadLeaflet()
    marker.setLatLng([s.lat, s.lng])
    if (!props.route) map.panTo([s.lat, s.lng])
  },
)

watch(
  () => props.route,
  (r) => {
    drawRoute(r)
  },
)

// Le bottom sheet a changé de taille → on recadre le tracé dans la zone visible.
watch(
  () => props.bottomInset,
  () => {
    if (props.route) fitRoute()
  },
)

// Mode édition : markers déplaçables. Le marker de départ + le clic-carte
// sont neutralisés tant qu'on édite (le départ devient le waypoint 0).
watch(
  [() => props.editable, () => props.editableWaypoints],
  () => {
    drawEditWaypoints()
    if (marker) marker.setOpacity(props.editable ? 0 : 1)
  },
  { deep: true },
)

async function drawEditWaypoints(): Promise<void> {
  if (!map || !editLayer) return
  const L = await loadLeaflet()
  editLayer.clearLayers()
  if (!props.editable) return
  props.editableWaypoints.forEach((wp, i) => {
    const m = L.marker([wp.lat, wp.lng], {
      draggable: true,
      icon: makeEditIcon(L, i),
      zIndexOffset: 1000,
    }).addTo(editLayer!)
    m.on('dragend', () => {
      const pos = m.getLatLng()
      emit('waypointMoved', i, { lat: pos.lat, lng: pos.lng })
    })
  })
}

interface ColorSeg {
  color: string
  /** Indices inclusifs dans route.points. */
  start: number
  end: number
}

/** Découpe le tracé en segments colorés contigus selon le type de chemin. */
function buildColorSegments(route: AnalyzedRoute): ColorSeg[] {
  const lastIdx = route.points.length - 1
  if (route.terrainFallback || route.segments.length === 0) {
    return [{ color: ROUTE_DEFAULT_COLOR, start: 0, end: lastIdx }]
  }
  const segs: ColorSeg[] = []
  const ratio = route.points.length / route.segments.length
  let bucketStart = 0
  let currentType = route.segments[0]!.pathType
  for (let i = 1; i <= route.segments.length; i++) {
    const type = i < route.segments.length ? route.segments[i]!.pathType : currentType
    if (type !== currentType || i === route.segments.length) {
      const bucketEnd = Math.min(lastIdx, Math.round(i * ratio))
      if (bucketEnd > bucketStart) {
        segs.push({
          color: PATH_COLORS[currentType as keyof typeof PATH_COLORS] ?? PATH_COLORS.unknown,
          start: bucketStart,
          end: bucketEnd,
        })
      }
      bucketStart = bucketEnd
      currentType = type
    }
  }
  return segs.length > 0 ? segs : [{ color: ROUTE_DEFAULT_COLOR, start: 0, end: lastIdx }]
}

function addWaypoints(L: typeof import('leaflet'), route: AnalyzedRoute): void {
  if (props.showWaypoints === false || props.editable || route.points.length <= 10) return
  const total = route.points.length
  for (let i = 1; i <= 10; i++) {
    const idx = Math.min(total - 1, Math.floor((total / 10) * i))
    const p = route.points[idx]!
    L.marker([p.lat, p.lng], { icon: makeWaypointIcon(L, i), interactive: false }).addTo(
      routeLayer!,
    )
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

async function drawRoute(route: AnalyzedRoute | null): Promise<void> {
  if (!map || !routeLayer) return
  const L = await loadLeaflet()
  cancelAnimationFrame(drawRaf)
  routeLayer.clearLayers()
  if (!route) return

  const segs = buildColorSegments(route)
  const latlngs = route.points.map((p) => [p.lat, p.lng] as [number, number])
  const opacityFor = (color: string) => (color === ROUTE_DEFAULT_COLOR ? 0.95 : 1)

  // Une polyline (vide au départ) par segment coloré.
  const lines = segs.map((s) =>
    L.polyline([], { color: s.color, weight: 5, opacity: opacityFor(s.color) }).addTo(
      routeLayer!,
    ),
  )

  /** Affiche le tracé jusqu'au point `reveal` inclus. */
  const renderUpTo = (reveal: number): void => {
    segs.forEach((s, idx) => {
      const end = Math.min(s.end, reveal)
      lines[idx]!.setLatLngs(end > s.start ? latlngs.slice(s.start, end + 1) : [])
    })
  }

  // Recadre d'abord, puis dessine dans la zone visible.
  map.fitBounds(L.latLngBounds(latlngs), boundsPadding())

  const lastIdx = route.points.length - 1
  // Pas d'animation en mode édition (re-routages fréquents) ni si reduced-motion.
  if (props.editable || prefersReducedMotion() || lastIdx < 8) {
    renderUpTo(lastIdx)
    addWaypoints(L, route)
    return
  }

  // Révélation progressive : le tracé « se dessine » du départ vers l'arrivée.
  const DURATION_MS = 750
  const easeOut = (t: number) => 1 - (1 - t) ** 3
  const startT = performance.now()
  const step = (now: number): void => {
    const t = Math.min(1, (now - startT) / DURATION_MS)
    renderUpTo(Math.floor(lastIdx * easeOut(t)))
    if (t < 1) {
      drawRaf = requestAnimationFrame(step)
    } else {
      renderUpTo(lastIdx)
      addWaypoints(L, route)
    }
  }
  drawRaf = requestAnimationFrame(step)
}

/** API exposée au parent. */
function recenter(): void {
  if (!map) return
  if (props.route) {
    fitRoute()
  } else if (props.start) {
    map.panTo([props.start.lat, props.start.lng])
  }
}

function zoomIn(): void {
  map?.zoomIn()
}
function zoomOut(): void {
  map?.zoomOut()
}

defineExpose({ recenter, zoomIn, zoomOut })
</script>

<template>
  <div ref="mapEl" class="h-full w-full" role="application" aria-label="Carte interactive du parcours" />
</template>
