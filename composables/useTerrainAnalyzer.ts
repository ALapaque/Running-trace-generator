/**
 * Analyse de terrain : pour chaque candidat ORS,
 *  1. décime à 1 point / 50m
 *  2. construit un bbox englobant avec marge
 *  3. interroge Overpass (timeout dur + cache localStorage + limiteur 3 req parallèles)
 *  4. matche chaque point au way OSM le plus proche (R-tree, distance < 15m)
 *  5. classifie en `route | chemin_large | single | unknown` et marque les points en forêt
 *
 * Robustesse :
 *  - `fetchWithTimeout` empêche un Overpass qui stalle de figer le pipeline.
 *  - Circuit breaker : après N échecs consécutifs, on arrête d'appeler Overpass
 *    pour les candidats restants (fast-fallback) pendant un cooldown.
 */

import { computeBBox, decimateByDistance } from '../utils/geo'
import { buildOverpassQuery } from '../utils/overpass-query-builder'
import {
  buildIndex,
  classifyPathType,
  findNearestWaySegment,
  isPointInForest,
  smoothPathTypes,
} from '../utils/spatial-matching'
import { getCachedOverpass, setCachedOverpass } from '../utils/bbox-cache'
import { createLimiter } from '../utils/concurrency'
import { fetchWithTimeout } from '../utils/fetch-timeout'
import {
  BBOX_MARGIN_DEG,
  MATCH_MAX_DISTANCE_M,
  OVERPASS_CIRCUIT_COOLDOWN_MS,
  OVERPASS_CIRCUIT_THRESHOLD,
  OVERPASS_DECIMATION_M,
  OVERPASS_FETCH_TIMEOUT_MS,
  OVERPASS_MAX_CONCURRENT,
} from '../config'
import type { BBox, OverpassResponse, SegmentClassification, TerrainStats } from '../types/osm'
import type { RouteCandidate, RoutePoint } from '../types/ors'

export class OverpassError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OverpassError'
  }
}

export interface TerrainAnalysisResult {
  segments: SegmentClassification[]
  stats: TerrainStats
  /** True si Overpass a échoué et qu'on n'a pas pu analyser le terrain. */
  fallback: boolean
}

const overpassLimiter = createLimiter(OVERPASS_MAX_CONCURRENT)

// Circuit breaker — partagé entre tous les appels du module.
let consecutiveFailures = 0
let circuitOpenUntil = 0

function recordSuccess(): void {
  consecutiveFailures = 0
}
function recordFailure(): void {
  consecutiveFailures++
  if (consecutiveFailures >= OVERPASS_CIRCUIT_THRESHOLD) {
    circuitOpenUntil = Date.now() + OVERPASS_CIRCUIT_COOLDOWN_MS
  }
}
function circuitIsOpen(): boolean {
  return Date.now() < circuitOpenUntil
}

async function fetchOverpass(
  query: string,
  signal?: AbortSignal,
): Promise<OverpassResponse> {
  // Proxifié côté serveur (`/api/overpass/route`) : pas de CORS, et le
  // basculement primaire → miroir kumi est fait serveur-side.
  const res = await fetchWithTimeout('/api/overpass/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    timeoutMs: OVERPASS_FETCH_TIMEOUT_MS,
    externalSignal: signal,
  })
  if (res.status === 429 || res.status === 504) {
    throw new OverpassError(`Overpass throttled (${res.status})`)
  }
  if (!res.ok) {
    throw new OverpassError(`Overpass ${res.status}`)
  }
  const json = (await res.json()) as OverpassResponse
  if (!json || !Array.isArray(json.elements)) {
    throw new OverpassError('Réponse Overpass malformée')
  }
  return json
}

function computeStats(segments: SegmentClassification[]): TerrainStats {
  const total = segments.length || 1
  let route = 0
  let chemin_large = 0
  let single = 0
  let unknown = 0
  let forest = 0
  for (const s of segments) {
    if (s.pathType === 'route') route++
    else if (s.pathType === 'chemin_large') chemin_large++
    else if (s.pathType === 'single') single++
    else unknown++
    if (s.inForest) forest++
  }
  return {
    route: route / total,
    chemin_large: chemin_large / total,
    single: single / total,
    mixte: 0,
    forest: forest / total,
    unknown: unknown / total,
  }
}

/** Segments « inconnus » utilisés en mode fallback. */
function fallbackSegments(decimated: RoutePoint[]): SegmentClassification[] {
  return decimated.map((p, i) => ({
    index: i,
    point: { lat: p.lat, lng: p.lng },
    pathType: 'unknown' as const,
    inForest: false,
  }))
}

export function useTerrainAnalyzer() {
  async function fetchTerrain(bbox: BBox, signal?: AbortSignal): Promise<OverpassResponse> {
    const cached = getCachedOverpass(bbox)
    if (cached) return cached
    const query = buildOverpassQuery(bbox)
    const response = await fetchOverpass(query, signal)
    setCachedOverpass(bbox, response)
    return response
  }

  async function analyzeCandidate(
    candidate: RouteCandidate,
    signal?: AbortSignal,
  ): Promise<TerrainAnalysisResult> {
    const decimated = decimateByDistance(candidate.points, OVERPASS_DECIMATION_M)
    const bbox = computeBBox(
      decimated.map((p) => ({ lat: p.lat, lng: p.lng })),
      BBOX_MARGIN_DEG,
    )

    // Cache local → on tente toujours (gratuit, instantané) même si le circuit est ouvert.
    const cached = getCachedOverpass(bbox)
    if (cached) {
      const index = buildIndex(cached.elements)
      const segments = classifySegments(decimated, index)
      return { segments, stats: computeStats(segments), fallback: false }
    }

    // Circuit ouvert → fast-fallback sans toucher au réseau.
    if (circuitIsOpen()) {
      const segments = fallbackSegments(decimated)
      return { segments, stats: computeStats(segments), fallback: true }
    }

    try {
      const overpass = await overpassLimiter(() => fetchTerrain(bbox, signal))
      recordSuccess()
      const index = buildIndex(overpass.elements)
      const segments = classifySegments(decimated, index)
      return { segments, stats: computeStats(segments), fallback: false }
    } catch {
      // Timeout / ban / réseau → fallback : terrain non analysé pour ce candidat.
      recordFailure()
      const segments = fallbackSegments(decimated)
      return { segments, stats: computeStats(segments), fallback: true }
    }
  }

  return { analyzeCandidate }
}

function classifySegments(
  decimated: RoutePoint[],
  index: ReturnType<typeof buildIndex>,
): SegmentClassification[] {
  const raw = decimated.map((p, i) => {
    const point = { lat: p.lat, lng: p.lng }
    const nearest = findNearestWaySegment(index, point, MATCH_MAX_DISTANCE_M)
    const inForest = isPointInForest(index, point)
    if (!nearest) {
      return { index: i, point, pathType: 'unknown' as const, inForest }
    }
    return {
      index: i,
      point,
      pathType: classifyPathType(nearest.tags),
      inForest,
      matchedWayId: nearest.wayId,
      tags: nearest.tags as Record<string, string>,
    }
  })

  // Lissage : efface les classifications isolées aberrantes (intersections).
  const smoothed = smoothPathTypes(raw.map((s) => s.pathType))
  return raw.map((s, i) => ({ ...s, pathType: smoothed[i]! }))
}
