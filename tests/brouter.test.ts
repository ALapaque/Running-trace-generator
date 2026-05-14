import { describe, expect, it } from 'vitest'
import { BrouterError, mapBrouterProfile, parseBrouterResponse } from '../composables/useBrouterRouter'

/** Réponse GeoJSON BRouter minimale : 3 points, profil 100 → 130 → 110. */
function makeGeoJson(opts: { trackLength?: string } = {}) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: opts.trackLength === undefined ? {} : { 'track-length': opts.trackLength },
        geometry: {
          type: 'LineString',
          coordinates: [
            [4.0, 50.0, 100],
            [4.001, 50.001, 130],
            [4.002, 50.002, 110],
          ] as [number, number, number][],
        },
      },
    ],
  }
}

describe('mapBrouterProfile', () => {
  it('mappe chaque type de côte sur un profil BRouter valide', () => {
    expect(mapBrouterProfile('plat')).toBe('trekking')
    expect(mapBrouterProfile('vallonné')).toBe('trekking-steep')
    expect(mapBrouterProfile('montagneux')).toBe('hiking-mountain')
  })
})

describe('parseBrouterResponse', () => {
  it('transforme la réponse en RouteCandidate (coords [lon,lat,ele])', () => {
    const c = parseBrouterResponse(makeGeoJson({ trackLength: '1234' }), 'cand-7', 7)
    expect(c.id).toBe('cand-7')
    expect(c.seed).toBe(7)
    expect(c.routingEngine).toBe('brouter')
    expect(c.points).toHaveLength(3)
    // Ordre [lon, lat, ele] → {lat, lng, ele}
    expect(c.points[0]).toEqual({ lat: 50.0, lng: 4.0, ele: 100, distance: 0 })
    expect(c.points[1]!.lat).toBeCloseTo(50.001, 6)
    expect(c.points[1]!.lng).toBeCloseTo(4.001, 6)
    expect(c.points[1]!.ele).toBe(130)
  })

  it('lit la distance depuis `track-length`', () => {
    const c = parseBrouterResponse(makeGeoJson({ trackLength: '1234' }), 'x', 0)
    expect(c.distanceM).toBe(1234)
  })

  it('retombe sur la distance haversine cumulée si `track-length` absent', () => {
    const c = parseBrouterResponse(makeGeoJson(), 'x', 0)
    expect(c.distanceM).toBeGreaterThan(0)
    // Sans track-length, distanceM = distance cumulée du dernier point.
    expect(c.distanceM).toBeCloseTo(c.points[c.points.length - 1]!.distance, 6)
  })

  it('calcule D+ / D- en filtrant le bruit (100 → 130 → 110)', () => {
    const c = parseBrouterResponse(makeGeoJson({ trackLength: '1234' }), 'x', 0)
    expect(c.elevationGainM).toBe(30)
    expect(c.elevationLossM).toBe(20)
  })

  it('lance BrouterError si aucune feature', () => {
    expect(() => parseBrouterResponse({ features: [] }, 'x', 0)).toThrow(BrouterError)
    expect(() => parseBrouterResponse({}, 'x', 0)).toThrow(BrouterError)
  })

  it('lance BrouterError si la géométrie a moins de 2 points', () => {
    const oneCoord = {
      features: [{ geometry: { coordinates: [[4.0, 50.0, 100]] as [number, number, number][] } }],
    }
    expect(() => parseBrouterResponse(oneCoord, 'x', 0)).toThrow(BrouterError)
  })
})
