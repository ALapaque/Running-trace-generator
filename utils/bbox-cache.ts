/**
 * Cache localStorage pour les réponses Overpass.
 * - Clé : bbox arrondi à `BBOX_CACHE_PRECISION`.
 * - TTL : `OVERPASS_CACHE_TTL_MS`.
 *
 * On stocke la version brute du JSON Overpass pour pouvoir reconstruire l'index spatial à la demande.
 */

import type { BBox, OverpassResponse } from '../types/osm'
import { roundBBox } from './geo'
import { BBOX_CACHE_PRECISION, OVERPASS_CACHE_TTL_MS } from '../config'

const KEY_PREFIX = 'rungen:overpass:v1:'

function bboxKey(bbox: BBox): string {
  const r = roundBBox(bbox, BBOX_CACHE_PRECISION)
  // 3 décimales suffisent à la précision 0.01°
  const fmt = (n: number) => n.toFixed(3)
  return `${KEY_PREFIX}${fmt(r.south)},${fmt(r.west)},${fmt(r.north)},${fmt(r.east)}`
}

interface CacheEntry {
  ts: number
  response: OverpassResponse
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function getCachedOverpass(bbox: BBox): OverpassResponse | null {
  const s = storage()
  if (!s) return null
  const key = bboxKey(bbox)
  const raw = s.getItem(key)
  if (!raw) return null
  try {
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.ts > OVERPASS_CACHE_TTL_MS) {
      s.removeItem(key)
      return null
    }
    return entry.response
  } catch {
    s.removeItem(key)
    return null
  }
}

export function setCachedOverpass(bbox: BBox, response: OverpassResponse): void {
  const s = storage()
  if (!s) return
  const key = bboxKey(bbox)
  const entry: CacheEntry = { ts: Date.now(), response }
  try {
    s.setItem(key, JSON.stringify(entry))
  } catch {
    // Quota dépassé → on purge les entrées les plus vieilles.
    pruneOldest(s, 0.5)
    try {
      s.setItem(key, JSON.stringify(entry))
    } catch {
      // Tant pis : on continue sans cache pour ce parcours.
    }
  }
}

function pruneOldest(s: Storage, ratio: number): void {
  const entries: Array<{ key: string; ts: number }> = []
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i)
    if (!k || !k.startsWith(KEY_PREFIX)) continue
    try {
      const e = JSON.parse(s.getItem(k) ?? '{}') as CacheEntry
      entries.push({ key: k, ts: e.ts ?? 0 })
    } catch {
      // entrée corrompue → on la supprime
      s.removeItem(k)
    }
  }
  entries.sort((a, b) => a.ts - b.ts)
  const toRemove = Math.max(1, Math.floor(entries.length * ratio))
  for (let i = 0; i < toRemove; i++) {
    s.removeItem(entries[i]!.key)
  }
}

export function clearOverpassCache(): void {
  const s = storage()
  if (!s) return
  const toRemove: string[] = []
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i)
    if (k && k.startsWith(KEY_PREFIX)) toRemove.push(k)
  }
  for (const k of toRemove) s.removeItem(k)
}
