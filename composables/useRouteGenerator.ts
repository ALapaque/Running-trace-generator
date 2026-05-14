/**
 * Génération de candidats round-trip via OpenRouteService.
 *
 * - 8 seeds différents en parallèle (configurable).
 * - Sur-demande +10% sur la distance car ORS sous-livre régulièrement.
 * - Retourne `RouteCandidate[]` ; les erreurs individuelles n'invalident pas l'ensemble.
 */

import { haversineM } from '../utils/geo'
import { fetchWithTimeout } from '../utils/fetch-timeout'
import { useI18n } from './useI18n'
import {
  DEFAULT_DISTANCE_SPAN_KM,
  ELEVATION_NOISE_M,
  ORS_CANDIDATES,
  ORS_FETCH_TIMEOUT_MS,
  ORS_OVER_REQUEST_RATIO,
  TRAIL_GREEN_WEIGHT,
} from '../config'
import type {
  LatLng,
  RouteCandidate,
  RouteGenerationInput,
  RouteMode,
  RoutePoint,
} from '../types/ors'

export class OrsQuotaExceededError extends Error {
  constructor() {
    super('Quota OpenRouteService dépassé')
    this.name = 'OrsQuotaExceededError'
  }
}

export class OrsApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'OrsApiError'
  }
}

/** Mappe le mode de course sur le profile ORS le plus adapté. */
function mapProfile(mode: RouteMode): 'foot-hiking' | 'foot-walking' {
  // foot-walking favorise les voies carrossables/urbaines (running sur route),
  // foot-hiking favorise sentiers et chemins (trail).
  return mode === 'trail' ? 'foot-hiking' : 'foot-walking'
}

function buildOrsBody(input: RouteGenerationInput, seed: number, lengthM: number) {
  return {
    coordinates: [[input.start.lng, input.start.lat]],
    elevation: true,
    instructions: false,
    geometry: true,
    options: {
      round_trip: {
        length: Math.round(lengthM),
        points: 5,
        seed,
      },
      // En mode trail, on biaise activement la génération vers les espaces
      // verts (forêts, parcs, bords de rivière). En running, routing neutre.
      ...(input.mode === 'trail'
        ? { profile_params: { weightings: { green: TRAIL_GREEN_WEIGHT } } }
        : {}),
    },
  }
}

/**
 * Longueur (m) demandée à ORS pour le candidat `index` parmi `total`.
 * On répartit les cibles sur toute la plage [min, max] pour produire des
 * candidats de longueurs variées ; le scoring/filtre tri ensuite.
 * Si la distance n'est pas contrainte, on explore un span par défaut.
 */
function targetLengthForIndex(input: RouteGenerationInput, index: number, total: number): number {
  const span = input.distanceKm ?? DEFAULT_DISTANCE_SPAN_KM
  const t = total <= 1 ? 0.5 : index / (total - 1)
  const km = span.min + (span.max - span.min) * t
  return km * 1000 * ORS_OVER_REQUEST_RATIO
}

interface OrsGeoJson {
  features: Array<{
    geometry: { coordinates: [number, number, number][] }
    properties: {
      summary?: { distance: number; duration: number; ascent?: number; descent?: number }
    }
  }>
}

/** True si on route via le proxy serverless (baseUrl relatif). */
function isProxied(baseUrl: string): boolean {
  return baseUrl.startsWith('/')
}

/** POST commun vers ORS directions, avec gestion 429 / erreurs. */
async function postOrs(
  config: { baseUrl: string; apiKey: string },
  profile: 'foot-hiking' | 'foot-walking',
  body: unknown,
  signal?: AbortSignal,
): Promise<OrsGeoJson> {
  const url = `${config.baseUrl}/v2/directions/${profile}/geojson`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/geo+json',
  }
  // En mode proxy, c'est le serveur qui injecte la clé : pas d'Authorization client.
  if (!isProxied(config.baseUrl)) headers.Authorization = config.apiKey

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: ORS_FETCH_TIMEOUT_MS,
    externalSignal: signal,
  })
  if (res.status === 429) throw new OrsQuotaExceededError()
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new OrsApiError(res.status, `ORS ${res.status}: ${text.slice(0, 200)}`)
  }
  return (await res.json()) as OrsGeoJson
}

/** Transforme une réponse GeoJSON ORS en RouteCandidate. */
function parseOrsResponse(data: OrsGeoJson, id: string, seed: number): RouteCandidate {
  const feature = data.features?.[0]
  if (!feature) throw new OrsApiError(200, 'ORS : aucune feature renvoyée')

  const coords = feature.geometry.coordinates
  const points: RoutePoint[] = []
  let distance = 0
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat, ele] = coords[i]!
    if (i > 0) {
      const prev = points[i - 1]!
      distance += haversineM({ lat: prev.lat, lng: prev.lng }, { lat, lng: lon })
    }
    points.push({ lat, lng: lon, ele, distance })
  }

  const { gain, loss } = computeElevationGainLoss(points)
  return {
    id,
    seed,
    points,
    distanceM: feature.properties.summary?.distance ?? distance,
    elevationGainM: feature.properties.summary?.ascent ?? gain,
    elevationLossM: feature.properties.summary?.descent ?? loss,
  }
}

