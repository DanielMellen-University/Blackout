import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { headingFromOrientation } from '../src/core/attitude'

describe('stable flight attitude heading', () => {
  it('resolves horizontal nose heading from the shared +Z convention', () => {
    const orientation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
    expect(headingFromOrientation(orientation)).toBeCloseTo(Math.PI / 2)
  })

  it('retains the last reliable heading when the nose is vertical', () => {
    const orientation = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
    expect(headingFromOrientation(orientation, 1.2)).toBeCloseTo(1.2)
  })

  it('contains malformed orientation and fallback values', () => {
    const orientation = new Quaternion(Number.NaN, 0, 0, 1)
    expect(headingFromOrientation(orientation, 0.7)).toBeCloseTo(0.7)
    expect(headingFromOrientation(orientation, Number.NaN)).toBe(0)
  })
})
