import { describe, expect, it } from 'vitest'
import { encodeParams, decodeParamsFromHash } from '../utils/share-url'
import type { GenerationParams } from '../types'

const baseParams: GenerationParams = {
  start: { lat: 50.4108, lng: 4.4446 },
  distanceKm: { min: 8, max: 12 },
  elevationGainM: { min: 100, max: 300 },
  mode: 'trail',
  hills: 'vallonné',
  resultsCount: 5,
}

describe('encodeParams / decodeParamsFromHash', () => {
  it('fait un aller-retour fidèle', () => {
    const hash = `#${encodeParams(baseParams)}`
    const decoded = decodeParamsFromHash(hash)
    expect(decoded).not.toBeNull()
    expect(decoded!.start.lat).toBeCloseTo(50.4108, 4)
    expect(decoded!.start.lng).toBeCloseTo(4.4446, 4)
    expect(decoded!.distanceKm).toEqual({ min: 8, max: 12 })
    expect(decoded!.elevationGainM).toEqual({ min: 100, max: 300 })
    expect(decoded!.mode).toBe('trail')
    expect(decoded!.hills).toBe('vallonné')
    expect(decoded!.resultsCount).toBe(5)
  })

  it('gère un critère null (distance non contrainte)', () => {
    const decoded = decodeParamsFromHash(
      `#${encodeParams({ ...baseParams, distanceKm: null })}`,
    )
    expect(decoded).not.toBeNull()
    expect(decoded!.distanceKm).toBeNull()
    expect(decoded!.elevationGainM).toEqual({ min: 100, max: 300 })
  })

  it('rejette un hash absent ou sans clé g=', () => {
    expect(decodeParamsFromHash('')).toBeNull()
    expect(decodeParamsFromHash('#')).toBeNull()
    expect(decodeParamsFromHash('#foo=bar')).toBeNull()
  })

  it('rejette un payload corrompu', () => {
    expect(decodeParamsFromHash('#g=not-valid-base64!!!')).toBeNull()
  })

  it('rejette un payload où les deux critères sont null', () => {
    const hash = `#${encodeParams({
      ...baseParams,
      distanceKm: null,
      elevationGainM: null,
    })}`
    expect(decodeParamsFromHash(hash)).toBeNull()
  })

  it('borne les valeurs hors limites au décodage', () => {
    // distance 999 km → clampée à 50 (DISTANCE_BOUNDS_KM.max)
    const hash = `#${encodeParams({
      ...baseParams,
      distanceKm: { min: 1, max: 999 },
    })}`
    const decoded = decodeParamsFromHash(hash)
    expect(decoded!.distanceKm!.max).toBeLessThanOrEqual(50)
    expect(decoded!.distanceKm!.min).toBeGreaterThanOrEqual(3)
  })

  it('cohabite avec d\'autres fragments dans le hash', () => {
    const hash = `#other=1&${encodeParams(baseParams)}&z=2`
    expect(decodeParamsFromHash(hash)).not.toBeNull()
  })

  it('encode et préserve `preferGreenway`', () => {
    const hash = `#${encodeParams({ ...baseParams, preferGreenway: true })}`
    const decoded = decodeParamsFromHash(hash)
    expect(decoded!.preferGreenway).toBe(true)
  })

  it('absent → preferGreenway défaut à false (rétrocompat)', () => {
    const hash = `#${encodeParams(baseParams)}`
    const decoded = decodeParamsFromHash(hash)
    expect(decoded!.preferGreenway).toBe(false)
  })
})
