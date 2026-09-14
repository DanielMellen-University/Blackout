import { describe, expect, it, vi } from 'vitest'
import { copyWorldSeed, formatWorldSeed } from '../src/core/WorldSeed'

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

  it('swallows clipboard permission failures', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied')
    })
    await expect(copyWorldSeed(12, { writeText })).resolves.toBe(false)
  })
})
