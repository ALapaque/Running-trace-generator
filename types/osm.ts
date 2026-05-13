/** Types liés à OpenStreetMap / Overpass. */

import type { LatLng } from './ors'

/** Catégorie haute du chemin telle que présentée à l'utilisateur. */
export type PathType = 'route' | 'chemin_large' | 'single' | 'mixte'

/** Bounding box en degrés. */
export interface BBox {
  south: number
  west: number
  north: number
  east: number
}

/** Way OSM tel que renvoyé par Overpass avec `out geom`. */
export interface OverpassWay {
  type: 'way'
  id: number
  geometry: Array<{ lat: number; lon: number }>
  tags: {
    highway?: string
    surface?: string
    tracktype?: string
    width?: string
    landuse?: string
    natural?: string
    [key: string]: string | undefined
  }
}

export interface OverpassResponse {
  version: number
  generator: string
  elements: OverpassWay[]
}

/** Classification d'un segment du tracé. */
export interface SegmentClassification {
  /** Index du point de départ dans le tableau de points décimés. */
  index: number
  point: LatLng
  pathType: PathType | 'unknown'
  inForest: boolean
  matchedWayId?: number
  /** Tags pertinents pour debug. */
  tags?: Record<string, string>
}

/** Statistiques de répartition du terrain pour un parcours. */
export interface TerrainStats {
  /** Pourcentage en route (0..1). */
  route: number
  chemin_large: number
  single: number
  mixte: number
  forest: number
  /** Pourcentage de segments non identifiés. */
  unknown: number
}
