import { describe, expect, it } from 'vitest'
import { terrainEdgeJoin } from '../src/world/TerrainSeams'
import { CHUNK_SIZE } from '../src/world/TerrainGeometry'

const box = (x: number, z: number, size = 1) => ({ originX: x * CHUNK_SIZE, originZ: z * CHUNK_SIZE, size })

describe('terrainEdgeJoin', () => {
  it('names the shared side as north, east, south or west', () => {
    const a = box(0, 0)
    expect(terrainEdgeJoin(a, box(1, 0))?.edge).toBe(1)
    expect(terrainEdgeJoin(a, box(-1, 0))?.edge).toBe(3)
    expect(terrainEdgeJoin(a, box(0, 1))?.edge).toBe(2)
    expect(terrainEdgeJoin(a, box(0, -1))?.edge).toBe(0)
  })

  it('clips the shared span to the smaller neighbour', () => {
    const join = terrainEdgeJoin(box(0, 0, 4), box(4, 2))!
    expect(join.start).toBe(2 * CHUNK_SIZE)
    expect(join.end).toBe(3 * CHUNK_SIZE)
  })

  it('ignores corner-only contact, gaps and overlaps', () => {
    expect(terrainEdgeJoin(box(0, 0), box(1, 1))).toBeNull()
    expect(terrainEdgeJoin(box(0, 0), box(2, 0))).toBeNull()
    expect(terrainEdgeJoin(box(0, 0, 2), box(1, 0))).toBeNull()
  })
})
