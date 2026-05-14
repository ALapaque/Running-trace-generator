/**
 * Encodage / décodage des paramètres de génération dans le hash de l'URL.
 *
 * On partage les *paramètres* (point de départ, plages, terrain…), pas la
 * géométrie : un lien reste court et robuste. Le destinataire relance une
 * génération avec les mêmes contraintes.
 *
 * Format : `#g=<base64url(JSON)>` préfixé d'une version pour évoluer sans casse.
 */

import type { GenerationParams } from '../types'
import {
  DISTANCE_BOUNDS_KM,
  ELEVATION_BOUNDS_M,
  RESULTS_COUNT_OPTIONS,
} from '../config'

const VERSION = 1
const HASH_KEY = 'g'

function base64UrlEncode(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(b64)))
}

/** Sérialise les paramètres en chaîne de hash (`g=...`). */
export function encodeParams(params: GenerationParams): string {
  const payload = {
    v: VERSION,
    s: [round(params.start.lat, 5), round(params.start.lng, 5)],
    d: params.distanceKm ? [params.distanceKm.min, params.distanceKm.max] : null,
    e: params.elevationGainM
      ? [params.elevationGainM.min, params.elevationGainM.max]
      : null,
    t: params.terrain,
    f: params.preferForest ? 1 : 0,
    h: params.hills,
    n: params.resultsCount,
  }
  return `${HASH_KEY}=${base64UrlEncode(JSON.stringify(payload))}`
}

/** Construit une URL absolue partageable pour ces paramètres. */
export function buildShareUrl(params: GenerationParams): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#${encodeParams(params)}`
}

/** Décode le hash courant. Retourne `null` si absent ou invalide. */
export function decodeParamsFromHash(hash: string): GenerationParams | null {
  const raw = hash.replace(/^#/, '')
  const part = raw.split('&').find((p) => p.startsWith(`${HASH_KEY}=`))
  if (!part) return null
  try {
    const json = base64UrlDecode(part.slice(HASH_KEY.length + 1))
    const p = JSON.parse(json) as Record<string, unknown>
    if (p.v !== VERSION) return null
    return sanitize(p)
  } catch {
    return null
  }
}

function round(n: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** Valide / borne les données décodées avant de les rendre à l'app. */
function sanitize(p: Record<string, unknown>): GenerationParams | null {
  const s = p.s as [number, number] | undefined
  if (!Array.isArray(s) || s.length !== 2) return null
  const [lat, lng] = s
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  const parseRange = (
    arr: unknown,
    bounds: { min: number; max: number },
  ): { min: number; max: number } | null => {
    if (!Array.isArray(arr) || arr.length !== 2) return null
    const min = clamp(Number(arr[0]), bounds.min, bounds.max)
    const max = clamp(Number(arr[1]), bounds.min, bounds.max)
    if (Number.isNaN(min) || Number.isNaN(max)) return null
    return { min: Math.min(min, max), max: Math.max(min, max) }
  }

  const distanceKm = p.d == null ? null : parseRange(p.d, DISTANCE_BOUNDS_KM)
  const elevationGainM = p.e == null ? null : parseRange(p.e, ELEVATION_BOUNDS_M)
  // Au moins un critère doit être présent et valide.
  if (!distanceKm && !elevationGainM) return null

  const terrain = ['route', 'chemin_large', 'single', 'mixte'].includes(p.t as string)
    ? (p.t as GenerationParams['terrain'])
    : 'mixte'
  const hills = ['plat', 'vallonné', 'montagneux'].includes(p.h as string)
    ? (p.h as GenerationParams['hills'])
    : 'vallonné'
  const resultsCount = (RESULTS_COUNT_OPTIONS as readonly number[]).includes(
    Number(p.n),
  )
    ? Number(p.n)
    : 5

  return {
    start: { lat, lng },
    distanceKm,
    elevationGainM,
    terrain,
    preferForest: p.f === 1,
    hills,
    resultsCount,
  }
}
