<script setup lang="ts">
defineProps<{
  label: string
  small?: boolean
  active?: boolean
}>()
</script>

<template>
  <button
    type="button"
    :class="[
      small ? 'fab-sm' : 'fab',
      active ? '!bg-neon-cyan !text-cream-50 !shadow-glow-cyan' : '',
    ]"
    :aria-label="label"
    :aria-pressed="active ? 'true' : 'false'"
  >
    <slot />
  </button>
</template>
