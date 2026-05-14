/**
 * Matching spatial entre points du tracé ORS et ways OSM.
 * - R-tree (rbush) sur les segments de ways pour des requêtes near-neighbor rapides.
 * - Détection de zones forestières via ray-casting (point in polygon).
 */

import RBush from 'rbush'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point as turfPoint, polygon as turfPolygon } from '@turf/helpers'
import type { Feature, Polygon } from 'geojson'

import type { LatLng } from '../types/ors'
import type { OverpassWay, PathType } from '../types/osm'
import { pointToSegmentDistanceM } from './geo'
import { MATCH_MAX_DISTANCE_M } from '../config'

interface SegmentItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  wayId: number
  a: { lat: number; lng: number }
  b: { lat: number; lng: number }
  tags: OverpassWay['tags']
}

class SegmentTree extends RBush<SegmentItem> {}

export interface BuiltIndex {
  highwayTree: SegmentTree
  forestPolygons: Feature<Polygon>[]
}

/** Construit l'index spatial (R-tree + polygones forestiers) à partir des ways Overpass. */
export function buildIndex(ways: OverpassWay[]): BuiltIndex {
  const highwayTree = new SegmentTree()
  const forestPolygons: Feature<Polygon>[] = []
  const items: SegmentItem[] = []

  for (const way of ways) {
    const tags = way.tags ?? {}
    if (!way.geometry || way.geometry.length < 2) continue

    if (tags.landuse === 'forest' || tags.natural === 'wood') {
      // Polygone fermé : on ferme si nécessaire
      const ring: [number, number][] = way.geometry.map((g) => [g.lon, g.lat])
      const first = ring[0]!
      const last = ring[ring.length - 1]!
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
      if (ring.length >= 4) {
        try {
          forestPolygons.push(turfPolygon([ring]))
        } catch {
          // ring invalide → ignorer
        }
      }
      continue
    }

    if (!tags.highway) continue
    for (let i = 0; i < way.geometry.length - 1; i++) {
      const a = way.geometry[i]!
      const b = way.geometry[i + 1]!
      items.push({
        minX: Math.min(a.lon, b.lon),
        minY: Math.min(a.lat, b.lat),
        maxX: Math.max(a.lon, b.lon),
        maxY: Math.max(a.lat, b.lat),
        wayId: way.id,
        a: { lat: a.lat, lng: a.lon },
        b: { lat: b.lat, lng: b.lon },
        tags,
      })
    }
  }

  highwayTree.load(items)
  return { highwayTree, forestPolygons }
}

/**
 * Trouve le segment de way le plus proche d'un point, sous le seuil `maxDistanceM`.
 * Retourne `null` si aucun segment ne matche.
 */
export function findNearestWaySegment(
  index: BuiltIndex,
  point: LatLng,
  maxDistanceM = MATCH_MAX_DISTANCE_M,
): SegmentItem | null {
  // Conversion approximative du seuil en degrés pour le bbox de recherche.
  const latRad = (point.lat * Math.PI) / 180
  const dLat = maxDistanceM / 111_132
  const dLng = maxDistanceM / (111_320 * Math.cos(latRad) || 1)
  const candidates = index.highwayTree.search({
    minX: point.lng - dLng,
    minY: point.lat - dLat,
    maxX: point.lng + dLng,
    maxY: point.lat + dLat,
  })
  let best: SegmentItem | null = null
  let bestDist = Infinity
  for (const seg of candidates) {
    const d = pointToSegmentDistanceM(point, seg.a, seg.b)
    if (d < bestDist) {
      bestDist = d
      best = seg
    }
  }
  return bestDist <= maxDistanceM ? best : null
}

/** True si le point est dans au moins un polygone forestier. */
export function isPointInForest(index: BuiltIndex, point: LatLng): boolean {
  if (index.forestPolygons.length === 0) return false
  const p = turfPoint([point.lng, point.lat])
  for (const poly of index.forestPolygons) {
    if (booleanPointInPolygon(p, poly)) return true
  }
  return false
}

/**
 * Classifie un way OSM en `PathType` haut niveau à partir de ses tags.
 * Retourne `'unknown'` si la classification est trop ambiguë.
 */
export function classifyPathType(tags: OverpassWay['tags']): PathType | 'unknown' {
  const hw = tags.highway
  if (!hw) return 'unknown'

  // Route bitume : voies carrossables
  const routeHighways = [
    'residential',
    'tertiary',
    'secondary',
    'primary',
    'unclassified',
    'service',
    'pedestrian',
    'living_street',
    'cycleway',
  ]
  if (routeHighways.includes(hw)) {
    const surface = tags.surface
    if (
      !surface ||
      ['asphalt', 'paved', 'concrete', 'paving_stones', 'sett'].includes(surface)
    ) {
      return 'route'
    }
    // Si la surface n'est pas asphaltée, c'est plutôt un chemin large
    return 'chemin_large'
  }

  // Pistes
  if (hw === 'track') {
    // tracktype 1-2 = bien carrossable, 3-5 = plus rustique mais reste large
    return 'chemin_large'
  }

  // path, footway, bridleway : largeur = critère décisif
  if (hw === 'path' || hw === 'footway' || hw === 'bridleway') {
    const width = tags.width ? parseFloat(tags.width) : NaN
    if (!Number.isNaN(width) && width >= 2) return 'chemin_large'
    return 'single'
  }

  return 'unknown'
}

/**
 * Lissage de la séquence de types de chemin (filtre de mode glissant).
 *
 * Le matching point-par-point se trompe ponctuellement aux intersections
 * (un point décimé tombe près d'une route croisée). On remplace donc le type
 * d'un point par le mode de sa fenêtre [i-r, i+r] quand ce mode est franchement
 * majoritaire (> moitié de la fenêtre), ce qui efface les classifications
 * isolées aberrantes.
 */
export function smoothPathTypes(
  types: Array<PathType | 'unknown'>,
  windowRadius = 2,
): Array<PathType | 'unknown'> {
  if (types.length <= 2) return [...types]
  const out: Array<PathType | 'unknown'> = []
  for (let i = 0; i < types.length; i++) {
    const lo = Math.max(0, i - windowRadius)
    const hi = Math.min(types.length - 1, i + windowRadius)
    const counts = new Map<PathType | 'unknown', number>()
    for (let j = lo; j <= hi; j++) {
      const t = types[j]!
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    let mode = types[i]!
    let modeCount = 0
    for (const [t, c] of counts) {
      if (c > modeCount) {
        modeCount = c
        mode = t
      }
    }
    const windowSize = hi - lo + 1
    out.push(modeCount * 2 > windowSize ? mode : types[i]!)
  }
  return out
}
