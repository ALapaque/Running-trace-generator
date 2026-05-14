/**
 * `fetch` avec timeout dur.
 *
 * Sans ça, un serveur lent (Overpass qui stalle, connexion suspendue) laisse
 * la promesse `fetch` en attente indéfiniment → le pipeline se fige (ex. bloqué
 * à « Analyse du terrain… 86 % »).
 *
 * Combine un timeout interne avec un éventuel signal externe (annulation côté
 * appelant). Le premier des deux qui se déclenche abort la requête.
 */

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Requête expirée après ${ms} ms`)
    this.name = 'TimeoutError'
  }
}

export interface FetchTimeoutOptions extends RequestInit {
  /** Timeout en millisecondes. */
  timeoutMs: number
  /** Signal externe (annulation par l'appelant). */
  externalSignal?: AbortSignal
}

export async function fetchWithTimeout(
  url: string,
  options: FetchTimeoutOptions,
): Promise<Response> {
  const { timeoutMs, externalSignal, ...init } = options
  const controller = new AbortController()

  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    if (timedOut) throw new TimeoutError(timeoutMs)
    throw e
  } finally {
    clearTimeout(timer)
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
  }
}
