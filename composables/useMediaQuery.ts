/**
 * Media query réactive (côté client).
 * `matches` est false jusqu'au montage (SSR-safe), puis suit `matchMedia`.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useMediaQuery(query: string) {
  // Init synchrone si window dispo (app SPA) → évite un flash de layout au montage.
  const matches = ref(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  let mql: MediaQueryList | null = null

  function update(): void {
    if (mql) matches.value = mql.matches
  }

  onMounted(() => {
    mql = window.matchMedia(query)
    update()
    mql.addEventListener('change', update)
  })

  onBeforeUnmount(() => {
    mql?.removeEventListener('change', update)
  })

  return matches
}
