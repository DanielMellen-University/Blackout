import { afterEach, describe, expect, it } from 'vitest'
import { getWorldSeed, hash2, setWorldSeed } from '../src/world/noise'

afterEach(() => setWorldSeed(1337.9182))

describe('world seed', () => {
  it('rounds seeds to six decimals so they replay exactly', () => {
    setWorldSeed(73.12345678)
    expect(getWorldSeed()).toBe(73.123457)
  })

  it('keeps the zero guard and its sign', () => {
    setWorldSeed(0)
    expect(getWorldSeed()).toBe(.001)
    setWorldSeed(-1e-9)
    expect(getWorldSeed()).toBe(-.001)
  })

  it('falls back for non-finite and oversized seeds', () => {
    setWorldSeed(Number.NaN)
    expect(getWorldSeed()).toBe(.001)
    setWorldSeed(1e300)
    expect(getWorldSeed()).toBe(.001)
  })

  it('changes the hash field with the seed and restores it on reseed', () => {
    setWorldSeed(1)
    const a = hash2(5, 9)
    setWorldSeed(2)
    expect(hash2(5, 9)).not.toBe(a)
    setWorldSeed(1)
    expect(hash2(5, 9)).toBe(a)
  })
})
