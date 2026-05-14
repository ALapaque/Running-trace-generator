<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

export interface Tab {
  key: string
  label: string
  disabled?: boolean
  badge?: number
}

const props = defineProps<{
  tabs: Tab[]
  modelValue: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const listEl = ref<HTMLElement | null>(null)

function onSelect(t: Tab): void {
  if (t.disabled) return
  emit('update:modelValue', t.key)
}

// Quand 4 onglets dépassent la largeur du panneau, la barre défile :
// on garde l'onglet actif visible.
watch(
  () => props.modelValue,
  async () => {
    await nextTick()
    listEl.value
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  },
)
</script>

<template>
  <div
    ref="listEl"
    class="tabbar flex w-full items-center gap-1 overflow-x-auto rounded-pill bg-cream-100 p-1"
    role="tablist"
  >
    <button
      v-for="t in props.tabs"
      :key="t.key"
      type="button"
      role="tab"
      :aria-selected="modelValue === t.key"
      :aria-disabled="t.disabled || undefined"
      :tabindex="modelValue === t.key ? 0 : -1"
      :class="[
        'flex shrink-0 items-center whitespace-nowrap rounded-pill px-4 py-2 text-sm font-semibold transition',
        modelValue === t.key
          ? 'bg-olive-900 text-white shadow-card'
          : 'text-ink-500 hover:text-ink-900',
        t.disabled ? 'opacity-40 pointer-events-none' : '',
      ]"
      style="min-height: 36px"
      @click="onSelect(t)"
    >
      {{ t.label }}
      <span
        v-if="t.badge !== undefined"
        class="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-white/25 px-1 text-[10px] font-bold text-white"
      >
        {{ t.badge }}
      </span>
    </button>
  </div>
</template>

<style scoped>
/* Barre d'onglets défilable horizontalement, scrollbar masquée. */
.tabbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
  scroll-behavior: smooth;
}
.tabbar::-webkit-scrollbar {
  display: none;
}
</style>
