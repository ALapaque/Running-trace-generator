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
    <!-- Royaume-Uni (Union Jack) pour l'anglais — SVG « flag-icons » (lipis)
         en polygones pleins : aucun clip ni trait, rendu fiable à toute taille. -->
    <svg v-else class="block h-4 w-[21px]" viewBox="0 0 640 480">
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path
        fill="#FFFFFF"
        d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"
      />
      <path
        fill="#C8102E"
        d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"
      />
      <path fill="#FFFFFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z" />
      <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z" />
    </svg>
  </span>
</template>
