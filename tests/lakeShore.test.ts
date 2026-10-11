import { describe, expect, it } from 'vitest'
import { refineLakeShore } from '../src/world/LakeShore'

describe('shared refined lake outline', () => {
  it('preserves every constrained anchor and cannot overshoot the cove or extent', () => {
    const original = new Float32Array([900, 650, 400, 550, 1100, 1400, 1300, 1000])
    const refined = refineLakeShore(original)
    expect(refined).toHaveLength(original.length * 2)
    for (let i = 0; i < original.length; i++) {
      expect(refined[i * 2]).toBe(original[i])
      expect(refined[i * 2 + 1]).toBeGreaterThanOrEqual(Math.min(original[i]!, original[(i + 1) % original.length]!))
      expect(refined[i * 2 + 1]).toBeLessThanOrEqual(Math.max(original[i]!, original[(i + 1) % original.length]!))
    }
    expect([...original]).toEqual([900, 650, 400, 550, 1100, 1400, 1300, 1000])
  })

  it('reduces polygon chord error without flattening a curved outline', () => {
    const r = new Float32Array(64).fill(4000), refined = refineLakeShore(r)
    const error = (n: number) => 4000 * (1 - Math.cos(Math.PI / n))
    expect(error(refined.length)).toBeLessThan(error(r.length) * .251)
    expect([...refined].every(x => x === 4000)).toBe(true)
  })

  it('is periodic and rotation invariant across the last/first sector', () => {
    const radii = new Float32Array([800, 750, 700, 900, 1300, 1100])
    const rotated = new Float32Array([...radii.slice(1), radii[0]!])
    const a = refineLakeShore(radii), b = refineLakeShore(rotated)
    expect([...b]).toEqual([...a.slice(2), ...a.slice(0, 2)])
    expect(refineLakeShore(new Float32Array())).toHaveLength(0)
  })
})
