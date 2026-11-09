import { describe, expect, it } from 'vitest'
import { medalForScore } from '../src/systems/operation/medal'

describe('operation medals', () => {
  it('withholds a medal from a failed or empty score', () => {
    expect(medalForScore(50_000, false)).toBe('none')
    expect(medalForScore(0, true)).toBe('none')
    expect(medalForScore(Number.NaN, true)).toBe('none')
  })

  it('bands bronze, silver and gold around the measured decision spread', () => {
    expect(medalForScore(35_000, true)).toBe('bronze')
    expect(medalForScore(49_999, true)).toBe('bronze')
    expect(medalForScore(50_000, true)).toBe('silver')
    expect(medalForScore(59_999, true)).toBe('silver')
    expect(medalForScore(60_000, true)).toBe('gold')
  })
})
