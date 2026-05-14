import { describe, expect, it } from 'vitest'
import { computeDifficulty } from '../utils/difficulty'

describe('computeDifficulty', () => {
  it('classe une courte boucle plate en Facile', () => {
    expect(computeDifficulty(5_000, 20).level).toBe('Facile')
  })

  it('classe une boucle moyenne (~11 km, 130 m D+) en Modéré', () => {
    const r = computeDifficulty(11_300, 132)
    expect(r.level).toBe('Modéré')
    expect(r.effortKm).toBeCloseTo(11.3 + 1.32, 5)
  })

  it('le dénivelé alourdit la difficulté (100 m D+ ≈ 1 km)', () => {
    const flat = computeDifficulty(15_000, 0).effortKm
    const hilly = computeDifficulty(15_000, 800).effortKm
    expect(hilly - flat).toBeCloseTo(8, 5)
  })

  it('le single track majore l’effort', () => {
    const easy = computeDifficulty(20_000, 200, 0).effortKm
    const technical = computeDifficulty(20_000, 200, 1).effortKm
    expect(technical).toBeGreaterThan(easy)
  })

  it('classe un long parcours montagneux en Difficile ou plus', () => {
    const r = computeDifficulty(35_000, 1200)
    expect(['Difficile', 'Très difficile']).toContain(r.level)
  })

  it('la difficulté est monotone croissante avec l’effort', () => {
    const levels = [
      computeDifficulty(4_000, 0).effortKm,
      computeDifficulty(10_000, 100).effortKm,
      computeDifficulty(20_000, 500).effortKm,
      computeDifficulty(40_000, 1500).effortKm,
    ]
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!).toBeGreaterThan(levels[i - 1]!)
    }
  })
})
