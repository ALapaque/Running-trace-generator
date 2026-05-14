/**
 * Configuration centralisée du générateur de parcours.
 * Pondérations de scoring, limites, couleurs : tout est ajustable ici.
 */

import type { PathType } from './types/osm'
import type { HillPreference } from './types/ors'

export interface ScoringWeights {
  /** Écart relatif distance cible vs distance réelle. */
  w_dist: number
  /** Écart relatif D+ cible vs D+ réel. */
  w_dplus: number
  /** Pénalité si le tracé n'utilise pas les voies adaptées au mode (route / sentier). */
  w_chemin: number
  /** Pénalité si mode trail et tracé pauvre en forêt. */
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

/**
 * Poids `green` envoyé à ORS en mode trail (`options.profile_params.weightings`).
 * 0 = neutre, 1 = détour maximal vers les espaces verts. ~0.8 biaise fortement
 * vers forêts/parcs/sentiers sans trop dégrader la cible de distance.
 */
export const TRAIL_GREEN_WEIGHT = 0.8

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

/**
 * Ratio appliqué à la distance demandée à ORS.
 * Observation : sur des distances courtes (~7 km), ORS sur-livre plutôt qu'il
 * ne sous-livre. On reste donc à 1.0 (neutre) et on filtre les candidats par
 * tolérance dans le pipeline (DISTANCE_TOLERANCE_RATIO).
 */
export const ORS_OVER_REQUEST_RATIO = 1.0

/**
 * Tolérance appliquée aux bornes des plages avant scoring.
 * Un candidat hors de la plage élargie de cette tolérance est écarté.
 */
export const DISTANCE_TOLERANCE_RATIO = 0.075 // ±7.5 %
export const DISTANCE_TOLERANCE_ABS_MIN_M = 500
export const ELEVATION_TOLERANCE_RATIO = 0.15 // ±15 % (SRTM bruité)
export const ELEVATION_TOLERANCE_ABS_MIN_M = 50

/** Distance min/max acceptée par l'app, en km. */
export const DISTANCE_BOUNDS_KM = { min: 3, max: 50, step: 0.5 } as const

/** D+ min/max acceptée par l'app, en mètres. */
export const ELEVATION_BOUNDS_M = { min: 0, max: 2000, step: 50 } as const

/** Plages par défaut du formulaire (sélection min–max). */
export const DEFAULT_DISTANCE_RANGE_KM = { min: 8, max: 12 } as const
export const DEFAULT_ELEVATION_RANGE_M = { min: 100, max: 300 } as const

/**
 * Span de distance exploré quand l'utilisateur ne contraint PAS la distance
 * (seul le dénivelé est demandé). ORS round-trip exige une longueur cible :
 * on répartit les candidats sur ce span pour obtenir des distances variées.
 */
export const DEFAULT_DISTANCE_SPAN_KM = { min: 5, max: 25 } as const

/** Vitesse running par défaut pour estimer le temps (min/km). */
export const PACE_MIN_PER_KM = 6

/** Décimation du tracé pour analyse Overpass — environ 1 point par X mètres. */
export const OVERPASS_DECIMATION_M = 50

/** Décimation du tracé pour l'export GPX — environ 1 point par X mètres (Komoot limite à 10 000 points). */
export const GPX_DECIMATION_M = 10

/** Décimation du tracé pour la persistance localStorage des alternatives (compromis taille/qualité). */
export const RESULTS_PERSIST_DECIMATION_M = 20

/** Marge ajoutée au bbox Overpass autour du tracé, en degrés (~30m). */
export const BBOX_MARGIN_DEG = 0.0003

/** Distance max pour considérer qu'un point ORS appartient à un way OSM, en mètres. */
export const MATCH_MAX_DISTANCE_M = 15

/** Bruit SRTM : on ignore les variations d'altitude inférieures à ce seuil. */
export const ELEVATION_NOISE_M = 2

/** Concurrence max sur Overpass (fair-use). */
export const OVERPASS_MAX_CONCURRENT = 3

/** Timeout dur des requêtes réseau (ms). */
export const ORS_FETCH_TIMEOUT_MS = 20_000
export const OVERPASS_FETCH_TIMEOUT_MS = 18_000
export const NOMINATIM_FETCH_TIMEOUT_MS = 10_000

/**
 * Circuit breaker Overpass : après N échecs consécutifs, on arrête d'appeler
 * Overpass pour les candidats restants (fast-fallback) et on attend un cooldown
 * avant de réessayer. Évite d'attendre des minutes quand le service est down.
 */
export const OVERPASS_CIRCUIT_THRESHOLD = 2
export const OVERPASS_CIRCUIT_COOLDOWN_MS = 60_000

/** TTL du cache Overpass dans localStorage, en millisecondes (24h). */
export const OVERPASS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Précision du bbox utilisé comme clé de cache (degrés). */
export const BBOX_CACHE_PRECISION = 0.01

/** Couleurs des polylines par type de terrain (palette terre & forêt). */
export const PATH_COLORS: Record<PathType | 'unknown', string> = {
  route: '#3E6E94',
  chemin_large: '#A9763F',
  single: '#4F8C5A',
  mixte: '#7C8579',
  unknown: '#A8A293',
}

/** Couleur unique de la polyline quand l'analyse de terrain est indisponible. */
export const ROUTE_DEFAULT_COLOR = '#2F6B3F'

/**
 * Couleurs du profil altimétrique (SVG natif). Synchro avec le thème
 * « Outdoor naturel » — gridlines volontairement discrètes.
 */
export const CHART_COLORS = {
  line: '#2F6B3F', // olive-900
  area: '#7FA86B', // sage-400
  refLine: '#E7E2D5', // cream-200 — gridlines discrètes
  axis: '#D4CDBA', // cream-300
  text: '#6B6A60', // ink-500
} as const

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
