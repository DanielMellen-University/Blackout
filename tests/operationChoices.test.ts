import { describe, expect, it } from 'vitest'
import { isEnergyChoice, isRouteChoice, operationPathKey } from '../src/systems/operation/choices'

describe('operation choices', () => {
  it('accepts only valley or ridge', () => {
    expect(isRouteChoice('valley')).toBe(true)
    expect(isRouteChoice('ridge')).toBe(true)
    expect(isRouteChoice('commit')).toBe(false)
    expect(isRouteChoice(null)).toBe(false)
  })

  it('accepts only conserve or commit', () => {
    expect(isEnergyChoice('conserve')).toBe(true)
    expect(isEnergyChoice('commit')).toBe(true)
    expect(isEnergyChoice('valley')).toBe(false)
  })

  it('names a decision path', () => {
    expect(operationPathKey('valley', 'commit')).toBe('valley-commit')
  })
})
