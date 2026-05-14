/**
 * Persistance localStorage de la dernière session de génération
 * (alternatives + sélection + paramètres) pour survivre à un reload.
 *
 * Les parcours sont allégés avant stockage : points décimés et tags de
 * segments retirés, afin de rester sous le quota localStorage.
 */
import { RESULTS_PERSIST_DECIMATION_M } from '../config'
import { decimateByDistance } from '../utils/geo'
import { useLocalStorage } from './useLocalStorage'
import type { AnalyzedRoute, GenerationParams } from '../types'

const STORAGE_KEY = 'rungen:results:v1'

interface StoredSession {
  results: AnalyzedRoute[]
  selectedId: string | null
  params: GenerationParams | null
}

const EMPTY: StoredSession = { results: [], selectedId: null, params: null }

/** Allège un parcours pour le stockage : points décimés, tags de segments retirés. */
function lighten(route: AnalyzedRoute): AnalyzedRoute {
  return {
    ...route,
    points: decimateByDistance(route.points, RESULTS_PERSIST_DECIMATION_M),
    segments: route.segments.map((s) => ({
      index: s.index,
      point: s.point,
      pathType: s.pathType,
      inForest: s.inForest,
    })),
  }
}

export function useLastResults() {
  const stored = useLocalStorage<StoredSession>(STORAGE_KEY, { ...EMPTY })

  function saveResults(
    results: AnalyzedRoute[],
    selectedId: string | null,
    params: GenerationParams | null,
  ): void {
    stored.value = { results: results.map(lighten), selectedId, params }
  }

  function saveSelectedId(selectedId: string | null): void {
    stored.value = { ...stored.value, selectedId }
  }

  function clear(): void {
    stored.value = { ...EMPTY }
  }

  return { stored, saveResults, saveSelectedId, clear }
}
