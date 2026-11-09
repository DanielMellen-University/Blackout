import { describe, expect, it } from 'vitest'
import { OPERATION_TERRAIN } from '../src/systems/operation/terrain'

describe('operation terrain', () => {
  it('uses a dry desert floor for the measured runs', () => {
    expect(OPERATION_TERRAIN.theme).toBe('desert-run')
    expect(OPERATION_TERRAIN.dry).toBe(true)
    expect(OPERATION_TERRAIN.baseHeight).toBe(200)
    expect(OPERATION_TERRAIN.relief).toBe(40)
    expect(OPERATION_TERRAIN.perfectLine).toBeUndefined()
  })
})
