<script setup lang="ts">
/**
 * Bannière de mise à jour : visible quand une nouvelle version de l'app a été
 * détectée (via `useAppUpdate` + le poll du plugin PWA). Bouton « Mettre à
 * jour » → recharge avec le cache app-shell nettoyé. Bouton « × » → ferme la
 * bannière pour la session (reviendra après reload si une version plus
 * récente existe encore).
 */
import { computed } from 'vue'
import { useAppUpdate } from '../composables/useAppUpdate'
import { useI18n } from '../composables/useI18n'

const { updateAvailable, dismissed, dismiss, applyUpdate } = useAppUpdate()
const { t } = useI18n()

const visible = computed(() => updateAvailable.value && !dismissed.value)
</script>

<template>
  <transition
    enter-active-class="transition duration-200 ease-out-soft"
    leave-active-class="transition duration-200 ease-in-soft"
    enter-from-class="opacity-0 -translate-y-1"
    leave-to-class="opacity-0 -translate-y-1"
  >
    <div
      v-if="visible"
      class="pointer-events-none fixed inset-x-0 top-6 z-toast mx-auto flex w-fit max-w-[92vw] items-center justify-center"
      role="status"
      aria-live="polite"
      style="top: max(1.5rem, calc(env(safe-area-inset-top) + 0.75rem));"
    >
      <div
        class="pointer-events-auto flex items-center gap-2 rounded-pill bg-cream-100 px-3 py-2 shadow-float ring-1 ring-cream-300"
      >
        <Icon name="refresh" class="h-4 w-4 shrink-0 text-olive-900" />
        <span class="text-sm font-medium text-ink-900">{{ t('update.available') }}</span>
        <button
          type="button"
          class="rounded-pill bg-olive-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-olive-800 active:scale-95"
          @click="applyUpdate"
        >
          {{ t('update.cta') }}
        </button>
        <button
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-ink-500 transition hover:bg-cream-200 active:scale-95"
          :aria-label="t('update.dismiss')"
          @click="dismiss"
        >
          <Icon name="close" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </transition>
</template>
