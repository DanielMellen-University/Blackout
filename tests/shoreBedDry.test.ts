import { describe, expect, it } from 'vitest'
import { shoreBedSteps } from '../src/world/TerrainWaterBed'

const run = <T>(steps: Generator<void, T, void>): T => { for (;;) { const r = steps.next(); if (r.done) return r.value } }

describe('shoreBedSteps', () => {
  const segs = 4, span = 80, n = (segs + 1) ** 2

  it('leaves a dry tile with no nearby water untouched', () => {
    const heights = new Float32Array(n).fill(30), levels = new Float32Array(n).fill(-Infinity)
    const bed = run(shoreBedSteps(heights, levels, segs, span, 0, 0,
      o => { o.height = 30; o.waterLevel = -Infinity }, () => Number.NaN))
    expect(bed.stride).toBe(segs + 5)
    expect([...bed.heights].every(h => h === 30)).toBe(true)
  })

  it('lowers ground that pokes through a shallow wet cell below the water', () => {
    const heights = new Float32Array(n).fill(9.9), levels = new Float32Array(n).fill(10)
    heights[2 * (segs + 1) + 2] = 12
    const bed = run(shoreBedSteps(heights, levels, segs, span, 0, 0,
      o => { o.height = 9.9; o.waterLevel = 10 }, () => 10))
    const centre = (2 + 2) * bed.stride + 2 + 2
    expect(bed.heights[centre]!).toBeLessThan(10 - .15 + 1e-6)
  })

  it('never lowers points the caller preserves', () => {
    const heights = new Float32Array(n).fill(9.9), levels = new Float32Array(n).fill(10)
    heights[2 * (segs + 1) + 2] = 12
    const bed = run(shoreBedSteps(heights, levels, segs, span, 0, 0,
      o => { o.height = 9.9; o.waterLevel = 10 }, () => 10, () => true))
    expect(bed.heights[(2 + 2) * bed.stride + 4]).toBe(12)
  })
})
