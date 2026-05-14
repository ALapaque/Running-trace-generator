<script setup lang="ts">
/**
 * Bar chart empilé + liste des types avec indicateur "tiret coloré" + distance estimée.
 * Komoot-style : section pliable, valeurs alignées à droite en tabular-nums.
 */
import { computed, onMounted, ref } from 'vue'
import { PATH_COLORS } from '../config'
import { useI18n } from '../composables/useI18n'
import type { TerrainStats } from '../types/osm'

// N'est rendu par la page que lorsque l'analyse de terrain a réussi.
const props = defineProps<{
  terrain: TerrainStats
  /** Distance totale du parcours en mètres, pour estimer chaque part. */
  distanceM: number
}>()

const { t } = useI18n()

const open = ref(true)
// Les barres partent à 0 puis croissent jusqu'à leur largeur cible (transition CSS).
const grown = ref(false)
onMounted(() => requestAnimationFrame(() => (grown.value = true)))

interface Row {
  key: string
  label: string
  ratio: number
  color: string
}

const rows = computed<Row[]>(() =>
  [
    { key: 'route', label: t('terrain.route'), ratio: props.terrain.route, color: PATH_COLORS.route },
    { key: 'chemin_large', label: t('terrain.chemin_large'), ratio: props.terrain.chemin_large, color: PATH_COLORS.chemin_large },
    { key: 'single', label: t('terrain.single'), ratio: props.terrain.single, color: PATH_COLORS.single },
    { key: 'unknown', label: t('terrain.unknown'), ratio: props.terrain.unknown, color: PATH_COLORS.unknown },
  ].filter((r) => r.ratio > 0.001),
)

function distLabel(ratio: number): string {
  const m = props.distanceM * ratio
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}
</script>

<template>
  <section>
    <button
      type="button"
      class="flex w-full items-center gap-2 py-2 text-left"
      :aria-expanded="open"
      @click="open = !open"
    >
      <svg
        :class="['h-4 w-4 text-ink-500 transition-transform duration-200 ease-out-soft', open ? '' : '-rotate-90']"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <h3 class="text-base font-bold text-ink-900">{{ t('terrain.title') }}</h3>
    </button>

    <div v-show="open" class="space-y-3 pt-1">
      <!-- Barre empilée : chaque segment croît de 0 à sa largeur cible -->
      <div class="flex h-2 w-full overflow-hidden rounded-pill bg-cream-200" aria-hidden="true">
        <div
          v-for="r in rows"
          :key="r.key"
          class="transition-[width] duration-500 ease-out-soft"
          :style="{ width: grown ? `${r.ratio * 100}%` : '0%', backgroundColor: r.color }"
        />
      </div>

      <!-- Liste (apparition échelonnée) -->
      <ul class="divide-y divide-cream-200">
        <li
          v-for="(r, i) in rows"
          :key="r.key"
          class="animate-reveal flex items-center gap-3 py-2.5"
          :style="{ animationDelay: `${i * 45}ms` }"
        >
          <span
            class="block h-1 w-6 rounded-pill"
            :style="{ backgroundColor: r.color }"
            aria-hidden="true"
          />
          <span class="text-sm text-ink-900">{{ r.label }}</span>
          <span class="ml-auto text-sm tabular-nums text-ink-700">{{ distLabel(r.ratio) }}</span>
        </li>
      </ul>

      <p v-if="terrain.forest > 0" class="text-sm text-ink-700">
        <span class="inline-block h-2 w-2 align-middle rounded-pill bg-sage-600" />
        <span class="ml-2 align-middle font-semibold text-olive-900">{{ t('terrain.forest') }}</span>
        <span class="ml-1 tabular-nums">{{ distLabel(terrain.forest) }}</span>
      </p>
    </div>
  </section>
</template>
