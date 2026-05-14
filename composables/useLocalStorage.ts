/**
 * Ref synchronisée avec localStorage.
 * - Lit la valeur stockée au montage (sinon `defaultValue`).
 * - Écrit à chaque changement (deep watch), throttle léger via microtask.
 */
import { ref, watch, type Ref } from 'vue'
import { readJson, writeJson } from '../utils/storage'

export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  const stored = readJson<T>(key)
  const state = ref<T>(stored ?? defaultValue) as Ref<T>

  watch(
    state,
    (value) => {
      writeJson(key, value)
    },
    { deep: true },
  )

  return state
}
