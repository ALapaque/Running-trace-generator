<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n'
import type { PipelineStage } from '../composables/useRoutePipeline'

const props = defineProps<{
  stage: PipelineStage
  progress: number
}>()

const { t } = useI18n()

const label = computed(() => {
  switch (props.stage) {
    case 'generating':
      return t('loading.generating')
    case 'analyzing':
      return t('loading.analyzing')
    case 'scoring':
      return t('loading.scoring')
    default:
      return ''
  }
})

const visible = computed(
  () =>
    props.stage === 'generating' ||
    props.stage === 'analyzing' ||
    props.stage === 'scoring',
)
</script>

<template>
  <transition
    enter-active-class="transition-opacity duration-200 ease-out-soft"
    leave-active-class="transition-opacity duration-200 ease-in-soft"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="visible"
      class="pointer-events-none fixed inset-x-0 top-6 z-50 mx-auto flex w-fit max-w-[90vw] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        class="pointer-events-auto flex items-center gap-3 rounded-pill bg-cream-100 px-4 py-2.5 shadow-float ring-1 ring-cream-300"
      >
        <svg class="h-4 w-4 shrink-0 animate-spin text-olive-900" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.2" stroke-width="3" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        <span class="text-sm font-semibold text-ink-900">{{ label }}</span>
        <span class="font-mono text-xs text-ink-500 tabular-nums">
          {{ Math.round(progress * 100) }}%
        </span>
      </div>
    </div>
  </transition>
</template>
