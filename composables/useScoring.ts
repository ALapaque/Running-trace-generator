/**
 * Scoring d'un candidat enrichi.
 *
 * score = w_dist     * |distance_real - cible| / cible
 *       + w_dplus    * |dplus - dplus_cible| / max(dplus_cible, 1)
 *       + w_chemin   * (1 - % du type demandé)
 *       + w_foret    * (1 - % forêt)   [si toggle activé]
 *       + w_profile  * pénalité_shape(type_de_côte)
 *
 * Plus le score est bas, mieux c'est. Retourne le top 3 trié.
 */

import { HILL_PROFILES, SCORING_WEIGHTS } from '../config'
import type { AnalyzedRoute } from '../types'
import type { TerrainStats } from '../types/osm'
import type { HillPreference, RouteCandidate, RouteGenerationInput, TerrainPreference } from '../types/ors'

interface AnalyzedInput {
  candidate: RouteCandidate
  terrain: TerrainStats
  segments: AnalyzedRoute['segments']
  fallback: boolean
}

/** Concentration du D+ ∈ [0, 1] : coefficient de variation des montées par tronçon. */
export function computeClimbConcentration(candidate: RouteCandidate): number {
  const pts = candidate.points
  if (pts.length < 10) return 0.5
  // On découpe en 10 tronçons de longueur égale et on calcule le D+ de chacun.
  const buckets = 10
  const bucketSize = Math.floor(pts.length / buckets)
  const gains: number[] = []
  for (let b = 0; b < buckets; b++) {
    const start = b * bucketSize
    const end = b === buckets - 1 ? pts.length : start + bucketSize
    let g = 0
    for (let i = start + 1; i < end; i++) {
      const delta = pts[i]!.ele - pts[i - 1]!.ele
      if (delta > 0) g += delta
    }
    gains.push(g)
  }
  const mean = gains.reduce((a, b) => a + b, 0) / gains.length
  if (mean === 0) return 0
  const variance =
    gains.reduce((s, g) => s + (g - mean) ** 2, 0) / gains.length
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / mean // coefficient de variation
  return Math.max(0, Math.min(1, cv / 2)) // borne à [0, 1]
}

function terrainShare(stats: TerrainStats, pref: TerrainPreference): number {
  switch (pref) {
    case 'route':
      return stats.route
    case 'chemin_large':
      return stats.chemin_large
    case 'single':
      return stats.single
    case 'mixte':
      // Pour 'mixte', on récompense la diversité : pas de pénalité majeure.
      return 1 - stats.unknown
  }
}

function profilePenalty(
  candidate: RouteCandidate,
  hills: HillPreference,
  concentration: number,
): number {
  const distanceKm = candidate.distanceM / 1000
  const profile = HILL_PROFILES[hills]
  return Math.max(0, Math.min(1, profile.penalty(candidate.elevationGainM, distanceKm, concentration)))
}

/**
 * Erreur d'une valeur vis-à-vis d'une plage [min, max] :
 *  - 0 si la valeur est dans la plage
 *  - sinon, écart au bord le plus proche, normalisé par le milieu de plage.
 */
export function rangeError(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 0
  const ref = Math.max((min + max) / 2, 1)
  return value < min ? (min - value) / ref : (value - max) / ref
}

export function useScoring() {
  function scoreOne(input: AnalyzedInput, request: RouteGenerationInput): AnalyzedRoute {
    // Distance / dénivelé optionnels : un critère non contraint → erreur 0
    // (il ne pèse pas sur le score, seuls les critères demandés comptent).
    const distanceErr = request.distanceKm
      ? rangeError(
          input.candidate.distanceM,
          request.distanceKm.min * 1000,
          request.distanceKm.max * 1000,
        )
      : 0
    const elevationErr = request.elevationGainM
      ? rangeError(
          input.candidate.elevationGainM,
          request.elevationGainM.min,
          request.elevationGainM.max,
        )
      : 0
    const terrainErr = 1 - terrainShare(input.terrain, request.terrain)
    const forestErr = request.preferForest ? 1 - input.terrain.forest : 0
    const concentration = computeClimbConcentration(input.candidate)
    const profileErr = profilePenalty(input.candidate, request.hills, concentration)

    // Lorsque le terrain est en fallback, on neutralise les composantes terrain/forêt
    // pour éviter de pénaliser injustement (toutes les composantes seraient à 1).
    const effectiveWeights = {
      ...SCORING_WEIGHTS,
      w_chemin: input.fallback ? 0 : SCORING_WEIGHTS.w_chemin,
      w_foret: input.fallback || !request.preferForest ? 0 : SCORING_WEIGHTS.w_foret,
    }

    const scoreBreakdown = {
      distance: effectiveWeights.w_dist * Math.min(distanceErr, 1),
      elevation: effectiveWeights.w_dplus * Math.min(elevationErr, 1),
      terrain: effectiveWeights.w_chemin * Math.min(terrainErr, 1),
      forest: effectiveWeights.w_foret * Math.min(forestErr, 1),
      profile: effectiveWeights.w_profile * profileErr,
    }

    const score =
      scoreBreakdown.distance +
      scoreBreakdown.elevation +
      scoreBreakdown.terrain +
      scoreBreakdown.forest +
      scoreBreakdown.profile

    return {
      ...input.candidate,
      terrain: input.terrain,
      segments: input.segments,
      score,
      scoreBreakdown,
      climbConcentration: concentration,
      terrainFallback: input.fallback,
    }
  }

  function rank(inputs: AnalyzedInput[], request: RouteGenerationInput, top = 3): AnalyzedRoute[] {
    const scored = inputs.map((i) => scoreOne(i, request))
    return scored.sort((a, b) => a.score - b.score).slice(0, top)
  }

  return { scoreOne, rank }
}
