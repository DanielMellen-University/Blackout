import { afterEach, describe, expect, it } from 'vitest'
import { clearOpsPad, getOpsPad, getOpsPadRevision, opsPadBlend, OPS_PAD_INNER, OPS_PAD_OUTER, setOpsPad } from '../src/world/terrainSample'

afterEach(clearOpsPad)

describe('ops pad state', () => {
  it('bumps the revision on every set and clear', () => {
    const start = getOpsPadRevision()
    setOpsPad(0, 0, 10)
    setOpsPad(0, 0, 10)
    clearOpsPad()
    expect(getOpsPadRevision()).toBe(start + 3)
  })

  it('treats a non-finite yaw as zero', () => {
    setOpsPad(1, 2, 3, Number.NaN)
    expect(getOpsPad()).toEqual({ x: 1, z: 2, y: 3, yaw: 0 })
  })

  it('blends from full inside the inner ring to none past the outer ring', () => {
    expect(opsPadBlend(0, 0)).toBe(0)
    setOpsPad(0, 0, 10)
    expect(opsPadBlend(OPS_PAD_INNER, 0)).toBe(1)
    expect(opsPadBlend(OPS_PAD_OUTER, 0)).toBe(0)
    let previous = 1
    for (let r = OPS_PAD_INNER; r <= OPS_PAD_OUTER; r += 5) {
      const blend = opsPadBlend(0, r)
      expect(blend).toBeLessThanOrEqual(previous)
      previous = blend
    }
  })
})
