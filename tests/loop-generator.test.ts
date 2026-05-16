import { describe, expect, it } from 'vitest'
import {
  bearingsFromSeed,
  buildLoopWaypoints,
  circumradiusForPerimeter,
  destinationPoint,
  rescaleRadius,
} from '../utils/loop-generator'
import { haversineM } from '../utils/geo'

describe('circumradiusForPerimeter', () => {
  it('inverse correctement la formule : périmètre(R) = R puis R(P) = R', () => {
    // Pentagone régulier, R=1000m → périmètre = 5 * 2 * 1000 * sin(36°) ≈ 5878m
    const N = 5
    const R = 1000
    const perim = N * 2 * R * Math.sin(Math.PI / N)
    expect(circumradiusForPerimeter(perim, N)).toBeCloseTo(R, 6)
  })

  it('lève si numSides < 3', () => {
    expect(() => circumradiusForPerimeter(1000, 2)).toThrow()
  })
})

describe('bearingsFromSeed', () => {
  it('retourne N bearings dans [0, 360)', () => {
    const b = bearingsFromSeed(42, 5)
    expect(b).toHaveLength(5)
    for (const x of b) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(360)
    }
  })

  it('est déterministe pour un seed donné', () => {
    expect(bearingsFromSeed(123, 5)).toEqual(bearingsFromSeed(123, 5))
  })

  it('produit des séquences différentes pour des seeds différents', () => {
    expect(bearingsFromSeed(1, 5)).not.toEqual(bearingsFromSeed(2, 5))
  })

  it('espace les bearings de 360/N (à l\'offset près)', () => {
    const b = bearingsFromSeed(7, 5)
    // Tous les écarts successifs valent 72° (modulo wrap).
    for (let i = 1; i < b.length; i++) {
      const d = ((b[i]! - b[i - 1]! + 360) % 360)
      expect(d).toBeCloseTo(72, 6)
    }
  })
})

describe('destinationPoint', () => {
  const paris = { lat: 48.8566, lng: 2.3522 }

  it('100m vers l\'est → +0.0013° de longitude environ', () => {
    const p = destinationPoint(paris, 90, 100)
    // À 48° de latitude, 1 deg lng ≈ 73.5 km → 100m ≈ 0.00136°.
    expect(p.lat).toBeCloseTo(paris.lat, 4)
    expect(p.lng - paris.lng).toBeGreaterThan(0.0010)
    expect(p.lng - paris.lng).toBeLessThan(0.0017)
  })

  it('1 km plein nord → +0.009° de latitude environ', () => {
    const p = destinationPoint(paris, 0, 1000)
    expect(p.lng).toBeCloseTo(paris.lng, 4)
    // 1 km ≈ 0.00899° de latitude.
    expect(p.lat - paris.lat).toBeCloseTo(0.00899, 4)
  })

  it('aller-retour Haversine : distance(origin, dest) ≈ distance demandée', () => {
    for (const bearing of [0, 45, 90, 180, 270, 315]) {
      const p = destinationPoint(paris, bearing, 5000)
      expect(haversineM(paris, p)).toBeCloseTo(5000, 0)
    }
  })
})

describe('buildLoopWaypoints', () => {
  const start = { lat: 50.4108, lng: 4.4446 } // Charleroi
  const bearings = [0, 72, 144, 216, 288]
  const radius = 1500

  it('retourne N+2 points : départ + N sommets + retour au départ', () => {
    const wp = buildLoopWaypoints(start, bearings, radius)
    expect(wp).toHaveLength(bearings.length + 2)
  })

  it('premier et dernier waypoint sont le départ', () => {
    const wp = buildLoopWaypoints(start, bearings, radius)
    expect(wp[0]).toEqual(start)
    expect(wp[wp.length - 1]).toEqual(start)
  })

  it('chaque sommet est à `radiusM` du départ', () => {
    const wp = buildLoopWaypoints(start, bearings, radius)
    for (let i = 1; i < wp.length - 1; i++) {
      expect(haversineM(start, wp[i]!)).toBeCloseTo(radius, 0)
    }
  })
})

describe('rescaleRadius', () => {
  it('garde le rayon si on est pile dessus', () => {
    expect(rescaleRadius(1000, 10000, 10000)).toBeCloseTo(1000, 6)
  })

  it('réduit le rayon quand la distance routée dépasse la cible', () => {
    // Routé 15km pour cible 10km → ratio 0.667 → rayon × 0.667
    expect(rescaleRadius(1000, 15000, 10000)).toBeCloseTo(666.66, 1)
  })

  it('agrandit le rayon quand la distance routée est sous la cible', () => {
    expect(rescaleRadius(1000, 8000, 10000)).toBeCloseTo(1250, 1)
  })

  it('borne les variations extrêmes (cap par défaut ×2)', () => {
    // Routé 1km pour cible 10km → ratio 10× → bridé à 2×
    expect(rescaleRadius(1000, 1000, 10000)).toBeCloseTo(2000, 6)
    // Routé 100km pour cible 10km → ratio 0.1 → bridé à 0.5
    expect(rescaleRadius(1000, 100000, 10000)).toBeCloseTo(500, 6)
  })
})
