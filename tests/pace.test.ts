import { describe, expect, it } from 'vitest'
import { PACE_PRESETS_MIN_PER_KM, formatPace, nextPace } from '../utils/pace'

describe('formatPace', () => {
  it('formate les minutes entières', () => {
    expect(formatPace(6)).toBe('6:00')
  })

  it('formate les demi-minutes', () => {
    expect(formatPace(5.5)).toBe('5:30')
    expect(formatPace(4.5)).toBe('4:30')
  })

  it('reporte un arrondi de 60 s sur la minute', () => {
    // 5.999 → 6:00 et non 5:60
    expect(formatPace(5.999)).toBe('6:00')
  })
})

describe('nextPace', () => {
  it('passe au preset suivant', () => {
    expect(nextPace(6)).toBe(6.5)
    expect(nextPace(4.5)).toBe(5)
  })

  it('boucle au plus petit preset depuis le dernier', () => {
    const last = PACE_PRESETS_MIN_PER_KM[PACE_PRESETS_MIN_PER_KM.length - 1]
    expect(nextPace(last)).toBe(PACE_PRESETS_MIN_PER_KM[0])
  })

  it('tolère une valeur hors preset (renvoie le 1er preset supérieur)', () => {
    expect(nextPace(5.2)).toBe(5.5)
    expect(nextPace(99)).toBe(PACE_PRESETS_MIN_PER_KM[0])
  })
})
