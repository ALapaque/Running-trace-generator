<script setup lang="ts">
/**
 * Carte Leaflet plein écran style Komoot :
 *  - Tiles OSM avec attribution discrète.
 *  - Marker rond personnalisé (vert olive) pour le départ, draggable.
 *  - Polyline composée de segments colorés par type de chemin détecté.
 *  - Marqueurs numérotés tous les ~10% (1–10) sur la polyline pour mimer Komoot.
 *  - Boutons zoom retirés (gérés par FAB externe ou contrôle natif Leaflet).
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { LatLng } from '../types/ors'
import type { AnalyzedRoute } from '../types'
import { PATH_COLORS } from '../config'

const props = defineProps<{
  start: LatLng | null
  route: AnalyzedRoute | null
  /** Numéro de waypoints à afficher (Komoot-style). Si false → polyline seule. */
  showWaypoints?: boolean
}>()

const emit = defineEmits<{
  (e: 'pickStart', position: LatLng): void
  (e: 'ready'): void
}>()

const mapEl = ref<HTMLDivElement | null>(null)

let map: import('leaflet').Map | null = null
let marker: import('leaflet').Marker | null = null
let routeLayer: import('leaflet').LayerGroup | null = null
let LRef: typeof import('leaflet') | null = null

async function loadLeaflet(): Promise<typeof import('leaflet')> {
  if (LRef) return LRef
  const mod = await import('leaflet')
  LRef = (mod as unknown as { default?: typeof import('leaflet') }).default ?? mod
  return LRef
}

function makeStartIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    className: '',
    html: `
      <span class="block h-6 w-6 rounded-full bg-olive-900 ring-4 ring-white shadow-float"
            style="background:#3D4A2A;border:4px solid white;border-radius:9999px;width:24px;height:24px;display:block;box-shadow:0 4px 12px -2px rgba(26,26,26,0.18);"></span>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function makeWaypointIcon(L: typeof import('leaflet'), n: number) {
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#1A1A1A;color:white;font-size:12px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px -1px rgba(0,0,0,0.3);">${n}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

onMounted(async () => {
  if (!mapEl.value) return
  const L = await loadLeaflet()
  const initial = props.start ?? { lat: 50.4108, lng: 4.4446 } // Charleroi par défaut

  map = L.map(mapEl.value, {
    zoomControl: false,
    attributionControl: true,
  }).setView([initial.lat, initial.lng], 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
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
  emit('ready')
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => props.start,
  async (s) => {
    if (!s || !marker || !map) return
    const L = await loadLeaflet()
    marker.setLatLng([s.lat, s.lng])
    if (!props.route) map.panTo([s.lat, s.lng])
    void L
  },
)

watch(
  () => props.route,
  (r) => {
    drawRoute(r)
  },
)

async function drawRoute(route: AnalyzedRoute | null): Promise<void> {
  if (!map || !routeLayer) return
  const L = await loadLeaflet()
  routeLayer.clearLayers()
  if (!route) return

  if (route.segments.length === 0) {
    L.polyline(
      route.points.map((p) => [p.lat, p.lng]),
      { color: PATH_COLORS.unknown, weight: 5, opacity: 0.9 },
    ).addTo(routeLayer)
  } else {
    const ratio = route.points.length / route.segments.length
    let bucketStart = 0
    let currentType = route.segments[0]!.pathType
    for (let i = 1; i <= route.segments.length; i++) {
      const type = i < route.segments.length ? route.segments[i]!.pathType : currentType
      if (type !== currentType || i === route.segments.length) {
        const bucketEnd = Math.min(route.points.length, Math.round(i * ratio))
        const slice = route.points.slice(bucketStart, bucketEnd + 1)
        if (slice.length >= 2) {
          L.polyline(
            slice.map((p) => [p.lat, p.lng]),
            {
              color: PATH_COLORS[currentType as keyof typeof PATH_COLORS] ?? PATH_COLORS.unknown,
              weight: 5,
              opacity: 0.95,
            },
          ).addTo(routeLayer)
        }
        bucketStart = bucketEnd
        currentType = type
      }
    }
  }

  // Marqueurs numérotés (style Komoot) sur 10 paliers réguliers
  if (props.showWaypoints !== false && route.points.length > 10) {
    const total = route.points.length
    for (let i = 1; i <= 10; i++) {
      const idx = Math.min(total - 1, Math.floor((total / 10) * i))
      const p = route.points[idx]!
      L.marker([p.lat, p.lng], { icon: makeWaypointIcon(L, i), interactive: false }).addTo(
        routeLayer,
      )
    }
  }

  const bounds = L.latLngBounds(route.points.map((p) => [p.lat, p.lng]))
  map.fitBounds(bounds, { padding: [60, 60] })
}

/** API exposée au parent (pour le bouton "recentrer"). */
function recenter(): void {
  if (!map) return
  if (props.route) {
    if (!LRef) return
    const b = LRef.latLngBounds(props.route.points.map((p) => [p.lat, p.lng]))
    map.fitBounds(b, { padding: [60, 60] })
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
