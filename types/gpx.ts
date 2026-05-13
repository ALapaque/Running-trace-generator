/** Types liés à l'export GPX. */

export interface GpxTrackPoint {
  lat: number
  lng: number
  ele?: number
}

export interface GpxTrack {
  name: string
  points: GpxTrackPoint[]
}

export interface GpxBuilderOptions {
  creator?: string
  trackName?: string
  metadataName?: string
  /** Date ISO 8601 ; par défaut now(). */
  time?: string
}
