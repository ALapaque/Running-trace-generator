import { describe, expect, it } from 'vitest'
import { climbConcentration, detectClimbs } from '../utils/climbs'
import type { RoutePoint } from '../types/ors'

/** Construit un tracé à partir d'un profil d'altitudes (1 point tous les 100 m). */
function profile(eles: number[]): RoutePoint[] {
  return eles.map((ele, i) => ({ lat: 50 + i * 1e-4, lng: 4, ele, distance: i * 100 }))
}

describe('detectClimbs', () => {
  it('ne détecte aucune montée sur un tracé plat', () => {
    expect(detectClimbs(profile([100, 100, 100, 100, 100]))).toHaveLength(0)
  })

  it('ignore les ascensions sous le seuil de bruit (< 10 m)', () => {
    expect(detectClimbs(profile([100, 103, 105, 103, 100]))).toHaveLength(0)
  })

  it('détecte une montée unique et calcule son gain', () => {
    const climbs = detectClimbs(profile([100, 120, 140, 160, 160, 150, 140]))
    expect(climbs).toHaveLength(1)
    expect(climbs[0]!.gainM).toBeCloseTo(60, 5)
  })

  it('détecte plusieurs montées séparées par des descentes', () => {
    // monte 40, redescend 30, remonte 50
    const climbs = detectClimbs(
      profile([100, 120, 140, 130, 110, 130, 150, 160]),
    )
    expect(climbs.length).toBe(2)
  })

  it('calcule une pente moyenne cohérente', () => {
    // +50 m sur 300 m → ~16,7 %
    const climbs = detectClimbs(profile([100, 130, 150]))
    expect(climbs).toHaveLength(1)
    expect(climbs[0]!.gradient).toBeCloseTo((50 / 200) * 100, 1)
  })
})

describe('climbConcentration', () => {
  it('renvoie 0 sur un tracé plat', () => {
    expect(climbConcentration(profile([100, 100, 100, 100]))).toBe(0)
  })

  it('renvoie ~1 quand tout le D+ tient dans une seule montée', () => {
    const conc = climbConcentration(profile([100, 130, 160, 190, 190, 190]))
    expect(conc).toBeCloseTo(1, 5)
  })

  it('est plus faible pour un profil vallonné (plusieurs montées) que pour une seule grosse montée', () => {
    const rolling = climbConcentration(
      profile([100, 120, 105, 125, 108, 128, 110, 130]),
    )
    const single = climbConcentration(profile([100, 140, 180, 220, 260]))
    expect(rolling).toBeLessThan(single)
    expect(rolling).toBeGreaterThanOrEqual(0)
    expect(rolling).toBeLessThanOrEqual(1)
  })
})
