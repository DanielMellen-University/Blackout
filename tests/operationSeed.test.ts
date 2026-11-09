import { describe, expect, it } from 'vitest'
import { normalizeOperationSeed } from '../src/systems/operation/seed'

describe('operation seed', () => {
  it('keeps a finite positive seed', () => {
    expect(normalizeOperationSeed(42)).toBe(42)
  })
})
