import { afterEach, describe, expect, it } from 'vitest'
import { fbm, hash2, ridged, setWorldSeed, valueNoise } from '../src/world/noise'

afterEach(() => setWorldSeed(1337.9182))

describe('value noise', () => {
  it('returns the lattice hash exactly at integer points', () => {
    setWorldSeed(73)
    for (const [x, z] of [[0, 0], [3, -2], [-17, 40]] as const) expect(valueNoise(x, z)).toBe(hash2(x, z))
  })

  it('stays in 0..1 and changes continuously across cell edges', () => {
    setWorldSeed(73)
    for (let i = 0; i < 400; i++) {
      const x = i * .37 - 50, z = i * .19 + 7
      const v = valueNoise(x, z)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    for (const edge of [1, 2, -3]) expect(Math.abs(valueNoise(edge - 1e-7, .4) - valueNoise(edge + 1e-7, .4))).toBeLessThan(1e-5)
  })
})

describe('fbm and ridged', () => {
  it('fbm with one octave is plain value noise and stays in 0..1', () => {
    setWorldSeed(1337)
    expect(fbm(4.2, -1.7, 1)).toBe(valueNoise(4.2, -1.7))
    expect(fbm(4.2, -1.7, 0)).toBe(0)
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * .71, i * -.33, 4, 2, .48)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('ridged stays in 0..1 and returns 0 with no octaves', () => {
    setWorldSeed(1337)
    expect(ridged(1, 2, 0)).toBe(0)
    for (let i = 0; i < 200; i++) {
      const v = ridged(i * .53, i * .29)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
