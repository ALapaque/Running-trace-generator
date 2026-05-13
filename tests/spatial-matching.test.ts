import { describe, expect, it } from 'vitest'
import {
  buildIndex,
  classifyPathType,
  findNearestWaySegment,
  isPointInForest,
} from '../utils/spatial-matching'
import type { OverpassWay } from '../types/osm'

const wayHighway = (id: number, tags: OverpassWay['tags'], coords: [number, number][]): OverpassWay => ({
  type: 'way',
  id,
  tags,
  geometry: coords.map(([lat, lon]) => ({ lat, lon })),
})

describe('classifyPathType', () => {
  it('classe residential asphalté en route', () => {
    expect(classifyPathType({ highway: 'residential', surface: 'asphalt' })).toBe('route')
  })

  it('classe tertiary sans surface en route (présumé bitumé)', () => {
    expect(classifyPathType({ highway: 'tertiary' })).toBe('route')
  })

  it('classe track en chemin_large', () => {
    expect(classifyPathType({ highway: 'track' })).toBe('chemin_large')
  })

  it('classe path sans largeur connue en single', () => {
    expect(classifyPathType({ highway: 'path' })).toBe('single')
  })

  it('classe path large (width>=2) en chemin_large', () => {
    expect(classifyPathType({ highway: 'path', width: '2.5' })).toBe('chemin_large')
  })

  it('classe footway en single par défaut', () => {
    expect(classifyPathType({ highway: 'footway' })).toBe('single')
  })

  it('classe residential non bitumé en chemin_large', () => {
    expect(classifyPathType({ highway: 'residential', surface: 'gravel' })).toBe('chemin_large')
  })

  it('renvoie unknown si pas de tag highway', () => {
    expect(classifyPathType({})).toBe('unknown')
  })
})

describe('buildIndex + findNearestWaySegment', () => {
  it('trouve un segment proche dans un rayon de 15m', () => {
    const ways: OverpassWay[] = [
      wayHighway(1, { highway: 'path' }, [
        [50.85, 4.35],
        [50.851, 4.351],
      ]),
    ]
    const idx = buildIndex(ways)
    const hit = findNearestWaySegment(idx, { lat: 50.8505, lng: 4.3505 }, 200)
    expect(hit).not.toBeNull()
    expect(hit?.wayId).toBe(1)
  })

  it('retourne null au-delà du seuil', () => {
    const ways: OverpassWay[] = [
      wayHighway(1, { highway: 'path' }, [
        [50.85, 4.35],
        [50.851, 4.351],
      ]),
    ]
    const idx = buildIndex(ways)
    // Point très loin (~1 km)
    const hit = findNearestWaySegment(idx, { lat: 50.86, lng: 4.36 }, 15)
    expect(hit).toBeNull()
  })

  it("n'inclut pas les ways landuse=forest dans le R-tree", () => {
    const ways: OverpassWay[] = [
      {
        type: 'way',
        id: 42,
        tags: { landuse: 'forest' },
        geometry: [
          { lat: 50.85, lon: 4.35 },
          { lat: 50.852, lon: 4.35 },
          { lat: 50.852, lon: 4.352 },
          { lat: 50.85, lon: 4.352 },
        ],
      },
    ]
    const idx = buildIndex(ways)
    const hit = findNearestWaySegment(idx, { lat: 50.851, lng: 4.351 }, 1000)
    expect(hit).toBeNull()
  })
})

describe('isPointInForest', () => {
  it('détecte un point dans un polygone landuse=forest', () => {
    const ways: OverpassWay[] = [
      {
        type: 'way',
        id: 42,
        tags: { landuse: 'forest' },
        geometry: [
          { lat: 50.85, lon: 4.35 },
          { lat: 50.86, lon: 4.35 },
          { lat: 50.86, lon: 4.36 },
          { lat: 50.85, lon: 4.36 },
        ],
      },
    ]
    const idx = buildIndex(ways)
    expect(isPointInForest(idx, { lat: 50.855, lng: 4.355 })).toBe(true)
    expect(isPointInForest(idx, { lat: 50.87, lng: 4.37 })).toBe(false)
  })

  it("retourne false s'il n'y a aucun polygone", () => {
    const idx = buildIndex([])
    expect(isPointInForest(idx, { lat: 50.85, lng: 4.35 })).toBe(false)
  })
})
