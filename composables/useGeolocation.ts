/**
 * Récupération de la position actuelle via navigator.geolocation.
 * Renvoie un état réactif (loading, error, position) et une méthode `request()`.
 *
 * - timeout 10s
 * - maximumAge 60s (réutilise une position récente si dispo)
 * - enableHighAccuracy true (GPS plutôt que IP, sur mobile)
 * - HTTPS requis par le navigateur (vrai sur Vercel, et sur localhost en dev)
 */
import { ref } from 'vue'
import type { LatLng } from '../types/ors'

export interface GeolocationState {
  loading: boolean
  error: string | null
  position: LatLng | null
}

export function useGeolocation() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const position = ref<LatLng | null>(null)

  function request(): Promise<LatLng> {
    error.value = null
    loading.value = true
    return new Promise<LatLng>((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const msg = 'Géolocalisation non supportée par ce navigateur'
        error.value = msg
        loading.value = false
        reject(new Error(msg))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          position.value = ll
          loading.value = false
          resolve(ll)
        },
        (err) => {
          loading.value = false
          let msg = 'Erreur de géolocalisation'
          if (err.code === err.PERMISSION_DENIED) {
            msg = 'Permission refusée. Active la géolocalisation dans ton navigateur.'
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = 'Position indisponible (signal GPS faible ?).'
          } else if (err.code === err.TIMEOUT) {
            msg = 'La localisation a pris trop de temps. Réessaye.'
          }
          error.value = msg
          reject(new Error(msg))
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      )
    })
  }

  return { loading, error, position, request }
}
