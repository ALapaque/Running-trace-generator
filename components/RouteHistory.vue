<script setup lang="ts">
/**
 * Onglet « Historique » : liste des parcours générés récemment (localStorage).
 * Cliquer une entrée la réaffiche sur la carte sans reconsommer de quota ORS.
 */
import { PACE_MIN_PER_KM } from '../config'
import type { RouteHistoryEntry } from '../types'

const props = defineProps<{
  entries: RouteHistoryEntry[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'remove', id: string): void
  (e: 'clear'): void
}>()

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDuration(distanceM: number): string {
  const min = (distanceM / 1000) * PACE_MIN_PER_KM
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m`
}

void props
</script>

<template>
  <section>
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-base font-bold text-ink-900">Historique</h3>
      <button
        v-if="entries.length"
        type="button"
        class="text-xs font-medium text-ink-500 hover:text-terracotta-600"
        @click="emit('clear')"
      >
        Tout effacer
      </button>
    </div>

    <p v-if="!entries.length" class="rounded-card bg-cream-100 px-4 py-6 text-center text-sm text-ink-500">
      Aucun parcours généré pour l'instant. Tes prochains parcours apparaîtront ici.
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
            'flex items-center gap-3 rounded-card border p-3 transition',
            selectedId === entry.id
              ? 'border-olive-900 bg-olive-50'
              : 'border-cream-200 bg-cream-100 hover:border-cream-300',
          ]"
        >
          <button
            type="button"
            class="flex-1 text-left"
            :aria-pressed="selectedId === entry.id"
            @click="emit('select', entry.id)"
          >
            <p class="flex items-baseline gap-1">
              <span class="text-lg font-bold tabular-nums">{{ (entry.distanceM / 1000).toFixed(1) }}</span>
              <span class="text-xs text-ink-500">km</span>
              <span class="mx-2 text-ink-300">•</span>
              <span class="text-lg font-bold tabular-nums">{{ Math.round(entry.elevationGainM) }}</span>
              <span class="text-xs text-ink-500">m D+</span>
            </p>
            <p class="mt-0.5 text-xs text-ink-500">
              {{ fmtDate(entry.ts) }} · ~{{ fmtDuration(entry.distanceM) }}
              <span v-if="entry.terrain">
                · Route {{ Math.round(entry.terrain.route * 100) }}%
              </span>
            </p>
          </button>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-ink-400 transition hover:bg-cream-200 hover:text-terracotta-600"
            :aria-label="`Supprimer le parcours du ${fmtDate(entry.ts)}`"
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
      </li>
    </ul>
  </section>
</template>
