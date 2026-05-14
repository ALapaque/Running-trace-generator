/**
 * Pipeline complet : génération → analyse terrain → scoring → top 3.
 * Expose un état réactif (étapes, progression, erreurs) pour l'UI.
 */

import { ref } from 'vue'
import { OrsQuotaExceededError, useRouteGenerator } from './useRouteGenerator'
import { useTerrainAnalyzer } from './useTerrainAnalyzer'
import { useScoring } from './useScoring'
import { useI18n } from './useI18n'
import {
  DEFAULT_RESULTS_COUNT,
  DISTANCE_TOLERANCE_ABS_MIN_M,
  DISTANCE_TOLERANCE_RATIO,
  ELEVATION_TOLERANCE_ABS_MIN_M,
  ELEVATION_TOLERANCE_RATIO,
  candidatesForResultsCount,
} from '../config'
import type { NumberRange } from '../types/ors'
import type { AnalyzedRoute } from '../types'
import type { RouteGenerationInput } from '../types/ors'

export type PipelineStage = 'idle' | 'generating' | 'analyzing' | 'scoring' | 'done' | 'error'

export interface PipelineRunOptions {
  signal?: AbortSignal
  /** Nombre d'alternatives à retourner après scoring (3, 5 ou 10). */
  resultsCount?: number
}

/** Multiplie les bornes d'une plage (ex. km → m). `null` reste `null`. */
export function scaleRange(range: NumberRange | null, factor: number): NumberRange | null {
  return range ? { min: range.min * factor, max: range.max * factor } : null
}

/**
 * True si `value` tombe dans `range` élargie d'une tolérance, OU si `range`
 * est `null` (critère non contraignant).
 */
export function inRange(
  value: number,
  range: NumberRange | null,
  toleranceRatio: number,
  toleranceAbsMin: number,
): boolean {
  if (!range) return true
  const tol = Math.max(toleranceAbsMin, ((range.min + range.max) / 2) * toleranceRatio)
  return value >= range.min - tol && value <= range.max + tol
}

export function useRoutePipeline() {
  const { t } = useI18n()
  const stage = ref<PipelineStage>('idle')
  const progress = ref(0)
  const errorMessage = ref<string | null>(null)
  const quotaWarning = ref(false)
  const overpassFallback = ref(false)
  /** True quand le filtre de tolérance distance a dû être relâché. */
  const distanceToleranceRelaxed = ref(false)
  const results = ref<AnalyzedRoute[]>([])

  const { generateCandidates } = useRouteGenerator()
  const { analyzeCandidate } = useTerrainAnalyzer()
  const { rank } = useScoring()

  async function run(
    input: RouteGenerationInput,
    options: PipelineRunOptions = {},
  ): Promise<AnalyzedRoute[]> {
    const signal = options.signal
    const resultsCount = options.resultsCount ?? DEFAULT_RESULTS_COUNT
    const candidateCount = candidatesForResultsCount(resultsCount)

    stage.value = 'generating'
    progress.value = 0.05
    errorMessage.value = null
    quotaWarning.value = false
    overpassFallback.value = false
    results.value = []

    try {
      const { candidates, quotaExceeded } = await generateCandidates(input, {
        signal,
        count: candidateCount,
      })
      quotaWarning.value = quotaExceeded
      progress.value = 0.35

      stage.value = 'analyzing'
      const analyses = []
      let done = 0
      for (const c of candidates) {
        const a = await analyzeCandidate(c, signal)
        if (a.fallback) overpassFallback.value = true
        analyses.push({ candidate: c, terrain: a.stats, segments: a.segments, fallback: a.fallback })
        done++
        progress.value = 0.35 + (0.55 * done) / candidates.length
      }

      stage.value = 'scoring'

      // Filtrage par les plages actives (distance et/ou dénivelé) avant scoring.
      // Une plage `null` n'est pas contraignante. La plage est élargie d'une
      // petite tolérance (ORS sur-livre parfois, SRTM est bruité). Si trop peu
      // de candidats passent, on relâche la contrainte.
      const within = analyses.filter(
        (a) =>
          inRange(
            a.candidate.distanceM,
            scaleRange(input.distanceKm, 1000),
            DISTANCE_TOLERANCE_RATIO,
            DISTANCE_TOLERANCE_ABS_MIN_M,
          ) &&
          inRange(
            a.candidate.elevationGainM,
            input.elevationGainM,
            ELEVATION_TOLERANCE_RATIO,
            ELEVATION_TOLERANCE_ABS_MIN_M,
          ),
      )
      const usable = within.length >= Math.min(resultsCount, 3) ? within : analyses
      distanceToleranceRelaxed.value = usable !== within

      const top = rank(usable, input, resultsCount)
      results.value = top
      progress.value = 1
      stage.value = 'done'
      return top
    } catch (e) {
      stage.value = 'error'
      if (e instanceof OrsQuotaExceededError) {
        errorMessage.value = t('errors.orsQuota')
      } else if (e instanceof Error) {
        errorMessage.value = e.message
      } else {
        errorMessage.value = t('errors.unknown')
      }
      throw e
    }
  }

  function reset(): void {
    stage.value = 'idle'
    progress.value = 0
    errorMessage.value = null
    results.value = []
    distanceToleranceRelaxed.value = false
  }

  /** Restaure des résultats persistés (reload de session) sans relancer le pipeline. */
  function restore(routes: AnalyzedRoute[]): void {
    results.value = routes
    stage.value = 'done'
  }

  return {
    stage,
    progress,
    errorMessage,
    quotaWarning,
    overpassFallback,
    distanceToleranceRelaxed,
    results,
    run,
    reset,
    restore,
  }
}
