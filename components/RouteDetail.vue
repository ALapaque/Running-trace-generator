<script setup lang="ts">
/**
 * Détail d'un parcours : stats, difficulté, allure, actions (inversion /
 * édition), profil altimétrique, répartition du terrain.
 *
 * Rendu inline sous l'élément sélectionné dans les listes Alternatives /
 * Historique (master-detail), plutôt que dans un onglet dédié.
 */
import { computed } from 'vue'
import RouteStats from './RouteStats.vue'
import ElevationChart from './ElevationChart.vue'
import TerrainBreakdown from './TerrainBreakdown.vue'
import { useI18n } from '../composables/useI18n'
import { computeDifficulty } from '../utils/difficulty'
import { formatPace } from '../utils/pace'
import type { AnalyzedRoute } from '../types'

const props = defineProps<{
  route: AnalyzedRoute
  /** Allure de course en min/km. */
  pace: number
  /** Le parcours est-il affiché en sens inversé. */
  reversed: boolean
}>()

const emit = defineEmits<{
  (e: 'cyclePace'): void
  (e: 'toggleReverse'): void
  (e: 'edit'): void
}>()

const { t } = useI18n()

const difficulty = computed(() =>
  computeDifficulty(
    props.route.distanceM,
    props.route.elevationGainM,
    props.route.terrainFallback ? 0 : props.route.terrain.single,
  ),
)
</script>

<template>
  <div class="space-y-6">
    <div class="animate-reveal">
      <RouteStats :route="route" :pace="pace" />
    </div>

    <!-- Pills difficulté (calculée) / rythme (réglable) + actions -->
    <div class="animate-reveal flex flex-wrap items-center gap-2" style="animation-delay: 60ms">
      <span class="pill-active">
        {{ t(`difficulty.${difficulty.level}`) }}
        <span class="text-[10px] uppercase opacity-80">{{ t('details.difficulty') }}</span>
      </span>
      <button
        type="button"
        class="pill-muted"
        :aria-label="t('details.changePace')"
        @click="emit('cyclePace')"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="7 10 12 5 17 10" />
          <polyline points="7 14 12 19 17 14" />
        </svg>
        {{ formatPace(pace) }} {{ t('units.minPerKm') }}
        <span class="text-[10px] uppercase opacity-60">{{ t('details.pace') }}</span>
      </button>
      <button
        type="button"
        :class="reversed ? 'pill-active' : 'pill-muted'"
        :aria-pressed="reversed"
        @click="emit('toggleReverse')"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        {{ t('details.reverse') }}
      </button>
      <button type="button" class="pill-muted" @click="emit('edit')">
        <svg
          viewBox="0 0 24 24"
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        {{ t('details.edit') }}
      </button>
    </div>

    <div class="animate-reveal" style="animation-delay: 120ms">
      <ElevationChart :points="route.points" />
    </div>

    <!-- Répartition du terrain : affichée uniquement si l'analyse a réussi -->
    <div
      v-if="!route.terrainFallback"
      class="animate-reveal"
      style="animation-delay: 180ms"
    >
      <TerrainBreakdown :terrain="route.terrain" :distance-m="route.distanceM" />
    </div>
  </div>
</template>
