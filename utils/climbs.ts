/**
 * Détection des montées réelles d'un tracé.
 *
 * Plutôt que de juger le profil sur un coefficient de variation grossier, on
 * segmente le tracé en *montées* (stretches d'ascension soutenue) et on en
 * tire des métriques exploitables : nombre de montées, plus longue montée,
 * concentration du D+.
 */

import type { RoutePoint } from '../types/ors'

export interface Climb {
  startIndex: number
  /** Index du sommet de la montée. */
  endIndex: number
  /** Longueur de la montée, en mètres. */
  lengthM: number
  /** Dénivelé positif de la montée, en mètres. */
  gainM: number
  /** Pente moyenne, en % (gainM / lengthM * 100). */
  gradient: number
}

/** Gain minimal pour qu'une ascension compte comme une montée (filtre le bruit). */
const MIN_CLIMB_GAIN_M = 10
/** Descente depuis le sommet qui clôt la montée en cours. */
const DESCENT_TO_CLOSE_M = 8

function makeClimb(points: RoutePoint[], startIndex: number, endIndex: number): Climb {
  const lengthM = Math.max(1, points[endIndex]!.distance - points[startIndex]!.distance)
  const gainM = points[endIndex]!.ele - points[startIndex]!.ele
  return {
    startIndex,
    endIndex,
    lengthM,
    gainM,
    gradient: (gainM / lengthM) * 100,
  }
}

/**
 * Segmente le tracé en montées. Une montée court du début d'une ascension
 * jusqu'à son sommet ; elle se clôt dès qu'on redescend de `DESCENT_TO_CLOSE_M`
 * sous ce sommet. Les ascensions de moins de `MIN_CLIMB_GAIN_M` sont ignorées.
 */
export function detectClimbs(points: RoutePoint[]): Climb[] {
  const climbs: Climb[] = []
  if (points.length < 2) return climbs

  let startIdx = 0
  let startEle = points[0]!.ele
  let peakEle = points[0]!.ele
  let peakIdx = 0

  for (let i = 1; i < points.length; i++) {
    const ele = points[i]!.ele
    if (ele >= peakEle) {
      peakEle = ele
      peakIdx = i
    } else if (peakEle - ele >= DESCENT_TO_CLOSE_M) {
      // Descente significative depuis le sommet → on clôt la montée éventuelle.
      if (peakEle - startEle >= MIN_CLIMB_GAIN_M) {
        climbs.push(makeClimb(points, startIdx, peakIdx))
      }
      startIdx = i
      startEle = ele
      peakEle = ele
      peakIdx = i
    }
  }
  // Montée en cours à la fin du tracé.
  if (peakEle - startEle >= MIN_CLIMB_GAIN_M) {
    climbs.push(makeClimb(points, startIdx, peakIdx))
  }
  return climbs
}

/**
 * Concentration du D+ ∈ [0, 1] :
 *  - 0  : aucune montée (plat) ou D+ étalé sur de nombreuses montées égales
 *  - 1  : tout le D+ tient dans une seule montée (montagneux)
 * Calculée comme part du D+ contenue dans la plus grosse montée.
 */
export function climbConcentration(points: RoutePoint[]): number {
  const climbs = detectClimbs(points)
  if (climbs.length === 0) return 0
  const totalGain = climbs.reduce((s, c) => s + c.gainM, 0)
  if (totalGain <= 0) return 0
  const longest = Math.max(...climbs.map((c) => c.gainM))
  return Math.min(1, longest / totalGain)
}
