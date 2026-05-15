<script setup lang="ts">
/**
 * Jeu d'icônes centralisé — un seul style de trait (stroke-width 2, bouts
 * arrondis) pour toutes les icônes au lieu de SVG inline dupliqués.
 *
 * Usage : <Icon name="search" class="h-4 w-4" />
 * La classe (taille, couleur via currentColor) passe en fallthrough sur le <svg>.
 * Pour le spinner : <Icon name="spinner" class="h-4 w-4 animate-spin" />.
 */
import { computed } from 'vue'

interface IconDef {
  /** Markup interne du <svg>. */
  body: string
  /** true → icône pleine (fill=currentColor) au lieu d'une icône au trait. */
  filled?: boolean
  viewBox?: string
}

const ICONS: Record<string, IconDef> = {
  settings: {
    body: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  },
  close: {
    body: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  },
  locate: {
    body: '<circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>',
  },
  plus: {
    body: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  },
  minus: {
    body: '<line x1="5" y1="12" x2="19" y2="12"/>',
  },
  'arrow-right': {
    body: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  },
  spinner: {
    body: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"/><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  },
  refresh: {
    body: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  },
  search: {
    body: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  },
  road: {
    body: '<path d="M5 22 L9 2"/><path d="M19 22 L15 2"/><line x1="12" y1="5" x2="12" y2="9"/><line x1="12" y1="13" x2="12" y2="17"/>',
  },
  pine: {
    body: '<path d="M12 2 L7 11 H17 Z"/><path d="M12 8 L5 18 H19 Z"/><line x1="12" y1="18" x2="12" y2="22"/>',
  },
  'chevron-up': {
    body: '<polyline points="18 15 12 9 6 15"/>',
  },
  'chevron-down': {
    body: '<polyline points="6 9 12 15 18 9"/>',
  },
  'chevron-expand': {
    body: '<polyline points="7 10 12 5 17 10"/><polyline points="7 14 12 19 17 14"/>',
  },
  reverse: {
    body: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  },
  edit: {
    body: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  },
  trash: {
    body: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  },
  download: {
    body: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  },
  link: {
    body: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  },
  grip: {
    filled: true,
    body: '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>',
  },
  komoot: {
    filled: true,
    body: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3"/>',
  },
  strava: {
    filled: true,
    body: '<path d="M9 4l5 10h-3l-2-4-2 4H3L9 4zm6 9l2.5 5L20 13h-2.2l-.3.6-.5-1.1L15 13z"/>',
  },
}

const props = defineProps<{ name: string }>()
const icon = computed<IconDef>(() => ICONS[props.name] ?? ICONS.close!)
</script>

<template>
  <svg
    :viewBox="icon.viewBox ?? '0 0 24 24'"
    :fill="icon.filled ? 'currentColor' : 'none'"
    :stroke="icon.filled ? undefined : 'currentColor'"
    :stroke-width="icon.filled ? undefined : 2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="icon.body"
  />
</template>
