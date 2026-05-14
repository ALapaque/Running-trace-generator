/** Types liés à OpenRouteService. */

export type TerrainPreference = 'route' | 'chemin_large' | 'single' | 'mixte'
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
  /** Plage de distance acceptée, en km. */
  distanceKm: NumberRange
  /** Plage de dénivelé positif acceptée, en mètres. */
  elevationGainM: NumberRange
  terrain: TerrainPreference
  preferForest: boolean
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
