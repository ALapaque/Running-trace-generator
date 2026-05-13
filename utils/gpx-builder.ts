/**
 * Génération GPX 1.1 côté client.
 *
 * Décisions :
 * - Pas de `<time>` sur les `<trkpt>` (sinon Strava interprète comme une activité).
 * - `<ele>` obligatoire pour Komoot.
 * - Décimation préalable conseillée (Komoot limite à 10 000 points).
 */

import type { GpxBuilderOptions, GpxTrackPoint } from '../types/gpx'

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatCoord(n: number): string {
  // 6 décimales : précision sub-métrique, suffisant pour Strava/Komoot.
  return n.toFixed(6)
}

function formatEle(n: number): string {
  return n.toFixed(1)
}

export function buildGpx(points: GpxTrackPoint[], options: GpxBuilderOptions = {}): string {
  const creator = escapeXml(options.creator ?? 'RunGen')
  const time = options.time ?? new Date().toISOString()
  const metadataName = escapeXml(options.metadataName ?? `Parcours du ${time.slice(0, 10)}`)
  const trackName = escapeXml(options.trackName ?? 'Parcours généré')

  const trkpts = points
    .map((p) => {
      const eleTag =
        typeof p.ele === 'number' && Number.isFinite(p.ele)
          ? `<ele>${formatEle(p.ele)}</ele>`
          : ''
      return `      <trkpt lat="${formatCoord(p.lat)}" lon="${formatCoord(p.lng)}">${eleTag}</trkpt>`
    })
    .join('\n')

  return `${XML_HEADER}
<gpx version="1.1" creator="${creator}" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${metadataName}</name>
    <time>${escapeXml(time)}</time>
  </metadata>
  <trk>
    <name>${trackName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`
}

/** Déclenche le téléchargement d'un GPX dans le navigateur. */
export function downloadGpx(filename: string, gpxContent: string): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
