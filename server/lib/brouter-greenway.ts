/**
 * Profil BRouter custom « greenway » — privilégie RAVeL / voies vertes /
 * pistes cyclables revêtues car-free dans le routage trail.
 *
 * brouter.de expose un endpoint non documenté `POST /brouter/profile` qui
 * accepte un `.brf` en raw body et renvoie `{ profileid: "custom_<id>" }`.
 * On peut ensuite l'utiliser comme n'importe quel profil nommé. Limite :
 * les profils sont **cache-only** côté brouter.de — purgés sans préavis.
 * On gère ça en module-level state + invalidation manuelle (cf. usage côté
 * `server/api/brouter/route.post.ts` qui rejoue l'upload sur 404 amont).
 */

const PROFILE_ASSET_KEY = 'trekking-greenway.brf'
/** Timeout dur de l'upload (le serveur écrit un fichier de ~17KB, fast). */
const UPLOAD_TIMEOUT_MS = 8_000

/** Cache module-level (réinitialisé à chaque cold start serverless — OK). */
let cachedProfileId: Promise<string> | null = null

interface ProfileUploadResponse {
  profileid?: unknown
  error?: unknown
}

async function uploadProfile(baseUrl: string): Promise<string> {
  const text = await useStorage('assets:server').getItem<string>(PROFILE_ASSET_KEY)
  if (!text) {
    throw new Error(`Asset profil greenway introuvable (${PROFILE_ASSET_KEY})`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: text,
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`upload profil BRouter HTTP ${res.status}`)
    }
    const data = (await res.json()) as ProfileUploadResponse
    const id = data?.profileid
    if (typeof id !== 'string' || !id.startsWith('custom_')) {
      throw new Error(`upload profil BRouter: réponse inattendue (${JSON.stringify(data).slice(0, 80)})`)
    }
    return id
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Récupère (ou crée à la demande) l'id du profil custom « greenway » sur
 * brouter.de. Le résultat est mémoïsé — appels concurrents partagent la même
 * Promise. Si l'upload échoue, le cache est invalidé pour permettre un retry.
 */
export async function getOrCreateGreenwayProfileId(baseUrl: string): Promise<string> {
  if (!cachedProfileId) {
    cachedProfileId = uploadProfile(baseUrl).catch((e) => {
      cachedProfileId = null // permet un retry à la prochaine requête
      throw e
    })
  }
  return cachedProfileId
}

/**
 * Force le re-upload au prochain appel. À déclencher quand le routage amont
 * renvoie une erreur du type « profil non trouvé » (brouter.de a purgé son
 * cache disque). Fonction synchrone : pas d'I/O ici.
 */
export function invalidateGreenwayProfileId(): void {
  cachedProfileId = null
}
