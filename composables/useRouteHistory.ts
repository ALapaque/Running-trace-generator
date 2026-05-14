/**
 * Historique des parcours générés (persistant, localStorage).
 *
 * On stocke une version allégée (points décimés, pas tous les segments) pour
 * rester sous le quota localStorage. Capé aux N entrées les plus récentes.
 */
import { computed } from 'vue'
import { GPX_DECIMATION_M } from '../config'
import { decimateByDistance, haversineM } from '../utils/geo'
import { useLocalStorage } from './useLocalStorage'
import type { AnalyzedRoute, RouteHistoryEntry } from '../types'
import type { RoutePoint, TerrainStats } from '../types'

const EMPTY_TERRAIN: TerrainStats = {
  route: 0,
  chemin_large: 0,
  single: 0,
  mixte: 0,
  forest: 0,
  unknown: 1,
}

/** Reconstruit un AnalyzedRoute affichable à partir d'une entrée d'historique. */
export function historyEntryToRoute(entry: RouteHistoryEntry): AnalyzedRoute {
  let dist = 0
  const points: RoutePoint[] = entry.points.map((p, i, arr) => {
    if (i > 0) {
      const prev = arr[i - 1]!
      dist += haversineM({ lat: prev.lat, lng: prev.lng }, { lat: p.lat, lng: p.lng })
    }
    return { lat: p.lat, lng: p.lng, ele: p.ele, distance: dist }
  })
  return {
    id: entry.id,
    seed: 0,
    points,
    distanceM: entry.distanceM,
    elevationGainM: entry.elevationGainM,
    elevationLossM: entry.elevationLossM,
    terrain: entry.terrain ?? EMPTY_TERRAIN,
    segments: [],
    score: 0,
    scoreBreakdown: { distance: 0, elevation: 0, terrain: 0, forest: 0, profile: 0 },
    climbConcentration: 0,
    terrainFallback: entry.terrain === null,
  }
}

const STORAGE_KEY = 'rungen:history:v1'
const MAX_ENTRIES = 12

export function useRouteHistory() {
  const entries = useLocalStorage<RouteHistoryEntry[]>(STORAGE_KEY, [])

  const list = computed(() => entries.value)

  function add(route: AnalyzedRoute): void {
    // Décimation à ~1 pt / 10 m : assez fin pour réafficher et ré-exporter.
    const decimated = decimateByDistance(route.points, GPX_DECIMATION_M)
    const entry: RouteHistoryEntry = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      ts: Date.now(),
      distanceM: route.distanceM,
      elevationGainM: route.elevationGainM,
      elevationLossM: route.elevationLossM,
      points: decimated.map((p) => ({
        lat: +p.lat.toFixed(6),
        lng: +p.lng.toFixed(6),
        ele: +p.ele.toFixed(1),
      })),
      terrain: route.terrainFallback ? null : route.terrain,
    }
    entries.value = [entry, ...entries.value].slice(0, MAX_ENTRIES)
  }

  function remove(id: string): void {
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  function clear(): void {
    entries.value = []
  }

  return { list, add, remove, clear }
}
