/**
 * Proxy Overpass (fonction serverless) — analyse de terrain OSM.
 *
 * On l'appelle côté serveur pour :
 *  - éviter le CORS quand `overpass-api.de` est sous charge et renvoie une
 *    page d'erreur HTML sans en-têtes CORS (le navigateur bloque la réponse) ;
 *  - centraliser le basculement vers le miroir `overpass.kumi.systems` ;
 *  - garder le client agnostique des URLs Overpass.
 *
 * Body attendu : `{ query: string }` (requête Overpass QL).
 */
const UPSTREAM_TIMEOUT_MS = 18_000

interface OverpassBody {
  query?: unknown
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event).public
  const primary = (config.overpassBaseUrl as string) || ''
  const fallback = (config.overpassFallbackUrl as string) || ''
  if (!primary) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Overpass non configuré (NUXT_PUBLIC_OVERPASS_BASE_URL absente).',
    })
  }

  const body = await readBody<OverpassBody>(event)
  if (typeof body?.query !== 'string' || !body.query) {
    throw createError({ statusCode: 400, statusMessage: 'query requise (string)' })
  }

  const formBody = `data=${encodeURIComponent(body.query)}`
  const urls = [primary, fallback].filter(Boolean)

  let lastError = 'aucune URL configurée'
  for (const url of urls) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody,
        signal: controller.signal,
      })
      const text = await upstream.text()
      if (!upstream.ok) {
        lastError = `Overpass ${upstream.status}`
        continue
      }
      // Overpass renvoie parfois une page HTML d'erreur (HTTP 200 ou non) sous
      // charge — on ne retient que les réponses JSON.
      if (!text.trimStart().startsWith('{')) {
        lastError = `Overpass: ${text.slice(0, 120)}`
        continue
      }
      setResponseHeader(event, 'content-type', 'application/json')
      return text
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'échec réseau Overpass'
    } finally {
      clearTimeout(timer)
    }
  }

  throw createError({
    statusCode: 422,
    statusMessage: `Overpass indisponible: ${lastError}`,
  })
})
