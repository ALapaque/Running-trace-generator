/**
 * Enregistre le service worker (PWA). Client-only, échec silencieux
 * (contexte non sécurisé, navigateur sans support…).
 */
export default defineNuxtPlugin(() => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW indisponible (http non sécurisé, etc.) — l'app fonctionne sans.
    })
  })
})
