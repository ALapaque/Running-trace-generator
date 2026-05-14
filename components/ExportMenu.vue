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
import { useI18n } from '../composables/useI18n'
import { buildShareUrl } from '../utils/share-url'
import type { AnalyzedRoute, GenerationParams } from '../types'

const props = defineProps<{
  route: AnalyzedRoute
  /** Paramètres de la dernière génération — pour le lien partageable. */
  params?: GenerationParams | null
  /** Ouvre le menu vers le haut (bouton ancré en bas de l'écran). */
  dropUp?: boolean
}>()

const { exportRoute, shareRoute } = useGpxExport()
const { t } = useI18n()

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
        ? t('export.importHintStrava')
        : t('export.importHintKomoot')
  } finally {
    busy.value = false
  }
}

function onDownload(): void {
  exportRoute(props.route)
  open.value = false
}

async function onCopyLink(): Promise<void> {
  if (!props.params) return
  const url = buildShareUrl(props.params)
  try {
    await navigator.clipboard.writeText(url)
    hint.value = t('export.linkCopied')
  } catch {
    // clipboard indisponible (contexte non sécurisé) → on affiche le lien.
    hint.value = url
  }
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
      <Icon name="download" class="h-4 w-4" />
      <span>{{ t('export.save') }}</span>
      <Icon
        name="chevron-down"
        class="h-3.5 w-3.5 transition-transform"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <transition
      enter-active-class="transition duration-150 ease-out-soft"
      leave-active-class="transition duration-100 ease-in-soft"
      :enter-from-class="dropUp ? 'opacity-0 translate-y-1' : 'opacity-0 -translate-y-1'"
      :leave-to-class="dropUp ? 'opacity-0 translate-y-1' : 'opacity-0 -translate-y-1'"
    >
      <!-- `dropUp` : ouvre vers le haut (bouton ancré en bas, desktop). Sinon
           vers le bas, aligné à droite (mobile) ou à gauche (desktop sidebar). -->
      <div
        v-if="open"
        :class="[
          'absolute z-overlay w-60 overflow-hidden rounded-card border border-cream-300 bg-cream-100 shadow-float',
          dropUp ? 'bottom-full left-0 mb-2' : 'right-0 mt-2 lg:left-0 lg:right-auto',
        ]"
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
            <Icon name="komoot" class="h-4 w-4" />
          </span>
          <span class="flex-1">
            <span class="block text-sm font-semibold text-ink-900">Komoot</span>
            <span class="block text-xs text-ink-500">{{ t('export.viaShare') }}</span>
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
            <Icon name="strava" class="h-4 w-4" />
          </span>
          <span class="flex-1">
            <span class="block text-sm font-semibold text-ink-900">Strava</span>
            <span class="block text-xs text-ink-500">{{ t('export.viaShare') }}</span>
          </span>
        </button>

        <div class="border-t border-cream-300" />

        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream-200"
          @click="onDownload"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-cream-200 text-ink-900">
            <Icon name="download" class="h-4 w-4" />
          </span>
          <span class="flex-1">
            <span class="block text-sm font-semibold text-ink-900">{{ t('export.downloadGpx') }}</span>
            <span class="block text-xs text-ink-500">{{ t('export.downloadGpxSub') }}</span>
          </span>
        </button>

        <button
          v-if="params"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cream-200"
          @click="onCopyLink"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-cream-200 text-ink-900">
            <Icon name="link" class="h-4 w-4" />
          </span>
          <span class="flex-1">
            <span class="block text-sm font-semibold text-ink-900">{{ t('export.copyLink') }}</span>
            <span class="block text-xs text-ink-500">{{ t('export.copyLinkSub') }}</span>
          </span>
        </button>

        <p v-if="hint" class="border-t border-cream-300 px-4 py-2 text-xs text-ink-500 break-all">
          {{ hint }}
        </p>
      </div>
    </transition>
  </div>
</template>
