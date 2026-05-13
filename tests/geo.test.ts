import { describe, expect, it } from 'vitest'
import {
  computeBBox,
  decimateByDistance,
  haversineM,
  pointToSegmentDistanceM,
  roundBBox,
} from '../utils/geo'

describe('haversineM', () => {
  it('renvoie ~0 pour le même point', () => {
    expect(haversineM({ lat: 50.85, lng: 4.35 }, { lat: 50.85, lng: 4.35 })).toBeLessThan(0.01)
  })

  it('mesure une distance connue (Bruxelles ↔ Paris ~263 km)', () => {
    const d = haversineM({ lat: 50.8503, lng: 4.3517 }, { lat: 48.8566, lng: 2.3522 })
    expect(d).toBeGreaterThan(260_000)
    expect(d).toBeLessThan(266_000)
  })
})

describe('computeBBox', () => {
  it('englobe tous les points et applique la marge', () => {
    const bbox = computeBBox(
      [
        { lat: 50.85, lng: 4.35 },
        { lat: 50.86, lng: 4.36 },
        { lat: 50.84, lng: 4.34 },
      ],
      0.001,
    )
    expect(bbox.south).toBeCloseTo(50.839, 4)
    expect(bbox.north).toBeCloseTo(50.861, 4)
    expect(bbox.west).toBeCloseTo(4.339, 4)
    expect(bbox.east).toBeCloseTo(4.361, 4)
  })
})

describe('decimateByDistance', () => {
  it('conserve premier et dernier point', () => {
    const pts = [
      { lat: 50.85, lng: 4.35 },
      { lat: 50.8501, lng: 4.3501 },
      { lat: 50.8502, lng: 4.3502 },
      { lat: 50.851, lng: 4.351 },
    ]
    const out = decimateByDistance(pts, 100)
    expect(out[0]).toBe(pts[0])
    expect(out[out.length - 1]).toBe(pts[pts.length - 1])
  })

  it("réduit le nombre de points avec un intervalle large", () => {
    const pts = Array.from({ length: 200 }, (_, i) => ({
      lat: 50.85 + i * 0.00001, // ~1 m entre chaque
      lng: 4.35,
    }))
    const out = decimateByDistance(pts, 50)
    expect(out.length).toBeLessThan(pts.length)
    expect(out.length).toBeGreaterThan(2)
  })
})

describe('pointToSegmentDistanceM', () => {
  it('mesure ~0 quand le point est sur le segment', () => {
    const d = pointToSegmentDistanceM(
      { lat: 50.85, lng: 4.35 },
      { lat: 50.85, lng: 4.35 },
      { lat: 50.86, lng: 4.36 },
    )
    expect(d).toBeLessThan(0.5)
  })

  it("renvoie la distance Haversine quand le point projette au-delà de l'extrémité", () => {
    const a = { lat: 50.85, lng: 4.35 }
    const b = { lat: 50.85, lng: 4.351 }
    const p = { lat: 50.85, lng: 4.34 }
    const d = pointToSegmentDistanceM(p, a, b)
    expect(d).toBeGreaterThan(500)
    expect(d).toBeLessThan(1500)
  })
})

describe('roundBBox', () => {
  it('arrondit à la précision demandée', () => {
    const bbox = { south: 50.852, west: 4.357, north: 50.866, east: 4.378 }
    const r = roundBBox(bbox, 0.01)
    expect(r.south).toBeCloseTo(50.85, 4)
    expect(r.west).toBeCloseTo(4.36, 4)
    expect(r.north).toBeCloseTo(50.87, 4)
    expect(r.east).toBeCloseTo(4.38, 4)
  })
})
