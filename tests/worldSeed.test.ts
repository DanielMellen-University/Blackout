import { describe, expect, it, vi } from 'vitest'
import {
  copyWorldSeed,
  copyWorldSeedLink,
  formatWorldSeed,
  parseWorldSeed,
  worldSeedReplayUrl,
} from '../src/core/WorldSeed'

describe('world seed sharing', () => {
  it('formats only finite integer seed values', () => {
    expect(formatWorldSeed(42.9)).toBe('42')
    expect(formatWorldSeed(-7.4)).toBe('-7')
    expect(formatWorldSeed(Number.NaN)).toBe('0')
    expect(formatWorldSeed(Number.POSITIVE_INFINITY)).toBe('0')
  })

  it('copies a seed and fails closed when clipboard access is unavailable', async () => {
    const writeText = vi.fn(async () => {})
    await expect(copyWorldSeed(9876.8, { writeText })).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('9876')
    await expect(copyWorldSeed(Number.NaN, { writeText })).resolves.toBe(false)
    await expect(copyWorldSeed(12, null)).resolves.toBe(false)
  })

  it('parses only safe integer URL seeds', () => {
    expect(parseWorldSeed(' 9876 ')).toBe(9876)
    expect(parseWorldSeed('-42')).toBe(-42)
    expect(parseWorldSeed('1.5')).toBeNull()
    expect(parseWorldSeed('12e2')).toBeNull()
    expect(parseWorldSeed(String(Number.MAX_SAFE_INTEGER) + '0')).toBeNull()
    expect(parseWorldSeed(null)).toBeNull()
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
