<script setup lang="ts">
import { useI18n } from '../composables/useI18n'
import type { AnalyzedRoute } from '../types'

const props = defineProps<{
  routes: AnalyzedRoute[]
  selectedId: string | null
}>()

const emit = defineEmits<{ (e: 'select', id: string): void }>()

const { t } = useI18n()

function fmtKm(m: number): string {
  return (m / 1000).toFixed(1)
}
</script>

<template>
  <section>
    <h3 class="mb-3 text-base font-bold text-ink-900">{{ t('alternatives.title') }}</h3>
    <ul class="space-y-2" role="listbox" :aria-label="t('alternatives.listLabel')">
      <li
        v-for="(r, idx) in props.routes"
        :key="r.id"
        class="animate-reveal"
        :style="{ animationDelay: `${idx * 45}ms` }"
      >
        <button
          type="button"
          role="option"
          :aria-selected="selectedId === r.id"
          :aria-expanded="selectedId === r.id"
          :class="[
            'flex w-full items-center gap-3 border p-3 text-left transition',
            selectedId === r.id
              ? 'rounded-t-card border-olive-900 bg-olive-50'
              : 'rounded-card border-cream-200 bg-cream-100 hover:border-cream-300',
          ]"
          @click="emit('select', r.id)"
        >
          <span
            :class="[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-sm font-bold',
              selectedId === r.id ? 'bg-olive-900 text-white' : 'bg-cream-200 text-ink-700',
            ]"
            aria-hidden="true"
          >
            {{ idx + 1 }}
          </span>
          <div class="flex-1">
            <p class="flex items-baseline gap-1">
              <span class="text-lg font-bold tabular-nums">{{ fmtKm(r.distanceM) }}</span>
              <span class="text-xs text-ink-500">km</span>
              <span class="mx-2 text-ink-300">•</span>
              <span class="text-lg font-bold tabular-nums">{{ Math.round(r.elevationGainM) }}</span>
              <span class="text-xs text-ink-500">{{ t('alternatives.dPlus') }}</span>
            </p>
            <p class="mt-0.5 text-xs text-ink-500">
              {{ t('terrain.route') }} {{ Math.round(r.terrain.route * 100) }}%
              · {{ t('terrain.chemin_large') }} {{ Math.round(r.terrain.chemin_large * 100) }}%
              · {{ t('terrain.single') }} {{ Math.round(r.terrain.single * 100) }}%
            </p>
          </div>
          <span class="font-mono text-[11px] text-ink-400">{{ t('alternatives.score') }} {{ r.score.toFixed(2) }}</span>
        </button>

        <!-- Détail inline : s'ouvre sous l'alternative sélectionnée -->
        <div
          class="grid transition-[grid-template-rows] duration-300 ease-out-soft"
          :class="selectedId === r.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
          <div class="overflow-hidden">
            <div
              v-if="selectedId === r.id"
              class="rounded-b-card border-x border-b border-olive-900 bg-olive-50 p-3"
            >
              <slot name="detail" />
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
