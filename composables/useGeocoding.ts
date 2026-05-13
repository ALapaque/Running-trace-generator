/**
 * Géocodage simple via Nominatim (OSM).
 * Respect des conditions d'utilisation :
 *  - 1 requête / seconde max (on n'a pas de boucle agressive)
 *  - User-Agent identifiable (côté navigateur, le User-Agent est imposé par le UA navigateur)
 */

import type { LatLng } from '../types/ors'

export interface GeocodeResult {
  label: string
  position: LatLng
}

export function useGeocoding() {
  const config = useRuntimeConfig()

  async function search(query: string, limit = 5, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []
    const url = new URL(`${config.public.nominatimBaseUrl}/search`)
    url.searchParams.set('q', trimmed)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('addressdetails', '0')
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    const data = (await res.json()) as Array<{
      display_name: string
      lat: string
      lon: string
    }>
    return data.map((d) => ({
      label: d.display_name,
      position: { lat: parseFloat(d.lat), lng: parseFloat(d.lon) },
    }))
  }

  return { search }
}
