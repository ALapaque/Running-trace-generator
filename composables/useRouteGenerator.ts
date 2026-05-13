/**
 * Génération de candidats round-trip via OpenRouteService.
 *
 * - 8 seeds différents en parallèle (configurable).
 * - Sur-demande +10% sur la distance car ORS sous-livre régulièrement.
 * - Retourne `RouteCandidate[]` ; les erreurs individuelles n'invalident pas l'ensemble.
 */

import { haversineM } from '../utils/geo'
import { ORS_CANDIDATES, ORS_OVER_REQUEST_RATIO, ELEVATION_NOISE_M } from '../config'
import type {
  LatLng,
  RouteCandidate,
  RouteGenerationInput,
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

/** Mappe le terrain demandé sur le profile ORS le plus adapté. */
function mapProfile(_terrain: RouteGenerationInput['terrain']): 'foot-hiking' | 'foot-walking' {
  // foot-hiking favorise sentiers et chemins, foot-walking favorise les voies piétonnes urbaines.
  // L'algo de scoring fait l'essentiel du tri, on garde foot-hiking par défaut pour avoir
  // accès à un graphe plus large (sentiers OSM).
  return 'foot-hiking'
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
    },
  }
}

async function fetchOrsCandidate(
  config: { baseUrl: string; apiKey: string },
  input: RouteGenerationInput,
  seed: number,
  signal?: AbortSignal,
): Promise<RouteCandidate> {
  const profile = mapProfile(input.terrain)
  const lengthM = input.distanceKm * 1000 * ORS_OVER_REQUEST_RATIO
  const body = buildOrsBody(input, seed, lengthM)
  const url = `${config.baseUrl}/v2/directions/${profile}/geojson`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json',
    },
    body: JSON.stringify(body),
    signal,
  })

  if (res.status === 429) throw new OrsQuotaExceededError()
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new OrsApiError(res.status, `ORS ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    features: Array<{
      geometry: { coordinates: [number, number, number][] }
      properties: {
        summary?: { distance: number; duration: number; ascent?: number; descent?: number }
      }
    }>
  }

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
    id: `cand-${seed}`,
    seed,
    points,
    distanceM: feature.properties.summary?.distance ?? distance,
    elevationGainM: feature.properties.summary?.ascent ?? gain,
    elevationLossM: feature.properties.summary?.descent ?? loss,
  }
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

  /** Lance N appels ORS en parallèle avec des seeds différents. Retourne uniquement les succès. */
  async function generateCandidates(
    input: RouteGenerationInput,
    options: { count?: number; signal?: AbortSignal } = {},
  ): Promise<{ candidates: RouteCandidate[]; quotaExceeded: boolean }> {
    const apiKey = config.public.orsApiKey
    if (!apiKey) {
      throw new Error(
        "Clé OpenRouteService manquante : définir NUXT_PUBLIC_ORS_API_KEY dans .env",
      )
    }
    const orsConfig = { baseUrl: config.public.orsBaseUrl, apiKey }
    const count = options.count ?? ORS_CANDIDATES

    // Seeds pseudo-aléatoires distincts pour explorer différentes formes de boucle.
    const seeds: number[] = []
    while (seeds.length < count) {
      const s = Math.floor(Math.random() * 1_000_000)
      if (!seeds.includes(s)) seeds.push(s)
    }

    const settled = await Promise.allSettled(
      seeds.map((seed) => fetchOrsCandidate(orsConfig, input, seed, options.signal)),
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

  return { generateCandidates }
}

export type { LatLng }
