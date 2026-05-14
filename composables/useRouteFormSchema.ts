/**
 * Schéma de validation Valibot pour le formulaire d'entrée.
 * Distance et dénivelé sont des plages min–max (min ≤ max).
 */

import * as v from 'valibot'
import { DISTANCE_BOUNDS_KM, ELEVATION_BOUNDS_M } from '../config'

function rangeSchema(bounds: { min: number; max: number }) {
  return v.pipe(
    v.object({
      min: v.pipe(v.number(), v.minValue(bounds.min), v.maxValue(bounds.max)),
      max: v.pipe(v.number(), v.minValue(bounds.min), v.maxValue(bounds.max)),
    }),
    v.check((r) => r.min <= r.max, 'La borne min doit être ≤ à la borne max'),
  )
}

export const RouteFormSchema = v.pipe(
  v.object({
    start: v.object({
      lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
      lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    }),
    // Distance et dénivelé optionnels (`null` = non contraint).
    distanceKm: v.nullable(rangeSchema(DISTANCE_BOUNDS_KM)),
    elevationGainM: v.nullable(rangeSchema(ELEVATION_BOUNDS_M)),
    terrain: v.picklist(['route', 'chemin_large', 'single', 'mixte']),
    preferForest: v.boolean(),
    hills: v.picklist(['plat', 'vallonné', 'montagneux']),
  }),
  v.check(
    (input) => input.distanceKm !== null || input.elevationGainM !== null,
    'Au moins la distance ou le dénivelé doit être renseigné',
  ),
)

export type RouteFormValues = v.InferOutput<typeof RouteFormSchema>

export function useRouteFormSchema() {
  function validate(
    input: unknown,
  ): { ok: true; value: RouteFormValues } | { ok: false; issues: string[] } {
    const r = v.safeParse(RouteFormSchema, input)
    if (r.success) return { ok: true, value: r.output }
    return { ok: false, issues: r.issues.map((i) => i.message) }
  }
  return { validate }
}
