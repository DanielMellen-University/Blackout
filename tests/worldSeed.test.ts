import { describe, expect, it, vi } from 'vitest'
import {
  copyWorldSeed,
  copyWorldSeedLink,
  formatWorldSeed,
  parseWorldSeed,
  shouldRegenerateWorldOnLaunch,
  worldSeedReplayUrl,
} from '../src/core/WorldSeed'
import { getWorldSeed, hash2, setWorldSeed } from '../src/world/noise'

describe('world seed sharing', () => {
  it('formats finite seeds at terrain-hash precision', () => {
    expect(formatWorldSeed(42.9)).toBe('42.9')
    expect(formatWorldSeed(-7.4)).toBe('-7.4')
    expect(formatWorldSeed(1337.9182009)).toBe('1337.918201')
    expect(formatWorldSeed(Number.NaN)).toBe('0')
    expect(formatWorldSeed(Number.POSITIVE_INFINITY)).toBe('0')
  })

  it('copies a seed and fails closed when clipboard access is unavailable', async () => {
    const writeText = vi.fn(async () => {})
    await expect(copyWorldSeed(9876.8, { writeText })).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('9876.8')
    await expect(copyWorldSeed(Number.NaN, { writeText })).resolves.toBe(false)
    await expect(copyWorldSeed(Number.MAX_SAFE_INTEGER, { writeText })).resolves.toBe(false)
    await expect(copyWorldSeed(12, null)).resolves.toBe(false)
  })

  it('parses only bounded decimal URL seeds', () => {
    expect(parseWorldSeed(' 9876 ')).toBe(9876)
    expect(parseWorldSeed('-42')).toBe(-42)
    expect(parseWorldSeed('1.5')).toBe(1.5)
    expect(parseWorldSeed('1337.9182')).toBe(1337.9182)
    expect(parseWorldSeed('1.1234567')).toBeNull()
    expect(parseWorldSeed('12e2')).toBeNull()
    expect(parseWorldSeed('9007199255.999999')).toBeNull()
    expect(parseWorldSeed('9000000000.123456')).toBe(9000000000.123456)
    expect(parseWorldSeed('.5')).toBe(0.5)
    expect(parseWorldSeed(null)).toBeNull()
  })

  it('canonicalizes procedural seeds to the precision used by the terrain hash', () => {
    setWorldSeed(267427.501572761)
    const canonical = getWorldSeed()
    expect(formatWorldSeed(canonical)).toBe('267427.501573')
    const before = hash2(12.5, -4.25)
    setWorldSeed(parseWorldSeed(formatWorldSeed(canonical))!)
    expect(getWorldSeed()).toBe(canonical)
    expect(hash2(12.5, -4.25)).toBe(before)
  })

  it('rebuilds the random course when a custom or replay seed is pending', () => {
    expect(shouldRegenerateWorldOnLaunch('random', 42)).toBe(true)
    expect(shouldRegenerateWorldOnLaunch('random', null)).toBe(false)
    expect(shouldRegenerateWorldOnLaunch('training-orbit', null)).toBe(true)
    expect(shouldRegenerateWorldOnLaunch(undefined, null)).toBe(true)
  })

  it('builds replay links while preserving existing query state', async () => {
    const href = 'http://localhost:5173/dev/terrain.html?debug=1#flight'
    const link = worldSeedReplayUrl(href, 1234.9)
    expect(link).toContain('/dev/terrain.html?debug=1&seed=1234')
    expect(link).toContain('#flight')
    const courseLink = worldSeedReplayUrl(href, 1234.9, 'coastal-run')
    expect(courseLink).toContain('seed=1234')
    expect(courseLink).toContain('course=coastal-run')
    expect(worldSeedReplayUrl(href, 1234, 'not a course')).not.toContain('course=')
    expect(worldSeedReplayUrl(href, Number.MAX_SAFE_INTEGER)).toBeNull()

    const writeText = vi.fn(async () => {})
    await expect(copyWorldSeedLink(1234.9, { writeText }, href, 'river-run')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith(worldSeedReplayUrl(href, 1234.9, 'river-run'))
    await expect(copyWorldSeedLink(1234, { writeText }, 'not a URL')).resolves.toBe(false)
  })

  it('swallows clipboard permission failures', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied')
    })
    await expect(copyWorldSeed(12, { writeText })).resolves.toBe(false)
  })
})
