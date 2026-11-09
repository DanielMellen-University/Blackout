import { describe, expect, it } from 'vitest'
import { medalForScore } from '../src/systems/operation/medal'

describe('operation medals', () => {
  it('withholds a medal from a failed or empty score', () => {
    expect(medalForScore(50_000, false)).toBe('none')
    expect(medalForScore(0, true)).toBe('none')
    expect(medalForScore(Number.NaN, true)).toBe('none')
  })
})
