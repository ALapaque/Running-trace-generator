/**
 * Proxy ORS opt-in (fonction serverless).
 *
 * Inerte par défaut : si `runtimeConfig.orsApiKey` (NUXT_ORS_API_KEY) n'est
 * pas renseignée, la route renvoie 503 et l'app reste en mode « zéro backend »
 * (clé publique côté client).
 *
 * Pour l'activer : définir NUXT_ORS_API_KEY (serveur) + NUXT_PUBLIC_ORS_BASE_URL=/api/ors.
 * La clé ORS n'est alors jamais exposée au client.
 */
export default defineEventHandler(async (event) => {
  const apiKey = useRuntimeConfig(event).orsApiKey
  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Proxy ORS non configuré (NUXT_ORS_API_KEY absente).',
    })
  }

  const path = (getRouterParam(event, 'path') ?? '').replace(/^\/+/, '')
  const body = await readRawBody(event)

  const upstream = await fetch(`https://api.openrouteservice.org/${path}`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json',
    },
    body: body ?? undefined,
  })

  // On propage le statut (notamment 429) et le corps tels quels.
  setResponseStatus(event, upstream.status)
  setResponseHeader(
    event,
    'content-type',
    upstream.headers.get('content-type') ?? 'application/json',
  )
  return await upstream.text()
})
