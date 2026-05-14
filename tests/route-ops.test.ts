import { describe, expect, it } from 'vitest'
import { reverseRoute } from '../utils/route-ops'
import { haversineM } from '../utils/geo'
import type { AnalyzedRoute } from '../types'
import type { RoutePoint } from '../types/ors'

/** Parcours minimal : profil montant 100 → 160 puis descendant à 110. */
function makeRoute(): AnalyzedRoute {
  const eles = [100, 120, 140, 160, 140, 110]
  let dist = 0
  // Distance cumulée cohérente avec les coordonnées (haversine).
  const points: RoutePoint[] = eles.map((ele, i, arr) => {
    if (i > 0) {
      dist += haversineM(
        { lat: 50 + (i - 1) * 1e-3, lng: 4 },
        { lat: 50 + i * 1e-3, lng: 4 },
      )
    }
    void arr
    return { lat: 50 + i * 1e-3, lng: 4, ele, distance: dist }
  })
  return {
    id: 'cand-1',
    seed: 1,
    points,
    distanceM: dist,
    elevationGainM: 60,
    elevationLossM: 50,
    terrain: { route: 0.5, chemin_large: 0, single: 0.5, mixte: 0, forest: 0, unknown: 0 },
    segments: [],
    score: 0.1,
    scoreBreakdown: { distance: 0, elevation: 0, terrain: 0, forest: 0, profile: 0 },
    climbConcentration: 1,
    terrainFallback: false,
  }
}

describe('reverseRoute', () => {
  it('inverse l’ordre des points et recalcule la distance cumulée', () => {
    const original = makeRoute()
    const r = reverseRoute(original)
    expect(r.points[0]!.ele).toBe(110)
    expect(r.points[r.points.length - 1]!.ele).toBe(100)
    expect(r.points[0]!.distance).toBe(0)
    // La longueur totale est inchangée (haversine symétrique).
    expect(r.points[r.points.length - 1]!.distance).toBeCloseTo(original.distanceM, 3)
  })

  it('échange D+ et D-', () => {
    const original = makeRoute()
    const r = reverseRoute(original)
    // Profil inversé : la descente devient montée et inversement.
    expect(r.elevationGainM).toBeCloseTo(original.elevationLossM, 5)
    expect(r.elevationLossM).toBeCloseTo(original.elevationGainM, 5)
  })

  it('est involutive (deux inversions ≈ original)', () => {
    const original = makeRoute()
    const twice = reverseRoute(reverseRoute(original))
    expect(twice.points.map((p) => p.ele)).toEqual(original.points.map((p) => p.ele))
    expect(twice.id).toBe(original.id)
    expect(twice.elevationGainM).toBeCloseTo(original.elevationGainM, 5)
  })

  it('préserve la distance totale et les stats de terrain', () => {
    const original = makeRoute()
    const r = reverseRoute(original)
    expect(r.points[r.points.length - 1]!.distance).toBeCloseTo(original.distanceM, 3)
    expect(r.terrain).toEqual(original.terrain)
  })
})
