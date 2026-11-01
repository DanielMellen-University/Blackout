import { describe, expect, it } from 'vitest'
import { deserializeTerrainGeometry, terrainTransferables, type TerrainGeometryBuffers } from '../src/world/TerrainGeometry'

const buffers = (positions: Float32Array, index: Uint32Array | null): TerrainGeometryBuffers => ({
  attributes: { position: { array: positions, itemSize: 3 } }, index, bounds: { x: 1, y: 2, z: 3, radius: 40 },
})

describe('terrain worker payloads', () => {
  it('lists each backing buffer once even when views share it', () => {
    const shared = new ArrayBuffer(64)
    const heights = new Float32Array(shared, 0, 4), levels = new Float32Array(shared, 16, 4)
    const ground = buffers(new Float32Array(9), new Uint32Array([0, 1, 2]))
    const list = terrainTransferables({ ground, water: null, heights, waterLevels: levels, segs: 1 })
    expect(list).toHaveLength(3)
    expect(new Set(list).size).toBe(list.length)
  })

  it('includes water buffers when a tile has water', () => {
    const ground = buffers(new Float32Array(9), null), water = buffers(new Float32Array(9), new Uint32Array(3))
    const list = terrainTransferables({ ground, water, heights: new Float32Array(4), waterLevels: new Float32Array(4), segs: 1 })
    expect(list).toContain(water.attributes.position!.array.buffer)
    expect(list).toContain(water.index!.buffer)
  })

  it('rebuilds geometry around the same arrays and keeps the worker bounds', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), index = new Uint32Array([0, 1, 2])
    const geometry = deserializeTerrainGeometry(buffers(positions, index))
    expect(geometry.getAttribute('position').array).toBe(positions)
    expect(geometry.index!.array).toBe(index)
    expect(geometry.boundingSphere!.center.toArray()).toEqual([1, 2, 3])
    expect(geometry.boundingSphere!.radius).toBe(40)
  })
})
