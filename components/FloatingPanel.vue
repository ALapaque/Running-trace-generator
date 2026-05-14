<script setup lang="ts">
/**
 * Panneau flottant desktop : carte draggable qui flotte au-dessus de la map.
 *
 * - Déplaçable par la barre de préhension (Pointer Events : souris + stylet).
 * - Contraint au viewport (clamp à chaque move + au resize).
 * - Repliable (collapse) pour dégager la carte sans perdre la position.
 * - Layout flex : barre de drag → header → contenu scrollable → footer.
 *
 * Mêmes slots que BottomSheet (`#header`, défaut, `#footer`) afin que la page
 * puisse basculer entre les deux via `<component :is>` sans dupliquer le contenu.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '../composables/useI18n'

const { t } = useI18n()

const PANEL_W = 380
const MARGIN = 16
/** Hauteur min restant visible quand on pousse le panneau vers le bas. */
const MIN_VISIBLE = 88

// Position par défaut : coin haut-droit (init synchrone, app SPA).
const x = ref(
  typeof window !== 'undefined'
    ? Math.max(MARGIN, window.innerWidth - PANEL_W - MARGIN)
    : MARGIN,
)
const y = ref(MARGIN)
const collapsed = ref(false)
const dragging = ref(false)

let startX = 0
let startY = 0
let originX = 0
let originY = 0
let pointerId: number | null = null

function clampToViewport(): void {
  const maxX = Math.max(MARGIN, window.innerWidth - PANEL_W - MARGIN)
  const maxY = Math.max(MARGIN, window.innerHeight - MIN_VISIBLE)
  x.value = Math.min(Math.max(MARGIN, x.value), maxX)
  y.value = Math.min(Math.max(MARGIN, y.value), maxY)
}

function onPointerDown(e: PointerEvent): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  // Ne pas démarrer un drag si on a cliqué un contrôle interactif de la barre.
  if ((e.target as HTMLElement).closest('button')) return
  dragging.value = true
  startX = e.clientX
  startY = e.clientY
  originX = x.value
  originY = y.value
  pointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || e.pointerId !== pointerId) return
  x.value = originX + (e.clientX - startX)
  y.value = originY + (e.clientY - startY)
  clampToViewport()
}

function onPointerUp(e: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  pointerId = null
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    // pointer déjà relâché
  }
}

function onResize(): void {
  clampToViewport()
}

onMounted(() => {
  clampToViewport()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <aside
    class="animate-panel-in fixed z-panel flex flex-col overflow-hidden rounded-card bg-cream-100 shadow-float ring-1 ring-cream-300"
    :style="{
      left: `${x}px`,
      top: `${y}px`,
      width: `${PANEL_W}px`,
      maxHeight: `calc(100dvh - ${2 * MARGIN}px)`,
    }"
    role="dialog"
    :aria-label="t('panel.label')"
  >
    <!-- Barre de préhension (drag) -->
    <div
      class="flex shrink-0 select-none items-center gap-2 border-b border-cream-300 px-4 py-2.5"
      :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <Icon name="grip" class="h-4 w-4 text-ink-500" />
      <span class="text-sm font-bold text-ink-900">RunGen</span>
      <button
        type="button"
        class="ml-auto flex h-11 w-11 items-center justify-center rounded-pill text-ink-500 transition hover:bg-cream-200"
        :aria-label="collapsed ? t('panel.expand') : t('panel.collapse')"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <Icon
          name="chevron-up"
          class="h-4 w-4 transition-transform duration-200 ease-out-soft"
          :class="collapsed ? 'rotate-180' : ''"
        />
      </button>
    </div>

    <template v-if="!collapsed">
      <!-- Header (onglets) -->
      <div v-if="$slots.header" class="shrink-0 px-4 pb-3 pt-3">
        <slot name="header" />
      </div>

      <!-- Contenu scrollable -->
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
        <slot />
      </div>

      <!-- Footer optionnel -->
      <div
        v-if="$slots.footer"
        class="shrink-0 border-t border-cream-300 bg-cream-100 px-4 py-3"
      >
        <slot name="footer" />
      </div>
    </template>
  </aside>
</template>
