/**
 * Outils géographiques de base : Haversine, bbox, décimation.
 */

import type { LatLng } from '../types/ors'
import type { BBox } from '../types/osm'

const EARTH_RADIUS_M = 6_371_008.8

/** Distance Haversine en mètres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** BBox englobant une polyligne avec marge en degrés. */
export function computeBBox(points: LatLng[], marginDeg = 0): BBox {
  if (points.length === 0) return { south: 0, west: 0, north: 0, east: 0 }
  let south = points[0]!.lat
  let north = points[0]!.lat
  let west = points[0]!.lng
  let east = points[0]!.lng
  for (const p of points) {
    if (p.lat < south) south = p.lat
    if (p.lat > north) north = p.lat
    if (p.lng < west) west = p.lng
    if (p.lng > east) east = p.lng
  }
  return {
    south: south - marginDeg,
    west: west - marginDeg,
    north: north + marginDeg,
    east: east + marginDeg,
  }
}

/**
 * Décime une polyligne pour garder ~1 point tous les `intervalM` mètres.
 * Le premier et le dernier point sont toujours conservés.
 */
export function decimateByDistance<T extends LatLng>(points: T[], intervalM: number): T[] {
  if (points.length <= 2) return [...points]
  const out: T[] = [points[0]!]
  let accumulated = 0
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!
    const curr = points[i]!
    accumulated += haversineM(prev, curr)
    if (accumulated >= intervalM) {
      out.push(curr)
      accumulated = 0
    }
  }
  out.push(points[points.length - 1]!)
  return out
}

/** Distance d'un point à un segment, en mètres (projection plane locale, suffisant pour <100m). */
export function pointToSegmentDistanceM(p: LatLng, a: LatLng, b: LatLng): number {
  const latRefRad = (a.lat * Math.PI) / 180
  const metersPerDegLat = 111_132
  const metersPerDegLng = 111_320 * Math.cos(latRefRad)

  const px = (p.lng - a.lng) * metersPerDegLng
  const py = (p.lat - a.lat) * metersPerDegLat
  const bx = (b.lng - a.lng) * metersPerDegLng
  const by = (b.lat - a.lat) * metersPerDegLat

  const lenSq = bx * bx + by * by
  if (lenSq === 0) return Math.hypot(px, py)
  let t = (px * bx + py * by) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = bx * t
  const cy = by * t
  return Math.hypot(px - cx, py - cy)
}

/** Arrondit une bbox à une précision donnée (utilisé pour la clé de cache). */
export function roundBBox(bbox: BBox, precision: number): BBox {
  const round = (n: number) => Math.round(n / precision) * precision
  return {
    south: round(bbox.south),
    west: round(bbox.west),
    north: round(bbox.north),
    east: round(bbox.east),
  }
}
