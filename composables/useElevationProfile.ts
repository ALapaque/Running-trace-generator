/**
 * Construction des séries pour le profil altimétrique (Chart.js).
 */

import type { RoutePoint } from '../types/ors'

export interface ElevationSerie {
  labels: number[] // distance cumulée en km
  data: number[] // altitude en m
}

export function useElevationProfile() {
  function build(points: RoutePoint[], maxPoints = 200): ElevationSerie {
    if (points.length === 0) return { labels: [], data: [] }
    const step = Math.max(1, Math.floor(points.length / maxPoints))
    const labels: number[] = []
    const data: number[] = []
    for (let i = 0; i < points.length; i += step) {
      labels.push(+(points[i]!.distance / 1000).toFixed(2))
      data.push(+points[i]!.ele.toFixed(1))
    }
    // Toujours inclure le dernier point pour une fin propre
    const last = points[points.length - 1]!
    if (labels[labels.length - 1] !== +(last.distance / 1000).toFixed(2)) {
      labels.push(+(last.distance / 1000).toFixed(2))
      data.push(+last.ele.toFixed(1))
    }
    return { labels, data }
  }

  return { build }
}
