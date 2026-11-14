import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import {
  createGroundHeightCache,
  sampleGroundNormal,
  sampleGroundNormalCached,
} from '../src/world/ground'

describe('ground normal sample distance', () => {
  it('falls back to the default spacing for a NaN sample distance', () => {
    const fallback = sampleGroundNormal(100, -200)
    const nan = sampleGroundNormal(100, -200, Number.NaN)
    expect([nan.x, nan.y, nan.z].every(Number.isFinite)).toBe(true)
    expect(nan.x).toBeCloseTo(fallback.x, 8)
    expect(nan.y).toBeCloseTo(fallback.y, 8)
    expect(nan.z).toBeCloseTo(fallback.z, 8)
  })

  it('returns a finite unit normal for a negative sample distance', () => {
    const normal = sampleGroundNormal(100, -200, -3)
    expect([normal.x, normal.y, normal.z].every(Number.isFinite)).toBe(true)
    expect(normal.length()).toBeCloseTo(1, 8)
    expect(normal.y).toBeGreaterThan(0)
  })

  it('falls back to the default spacing in the cached path too', () => {
    const cache = createGroundHeightCache()
    const target = new Vector3()
    const nan = sampleGroundNormalCached(100, -200, Number.NaN, cache, target)
    expect([nan.x, nan.y, nan.z].every(Number.isFinite)).toBe(true)
    expect(nan.length()).toBeCloseTo(1, 8)
    expect(nan.y).toBeGreaterThan(0)
    const fallback = sampleGroundNormal(100, -200)
    expect(nan.x).toBeCloseTo(fallback.x, 8)
    expect(nan.z).toBeCloseTo(fallback.z, 8)
  })
})
