/**
 * Transformations d'un parcours déjà généré (sans appel réseau).
 */

import { haversineM } from './geo'
import { climbConcentration } from './climbs'
import { computeElevationGainLoss } from '../composables/useRouteGenerator'
import type { AnalyzedRoute } from '../types'
import type { LatLng, RoutePoint } from '../types/ors'

/**
 * Échantillonne `count` waypoints intermédiaires régulièrement espacés (par
 * index) le long d'un parcours, précédés du point de départ. Avec `closeLoop`,
 * le départ est aussi répété en fin pour fermer la boucle.
 *
 * Réutilisé par l'édition manuelle du tracé et le re-routage trail BRouter.
 */
export function sampleWaypoints(
  points: RoutePoint[],
  count = 6,
  closeLoop = false,
): LatLng[] {
  const start: LatLng = { lat: points[0]!.lat, lng: points[0]!.lng }
  const wps: LatLng[] = [start]
  for (let i = 1; i <= count; i++) {
    const idx = Math.min(points.length - 1, Math.floor((points.length / (count + 1)) * i))
    wps.push({ lat: points[idx]!.lat, lng: points[idx]!.lng })
  }
  if (closeLoop) wps.push(start)
  return wps
}

/**
 * Inverse le sens d'un parcours :
 *  - points dans l'ordre inverse, distance cumulée recalculée depuis 0
 *  - D+ et D- échangés (recalculés sur le profil inversé)
 *  - segments de terrain inversés et réindexés
 *  - concentration des montées recalculée (le profil change de forme)
 */
export function reverseRoute(route: AnalyzedRoute): AnalyzedRoute {
  const reversed = [...route.points].reverse()
  let dist = 0
  const points: RoutePoint[] = reversed.map((p, i, arr) => {
    if (i > 0) {
      const prev = arr[i - 1]!
      dist += haversineM({ lat: prev.lat, lng: prev.lng }, { lat: p.lat, lng: p.lng })
    }
    return { lat: p.lat, lng: p.lng, ele: p.ele, distance: dist }
  })

  const { gain, loss } = computeElevationGainLoss(points)
  const segments = [...route.segments].reverse().map((s, i) => ({ ...s, index: i }))

  return {
    ...route,
    id: route.id.endsWith('-rev') ? route.id.slice(0, -4) : `${route.id}-rev`,
    points,
    elevationGainM: gain,
    elevationLossM: loss,
    segments,
    climbConcentration: climbConcentration(points),
  }
}
