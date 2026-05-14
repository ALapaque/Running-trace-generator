<script setup lang="ts">
/**
 * Menu d'export du parcours : Komoot · Strava · Télécharger GPX.
 *
 * Komoot / Strava : pas d'API d'upload 100 % client → on passe par la
 * Web Share API (mobile : la feuille de partage système propose les apps
 * installées). Sur desktop sans Web Share fichiers, fallback : téléchargement
 * du `.gpx` + ouverture de la page d'import du service.
 */
import { onBeforeUnmount, ref } from 'vue'
import { useGpxExport } from '../composables/useGpxExport'
import type { AnalyzedRoute } from '../types'

const props = defineProps<{ route: AnalyzedRoute }>()

const { exportRoute, shareRoute } = useGpxExport()

const open = ref(false)
const busy = ref(false)
const hint = ref<string | null>(null)

// URLs d'import (fallback desktop) — domaines de service connus et stables.
const IMPORT_URLS: Record<'komoot' | 'strava', string> = {
  strava: 'https://www.strava.com/upload/select',
  komoot: 'https://www.komoot.com/',
}

function toggle(): void {
  open.value = !open.value
  hint.value = null
}
function close(): void {
  open.value = false
}

function onClickOutside(e: MouseEvent): void {
  if (!(e.target as HTMLElement)?.closest?.('[data-export-menu]')) close()
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}
document.addEventListener('click', onClickOutside)
document.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})

async function sendTo(target: 'komoot' | 'strava'): Promise<void> {
  busy.value = true
  hint.value = null
  try {
    const result = await shareRoute(props.route)
    if (result === 'shared' || result === 'cancelled') {
      open.value = false
      return
    }
    // Fallback desktop : téléchargement + ouverture de la page d'import.
    exportRoute(props.route)
    window.open(IMPORT_URLS[target], '_blank', 'noopener')
    hint.value =
      target === 'strava'
        ? 'GPX téléchargé — importe-le dans l’onglet Strava ouvert.'
        : 'GPX téléchargé — importe-le dans Komoot (onglet ouvert).'
  } finally {
    busy.value = false
  }
}

function onDownload(): void {
  exportRoute(props.route)
  open.value = false
}
</script>

<template>
  <div class="relative" data-export-menu>
    <button
      type="button"
      class="btn-primary"
      :disabled="busy"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="toggle"
    >
      <svg
        viewBox="0 0 24 24"
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span>Enregistrer</span>
      <svg
        viewBox="0 0 24 24"
        class="h-3.5 w-3.5 transition-transform"
        :class="open ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <transition
      enter-active-class="transition duration-150 ease-out-soft"
      leave-active-class="transition duration-100 ease-in-soft"
      enter-from-class="opacity-0 -translate-y-1"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <!-- Aligné à droite sur mobile (menu en haut-droite), à gauche sur
           desktop (le menu passe en haut-gauche, la sidebar prend la droite). -->
      <div
        v-if="open"
        class="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-card border border-cream-200 bg-cream-100 shadow-float lg:left-0 lg:right-auto"
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream-200 disabled:opacity-60"
          :disabled="busy"
          @click="sendTo('komoot')"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-olive-900 text-white">
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <span class="flex-1">
            <span class="block text-sm font-semibold text-ink-900">Komoot</span>
            <span class="block text-xs text-ink-500">Via le partage système</span>
          </span>
        </button>

        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream-200 disabled:opacity-60"
          :disabled="busy"
          @click="sendTo('strava')"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-terracotta-500 text-white">
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M9 4l5 10h-3l-2-4-2 4H3L9 4zm6 9l2.5 5L20 13h-2.2l-.3.6-.5-1.1L15 13z" />
            </svg>
          </span>
          <span class="flex-1">
            <span class="block text-sm font-semibold text-ink-900">Strava</span>
            <span class="block text-xs text-ink-500">Via le partage système</span>
          </span>
        </button>

        <div class="border-t border-cream-200" />

        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream-200"
          @click="onDownload"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-cream-200 text-ink-900">
            <svg
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </span>
          <span class="flex-1">
            <span class="block text-sm font-semibold text-ink-900">Télécharger le GPX</span>
            <span class="block text-xs text-ink-500">Fichier .gpx (Strava, Komoot, montre…)</span>
          </span>
        </button>

        <p v-if="hint" class="border-t border-cream-200 px-4 py-2 text-xs text-ink-500">
          {{ hint }}
        </p>
      </div>
    </transition>
  </div>
</template>
