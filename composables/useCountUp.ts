/**
 * Anime un nombre depuis sa valeur courante vers une cible (count-up).
 *
 * - easing ease-out, ~600ms par défaut
 * - respecte `prefers-reduced-motion` (saut immédiat)
 * - interruptible : une nouvelle cible relance depuis la valeur affichée
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function useCountUp(target: () => number, durationMs = 600): Ref<number> {
  const displayed = ref(target())
  let raf = 0

  function animateTo(to: number): void {
    cancelAnimationFrame(raf)
    if (typeof requestAnimationFrame === 'undefined' || prefersReducedMotion()) {
      displayed.value = to
      return
    }
    const from = displayed.value
    const start = performance.now()
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / durationMs)
      displayed.value = from + (to - from) * easeOutCubic(t)
      if (t < 1) raf = requestAnimationFrame(step)
      else displayed.value = to
    }
    raf = requestAnimationFrame(step)
  }

  watch(target, (to) => animateTo(to))
  onBeforeUnmount(() => cancelAnimationFrame(raf))

  return displayed
}
