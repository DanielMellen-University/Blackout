import { describe, expect, it } from 'vitest'
import { clamp01, smoothstep } from '../src/world/noise'

describe('smoothstep and clamp01', () => {
  it('clamps outside the edges and is symmetric about the midpoint', () => {
    expect(smoothstep(0, 10, -5)).toBe(0)
    expect(smoothstep(0, 10, 15)).toBe(1)
    expect(smoothstep(0, 10, 5)).toBeCloseTo(.5, 12)
    for (const t of [1, 2.5, 4]) expect(smoothstep(0, 10, t) + smoothstep(0, 10, 10 - t)).toBeCloseTo(1, 12)
  })

  it('has zero slope at both edges', () => {
    const h = 1e-4
    expect(smoothstep(0, 1, h) / h).toBeLessThan(.001)
    expect((1 - smoothstep(0, 1, 1 - h)) / h).toBeLessThan(.001)
  })

  it('works with reversed edges the way terrain fades use it', () => {
    expect(smoothstep(10, 0, 0)).toBe(1)
    expect(smoothstep(10, 0, 10)).toBe(0)
  })

  it('treats equal edges as a hard step instead of NaN', () => {
    expect(smoothstep(5, 5, 4)).toBe(0)
    expect(smoothstep(5, 5, 5)).toBe(1)
    expect(smoothstep(5, 5, 6)).toBe(1)
  })

  it('clamp01 keeps values inside the unit range', () => {
    expect([-1, 0, .25, 1, 3].map(clamp01)).toEqual([0, 0, .25, 1, 1])
  })

  it('clamp01 maps non-finite input to 0 instead of leaking NaN into colors', () => {
    expect(clamp01(Number.NaN)).toBe(0)
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clamp01(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})
