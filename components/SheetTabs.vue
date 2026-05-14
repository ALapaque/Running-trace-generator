<script setup lang="ts">
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

function onSelect(t: Tab): void {
  if (t.disabled) return
  emit('update:modelValue', t.key)
}
</script>

<template>
  <div
    class="mx-auto flex w-fit max-w-full items-center gap-1 rounded-pill bg-cream-100 p-1"
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
        'rounded-pill px-4 py-2 text-sm font-semibold transition',
        modelValue === t.key
          ? 'bg-olive-900 text-white shadow-card'
          : 'text-ink-500 hover:text-ink-900',
        t.disabled ? 'opacity-40 pointer-events-none' : '',
      ]"
      style="min-height: 36px;"
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
