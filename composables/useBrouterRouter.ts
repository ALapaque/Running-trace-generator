/**
 * Re-routage trail via BRouter (proxy serverless `/api/brouter/route`).
 *
 * En mode trail, chaque boucle générée par ORS est ré-échantillonnée en
 * waypoints puis re-routée par BRouter, qui suit nativement les bons sentiers
 * (pondération OSM surface/tracktype). Robustesse :
 *  - échec individuel → on garde le candidat ORS intact (le pipeline n'est
 *    jamais cassé) ;
 *  - circuit breaker partagé : après N échecs consécutifs, on saute BRouter
 *    pendant un cooldown (cf. `useTerrainAnalyzer`).
 */
import { haversineM } from '../utils/geo'
import { fetchWithTimeout } from '../utils/fetch-timeout'
import { createLimiter } from '../utils/concurrency'
import { sampleWaypoints } from '../utils/route-ops'
import { computeElevationGainLoss } from './useRouteGenerator'
import {
  BROUTER_CIRCUIT_COOLDOWN_MS,
  BROUTER_CIRCUIT_THRESHOLD,
  BROUTER_FETCH_TIMEOUT_MS,
  BROUTER_MAX_CONCURRENT,
  BROUTER_WAYPOINTS_PER_LOOP,
} from '../config'
import type {
  HillPreference,
  RouteCandidate,
  RouteGenerationInput,
  RoutePoint,
} from '../types/ors'

/** Profils BRouter — limités à ceux confirmés disponibles sur le serveur public. */
export type BrouterProfile = 'trekking' | 'trekking-steep' | 'hiking-mountain'

export class BrouterError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BrouterError'
  }
}

/** Mappe le type de côte demandé sur le profil BRouter le plus adapté. */
export function mapBrouterProfile(hills: HillPreference): BrouterProfile {
  if (hills === 'montagneux') return 'hiking-mountain'
  if (hills === 'vallonné') return 'trekking-steep'
  return 'trekking'
}

/** Réponse GeoJSON minimale de BRouter (FeatureCollection, une LineString). */
interface BrouterGeoJson {
  features?: Array<{
    geometry?: { coordinates?: [number, number, number][] }
    properties?: Record<string, unknown>
  }>
}

/**
 * Transforme une réponse GeoJSON BRouter en `RouteCandidate` — mêmes shapes
 * que `parseOrsResponse`, pour que tout le pipeline aval reste inchangé.
 * Les coordonnées BRouter sont des triplets `[lon, lat, ele]` ; la longueur
 * totale est exposée dans `properties['track-length']` (mètres, en string).
 */
export function parseBrouterResponse(
  data: BrouterGeoJson,
  id: string,
  seed: number,
): RouteCandidate {
  const feature = data?.features?.[0]
  const coords = feature?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) {
    throw new BrouterError('BRouter : aucune géométrie renvoyée')
  }

  const points: RoutePoint[] = []
  let distance = 0
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat, ele] = coords[i]!
    if (i > 0) {
      const prev = points[i - 1]!
      distance += haversineM({ lat: prev.lat, lng: prev.lng }, { lat, lng: lon })
    }
    points.push({ lat, lng: lon, ele: ele ?? 0, distance })
  }

  const trackLength = Number(feature?.properties?.['track-length'])
  const { gain, loss } = computeElevationGainLoss(points)

  return {
    id,
    seed,
    points,
    distanceM: Number.isFinite(trackLength) && trackLength > 0 ? trackLength : distance,
    elevationGainM: gain,
    elevationLossM: loss,
    routingEngine: 'brouter',
  }
}

const brouterLimiter = createLimiter(BROUTER_MAX_CONCURRENT)

// Circuit breaker — partagé entre tous les appels du module (cf. useTerrainAnalyzer).
let consecutiveFailures = 0
let circuitOpenUntil = 0

function recordSuccess(): void {
  consecutiveFailures = 0
}
function recordFailure(): void {
  consecutiveFailures++
  if (consecutiveFailures >= BROUTER_CIRCUIT_THRESHOLD) {
    circuitOpenUntil = Date.now() + BROUTER_CIRCUIT_COOLDOWN_MS
  }
}
function circuitIsOpen(): boolean {
  return Date.now() < circuitOpenUntil
}

export function useBrouterRouter() {
  /**
   * Re-route un candidat ORS via BRouter. Lance `BrouterError` (ou l'erreur
   * d'abort) en cas d'échec — l'appelant décide du fallback.
   */
  async function rerouteCandidate(
    candidate: RouteCandidate,
    profile: BrouterProfile,
    signal?: AbortSignal,
  ): Promise<RouteCandidate> {
    const waypoints = sampleWaypoints(candidate.points, BROUTER_WAYPOINTS_PER_LOOP, true)
    const lonlats = waypoints.map((w) => [w.lng, w.lat])

    const res = await fetchWithTimeout('/api/brouter/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lonlats, profile }),
      timeoutMs: BROUTER_FETCH_TIMEOUT_MS,
      externalSignal: signal,
    })
    if (!res.ok) {
      throw new BrouterError(`BRouter ${res.status}`)
    }
    const data = (await res.json()) as BrouterGeoJson
    // On conserve id/seed du candidat ORS d'origine (traçabilité + variété).
    return parseBrouterResponse(data, candidate.id, candidate.seed)
  }

  /**
   * Re-route tous les candidats en mode trail. Échec individuel → on garde le
   * candidat ORS d'origine (le tableau garde toujours sa longueur). Circuit
   * ouvert → on saute BRouter entièrement. Lance si l'appelant a annulé.
   *
   * Retourne `fallback: true` si au moins un candidat n'a pas pu être re-routé.
   */
  async function rerouteCandidates(
    candidates: RouteCandidate[],
    input: RouteGenerationInput,
    signal?: AbortSignal,
  ): Promise<{ candidates: RouteCandidate[]; fallback: boolean }> {
    if (circuitIsOpen()) {
      return { candidates, fallback: true }
    }

    // Running + preferGreenway : on force `trekking` (la seule variante boostée
    // RAVeL côté serveur, cf. server/lib/brouter-greenway.ts) plutôt que de
    // suivre la mapping `hills → profil`.
    const profile = input.preferGreenway
      ? 'trekking'
      : mapBrouterProfile(input.hills)
    let fallback = false

    // Chaque tâche se résout toujours (jamais de rejet) → pas de rejet non géré.
    const results = await Promise.all(
      candidates.map((c) =>
        brouterLimiter(async () => {
          try {
            const refined = await rerouteCandidate(c, profile, signal)
            recordSuccess()
            return refined
          } catch (e) {
            // Une annulation ne compte pas comme un échec de service.
            if ((e as Error)?.name !== 'AbortError') {
              recordFailure()
              fallback = true
            }
            return c // fallback : candidat ORS intact
          }
        }),
      ),
    )

    // Annulation par l'appelant → on remonte l'erreur pour stopper le pipeline.
    if (signal?.aborted) {
      const err = new Error('Re-routage BRouter annulé')
      err.name = 'AbortError'
      throw err
    }

    return { candidates: results, fallback }
  }

  return { rerouteCandidate, rerouteCandidates }
}
