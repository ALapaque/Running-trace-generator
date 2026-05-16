/**
 * Génération de boucles round-trip *côté client* — remplace ORS round_trip
 * (notoirement instable : la longueur cible y est une suggestion plutôt qu'une
 * contrainte, avec des écarts pouvant dépasser 100 % dans certaines zones).
 *
 * Approche : on construit un polygone régulier (par défaut un pentagone) de N
 * waypoints autour du point de départ, orienté par un bearing dérivé du seed
 * (pour la variété des alternatives). Le client `useRouteGenerator` envoie
 * ensuite ces waypoints à ORS *directions* (prévisible, mature), mesure la
 * distance retournée, et redimensionne le polygone en itérant jusqu'à
 * converger sur la cible.
 *
 * Fonctions ici : *pures*, déterministes, testables sans réseau.
 */

import type { LatLng } from '../types/ors'

const EARTH_RADIUS_M = 6_371_008.8
const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * PRNG mulberry32 — déterministe, rapide, suffisant pour orienter un polygone.
 * Permet à un seed donné de toujours produire la même boucle.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Rayon circonscrit (m) d'un N-gone régulier de périmètre donné.
 * Formule : périmètre = N × 2 × R × sin(π/N) → R = P / (2N sin(π/N)).
 */
export function circumradiusForPerimeter(perimeterM: number, numSides: number): number {
  if (numSides < 3) throw new Error('numSides doit être >= 3')
  return perimeterM / (2 * numSides * Math.sin(Math.PI / numSides))
}

/**
 * N bearings (degrés, [0, 360)) répartis uniformément autour du cercle, avec
 * un offset pseudo-aléatoire dérivé du seed (variété des candidats).
 */
export function bearingsFromSeed(seed: number, numSides: number): number[] {
  if (numSides < 3) throw new Error('numSides doit être >= 3')
  const rng = mulberry32(seed)
  const offset = rng() * 360
  const step = 360 / numSides
  const out: number[] = []
  for (let i = 0; i < numSides; i++) {
    out.push((offset + i * step) % 360)
  }
  return out
}

/**
 * Point destination en partant de `origin` selon `bearingDeg` et `distanceM`,
 * en suivant un grand cercle (sphère). Suffisamment précis pour < 100 km.
 */
export function destinationPoint(
  origin: LatLng,
  bearingDeg: number,
  distanceM: number,
): LatLng {
  const δ = distanceM / EARTH_RADIUS_M
  const θ = bearingDeg * DEG_TO_RAD
  const φ1 = origin.lat * DEG_TO_RAD
  const λ1 = origin.lng * DEG_TO_RAD
  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  const φ2 = Math.asin(sinφ2)
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1)
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2
  const λ2 = λ1 + Math.atan2(y, x)
  return {
    lat: φ2 * RAD_TO_DEG,
    // Normalise la longitude dans [-180, 180].
    lng: (((λ2 * RAD_TO_DEG + 540) % 360) - 180),
  }
}

/**
 * Construit la séquence de waypoints d'une boucle ORS : départ, N sommets
 * d'un N-gone régulier orienté par les `bearings` à `radiusM` du départ,
 * puis retour au départ pour fermer la boucle.
 */
export function buildLoopWaypoints(
  start: LatLng,
  bearings: number[],
  radiusM: number,
): LatLng[] {
  const vertices = bearings.map((b) => destinationPoint(start, b, radiusM))
  return [start, ...vertices, start]
}

/**
 * Met à l'échelle le rayon pour la prochaine itération : si l'itération
 * précédente a renvoyé `actualDistanceM` pour une cible `targetDistanceM`,
 * on multiplie le rayon par leur ratio (la distance routée est ~linéaire
 * vs le rayon du polygone, donc on converge vite).
 *
 * `cap` borne le ratio de rescale par itération (évite les sur-corrections
 * sur des mesures bruitées).
 */
export function rescaleRadius(
  currentRadiusM: number,
  actualDistanceM: number,
  targetDistanceM: number,
  cap = 2,
): number {
  if (actualDistanceM <= 0) return currentRadiusM * cap
  const ratio = targetDistanceM / actualDistanceM
  const bounded = Math.max(1 / cap, Math.min(cap, ratio))
  return currentRadiusM * bounded
}
