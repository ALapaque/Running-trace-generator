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
import { useI18n } from './useI18n'
import type { LatLng } from '../types/ors'

export interface GeolocationState {
  loading: boolean
  error: string | null
  position: LatLng | null
}

export function useGeolocation() {
  const { t } = useI18n()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const position = ref<LatLng | null>(null)

  function request(): Promise<LatLng> {
    error.value = null
    loading.value = true
    return new Promise<LatLng>((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const msg = t('geo.unsupported')
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
          let msg = t('geo.error')
          if (err.code === err.PERMISSION_DENIED) {
            msg = t('geo.denied')
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            msg = t('geo.unavailable')
          } else if (err.code === err.TIMEOUT) {
            msg = t('geo.timeout')
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
