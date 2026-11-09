import { describe, expect, it } from 'vitest'
import { normalizeOperationSeed } from '../src/systems/operation/seed'

describe('operation seed', () => {
  it('keeps a finite positive seed', () => {
    expect(normalizeOperationSeed(42)).toBe(42)
  })

  it('replays the same seed', () => {
    expect(normalizeOperationSeed(1337)).toBe(normalizeOperationSeed(1337))
  })

  it('turns NaN and infinity into seed 1', () => {
    expect(normalizeOperationSeed(Number.NaN)).toBe(1)
    expect(normalizeOperationSeed(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('uses the absolute value of a negative seed', () => {
    expect(normalizeOperationSeed(-18)).toBe(18)
  })
})
