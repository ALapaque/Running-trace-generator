/**
 * Configuration centralisée du générateur de parcours.
 * Pondérations de scoring, limites, couleurs : tout est ajustable ici.
 */

import type { PathType } from './types/osm'
import type { TerrainPreference, HillPreference } from './types/ors'

export interface ScoringWeights {
  /** Écart relatif distance cible vs distance réelle. */
  w_dist: number
  /** Écart relatif D+ cible vs D+ réel. */
  w_dplus: number
  /** Pénalité si le tracé ne respecte pas le type de chemin demandé. */
  w_chemin: number
  /** Pénalité si toggle forêt activé et tracé pauvre en forêt. */
  w_foret: number
  /** Pénalité de profil (plat / vallonné / montagneux). */
  w_profile: number
}

export const SCORING_WEIGHTS: ScoringWeights = {
  w_dist: 0.25,
  w_dplus: 0.25,
  w_chemin: 0.25,
  w_foret: 0.15,
  w_profile: 0.1,
}

/** Génération ORS — nombre de candidats à générer en parallèle (valeur min). */
export const ORS_CANDIDATES = 8

/** Options proposées à l'utilisateur pour le nombre d'alternatives retournées. */
export const RESULTS_COUNT_OPTIONS = [3, 5, 10] as const
export type ResultsCount = (typeof RESULTS_COUNT_OPTIONS)[number]
export const DEFAULT_RESULTS_COUNT: ResultsCount = 5

/**
 * Combien de candidats ORS générer pour pouvoir extraire `top` alternatives.
 * On garde une marge de sélection (~+3) pour que le scoring puisse écarter
 * les pires candidats même quand l'utilisateur demande 10 résultats.
 */
export function candidatesForResultsCount(top: number): number {
  return Math.max(ORS_CANDIDATES, top + 3)
}

/** ORS sous-livre souvent ; on demande +10% pour compenser. */
export const ORS_OVER_REQUEST_RATIO = 1.1

/** Distance min/max acceptée par l'app, en km. */
export const DISTANCE_BOUNDS_KM = { min: 3, max: 50, step: 0.5 } as const

/** D+ min/max acceptée par l'app, en mètres. */
export const ELEVATION_BOUNDS_M = { min: 0, max: 2000, step: 50 } as const

/** Vitesse running par défaut pour estimer le temps (min/km). */
export const PACE_MIN_PER_KM = 6

/** Décimation du tracé pour analyse Overpass — environ 1 point par X mètres. */
export const OVERPASS_DECIMATION_M = 50

/** Décimation du tracé pour l'export GPX — environ 1 point par X mètres (Komoot limite à 10 000 points). */
export const GPX_DECIMATION_M = 10

/** Marge ajoutée au bbox Overpass autour du tracé, en degrés (~30m). */
export const BBOX_MARGIN_DEG = 0.0003

/** Distance max pour considérer qu'un point ORS appartient à un way OSM, en mètres. */
export const MATCH_MAX_DISTANCE_M = 15

/** Bruit SRTM : on ignore les variations d'altitude inférieures à ce seuil. */
export const ELEVATION_NOISE_M = 2

/** Concurrence max sur Overpass (fair-use). */
export const OVERPASS_MAX_CONCURRENT = 3

/** TTL du cache Overpass dans localStorage, en millisecondes (24h). */
export const OVERPASS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Précision du bbox utilisé comme clé de cache (degrés). */
export const BBOX_CACHE_PRECISION = 0.01

/** Couleurs des polylines par type de terrain (palette néon dark). */
export const PATH_COLORS: Record<PathType | 'unknown', string> = {
  route: '#00E5FF',
  chemin_large: '#FF9F1C',
  single: '#A8FF00',
  mixte: '#B86DFF',
  unknown: '#6B7280',
}

/** Profil dénivelé selon le type de côte demandé. */
export interface HillProfile {
  /** Pénalité multiplicative selon la concentration du D+. */
  penalty: (dPlus: number, distanceKm: number, climbConcentration: number) => number
}

/**
 * climbConcentration ∈ [0, 1] : 0 = D+ étalé régulièrement, 1 = D+ concentré en une seule montée
 * (calculé dans useScoring à partir de l'écart-type des pentes par segment).
 */
export const HILL_PROFILES: Record<HillPreference, HillProfile> = {
  plat: {
    penalty: (dPlus, distanceKm, _conc) => {
      // Pénalise dénivelé élevé et pentes inégales
      const ratio = dPlus / Math.max(distanceKm, 1)
      return Math.min(1, ratio / 30)
    },
  },
  vallonné: {
    penalty: (_dPlus, _distanceKm, concentration) => {
      // Idéal : concentration faible/moyenne → montées courtes répétées
      return Math.abs(concentration - 0.35)
    },
  },
  montagneux: {
    penalty: (_dPlus, _distanceKm, concentration) => {
      // Idéal : concentration forte → grosses montées peu nombreuses
      return Math.max(0, 0.8 - concentration)
    },
  },
}

export const TERRAIN_LABELS: Record<TerrainPreference, string> = {
  route: 'Route',
  chemin_large: 'Chemin large',
  single: 'Single track',
  mixte: 'Mixte',
}

export const HILL_LABELS: Record<HillPreference, string> = {
  plat: 'Plat',
  vallonné: 'Vallonné',
  montagneux: 'Montagneux',
}
