/**
 * Export GPX d'un parcours analysé : décime + génère + télécharge / partage.
 *
 * Partage vers Komoot / Strava : il n'existe pas d'API d'upload utilisable
 * 100 % côté client (OAuth serveur requis). On utilise donc la Web Share API —
 * sur mobile, partager un fichier `.gpx` fait apparaître Komoot/Strava (et les
 * autres apps) comme cibles. Sur desktop (Web Share fichiers non supportée),
 * l'appelant retombe sur un téléchargement classique.
 */

import { GPX_DECIMATION_M } from '../config'
import { decimateByDistance } from '../utils/geo'
import { buildGpx, downloadGpx } from '../utils/gpx-builder'
import type { AnalyzedRoute } from '../types'

export type ShareResult = 'shared' | 'cancelled' | 'unsupported'

export function useGpxExport() {
  function buildGpxForRoute(route: AnalyzedRoute, options: { name?: string } = {}): string {
    const decimated = decimateByDistance(route.points, GPX_DECIMATION_M)
    const distanceKm = (route.distanceM / 1000).toFixed(1)
    const dPlus = Math.round(route.elevationGainM)
    const name = options.name ?? `${distanceKm}km - ${dPlus}m D+`
    return buildGpx(
      decimated.map((p) => ({ lat: p.lat, lng: p.lng, ele: p.ele })),
      {
        creator: 'RunGen',
        metadataName: `Parcours RunGen du ${new Date().toISOString().slice(0, 10)}`,
        trackName: name,
      },
    )
  }

  function filenameForRoute(route: AnalyzedRoute): string {
    const distanceKm = (route.distanceM / 1000).toFixed(1).replace('.', '_')
    const dPlus = Math.round(route.elevationGainM)
    return `rungen-${distanceKm}km-${dPlus}m.gpx`
  }

  /** Construit un File GPX (pour la Web Share API). */
  function gpxFileForRoute(route: AnalyzedRoute): File {
    const gpx = buildGpxForRoute(route)
    return new File([gpx], filenameForRoute(route), { type: 'application/gpx+xml' })
  }

  /** True si le navigateur peut partager un fichier `.gpx`. */
  function canShareGpx(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
      return false
    }
    try {
      const probe = new File(['<gpx/>'], 'probe.gpx', { type: 'application/gpx+xml' })
      return navigator.canShare({ files: [probe] })
    } catch {
      return false
    }
  }

  /** Téléchargement classique du fichier `.gpx`. */
  function exportRoute(route: AnalyzedRoute, filenameHint?: string): void {
    const gpx = buildGpxForRoute(route, filenameHint ? { name: filenameHint } : {})
    downloadGpx(filenameForRoute(route), gpx)
  }

  /**
   * Ouvre le partage système avec le fichier GPX.
   * Retourne :
   *  - 'shared'      : partage effectué
   *  - 'cancelled'   : l'utilisateur a annulé la feuille de partage
   *  - 'unsupported' : Web Share fichiers indisponible (→ fallback download)
   */
  async function shareRoute(route: AnalyzedRoute): Promise<ShareResult> {
    if (!canShareGpx()) return 'unsupported'
    const file = gpxFileForRoute(route)
    const distanceKm = (route.distanceM / 1000).toFixed(1)
    try {
      await navigator.share({
        files: [file],
        title: 'Parcours RunGen',
        text: `Parcours running ${distanceKm} km · ${Math.round(route.elevationGainM)} m D+`,
      })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled'
      return 'unsupported'
    }
  }

  return {
    buildGpxForRoute,
    gpxFileForRoute,
    filenameForRoute,
    canShareGpx,
    exportRoute,
    shareRoute,
  }
}
