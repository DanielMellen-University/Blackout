import { describe, expect, it } from 'vitest'
import { touchInputSupported } from '../src/core/TouchControls'

describe('touch flight controls support detection', () => {
  it('accepts touch points or a coarse pointer', () => {
    expect(touchInputSupported(5, false)).toBe(true)
    expect(touchInputSupported(0, true)).toBe(true)
    expect(touchInputSupported(0, false)).toBe(false)
  })

  it('rejects malformed touch point counts without hiding coarse devices', () => {
    expect(touchInputSupported(Number.NaN, false)).toBe(false)
    expect(touchInputSupported(Number.POSITIVE_INFINITY, false)).toBe(false)
    expect(touchInputSupported(-1, false)).toBe(false)
    expect(touchInputSupported(Number.NaN, true)).toBe(true)
  })
})
