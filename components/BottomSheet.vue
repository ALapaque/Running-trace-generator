<script setup lang="ts">
/**
 * Bottom sheet à 3 snap points : `peek` (poignée + résumé), `mid` (~50dvh), `full` (~88dvh).
 * - Drag à la poignée (et au header) via Pointer Events (touch + souris + stylet).
 * - Velocity-based snapping : un swipe rapide saute au point suivant.
 * - Scrim qui apparaît quand on dépasse `mid`.
 * - Escape ferme vers `peek`.
 * - Respecte prefers-reduced-motion.
 *
 * Accessibilité : role="dialog", aria-modal sur scrim actif, aria-label sur la poignée.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from '../composables/useI18n'

export type SheetSnap = 'peek' | 'mid' | 'full'

const props = withDefaults(
  defineProps<{
    snap?: SheetSnap
    peekPx?: number
    /** Permet au parent de désactiver le drag (ex. pendant un input focus). */
    disableDrag?: boolean
  }>(),
  { snap: 'peek', peekPx: 160, disableDrag: false },
)

const emit = defineEmits<{ (e: 'update:snap', value: SheetSnap): void }>()

const { t } = useI18n()

const sheetEl = ref<HTMLElement | null>(null)
const dragging = ref(false)
const translateY = ref(0) // px depuis le haut de la fenêtre (top de la sheet)
const animating = ref(false) // pas d'anim avant le 1er applySnap (évite le flash initial)
const viewportH = ref(0)

let snapPositions: Record<SheetSnap, number> = { peek: 0, mid: 0, full: 0 }

let dragStartY = 0
let dragStartTranslate = 0
let lastMoveY = 0
let lastMoveTs = 0
let velocity = 0
let activePointerId: number | null = null

function computeSnaps(): void {
  viewportH.value = window.innerHeight
  snapPositions = {
    peek: viewportH.value - props.peekPx,
    mid: Math.round(viewportH.value * 0.45),
    full: Math.round(viewportH.value * 0.1),
  }
}

function applySnap(snap: SheetSnap): void {
  translateY.value = snapPositions[snap]
}

function nearestSnap(y: number, vel: number): SheetSnap {
  const VEL_THRESHOLD = 0.6 // px/ms
  const ordered: SheetSnap[] = ['full', 'mid', 'peek']
  if (vel > VEL_THRESHOLD) {
    // Swipe vers le bas → snap suivant
    if (y >= snapPositions.mid) return 'peek'
    if (y >= snapPositions.full) return 'mid'
    return 'mid'
  }
  if (vel < -VEL_THRESHOLD) {
    // Swipe vers le haut → snap précédent
    if (y <= snapPositions.mid) return 'full'
    return 'mid'
  }
  // Sinon : plus proche
  let best: SheetSnap = 'peek'
  let bestDist = Infinity
  for (const s of ordered) {
    const d = Math.abs(snapPositions[s] - y)
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  return best
}

function onPointerDown(e: PointerEvent): void {
  if (props.disableDrag) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  dragging.value = true
  animating.value = false
  dragStartY = e.clientY
  dragStartTranslate = translateY.value
  lastMoveY = e.clientY
  lastMoveTs = performance.now()
  velocity = 0
  activePointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || e.pointerId !== activePointerId) return
  const delta = e.clientY - dragStartY
  const next = Math.min(
    snapPositions.peek,
    Math.max(snapPositions.full - 40, dragStartTranslate + delta),
  )
  translateY.value = next

  const now = performance.now()
  const dt = now - lastMoveTs
  if (dt > 0) velocity = (e.clientY - lastMoveY) / dt
  lastMoveY = e.clientY
  lastMoveTs = now
}

function onPointerUp(e: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  animating.value = true
  const snap = nearestSnap(translateY.value, velocity)
  applySnap(snap)
  emit('update:snap', snap)
  activePointerId = null
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    // pointer déjà relâché
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.snap !== 'peek') {
    e.preventDefault()
    emit('update:snap', 'peek')
  }
}

watch(
  () => props.snap,
  (s) => {
    animating.value = true
    applySnap(s)
  },
)

const scrimVisible = computed(() => props.snap === 'full')

/**
 * On anime maintenant `height` plutôt que `transform: translateY` :
 *  - Plus de transform-context qui casserait `position: fixed/sticky` des enfants.
 *  - Layout flexbox stable : poignée → scroll flex-1 → footer optionnel.
 *  - `height` animée via CSS transition (260ms ease-out-soft).
 */
const sheetVisibleHeight = computed(() => {
  if (viewportH.value === 0) return '0px'
  return `${Math.max(0, Math.round(viewportH.value - translateY.value))}px`
})
const transition = computed(() =>
  animating.value ? 'height 260ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
)

function onResize(): void {
  computeSnaps()
  applySnap(props.snap)
}

onMounted(() => {
  computeSnaps()
  applySnap(props.snap)
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeydown)
})

function onScrimClick(): void {
  emit('update:snap', 'mid')
}
</script>

<template>
  <!-- Scrim affiché uniquement en mode full -->
  <transition
    enter-active-class="transition-opacity duration-200 ease-out-soft"
    leave-active-class="transition-opacity duration-200 ease-in-soft"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="scrimVisible"
      class="fixed inset-0 z-30 bg-ink-900/40"
      @click="onScrimClick"
      aria-hidden="true"
    />
  </transition>

  <section
    ref="sheetEl"
    class="fixed inset-x-0 bottom-0 z-40 flex w-full flex-col rounded-t-sheet bg-cream-50 shadow-sheet will-change-[height]"
    :style="{ height: sheetVisibleHeight, transition }"
    role="dialog"
    aria-modal="false"
    :aria-label="t('panel.sheetLabel')"
  >
    <!-- Zone draggable : poignée (le drag est aussi capté sur le header) -->
    <div
      class="shrink-0 cursor-grab touch-none select-none pt-3 pb-1 active:cursor-grabbing"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      role="button"
      tabindex="0"
      :aria-label="t('panel.drag')"
    >
      <span class="drag-handle block" />
    </div>

    <!-- Header optionnel : toujours visible (hors scroll), ex. onglets -->
    <div v-if="$slots.header" class="shrink-0 px-4 pb-3 pt-1">
      <slot name="header" />
    </div>

    <!-- Contenu scrollable, occupe l'espace restant entre header et footer -->
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
      <slot />
    </div>

    <!-- Footer optionnel (toujours visible, sous la zone scroll) -->
    <div
      v-if="$slots.footer"
      class="shrink-0 border-t border-cream-300 bg-cream-50 px-4 pt-3"
      style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom));"
    >
      <slot name="footer" />
    </div>
  </section>
</template>
