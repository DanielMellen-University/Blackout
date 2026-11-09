import { describe, expect, it } from 'vitest'
import { buildStageGates, lateralForSeed } from '../src/systems/operation/gates'
import { STAGE_LENGTH_M } from '../src/systems/operation/layout'

describe('operation gates', () => {
  it('places three gates facing down-track', () => {
    const gates = buildStageGates(0, 400, 50)
    expect(gates).toHaveLength(3)
    expect(gates.map(gate => gate.z)).toEqual([800, 1600, 2400])
    for (const gate of gates) {
      expect(gate.fwdX).toBe(0)
      expect(gate.fwdZ).toBe(1)
      expect(gate.x).toBe(50)
      expect(gate.y).toBe(400)
    }
  })

  it('ends the stage on the last gate', () => {
    const gates = buildStageGates(2, 300, 0)
    expect(gates[2]?.z).toBe(3 * STAGE_LENGTH_M)
  })

  it('shifts the line with the seed and keeps that shift', () => {
    expect(lateralForSeed(42)).toBe(lateralForSeed(42))
    expect(lateralForSeed(42)).not.toBe(lateralForSeed(43))
  })
})
