/**
 * Pipeline complet : génération → analyse terrain → scoring → top 3.
 * Expose un état réactif (étapes, progression, erreurs) pour l'UI.
 */

import { ref } from 'vue'
import { OrsQuotaExceededError, useRouteGenerator } from './useRouteGenerator'
import { useTerrainAnalyzer } from './useTerrainAnalyzer'
import { useScoring } from './useScoring'
import type { AnalyzedRoute } from '../types'
import type { RouteGenerationInput } from '../types/ors'

export type PipelineStage = 'idle' | 'generating' | 'analyzing' | 'scoring' | 'done' | 'error'

export function useRoutePipeline() {
  const stage = ref<PipelineStage>('idle')
  const progress = ref(0)
  const errorMessage = ref<string | null>(null)
  const quotaWarning = ref(false)
  const overpassFallback = ref(false)
  const results = ref<AnalyzedRoute[]>([])

  const { generateCandidates } = useRouteGenerator()
  const { analyzeCandidate } = useTerrainAnalyzer()
  const { rank } = useScoring()

  async function run(input: RouteGenerationInput, signal?: AbortSignal): Promise<AnalyzedRoute[]> {
    stage.value = 'generating'
    progress.value = 0.05
    errorMessage.value = null
    quotaWarning.value = false
    overpassFallback.value = false
    results.value = []

    try {
      const { candidates, quotaExceeded } = await generateCandidates(input, { signal })
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
      const top = rank(analyses, input, 3)
      results.value = top
      progress.value = 1
      stage.value = 'done'
      return top
    } catch (e) {
      stage.value = 'error'
      if (e instanceof OrsQuotaExceededError) {
        errorMessage.value =
          'Quota OpenRouteService dépassé pour aujourd\'hui. Réessayez demain ou utilisez une autre clé.'
      } else if (e instanceof Error) {
        errorMessage.value = e.message
      } else {
        errorMessage.value = 'Erreur inconnue'
      }
      throw e
    }
  }

  function reset(): void {
    stage.value = 'idle'
    progress.value = 0
    errorMessage.value = null
    results.value = []
  }

  return { stage, progress, errorMessage, quotaWarning, overpassFallback, results, run, reset }
}
