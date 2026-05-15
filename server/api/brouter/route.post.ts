/**
 * Proxy BRouter (fonction serverless) — routage trail / sentier.
 *
 * BRouter (brouter.de) route nativement le long des bons sentiers en pondérant
 * les tags OSM surface/tracktype. On l'appelle côté serveur : pas de CORS à
 * gérer, et un kill-switch central — si `NUXT_PUBLIC_BROUTER_BASE_URL` est vide,
 * la route renvoie 503 et le client retombe proprement sur les candidats ORS.
 *
 * Pour le profil `trekking`, on uploade au démarrage (paresseusement) une
 * variante custom « greenway » qui privilégie les voies vertes / RAVeL /
 * pistes cyclables revêtues. Si brouter.de a purgé son cache de profils, on
 * réuploade et retry une fois.
 *
 * Body attendu :
 *   { lonlats: [lon, lat][], profile: 'trekking' | 'trekking-steep' | 'hiking-mountain' }
 */
import {
  getOrCreateGreenwayProfileId,
  invalidateGreenwayProfileId,
} from '../../lib/brouter-greenway'

const PROFILES = ['trekking', 'trekking-steep', 'hiking-mountain']
/** Timeout dur par URL amont (brouter.de puis le miroir). */
const UPSTREAM_TIMEOUT_MS = 10_000

interface BrouterBody {
  lonlats?: unknown
  profile?: unknown
}

/**
 * Résout un profil logique en nom à envoyer à brouter.de.
 * - `trekking` → profil custom greenway (upload-on-demand, cache module).
 * - autres → builtin brouter.de tel quel.
 */
async function resolveProfileName(profile: string, baseUrl: string): Promise<string> {
  if (profile === 'trekking') {
    return getOrCreateGreenwayProfileId(baseUrl)
  }
  return profile
}

interface UpstreamResult {
  ok: true
  json: string
}

interface UpstreamFailure {
  ok: false
  /** Erreur réseau (timeout, DNS…) — le custom profile reste valide, on essaie le miroir. */
  retryable: boolean
  /** Le profil custom a probablement été purgé côté serveur — invalider + ré-uploader. */
  profileExpired: boolean
  message: string
}

/**
 * Appelle un upstream BRouter une fois. Distingue les trois familles d'échec
 * pour qu'on sache quoi faire derrière (essayer le miroir vs ré-uploader vs
 * remonter au client).
 */
async function fetchUpstream(url: string, query: string): Promise<UpstreamResult | UpstreamFailure> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const upstream = await fetch(`${url}?${query}`, { signal: controller.signal })
    const text = await upstream.text()

    if (!upstream.ok) {
      // 404 / 500 avec un body mentionnant le profil → cache purgé côté brouter.de.
      const profileExpired = /profile/i.test(text) && /not.?(found|exist)|unknown/i.test(text)
      return {
        ok: false,
        retryable: true,
        profileExpired,
        message: `HTTP ${upstream.status}: ${text.slice(0, 120)}`,
      }
    }
    // BRouter renvoie parfois une erreur en texte brut avec un HTTP 200.
    if (!text.trimStart().startsWith('{')) {
      const profileExpired = /profile/i.test(text)
      return {
        ok: false,
        retryable: true,
        profileExpired,
        message: text.slice(0, 120),
      }
    }
    return { ok: true, json: text }
  } catch (e) {
    return {
      ok: false,
      retryable: true,
      profileExpired: false,
      message: e instanceof Error ? e.message : 'échec réseau BRouter',
    }
  } finally {
    clearTimeout(timer)
  }
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

  const lonlatsParam = (lonlats as [number, number][]).map((p) => `${p[0]},${p[1]}`).join('|')
  // brouter.de en primaire, fallback éventuel via brouterFallbackUrl (vide par défaut).
  const fallbackUrl = (config.brouterFallbackUrl as string) || ''
  const urls = [baseUrl, fallbackUrl].filter(Boolean)

  let lastError = 'aucune URL configurée'
  let alreadyReuploaded = false

  for (const url of urls) {
    // Résolution du nom de profil sur chaque URL — le custom_<id> est lié à
    // un serveur donné (uploaded sur celui-ci). Pour l'instant on n'uploade
    // que sur l'URL primaire ; sur le miroir, on retombe sur le builtin.
    let resolvedProfile: string
    try {
      resolvedProfile = url === baseUrl ? await resolveProfileName(profile, baseUrl) : profile
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'résolution profil échouée'
      continue
    }
    const query = `lonlats=${lonlatsParam}&profile=${resolvedProfile}&format=geojson`

    let result = await fetchUpstream(url, query)

    // Retry: si on a utilisé un profil custom et que le serveur l'a purgé,
    // on ré-uploade puis on rejoue UNE fois.
    if (
      !result.ok &&
      result.profileExpired &&
      url === baseUrl &&
      resolvedProfile !== profile &&
      !alreadyReuploaded
    ) {
      alreadyReuploaded = true
      invalidateGreenwayProfileId()
      try {
        const fresh = await resolveProfileName(profile, baseUrl)
        const retryQuery = `lonlats=${lonlatsParam}&profile=${fresh}&format=geojson`
        result = await fetchUpstream(url, retryQuery)
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'ré-upload profil échoué'
        continue
      }
    }

    if (result.ok) {
      setResponseHeader(event, 'content-type', 'application/json')
      return result.json
    }
    lastError = result.message
  }

  throw createError({ statusCode: 422, statusMessage: `BRouter indisponible: ${lastError}` })
})
