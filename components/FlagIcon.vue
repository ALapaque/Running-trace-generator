<script setup lang="ts">
/**
 * Petit drapeau du sélecteur de langue. SVG natifs plutôt qu'emoji (rendu
 * incohérent selon l'OS). Hauteur fixe 16px, largeur selon le ratio du drapeau.
 */
import type { Locale } from '../composables/useI18n'

defineProps<{ locale: Locale }>()
</script>

<template>
  <span
    class="block overflow-hidden rounded-[3px] ring-1 ring-ink-900/10"
    aria-hidden="true"
  >
    <!-- France — 3:2 -->
    <svg v-if="locale === 'fr'" class="block h-4 w-6" viewBox="0 0 3 2">
      <rect width="1" height="2" fill="#0055A4" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#EF4135" />
    </svg>
    <!-- Royaume-Uni — 2:1 (Union Jack), pour l'anglais.
         `flag-gb-s` rogne les diagonales au bord du drapeau ; `flag-gb-t`
         décale les diagonales rouges (contre-échange). -->
    <svg v-else class="block h-4 w-8" viewBox="0 0 60 30">
      <clipPath id="flag-gb-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="flag-gb-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clip-path="url(#flag-gb-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" stroke-width="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clip-path="url(#flag-gb-t)"
          stroke="#C8102E"
          stroke-width="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" stroke-width="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6" />
      </g>
    </svg>
  </span>
</template>
