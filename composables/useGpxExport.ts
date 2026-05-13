/**
 * Export GPX d'un parcours analysé : décime + génère + télécharge.
 */

import { GPX_DECIMATION_M } from '../config'
import { decimateByDistance } from '../utils/geo'
import { buildGpx, downloadGpx } from '../utils/gpx-builder'
import type { AnalyzedRoute } from '../types'

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

  function exportRoute(route: AnalyzedRoute, filenameHint?: string): void {
    const gpx = buildGpxForRoute(route, filenameHint ? { name: filenameHint } : {})
    const distanceKm = (route.distanceM / 1000).toFixed(1).replace('.', '_')
    const dPlus = Math.round(route.elevationGainM)
    const filename = `rungen-${distanceKm}km-${dPlus}m.gpx`
    downloadGpx(filename, gpx)
  }

  return { buildGpxForRoute, exportRoute }
}
