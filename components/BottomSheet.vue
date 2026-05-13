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

const sheetEl = ref<HTMLElement | null>(null)
const dragging = ref(false)
const translateY = ref(0) // px depuis le haut de la fenêtre
const animating = ref(true)

let viewportH = 0
let snapPositions: Record<SheetSnap, number> = { peek: 0, mid: 0, full: 0 }

let dragStartY = 0
let dragStartTranslate = 0
let lastMoveY = 0
let lastMoveTs = 0
let velocity = 0
let activePointerId: number | null = null

function computeSnaps(): void {
  viewportH = window.innerHeight
  snapPositions = {
    peek: viewportH - props.peekPx,
    mid: Math.round(viewportH * 0.45),
    full: Math.round(viewportH * 0.1),
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

const transform = computed(() => `translate3d(0, ${translateY.value}px, 0)`)
const transition = computed(() =>
  animating.value
    ? 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)'
    : 'none',
)

/**
 * Hauteur visible de la sheet sous le drag handle.
 * Indispensable car la sheet est `h-dvh` translatée vers le bas : sans cap,
 * le scroll container déborde sous le viewport et le contenu en fin (ex. CTA
 * sticky) devient inaccessible.
 */
const scrollAreaHeight = computed(
  () => `calc(100dvh - ${Math.round(translateY.value)}px - 2rem)`,
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
    class="fixed inset-x-0 top-0 z-40 h-dvh w-full rounded-t-sheet bg-cream-50 shadow-sheet will-change-transform"
    :style="{ transform, transition }"
    role="dialog"
    aria-modal="false"
    aria-label="Détails du parcours"
  >
    <!-- Zone draggable : poignée + header (les ~56 premiers px) -->
    <div
      class="cursor-grab touch-none select-none py-3 active:cursor-grabbing"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      role="button"
      tabindex="0"
      aria-label="Glisser pour redimensionner"
    >
      <span class="drag-handle block" />
    </div>

    <!-- Contenu scrollable de la sheet (hauteur = portion visible sous le drag handle) -->
    <div
      class="overflow-y-auto overscroll-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom))]"
      :style="{ height: scrollAreaHeight }"
    >
      <slot />
    </div>
  </section>
</template>
