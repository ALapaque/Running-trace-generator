import { describe, expect, it } from 'vitest'
import { computeClimbConcentration, rangeError, useScoring } from '../composables/useScoring'
import type { RouteCandidate, RouteGenerationInput, RoutePoint } from '../types/ors'
import type { TerrainStats } from '../types/osm'

function makeFlatCandidate(distanceM: number, points = 100): RouteCandidate {
  const pts: RoutePoint[] = []
  for (let i = 0; i < points; i++) {
    pts.push({ lat: 50 + i * 0.0001, lng: 4, ele: 100, distance: (i * distanceM) / (points - 1) })
  }
  return { id: 'flat', seed: 1, points: pts, distanceM, elevationGainM: 0, elevationLossM: 0 }
}

function makeHillyCandidate(distanceM: number, gain: number, concentrated = false): RouteCandidate {
  const pts: RoutePoint[] = []
  const n = 100
  for (let i = 0; i < n; i++) {
    let ele = 100
    if (concentrated) {
      // Tout le gain est sur le quart milieu
      if (i >= 40 && i < 60) ele = 100 + ((i - 40) / 20) * gain
      else if (i >= 60) ele = 100 + gain
    } else {
      // Gain réparti
      ele = 100 + (i / (n - 1)) * gain
    }
    pts.push({ lat: 50 + i * 0.0001, lng: 4, ele, distance: (i * distanceM) / (n - 1) })
  }
  return {
    id: concentrated ? 'concentrated' : 'spread',
    seed: 2,
    points: pts,
    distanceM,
    elevationGainM: gain,
    elevationLossM: 0,
  }
}

const baseTerrain: TerrainStats = {
  route: 0,
  chemin_large: 0,
  single: 0,
  mixte: 0,
  forest: 0,
  unknown: 1,
}

describe('useScoring.scoreOne', () => {
  const { scoreOne } = useScoring()
  const request: RouteGenerationInput = {
    start: { lat: 50, lng: 4 },
    distanceKm: { min: 9, max: 11 },
    elevationGainM: { min: 80, max: 120 },
    terrain: 'single',
    preferForest: false,
    hills: 'plat',
  }

  it('produit un score bas quand distance et D+ matchent et terrain idéal', () => {
    const candidate = makeFlatCandidate(10_000)
    const terrain: TerrainStats = { ...baseTerrain, single: 0.9, unknown: 0.1 }
    const result = scoreOne(
      { candidate: { ...candidate, elevationGainM: 100 }, terrain, segments: [], fallback: false },
      request,
    )
    expect(result.score).toBeLessThan(0.1)
  })

  it("pénalise un parcours dont la distance s'éloigne de la cible", () => {
    const candidate = makeFlatCandidate(20_000) // 2x la cible
    const terrain: TerrainStats = { ...baseTerrain, single: 0.9, unknown: 0.1 }
    const result = scoreOne(
      { candidate: { ...candidate, elevationGainM: 100 }, terrain, segments: [], fallback: false },
      request,
    )
    expect(result.scoreBreakdown.distance).toBeGreaterThan(0.2)
  })

  it("pénalise un parcours dont le terrain ne correspond pas à la préférence", () => {
    const candidate = makeFlatCandidate(10_000)
    const terrainBad: TerrainStats = { ...baseTerrain, route: 1, unknown: 0 }
    const terrainGood: TerrainStats = { ...baseTerrain, single: 1, unknown: 0 }
    const bad = scoreOne(
      { candidate, terrain: terrainBad, segments: [], fallback: false },
      request,
    )
    const good = scoreOne(
      { candidate, terrain: terrainGood, segments: [], fallback: false },
      request,
    )
    expect(bad.score).toBeGreaterThan(good.score)
  })

  it('neutralise les pénalités terrain en mode fallback', () => {
    const candidate = makeFlatCandidate(10_000)
    const terrain = { ...baseTerrain, single: 0, unknown: 1 }
    const result = scoreOne(
      { candidate: { ...candidate, elevationGainM: 100 }, terrain, segments: [], fallback: true },
      request,
    )
    expect(result.scoreBreakdown.terrain).toBe(0)
    expect(result.scoreBreakdown.forest).toBe(0)
  })

  it('applique la pénalité forêt seulement quand le toggle est actif', () => {
    const candidate = makeFlatCandidate(10_000)
    const terrain = { ...baseTerrain, forest: 0, single: 1, unknown: 0 }
    const noForest = scoreOne(
      { candidate, terrain, segments: [], fallback: false },
      { ...request, preferForest: false },
    )
    const withForest = scoreOne(
      { candidate, terrain, segments: [], fallback: false },
      { ...request, preferForest: true },
    )
    expect(noForest.scoreBreakdown.forest).toBe(0)
    expect(withForest.scoreBreakdown.forest).toBeGreaterThan(0)
  })

  it('ignore la distance quand le critère distance est null', () => {
    // Candidat très loin de toute plage : sans contrainte distance, aucune pénalité.
    const candidate = makeFlatCandidate(42_000)
    const terrain: TerrainStats = { ...baseTerrain, single: 1, unknown: 0 }
    const result = scoreOne(
      { candidate, terrain, segments: [], fallback: false },
      { ...request, distanceKm: null },
    )
    expect(result.scoreBreakdown.distance).toBe(0)
  })

  it('ignore le dénivelé quand le critère dénivelé est null', () => {
    const candidate = { ...makeFlatCandidate(10_000), elevationGainM: 1500 }
    const terrain: TerrainStats = { ...baseTerrain, single: 1, unknown: 0 }
    const result = scoreOne(
      { candidate, terrain, segments: [], fallback: false },
      { ...request, elevationGainM: null },
    )
    expect(result.scoreBreakdown.elevation).toBe(0)
  })
})

