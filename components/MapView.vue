<script setup lang="ts">
/**
 * Carte Leaflet :
 *  - Affiche un marker pour le point de départ (clic pour le déplacer).
 *  - Affiche la polyline du parcours sélectionné, colorée par type de chemin (segments).
 *  - Tiles OpenStreetMap (attribution requise).
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { LatLng } from '../types/ors'
import type { AnalyzedRoute } from '../types'
import { PATH_COLORS } from '../config'
import type { PathType } from '../types/osm'

const props = defineProps<{
  start: LatLng | null
  route: AnalyzedRoute | null
}>()

const emit = defineEmits<{ (e: 'pickStart', position: LatLng): void }>()

const mapEl = ref<HTMLDivElement | null>(null)

// Refs Leaflet (typés via import dynamique).
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

onMounted(async () => {
  if (!mapEl.value) return
  const L = await loadLeaflet()
  const initial = props.start ?? { lat: 50.8503, lng: 4.3517 } // Bruxelles par défaut

  map = L.map(mapEl.value, { zoomControl: true }).setView([initial.lat, initial.lng], 13)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  marker = L.marker([initial.lat, initial.lng], { draggable: true }).addTo(map)
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
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => props.start,
  (s) => {
    if (!s || !marker || !map || !LRef) return
    marker.setLatLng([s.lat, s.lng])
    map.panTo([s.lat, s.lng])
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

  // On dessine la polyline en segments colorés selon le type détecté.
  // Les segments sont indexés par décimation à ~50m ; on reproduit la coloration
  // sur la polyline complète en associant chaque point au segment décimé le plus proche.
  const colorByIndex = new Map<number, string>()
  const segByPointIdx = new Map<number, PathType | 'unknown'>()

  // segments[i].index est l'indice dans le tableau décimé, pas dans points.
  // Pour rester simple : on reconstruit en partant des segments dans l'ordre.
  if (route.segments.length === 0) {
    L.polyline(route.points.map((p) => [p.lat, p.lng]), {
      color: PATH_COLORS.unknown,
      weight: 4,
      opacity: 0.85,
    }).addTo(routeLayer)
  } else {
    // Découpe l'ensemble des points en sous-tronçons à chaque changement de type.
    // On répartit `points` uniformément sur les `segments` (le ratio est cohérent
    // car les segments viennent d'une décimation linéaire).
    const ratio = route.points.length / route.segments.length
    let bucketStart = 0
    let currentType: PathType | 'unknown' = route.segments[0]!.pathType
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
              weight: 4,
              opacity: 0.9,
            },
          ).addTo(routeLayer)
        }
        bucketStart = bucketEnd
        currentType = type
      }
    }
  }

  // Recadre la vue.
  const bounds = L.latLngBounds(route.points.map((p) => [p.lat, p.lng]))
  map.fitBounds(bounds, { padding: [40, 40] })

  // Suppression des warnings non utilisés (segByPointIdx, colorByIndex reservés pour évolution future).
  void colorByIndex
  void segByPointIdx
}
</script>

<template>
  <div ref="mapEl" class="h-full w-full" role="application" aria-label="Carte interactive du parcours" />
</template>
