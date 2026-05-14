import { describe, expect, it } from 'vitest'
import { inRange, scaleRange } from '../composables/useRoutePipeline'
import { computeElevationGainLoss } from '../composables/useRouteGenerator'
import type { RoutePoint } from '../types/ors'

function pts(eles: number[]): RoutePoint[] {
  return eles.map((ele) => ({ lat: 0, lng: 0, ele, distance: 0 }))
}

describe('scaleRange', () => {
  it('multiplie les bornes', () => {
    expect(scaleRange({ min: 8, max: 12 }, 1000)).toEqual({ min: 8000, max: 12000 })
  })
  it('laisse null tel quel', () => {
    expect(scaleRange(null, 1000)).toBeNull()
  })
})

describe('inRange', () => {
  it('accepte tout quand la plage est null (critère non contraignant)', () => {
    expect(inRange(99_999, null, 0.075, 500)).toBe(true)
  })

  it('accepte une valeur dans la plage', () => {
    expect(inRange(10_000, { min: 8000, max: 12_000 }, 0.075, 500)).toBe(true)
  })

  it('rejette une valeur franchement hors plage', () => {
    expect(inRange(5_000, { min: 8000, max: 12_000 }, 0.075, 500)).toBe(false)
    expect(inRange(20_000, { min: 8000, max: 12_000 }, 0.075, 500)).toBe(false)
  })

  it('élargit la plage de la tolérance (ratio sur le milieu)', () => {
    // milieu 10000 → tol = max(500, 10000*0.075) = 750 → borne basse 7250
    expect(inRange(7_300, { min: 8000, max: 12_000 }, 0.075, 500)).toBe(true)
    expect(inRange(7_100, { min: 8000, max: 12_000 }, 0.075, 500)).toBe(false)
  })

  it('applique au minimum la tolérance absolue', () => {
    // petite plage → tol = max(500, 200*0.075=15) = 500
    expect(inRange(550, { min: 1000, max: 2000 }, 0.075, 500)).toBe(true)
    expect(inRange(450, { min: 1000, max: 2000 }, 0.075, 500)).toBe(false)
  })
})

describe('computeElevationGainLoss', () => {
  it('renvoie 0/0 pour un profil plat', () => {
    expect(computeElevationGainLoss(pts([100, 100, 100]))).toEqual({ gain: 0, loss: 0 })
  })

  it('ignore le bruit SRTM (variations < 2 m)', () => {
    // aucune variation cumulée n'atteint 2 m depuis le dernier point significatif
    const { gain, loss } = computeElevationGainLoss(pts([100, 101, 100.5, 101.8, 100.2]))
    expect(gain).toBe(0)
    expect(loss).toBe(0)
  })

  it('comptabilise une montée franche', () => {
    expect(computeElevationGainLoss(pts([100, 150]))).toEqual({ gain: 50, loss: 0 })
  })

  it('sépare montée et descente', () => {
    const { gain, loss } = computeElevationGainLoss(pts([100, 110, 105]))
    expect(gain).toBe(10)
    expect(loss).toBe(5)
  })
})
