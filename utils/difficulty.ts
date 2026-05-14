/**
 * Difficulté estimée d'un parcours running.
 *
 * Basée sur le « kilomètre-effort » : distance + D+/100 (règle de pouce :
 * 100 m de dénivelé positif ≈ 1 km de plat). Majoré quand le tracé est
 * technique (single track ≈ +25 % d'effort sur la part concernée).
 */

export type DifficultyLevel =
  | 'Facile'
  | 'Modéré'
  | 'Soutenu'
  | 'Difficile'
  | 'Très difficile'

export interface DifficultyResult {
  level: DifficultyLevel
  /** Kilomètre-effort sous-jacent (pour debug / affichage éventuel). */
  effortKm: number
}

export function computeDifficulty(
  distanceM: number,
  elevationGainM: number,
  singleTrackFraction = 0,
): DifficultyResult {
  const distanceKm = distanceM / 1000
  let effortKm = distanceKm + elevationGainM / 100
  effortKm += Math.max(0, Math.min(1, singleTrackFraction)) * distanceKm * 0.25

  const level: DifficultyLevel =
    effortKm < 7
      ? 'Facile'
      : effortKm < 13
        ? 'Modéré'
        : effortKm < 25
          ? 'Soutenu'
          : effortKm < 38
            ? 'Difficile'
            : 'Très difficile'

  return { level, effortKm }
}
