<script setup lang="ts">
/**
 * Onglet « Historique » : liste des parcours générés récemment (localStorage).
 * Cliquer une entrée la réaffiche sur la carte sans reconsommer de quota ORS.
 */
import { useI18n } from '../composables/useI18n'
import type { RouteHistoryEntry } from '../types'

const props = defineProps<{
  entries: RouteHistoryEntry[]
  selectedId: string | null
  /** Allure de course en min/km, pour la durée estimée. */
  pace: number
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'remove', id: string): void
  (e: 'clear'): void
}>()

const { t, formatDate } = useI18n()

function fmtDate(ts: number): string {
  return formatDate(ts)
}

function fmtDuration(distanceM: number): string {
  const min = (distanceM / 1000) * props.pace
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m`
}
</script>

<template>
  <section>
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-base font-bold text-ink-900">{{ t('history.title') }}</h3>
      <button
        v-if="entries.length"
        type="button"
        class="text-xs font-medium text-ink-500 hover:text-terracotta-600"
        @click="emit('clear')"
      >
        {{ t('history.clearAll') }}
      </button>
    </div>

    <p v-if="!entries.length" class="rounded-card bg-cream-100 px-4 py-6 text-center text-sm text-ink-500">
      {{ t('history.empty') }}
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="(entry, i) in entries"
        :key="entry.id"
        class="animate-reveal"
        :style="{ animationDelay: `${i * 40}ms` }"
      >
        <div
          :class="[
            'flex items-center gap-3 border p-3 transition',
            selectedId === entry.id
              ? 'rounded-t-card border-olive-900 bg-olive-50'
              : 'rounded-card border-cream-300 bg-cream-100 hover:border-ink-300',
          ]"
        >
          <button
            type="button"
            class="flex-1 text-left"
            :aria-pressed="selectedId === entry.id"
            :aria-expanded="selectedId === entry.id"
            @click="emit('select', entry.id)"
          >
            <p class="flex items-baseline gap-1">
              <span class="text-lg font-bold tabular-nums">{{ (entry.distanceM / 1000).toFixed(1) }}</span>
              <span class="text-xs text-ink-500">km</span>
              <span class="mx-2 text-ink-300">•</span>
              <span class="text-lg font-bold tabular-nums">{{ Math.round(entry.elevationGainM) }}</span>
              <span class="text-xs text-ink-500">{{ t('alternatives.dPlus') }}</span>
            </p>
            <p class="mt-0.5 text-xs text-ink-500">
              {{ fmtDate(entry.ts) }} · ~{{ fmtDuration(entry.distanceM) }}
              <span v-if="entry.terrain">
                · {{ t('terrain.route') }} {{ Math.round(entry.terrain.route * 100) }}%
              </span>
            </p>
          </button>
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-ink-500 transition hover:bg-cream-200 hover:text-terracotta-600"
            :aria-label="t('history.remove', { date: fmtDate(entry.ts) })"
            @click="emit('remove', entry.id)"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>

        <!-- Détail inline : s'ouvre sous l'entrée d'historique sélectionnée -->
        <div
          class="grid transition-[grid-template-rows] duration-300 ease-out-soft"
          :class="selectedId === entry.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        >
          <div class="overflow-hidden">
            <div
              v-if="selectedId === entry.id"
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
