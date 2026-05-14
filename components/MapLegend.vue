<script setup lang="ts">
/**
 * Légende flottante de la carte : associe chaque couleur de polyline à un type
 * de voie. La polyline encode le terrain par la couleur seule — la légende
 * fournit la clé (règle a11y « color-not-only »).
 *
 * N'affiche que les types réellement présents sur le tracé.
 */
import { computed } from 'vue'
import { PATH_COLORS } from '../config'
import { useI18n } from '../composables/useI18n'
import type { TerrainStats } from '../types/osm'

const props = defineProps<{ terrain: TerrainStats }>()
const { t } = useI18n()

const items = computed(() =>
  (
    [
      { key: 'route', color: PATH_COLORS.route, ratio: props.terrain.route },
      { key: 'chemin_large', color: PATH_COLORS.chemin_large, ratio: props.terrain.chemin_large },
      { key: 'single', color: PATH_COLORS.single, ratio: props.terrain.single },
      { key: 'unknown', color: PATH_COLORS.unknown, ratio: props.terrain.unknown },
    ] as const
  ).filter((i) => i.ratio > 0.001),
)
</script>

<template>
  <div
    v-if="items.length"
    class="rounded-card bg-cream-100/95 px-3 py-2 shadow-float ring-1 ring-cream-300 backdrop-blur-sm"
    role="group"
    :aria-label="t('terrain.title')"
  >
    <ul class="space-y-1.5">
      <li v-for="i in items" :key="i.key" class="flex items-center gap-2">
        <span
          class="block h-1 w-5 shrink-0 rounded-pill"
          :style="{ backgroundColor: i.color }"
          aria-hidden="true"
        />
        <span class="text-[11px] font-medium text-ink-700">{{ t(`terrain.${i.key}`) }}</span>
      </li>
    </ul>
  </div>
</template>
