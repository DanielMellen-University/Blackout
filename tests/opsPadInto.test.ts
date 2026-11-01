import { afterEach, describe, expect, it } from 'vitest'
import { clearOpsPad, getOpsPadInto, setOpsPad } from '../src/world/terrainSample'

afterEach(clearOpsPad)

describe('getOpsPadInto', () => {
  it('returns null and leaves storage alone while no pad is set', () => {
    clearOpsPad()
    const out = { x: 9, z: 9, y: 9, yaw: 9 }
    expect(getOpsPadInto(out)).toBeNull()
    expect(out).toEqual({ x: 9, z: 9, y: 9, yaw: 9 })
  })

  it('fills and returns the caller-owned record', () => {
    setOpsPad(10, -20, 33, .5)
    const out = { x: 0, z: 0, y: 0, yaw: 0 }
    expect(getOpsPadInto(out)).toBe(out)
    expect(out).toEqual({ x: 10, z: -20, y: 33, yaw: .5 })
  })
})
