/**
 * Allure de course de l'utilisateur (min/km), persistée en localStorage.
 * Sert à estimer le temps de parcours. `cycle()` passe au preset suivant.
 */
import { PACE_MIN_PER_KM } from '../config'
import { nextPace } from '../utils/pace'
import { useLocalStorage } from './useLocalStorage'

export function useRunnerPace() {
  const pace = useLocalStorage('rungen:pace-min-per-km:v1', PACE_MIN_PER_KM)

  function cycle(): void {
    pace.value = nextPace(pace.value)
  }

  return { pace, cycle }
}
