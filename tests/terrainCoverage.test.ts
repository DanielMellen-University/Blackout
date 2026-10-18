import { describe, expect, it } from 'vitest'
import { TerrainSystem } from '../src/world/TerrainSystem'

function fixture() {
  const chunks = new Map<string, { alpha: number; terrainMesh: { visible: boolean } }>()
  const system = Object.create(TerrainSystem.prototype) as TerrainSystem
  Object.assign(system, { chunks })
  const add = (x: number, z: number, size = 1) => chunks.set(size === 1 ? `${x},${z}` : `${x},${z}:${size}`,
    { alpha: 1, terrainMesh: { visible: true } })
  return { system, chunks, add }
}

describe('settlement resident-terrain coverage', () => {
  it('detects an interior hole that a nine-point footprint survey misses', () => {
    const { system, chunks, add } = fixture()
    for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) add(x, z)
    expect(system.hasMeshCoverage(0, 0, 1680, 1680)).toBe(true)
    chunks.delete('1,1')
    expect(system.hasMeshCoverage(0, 0, 1680, 1680)).toBe(false)
    expect(system.hasMeshCoverage(840, 840, 1680, 1680)).toBe(true)
  })

  it('keeps overlapping parent coverage through LOD replacement, then requires all children', () => {
    const { system, chunks, add } = fixture()
    add(-4, -4, 4)
    expect(system.hasMeshCoverage(-1680, -1680, 0, 0)).toBe(true)
    for (let z = -4; z < 0; z += 2) for (let x = -4; x < 0; x += 2) add(x, z, 2)
    chunks.delete('-4,-4:4')
    expect(system.hasMeshCoverage(-1680, -1680, 0, 0)).toBe(true)
    chunks.get('-2,-2:2')!.alpha = 0
    expect(system.hasMeshCoverage(-1680, -1680, 0, 0)).toBe(false)
    chunks.get('-2,-2:2')!.alpha = 1
    chunks.get('-2,-2:2')!.terrainMesh.visible = false
    expect(system.hasMeshCoverage(-1680, -1680, 0, 0)).toBe(false)
  })

  it('handles top-level boundaries and rejects malformed or empty rectangles', () => {
    const { system, add } = fixture()
    add(0, 0, 32); add(32, 0, 32)
    expect(system.hasMeshCoverage(13000, 1, 14000, 500)).toBe(true)
    expect(system.hasMeshCoverage(13000, -1, 14000, 500)).toBe(false)
    expect(system.hasMeshCoverage(NaN, 0, 1, 1)).toBe(false)
    expect(system.hasMeshCoverage(0, 0, Infinity, 1)).toBe(false)
    expect(system.hasMeshCoverage(0, 0, 0, 1)).toBe(false)
    expect(system.hasMeshCoverage(1e100, 0, 2e100, 1)).toBe(false)
    expect(system.hasMeshCoverage(0, 0, 1e9, 1)).toBe(false)
  })
})
