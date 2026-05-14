/** Types liés à OpenRouteService. */

/**
 * Type de course :
 *  - `running` : bitume / routes — profil ORS `foot-walking`.
 *  - `trail`   : sentiers & forêt — profil ORS `foot-hiking` + weighting `green`.
 */
export type RouteMode = 'running' | 'trail'
export type HillPreference = 'plat' | 'vallonné' | 'montagneux'

export interface LatLng {
  lat: number
  lng: number
}

/** Plage de valeurs min–max (inclusive). */
export interface NumberRange {
  min: number
  max: number
}

export interface RouteGenerationInput {
  start: LatLng
  /** Plage de distance acceptée, en km. `null` = non contrainte. */
  distanceKm: NumberRange | null
  /** Plage de dénivelé positif acceptée, en mètres. `null` = non contrainte. */
  elevationGainM: NumberRange | null
  /** Running (route) ou Trail (sentiers & forêt). Pilote profil ORS + scoring. */
  mode: RouteMode
  hills: HillPreference
}

/** Paramètres bruts envoyés à ORS. */
export interface OrsDirectionsRequest {
  coordinates: [number, number][]
  elevation: boolean
  geometry: true
  instructions: false
  options: {
    round_trip: {
      length: number
      points: number
      seed: number
    }
    /** Biais vers les espaces verts (0–1), utilisé en mode trail. */
    profile_params?: {
      weightings: {
        green: number
      }
    }
  }
}

/** Réponse minimale ORS (mode `format=json` avec `geometry_simplify=false`). */
export interface OrsDirectionsResponse {
  routes: Array<{
    summary: {
      distance: number // en mètres
      duration: number
    }
    geometry: string // polyline encoded
    elevation?: number[]
    way_points?: number[]
    /** Optionnellement renvoyé en mode JSON sans encodage. */
    geometry_format?: 'encodedpolyline'
  }>
  /** Format GeoJSON quand on appelle `/geojson`. */
  features?: Array<{
    type: 'Feature'
    geometry: {
      type: 'LineString'
      coordinates: [number, number, number][] // [lon, lat, ele]
    }
    properties: {
      summary: {
        distance: number
        duration: number
        ascent?: number
        descent?: number
      }
    }
  }>
}

/** Point d'un parcours avec altitude. */
export interface RoutePoint {
  lat: number
  lng: number
  ele: number
  /** Distance cumulée depuis le départ, en mètres. */
  distance: number
}

/** Candidat ORS brut (avant analyse de terrain). */
export interface RouteCandidate {
  id: string
  seed: number
  points: RoutePoint[]
  distanceM: number
  elevationGainM: number
  elevationLossM: number
}
