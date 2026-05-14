/**
 * Transformations d'un parcours déjà généré (sans appel réseau).
 */

import { haversineM } from './geo'
import { climbConcentration } from './climbs'
import { computeElevationGainLoss } from '../composables/useRouteGenerator'
import type { AnalyzedRoute } from '../types'
import type { RoutePoint } from '../types/ors'

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
