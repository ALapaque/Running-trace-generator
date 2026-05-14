export * from './ors'
export * from './osm'
export * from './gpx'

import type { RouteCandidate, RouteGenerationInput } from './ors'
import type { TerrainStats, SegmentClassification } from './osm'

/** Paramètres complets d'une génération (entrée + nombre d'alternatives). */
export interface GenerationParams extends RouteGenerationInput {
  resultsCount: number
}

/** Entrée d'historique : un parcours sauvegardé, allégé pour localStorage. */
export interface RouteHistoryEntry {
  id: string
  /** Timestamp de génération (ms). */
  ts: number
  distanceM: number
  elevationGainM: number
  elevationLossM: number
  /** Points décimés (lat/lng/ele) — suffisant pour réafficher + ré-exporter. */
  points: Array<{ lat: number; lng: number; ele: number }>
  /** Répartition terrain (vide si analyse indisponible). */
  terrain: TerrainStats | null
}

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