describe('useScoring.rank', () => {
  it('trie du meilleur au pire et limite au top N', () => {
    const { rank } = useScoring()
    const request: RouteGenerationInput = {
      start: { lat: 50, lng: 4 },
      distanceKm: { min: 9, max: 11 },
      elevationGainM: { min: 80, max: 120 },
      terrain: 'single',
      preferForest: false,
      hills: 'plat',
    }
    const inputs = [
      {
        candidate: { ...makeFlatCandidate(30_000), id: 'far' },
        terrain: { ...baseTerrain, single: 1, unknown: 0 },
        segments: [],
        fallback: false,
      },
      {
        candidate: { ...makeFlatCandidate(10_000), id: 'good', elevationGainM: 100 },
        terrain: { ...baseTerrain, single: 1, unknown: 0 },
        segments: [],
        fallback: false,
      },
      {
        candidate: { ...makeFlatCandidate(12_000), id: 'okay', elevationGainM: 80 },
        terrain: { ...baseTerrain, single: 0.6, unknown: 0.4 },
        segments: [],
        fallback: false,
      },
      {
        candidate: { ...makeFlatCandidate(5_000), id: 'short' },
        terrain: { ...baseTerrain, single: 0.5, unknown: 0.5 },
        segments: [],
        fallback: false,
      },
    ]
    const top = rank(inputs, request, 3)
    expect(top).toHaveLength(3)
    expect(top[0]!.id).toBe('good')
    expect(top[0]!.score).toBeLessThanOrEqual(top[1]!.score)
    expect(top[1]!.score).toBeLessThanOrEqual(top[2]!.score)
  })
})

describe('computeClimbConcentration', () => {
  it('renvoie une concentration plus haute pour un D+ concentré', () => {
    const concentrated = computeClimbConcentration(makeHillyCandidate(10_000, 300, true))
    const spread = computeClimbConcentration(makeHillyCandidate(10_000, 300, false))
    expect(concentrated).toBeGreaterThan(spread)
  })

  it('reste borné dans [0, 1]', () => {
    const v = computeClimbConcentration(makeHillyCandidate(10_000, 300, true))
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(1)
  })
})

describe('rangeError', () => {
  it('renvoie 0 quand la valeur est dans la plage (bornes incluses)', () => {
    expect(rangeError(10, 8, 12)).toBe(0)
    expect(rangeError(8, 8, 12)).toBe(0)
    expect(rangeError(12, 8, 12)).toBe(0)
  })

  it('pénalise proportionnellement en dessous de la borne min', () => {
    // milieu de plage = 10 → (8 - 6) / 10 = 0.2
    expect(rangeError(6, 8, 12)).toBeCloseTo(0.2, 5)
  })

  it('pénalise proportionnellement au-dessus de la borne max', () => {
    // (16 - 12) / 10 = 0.4
    expect(rangeError(16, 8, 12)).toBeCloseTo(0.4, 5)
  })

  it('gère une plage dégénérée [0, 0] sans division par zéro', () => {
    expect(rangeError(0, 0, 0)).toBe(0)
    expect(Number.isFinite(rangeError(50, 0, 0))).toBe(true)
  })
})
