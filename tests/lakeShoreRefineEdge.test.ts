import { describe, expect, it } from 'vitest'
import { refineLakeShore } from '../src/world/LakeShore'

describe('lake shore refinement edges', () => {
  it('returns an empty shore for an empty radius list', () => {
    expect(refineLakeShore(new Float32Array(0))).toEqual(new Float32Array(0))
  })

  it('keeps a single radius unchanged', () => {
    expect(Array.from(refineLakeShore(new Float32Array([100])))).toEqual([100, 100])
  })

  it('inserts exact midpoints for two radii', () => {
    expect(Array.from(refineLakeShore(new Float32Array([100, 200])))).toEqual([100, 150, 200, 150])
  })

  it('never overshoots neighbouring radii on a rough shore', () => {
    const radii = new Float32Array([100, 400, 120, 380, 90, 300])
    const refined = refineLakeShore(radii)
    expect(refined.length).toBe(radii.length * 2)
    for (let i = 0; i < radii.length; i++) {
      expect(refined[i * 2]).toBe(radii[i])
      const midpoint = refined[i * 2 + 1]!
      const lo = Math.min(radii[i]!, radii[(i + 1) % radii.length]!)
      const hi = Math.max(radii[i]!, radii[(i + 1) % radii.length]!)
      expect(midpoint).toBeGreaterThanOrEqual(lo)
      expect(midpoint).toBeLessThanOrEqual(hi)
    }
  })

  it('keeps a constant shore constant', () => {
    const refined = refineLakeShore(new Float32Array([250, 250, 250, 250]))
    expect(Array.from(refined)).toEqual([250, 250, 250, 250, 250, 250, 250, 250])
  })
})
