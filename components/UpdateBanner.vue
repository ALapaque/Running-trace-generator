<script setup lang="ts">
/**
 * Carte de mise à jour : visible quand une nouvelle version de l'app a été
 * détectée (via `useAppUpdate` + le poll du plugin PWA). Pattern « notification
 * card » non-bloquante (pas de scrim — une mise à jour n'est pas critique).
 *
 * - « Mettre à jour » → vide les caches app-shell du SW et recharge.
 * - « Plus tard » → cache la carte pour la session (revient à la prochaine
 *   session si une version plus récente est encore là).
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
    enter-active-class="transition duration-300 ease-out-soft"
    leave-active-class="transition duration-200 ease-in-soft"
    enter-from-class="opacity-0 -translate-y-3"
    leave-to-class="opacity-0 -translate-y-3"
  >
    <div
      v-if="visible"
      class="pointer-events-none fixed inset-x-3 z-toast mx-auto flex max-w-sm justify-center"
      style="top: max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem));"
    >
      <div
        class="pointer-events-auto w-full overflow-hidden rounded-card bg-cream-100 p-4 shadow-float ring-1 ring-cream-300"
        role="region"
        aria-labelledby="update-banner-title"
        aria-describedby="update-banner-desc"
      >
        <div class="flex items-start gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-olive-900 text-cream-50 shadow-card"
            aria-hidden="true"
          >
            <Icon name="refresh" class="h-5 w-5" />
          </span>
          <div class="flex-1 pt-0.5 min-w-0">
            <p id="update-banner-title" class="text-sm font-semibold text-ink-900">
              {{ t('update.available') }}
            </p>
            <p id="update-banner-desc" class="mt-0.5 text-xs leading-relaxed text-ink-500">
              {{ t('update.description') }}
            </p>
          </div>
        </div>
        <div class="mt-3 flex items-center justify-end gap-2">
          <button type="button" class="btn-ghost" @click="dismiss">
            {{ t('update.dismiss') }}
          </button>
          <button type="button" class="btn-primary" @click="applyUpdate">
            <Icon name="refresh" class="h-4 w-4" />
            <span>{{ t('update.cta') }}</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
