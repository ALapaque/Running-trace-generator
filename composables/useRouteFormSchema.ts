/**
 * Schéma de validation Valibot pour le formulaire d'entrée.
 */

import * as v from 'valibot'
import { DISTANCE_BOUNDS_KM, ELEVATION_BOUNDS_M } from '../config'

export const RouteFormSchema = v.object({
  start: v.object({
    lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  }),
  distanceKm: v.pipe(
    v.number(),
    v.minValue(DISTANCE_BOUNDS_KM.min),
    v.maxValue(DISTANCE_BOUNDS_KM.max),
  ),
  elevationGainM: v.pipe(
    v.number(),
    v.minValue(ELEVATION_BOUNDS_M.min),
    v.maxValue(ELEVATION_BOUNDS_M.max),
  ),
  terrain: v.picklist(['route', 'chemin_large', 'single', 'mixte']),
  preferForest: v.boolean(),
  hills: v.picklist(['plat', 'vallonné', 'montagneux']),
})

export type RouteFormValues = v.InferOutput<typeof RouteFormSchema>

export function useRouteFormSchema() {
  function validate(input: unknown): { ok: true; value: RouteFormValues } | { ok: false; issues: string[] } {
    const r = v.safeParse(RouteFormSchema, input)
    if (r.success) return { ok: true, value: r.output }
    return { ok: false, issues: r.issues.map((i) => i.message) }
  }
  return { validate }
}
