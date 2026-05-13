/**
 * Analyse de terrain : pour chaque candidat ORS,
 *  1. décime à 1 point / 50m
 *  2. construit un bbox englobant avec marge
 *  3. interroge Overpass (avec cache localStorage + limiteur 3 req parallèles)
 *  4. matche chaque point au way OSM le plus proche (R-tree, distance < 15m)
 *  5. classifie en `route | chemin_large | single | unknown` et marque les points en forêt
 */

import { computeBBox, decimateByDistance } from '../utils/geo'
import { buildOverpassQuery } from '../utils/overpass-query-builder'
import {
  buildIndex,
  classifyPathType,
  findNearestWaySegment,
  isPointInForest,
} from '../utils/spatial-matching'
import { getCachedOverpass, setCachedOverpass } from '../utils/bbox-cache'
import { createLimiter } from '../utils/concurrency'
import {
  BBOX_MARGIN_DEG,
  OVERPASS_DECIMATION_M,
  OVERPASS_MAX_CONCURRENT,
  MATCH_MAX_DISTANCE_M,
} from '../config'
import type { BBox, OverpassResponse, SegmentClassification, TerrainStats } from '../types/osm'
import type { RouteCandidate } from '../types/ors'

export class OverpassError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OverpassError'
  }
}

export interface TerrainAnalysisResult {
  segments: SegmentClassification[]
  stats: TerrainStats
  /** True si Overpass a échoué et qu'on n'a pas pu analyser : seul l'utilisateur du fallback. */
  fallback: boolean
}

const overpassLimiter = createLimiter(OVERPASS_MAX_CONCURRENT)

async function fetchOverpass(
  url: string,
  query: string,
  signal?: AbortSignal,
): Promise<OverpassResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
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

async function fetchOverpassWithFallback(
  primary: string,
  fallback: string,
  query: string,
  signal?: AbortSignal,
): Promise<OverpassResponse> {
  try {
    return await fetchOverpass(primary, query, signal)
  } catch (e) {
    if (e instanceof OverpassError) {
      // Bascule sur le miroir kumi
      return await fetchOverpass(fallback, query, signal)
    }
    throw e
  }
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
    mixte: 0, // 'mixte' n'est pas un type détecté ; uniquement une préférence utilisateur.
    forest: forest / total,
    unknown: unknown / total,
  }
}

export function useTerrainAnalyzer() {
  const config = useRuntimeConfig()

  async function fetchTerrain(
    bbox: BBox,
    signal?: AbortSignal,
  ): Promise<OverpassResponse> {
    const cached = getCachedOverpass(bbox)
    if (cached) return cached
    const query = buildOverpassQuery(bbox)
    const response = await fetchOverpassWithFallback(
      config.public.overpassBaseUrl,
      config.public.overpassFallbackUrl,
      query,
      signal,
    )
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

    try {
      const overpass = await overpassLimiter(() => fetchTerrain(bbox, signal))
      const index = buildIndex(overpass.elements)

      const segments: SegmentClassification[] = decimated.map((p, i) => {
        const point = { lat: p.lat, lng: p.lng }
        const nearest = findNearestWaySegment(index, point, MATCH_MAX_DISTANCE_M)
        const inForest = isPointInForest(index, point)
        if (!nearest) {
          return { index: i, point, pathType: 'unknown', inForest }
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

      return { segments, stats: computeStats(segments), fallback: false }
    } catch (e) {
      // Overpass timeout / ban temporaire → fallback : segments inconnus.
      const segments: SegmentClassification[] = decimated.map((p, i) => ({
        index: i,
        point: { lat: p.lat, lng: p.lng },
        pathType: 'unknown',
        inForest: false,
      }))
      return {
        segments,
        stats: computeStats(segments),
        fallback: true,
      }
    }
  }

  return { analyzeCandidate }
}
