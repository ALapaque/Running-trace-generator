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
      active ? '!bg-olive-900 !text-white' : '',
    ]"
    :aria-label="label"
    :aria-pressed="active ? 'true' : 'false'"
  >
    <slot />
  </button>
</template>
