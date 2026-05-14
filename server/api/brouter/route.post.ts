/**
 * Proxy BRouter (fonction serverless) — routage trail / sentier.
 *
 * BRouter (brouter.de) route nativement le long des bons sentiers en pondérant
 * les tags OSM surface/tracktype. On l'appelle côté serveur : pas de CORS à
 * gérer, et un kill-switch central — si `NUXT_PUBLIC_BROUTER_BASE_URL` est vide,
 * la route renvoie 503 et le client retombe proprement sur les candidats ORS.
 *
 * Body attendu :
 *   { lonlats: [lon, lat][], profile: 'trekking' | 'hiking' | 'hiking-mountain' }
 */
const PROFILES = ['trekking', 'trekking-steep', 'hiking-mountain']
/** Timeout dur par URL amont (brouter.de puis le miroir). */
const UPSTREAM_TIMEOUT_MS = 10_000

interface BrouterBody {
  lonlats?: unknown
  profile?: unknown
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event).public
  const baseUrl = (config.brouterBaseUrl as string) || ''
  if (!baseUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Proxy BRouter non configuré (NUXT_PUBLIC_BROUTER_BASE_URL absente).',
    })
  }

  const body = await readBody<BrouterBody>(event)
  const lonlats = body?.lonlats
  const profile = body?.profile

  if (
    !Array.isArray(lonlats) ||
    lonlats.length < 2 ||
    !lonlats.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === 'number' &&
        typeof p[1] === 'number',
    )
  ) {
    throw createError({ statusCode: 400, statusMessage: 'lonlats invalide' })
  }
  if (typeof profile !== 'string' || !PROFILES.includes(profile)) {
    throw createError({ statusCode: 400, statusMessage: 'profile invalide' })
  }

  const query =
    `lonlats=${lonlats.map((p) => `${p[0]},${p[1]}`).join('|')}` +
    `&profile=${profile}&format=geojson`

  // brouter.de en primaire, bikerouter.de en miroir de secours.
  const fallbackUrl = (config.brouterFallbackUrl as string) || ''
  const urls = [baseUrl, fallbackUrl].filter(Boolean)

  let lastError = 'aucune URL configurée'
  for (const url of urls) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    try {
      const upstream = await fetch(`${url}?${query}`, { signal: controller.signal })
      const text = await upstream.text()
      if (!upstream.ok) {
        lastError = `BRouter ${upstream.status}`
        continue
      }
      // BRouter renvoie parfois une erreur en texte brut avec un HTTP 200.
      if (!text.trimStart().startsWith('{')) {
        lastError = `BRouter: ${text.slice(0, 120)}`
        continue
      }
      setResponseHeader(event, 'content-type', 'application/json')
      return text
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'échec réseau BRouter'
    } finally {
      clearTimeout(timer)
    }
  }

  throw createError({ statusCode: 422, statusMessage: `BRouter indisponible: ${lastError}` })
})
