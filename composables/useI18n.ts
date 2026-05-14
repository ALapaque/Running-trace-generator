/**
 * i18n léger, sans dépendance.
 *
 * - Locale partagée réactive (`useState`), persistée en localStorage.
 * - `t(key, params?)` : résolution de clé pointée + interpolation `{param}`.
 * - `formatDate` : formatage de date selon la locale.
 * - Init : localStorage > langue navigateur > 'fr'.
 */
import { en, fr } from '../i18n/messages'
import { readJson, writeJson } from '../utils/storage'

const MESSAGES = { fr, en }
export type Locale = keyof typeof MESSAGES
export const LOCALES = Object.keys(MESSAGES) as Locale[]

const STORAGE_KEY = 'rungen:locale:v1'

function detectLocale(): Locale {
  const stored = readJson<Locale>(STORAGE_KEY)
  if (stored && stored in MESSAGES) return stored
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('en')) {
    return 'en'
  }
  return 'fr'
}

function resolve(dict: unknown, key: string): string | undefined {
  let value: unknown = dict
  for (const part of key.split('.')) {
    if (value == null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return typeof value === 'string' ? value : undefined
}

export function useI18n() {
  const locale = useState<Locale>('rungen-locale', detectLocale)

  /** Traduit une clé pointée, avec interpolation `{param}` optionnelle. */
  function t(key: string, params?: Record<string, string | number>): string {
    let str = resolve(MESSAGES[locale.value], key) ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.split(`{${k}}`).join(String(v))
      }
    }
    return str
  }

  function setLocale(next: Locale): void {
    if (next === locale.value || !(next in MESSAGES)) return
    locale.value = next
    writeJson(STORAGE_KEY, next)
  }

  function formatDate(ts: number): string {
    const tag = locale.value === 'en' ? 'en-GB' : 'fr-FR'
    return new Date(ts).toLocaleDateString(tag, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return { locale, t, setLocale, formatDate }
}
