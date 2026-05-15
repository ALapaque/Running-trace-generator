/**
 * Détection des mises à jour de l'app (build id Nuxt).
 *
 * Au chargement, on retient l'`id` de `/_nuxt/builds/latest.json`. Un poll
 * périodique (et au retour de visibilité du tab) re-fetche ce fichier : si
 * l'`id` a changé, c'est qu'une nouvelle version est déployée → on déclenche
 * une bannière qui propose à l'utilisateur de recharger.
 *
 * Recharger nettoie d'abord le cache app-shell du service worker pour
 * garantir que la nouvelle version est servie dès le premier reload (sans
 * ça, la stratégie stale-while-revalidate du SW renvoie d'abord l'ancien).
 */
export function useAppUpdate() {
  /** Build id capturé au démarrage de la session (référence). */
  const baseBuildId = useState<string | null>('app-update:base-id', () => null)
  /** True dès qu'un build id différent a été détecté. */
  const updateAvailable = useState<boolean>('app-update:available', () => false)
  /** L'utilisateur a fermé la bannière pour cette session. */
  const dismissed = useState<boolean>('app-update:dismissed', () => false)

  /** Mémorise l'id de référence (premier appel uniquement). */
  function setBaseBuildId(id: string | null): void {
    if (id && !baseBuildId.value) baseBuildId.value = id
  }

  /** Compare un id fraîchement fetché à la référence. Active la bannière si différent. */
  function checkForUpdate(id: string): void {
    if (baseBuildId.value && id !== baseBuildId.value) {
      updateAvailable.value = true
    }
  }

  function dismiss(): void {
    dismissed.value = true
  }

  /**
   * Nettoie les caches « app-shell » du SW puis recharge. Garantit que la
   * nouvelle version est servie dès ce reload (sinon stale-while-revalidate
   * renverrait l'ancien tant qu'il n'a pas été revalidé en arrière-plan).
   */
  async function applyUpdate(): Promise<void> {
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter((k) => k.endsWith('-app')).map((k) => caches.delete(k)),
        )
      } catch {
        // Pas critique — on recharge quand même.
      }
    }
    window.location.reload()
  }

  return {
    baseBuildId,
    updateAvailable,
    dismissed,
    setBaseBuildId,
    checkForUpdate,
    dismiss,
    applyUpdate,
  }
}
