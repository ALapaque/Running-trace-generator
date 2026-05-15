/**
 * - Enregistre le service worker (PWA). Échec silencieux (contexte non
 *   sécurisé, navigateur sans support…).
 * - Détecte les nouvelles versions de l'app via `/_nuxt/builds/latest.json`
 *   (poll périodique + au retour de visibilité du tab) → la bannière
 *   `UpdateBanner` propose alors un rechargement.
 */
import { useAppUpdate } from '../composables/useAppUpdate'

/** Fréquence du poll de fond pour détecter une nouvelle version. */
const UPDATE_POLL_MS = 5 * 60 * 1000

export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW indisponible (http non sécurisé, etc.) — l'app fonctionne sans.
      })
    })
  }

  const { setBaseBuildId, checkForUpdate } = useAppUpdate()

  async function fetchBuildId(): Promise<string | null> {
    try {
      const res = await fetch('/_nuxt/builds/latest.json', { cache: 'no-store' })
      if (!res.ok) return null
      const data = (await res.json()) as { id?: unknown }
      return typeof data?.id === 'string' ? data.id : null
    } catch {
      return null
    }
  }

  // Capture l'id de référence au démarrage.
  fetchBuildId().then((id) => setBaseBuildId(id))

  // Poll périodique en arrière-plan.
  const interval = window.setInterval(async () => {
    const id = await fetchBuildId()
    if (id) checkForUpdate(id)
  }, UPDATE_POLL_MS)

  // Au retour du tab (cas le plus courant : utilisateur qui revient après une absence).
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return
    const id = await fetchBuildId()
    if (id) checkForUpdate(id)
  })

  // Nettoyage HMR (évite les timers fantômes en dev).
  if (import.meta.hot) {
    import.meta.hot.dispose(() => window.clearInterval(interval))
  }
})
