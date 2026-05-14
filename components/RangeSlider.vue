<script setup lang="ts">
/**
 * Slider à deux poignées (plage min–max).
 *
 * Deux <input type="range"> superposés : seul le `::thumb` capte le pointeur
 * (le corps de l'input a `pointer-events: none`), donc les deux poignées sont
 * indépendamment saisissables. Le z-index de la poignée min est relevé quand
 * elle est dans la moitié haute, pour rester attrapable en cas de superposition.
 *
 * Les handlers `clamp` empêchent les poignées de se croiser.
 */
import { computed } from 'vue'
import type { NumberRange } from '../types/ors'

const props = defineProps<{
  modelValue: NumberRange
  min: number
  max: number
  step: number
  /** Libellé du critère pour les lecteurs d'écran (ex. « Distance »). */
  ariaLabel?: string
  /** Unité annoncée aux lecteurs d'écran (ex. « km », « m »). */
  unit?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: NumberRange): void }>()

const span = computed(() => Math.max(1, props.max - props.min))
const pctMin = computed(() => ((props.modelValue.min - props.min) / span.value) * 100)
const pctMax = computed(() => ((props.modelValue.max - props.min) / span.value) * 100)
// Poignée min au-dessus quand elle dépasse la moitié → reste saisissable.
const minOnTop = computed(() => pctMin.value > 50)

function onMinInput(e: Event): void {
  const raw = Number((e.target as HTMLInputElement).value)
  const clamped = Math.min(raw, props.modelValue.max)
  emit('update:modelValue', { min: clamped, max: props.modelValue.max })
}
function onMaxInput(e: Event): void {
  const raw = Number((e.target as HTMLInputElement).value)
  const clamped = Math.max(raw, props.modelValue.min)
  emit('update:modelValue', { min: props.modelValue.min, max: clamped })
}

const unitSuffix = computed(() => (props.unit ? ` ${props.unit}` : ''))
const labelBase = computed(() => props.ariaLabel ?? 'Valeur')
</script>

<template>
  <div class="range-slider relative h-6 w-full">
    <!-- Rail -->
    <div class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-cream-300" />
    <!-- Portion active -->
    <div
      class="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-olive-900"
      :style="{ left: `${pctMin}%`, width: `${pctMax - pctMin}%` }"
    />
    <input
      type="range"
      class="thumb"
      :class="minOnTop ? 'z-[4]' : 'z-[3]'"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue.min"
      :aria-label="`${labelBase} minimale`"
      :aria-valuetext="`${modelValue.min}${unitSuffix}`"
      @input="onMinInput"
    />
    <input
      type="range"
      class="thumb z-[3]"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue.max"
      :aria-label="`${labelBase} maximale`"
      :aria-valuetext="`${modelValue.max}${unitSuffix}`"
      @input="onMaxInput"
    />
  </div>
</template>

<style scoped>
.thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  /* Le corps de l'input ne capte pas le pointeur — seul le thumb le fait. */
  pointer-events: none;
}
.thumb:focus-visible {
  outline: none;
}
.thumb::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  pointer-events: auto;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: theme('colors.olive.900');
  border: 3px solid theme('colors.cream.100');
  box-shadow: 0 1px 4px rgba(42, 42, 38, 0.3);
  cursor: grab;
}
.thumb::-webkit-slider-thumb:active {
  cursor: grabbing;
}
.thumb::-moz-range-thumb {
  pointer-events: auto;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: theme('colors.olive.900');
  border: 3px solid theme('colors.cream.100');
  box-shadow: 0 1px 4px rgba(42, 42, 38, 0.3);
  cursor: grab;
}
.thumb:focus-visible::-webkit-slider-thumb {
  outline: 2px solid theme('colors.olive.900');
  outline-offset: 2px;
}
.thumb::-moz-range-track {
  background: transparent;
}
</style>