async function fetchOrsCandidate(
  config: { baseUrl: string; apiKey: string },
  input: RouteGenerationInput,
  seed: number,
  lengthM: number,
  signal?: AbortSignal,
): Promise<RouteCandidate> {
  const profile = mapProfile(input.mode)
  const body = buildOrsBody(input, seed, lengthM)
  const data = await postOrs(config, profile, body, signal)
  return parseOrsResponse(data, `cand-${seed}`, seed)
}

/**
 * Calcule D+ et D- en ignorant le bruit SRTM (variations < ELEVATION_NOISE_M).
 */
export function computeElevationGainLoss(points: RoutePoint[]): {
  gain: number
  loss: number
} {
  if (points.length < 2) return { gain: 0, loss: 0 }
  let gain = 0
  let loss = 0
  let lastSignificant = points[0]!.ele
  for (let i = 1; i < points.length; i++) {
    const ele = points[i]!.ele
    const delta = ele - lastSignificant
    if (Math.abs(delta) >= ELEVATION_NOISE_M) {
      if (delta > 0) gain += delta
      else loss += -delta
      lastSignificant = ele
    }
  }
  return { gain, loss }
}

export function useRouteGenerator() {
  const config = useRuntimeConfig()
  const { t } = useI18n()

  /** Lance N appels ORS en parallèle avec des seeds différents. Retourne uniquement les succès. */
  async function generateCandidates(
    input: RouteGenerationInput,
    options: { count?: number; signal?: AbortSignal } = {},
  ): Promise<{ candidates: RouteCandidate[]; quotaExceeded: boolean }> {
    const baseUrl = config.public.orsBaseUrl
    const apiKey = config.public.orsApiKey
    // En mode proxy, la clé est côté serveur ; sinon elle est requise côté client.
    if (!isProxied(baseUrl) && !apiKey) {
      throw new Error(t("errors.orsKeyMissing"))
    }
    const orsConfig = { baseUrl, apiKey }
    const count = options.count ?? ORS_CANDIDATES

    // Seeds pseudo-aléatoires distincts pour explorer différentes formes de boucle.
    const seeds: number[] = []
    while (seeds.length < count) {
      const s = Math.floor(Math.random() * 1_000_000)
      if (!seeds.includes(s)) seeds.push(s)
    }

    const settled = await Promise.allSettled(
      seeds.map((seed, i) =>
        fetchOrsCandidate(
          orsConfig,
          input,
          seed,
          targetLengthForIndex(input, i, seeds.length),
          options.signal,
        ),
      ),
    )

    const candidates: RouteCandidate[] = []
    let quotaExceeded = false
    for (const r of settled) {
      if (r.status === 'fulfilled') {
        candidates.push(r.value)
      } else if (r.reason instanceof OrsQuotaExceededError) {
        quotaExceeded = true
      }
    }

    if (candidates.length === 0) {
      if (quotaExceeded) throw new OrsQuotaExceededError()
      // Si tout a échoué pour d'autres raisons, on remonte l'erreur du premier rejet.
      const firstReject = settled.find((r) => r.status === 'rejected')
      if (firstReject && firstReject.status === 'rejected') throw firstReject.reason
      throw new Error('Aucun candidat généré')
    }

    return { candidates, quotaExceeded }
  }

  /**
   * Re-calcule un itinéraire passant par une liste ordonnée de waypoints
   * (édition manuelle du tracé). Pour une boucle, fermer en répétant le départ.
   */
  async function routeThroughWaypoints(
    waypoints: LatLng[],
    signal?: AbortSignal,
  ): Promise<RouteCandidate> {
    const baseUrl = config.public.orsBaseUrl
    const apiKey = config.public.orsApiKey
    if (!isProxied(baseUrl) && !apiKey) {
      throw new Error(t("errors.orsKeyMissing"))
    }
    if (waypoints.length < 2) throw new Error('Au moins 2 points sont nécessaires')
    const orsConfig = { baseUrl, apiKey }
    const data = await postOrs(
      orsConfig,
      'foot-hiking',
      {
        coordinates: waypoints.map((w) => [w.lng, w.lat]),
        elevation: true,
        instructions: false,
      },
      signal,
    )
    return parseOrsResponse(data, `edited-${Date.now()}`, 0)
  }

  return { generateCandidates, routeThroughWaypoints }
}

export type { LatLng }
