<script setup lang="ts">
import { computed } from 'vue'
import type { PipelineStage } from '../composables/useRoutePipeline'

const props = defineProps<{
  stage: PipelineStage
  progress: number
}>()

const label = computed(() => {
  switch (props.stage) {
    case 'generating':
      return 'Génération du parcours…'
    case 'analyzing':
      return 'Analyse du terrain…'
    case 'scoring':
      return 'Sélection des meilleurs candidats…'
    case 'done':
      return 'Terminé'
    case 'error':
      return 'Erreur'
    default:
      return ''
  }
})

const visible = computed(
  () => props.stage === 'generating' || props.stage === 'analyzing' || props.stage === 'scoring',
)
</script>

<template>
  <transition name="fade">
    <div
      v-if="visible"
      class="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-white/60 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
    >
      <div class="pointer-events-auto w-[280px] rounded-md border border-slate-200 bg-white p-4 shadow-lg">
        <p class="text-sm font-semibold text-slate-900">{{ label }}</p>
        <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full bg-blue-600 transition-all duration-300"
            :style="{ width: `${Math.min(100, progress * 100)}%` }"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
