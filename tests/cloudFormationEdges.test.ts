import { describe, expect, it } from 'vitest'
import {
  cloudCellLayer,
  cloudCellRandom,
  shapeCloudFormation,
  type CloudLayer,
  type CloudPuff,
} from '../src/world/CloudFormations'

const puff = (): CloudPuff => ({ x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, rotationY: 0 })

describe('cloud formation edges', () => {
  it('returns a unit-range deterministic roll per cell and salt', () => {
    const roll = cloudCellRandom(42, 3, -7, 5)
    expect(roll).toBeGreaterThanOrEqual(0)
    expect(roll).toBeLessThan(1)
    expect(cloudCellRandom(42, 3, -7, 5)).toBe(roll)
    expect(cloudCellRandom(42, 3, -7, 6)).not.toBe(roll)
    expect(cloudCellRandom(43, 3, -7, 5)).not.toBe(roll)
  })

  it('produces all three layers across a spread of cells', () => {
    const layers = new Set<CloudLayer>()
    for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) layers.add(cloudCellLayer(7, x, z))
    expect(layers).toEqual(new Set(['cumulus', 'stratus', 'cirrus']))
  })

  it('shapes zero puffs without throwing', () => {
    expect(() => shapeCloudFormation([], 'cumulus', 1, 0, 0)).not.toThrow()
    expect(() => shapeCloudFormation([], 'stratus', 1, 0, 0)).not.toThrow()
    expect(() => shapeCloudFormation([], 'cirrus', 1, 0, 0)).not.toThrow()
  })

  it('shapes a single puff per layer with finite positive sizes', () => {
    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      const puffs = [puff()]
      shapeCloudFormation(puffs, layer, 1, -3, 4)
      const p = puffs[0]!
      expect([p.x, p.y, p.z, p.sx, p.sy, p.sz, p.rotationY].every(Number.isFinite)).toBe(true)
      expect(p.sx).toBeGreaterThan(0)
      expect(p.sy).toBeGreaterThan(0)
      expect(p.sz).toBeGreaterThan(0)
    }
  })

  it('keeps the same formation for the same cell and seed', () => {
    const first = Array.from({ length: 6 }, puff)
    const second = Array.from({ length: 6 }, puff)
    shapeCloudFormation(first, 'cumulus', 9, 11, -2)
    shapeCloudFormation(second, 'cumulus', 9, 11, -2)
    expect(first).toEqual(second)
  })
})
