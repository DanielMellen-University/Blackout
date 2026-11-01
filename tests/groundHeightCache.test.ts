import { describe, expect, it } from 'vitest'
import { clearGroundHeightCache, createGroundHeightCache, groundSamplerRevision,
  invalidateGroundSamplerCaches } from '../src/world/ground'

describe('ground height cache', () => {
  it('clamps capacity to 1..32 and defaults bad input to 8', () => {
    expect(createGroundHeightCache(0).entries).toHaveLength(1)
    expect(createGroundHeightCache(100).entries).toHaveLength(32)
    expect(createGroundHeightCache(Number.NaN).entries).toHaveLength(8)
    expect(createGroundHeightCache(3.9).entries).toHaveLength(3)
  })

  it('starts with slots that cannot match the world origin', () => {
    for (const entry of createGroundHeightCache().entries) {
      expect(entry.x === 0 && entry.z === 0).toBe(false)
      expect(entry.surfaceKnown).toBe(false)
    }
  })

  it('clearing resets the cursor, last slot and revision', () => {
    const cache = createGroundHeightCache(4)
    cache.cursor = 3; cache.lastIndex = 2
    cache.entries[1]!.x = 5; cache.entries[1]!.z = 6; cache.entries[1]!.surfaceKnown = true
    invalidateGroundSamplerCaches()
    clearGroundHeightCache(cache)
    expect(cache.cursor).toBe(0)
    expect(cache.lastIndex).toBe(-1)
    expect(cache.revision).toBe(groundSamplerRevision())
    expect(Number.isNaN(cache.entries[1]!.x)).toBe(true)
    expect(cache.entries[1]!.surfaceKnown).toBe(false)
  })

  it('invalidation bumps the shared revision', () => {
    const before = groundSamplerRevision()
    invalidateGroundSamplerCaches()
    expect(groundSamplerRevision()).toBe(before + 1)
  })
})
