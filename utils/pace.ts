/**
 * Allure de course (min/km) : presets, formatage, cycle.
 */

export const PACE_PRESETS_MIN_PER_KM = [4.5, 5, 5.5, 6, 6.5, 7] as const

/** Formate une allure (min/km) en `m:ss`. Ex. 5.5 → "5:30". */
export function formatPace(minPerKm: number): string {
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  if (s === 60) return `${m + 1}:00`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Allure suivante dans les presets (cycle).
 * Tolère une valeur courante hors-preset : renvoie le 1er preset strictement
 * supérieur, sinon boucle au plus petit.
 */
export function nextPace(current: number): number {
  const next = PACE_PRESETS_MIN_PER_KM.find((p) => p > current + 1e-9)
  return next ?? PACE_PRESETS_MIN_PER_KM[0]
}
