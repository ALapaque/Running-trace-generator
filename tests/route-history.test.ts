import { describe, expect, it } from 'vitest'
import { historyEntryToRoute } from '../composables/useRouteHistory'
import type { RouteHistoryEntry } from '../types'

const entry: RouteHistoryEntry = {
  id: 'h1',
  ts: 1_700_000_000_000,
  distanceM: 10_000,
  elevationGainM: 180,
  elevationLossM: 175,
  points: [
    { lat: 50.85, lng: 4.35, ele: 100 },
    { lat: 50.851, lng: 4.351, ele: 110 },
    { lat: 50.852, lng: 4.352, ele: 105 },
  ],
  terrain: { route: 0.6, chemin_large: 0.2, single: 0.2, mixte: 0, forest: 0.1, unknown: 0 },
}

describe('historyEntryToRoute', () => {
  it('reconstruit un AnalyzedRoute affichable avec distance cumulée croissante', () => {
    const route = historyEntryToRoute(entry)
    expect(route.id).toBe('h1')
    expect(route.points).toHaveLength(3)
    expect(route.points[0]!.distance).toBe(0)
    expect(route.points[1]!.distance).toBeGreaterThan(0)
    expect(route.points[2]!.distance).toBeGreaterThan(route.points[1]!.distance)
  })

  it('conserve les stats de terrain quand elles existent (pas de fallback)', () => {
    const route = historyEntryToRoute(entry)
    expect(route.terrainFallback).toBe(false)
    expect(route.terrain.route).toBe(0.6)
  })

  it('passe en fallback quand le terrain est null', () => {
    const route = historyEntryToRoute({ ...entry, terrain: null })
    expect(route.terrainFallback).toBe(true)
    expect(route.segments).toEqual([])
  })

  it('reporte distance et dénivelés de l\'entrée', () => {
    const route = historyEntryToRoute(entry)
    expect(route.distanceM).toBe(10_000)
    expect(route.elevationGainM).toBe(180)
    expect(route.elevationLossM).toBe(175)
  })
})
