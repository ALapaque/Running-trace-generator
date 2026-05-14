/**
 * Accès localStorage sûr (try/catch, SSR-safe, JSON).
 * Utilisé par les composables de persistance et l'historique.
 */

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string): T | null {
  const s = storage()
  if (!s) return null
  const raw = s.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    s.removeItem(key)
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  const s = storage()
  if (!s) return false
  try {
    s.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Quota dépassé ou stockage indisponible — échec silencieux.
    return false
  }
}

export function removeKey(key: string): void {
  storage()?.removeItem(key)
}
