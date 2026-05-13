export * from './ors'
export * from './osm'
export * from './gpx'

import type { RouteCandidate } from './ors'
import type { TerrainStats, SegmentClassification } from './osm'

/** Candidat enrichi avec analyse de terrain et score. */
export interface AnalyzedRoute extends RouteCandidate {
  terrain: TerrainStats
  segments: SegmentClassification[]
  score: number
  /** Décomposition du score pour le débogage / l'UI. */
  scoreBreakdown: {
    distance: number
    elevation: number
    terrain: number
    forest: number
    profile: number
  }
  /** Concentration du D+ ∈ [0, 1]. */
  climbConcentration: number
  /** True si Overpass a échoué pour ce candidat → terrain non fiable. */
  terrainFallback: boolean
}
