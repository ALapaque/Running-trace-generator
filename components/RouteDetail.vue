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
        <span class="text-[11px] uppercase opacity-80">{{ t('details.difficulty') }}</span>
      </span>
      <button
        type="button"
        class="pill-muted"
        :aria-label="t('details.changePace')"
        @click="emit('cyclePace')"
      >
        <Icon name="chevron-expand" class="h-3.5 w-3.5" />
        {{ formatPace(pace) }} {{ t('units.minPerKm') }}
        <span class="text-[11px] uppercase opacity-60">{{ t('details.pace') }}</span>
      </button>
      <button
        type="button"
        :class="reversed ? 'pill-active' : 'pill-muted'"
        :aria-pressed="reversed"
        @click="emit('toggleReverse')"
      >
        <Icon name="reverse" class="h-3.5 w-3.5" />
        {{ t('details.reverse') }}
      </button>
      <button type="button" class="pill-muted" @click="emit('edit')">
        <Icon name="edit" class="h-3.5 w-3.5" />
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
