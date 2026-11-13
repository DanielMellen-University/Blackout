import { describe, expect, it } from 'vitest'
import { terrainEdgeJoin } from '../src/world/TerrainSeams'

const box = (originX: number, originZ: number, size = 1) => ({ originX, originZ, size })

describe('terrain edge join edges', () => {
  it('reports the partial overlap of unequal east and south neighbours', () => {
    const east = terrainEdgeJoin(box(0, 0, 2), box(840, 420, 1))!
    expect(east.edge).toBe(1)
    expect(east.start).toBe(420)
    expect(east.end).toBe(840)
    const south = terrainEdgeJoin(box(0, 0, 2), box(420, 840, 1))!
    expect(south.edge).toBe(2)
    expect(south.start).toBe(420)
    expect(south.end).toBe(840)
  })

  it('returns null for fully overlapping tiles and corner-only contact', () => {
    expect(terrainEdgeJoin(box(0, 0, 1), box(0, 0, 1))).toBeNull()
    expect(terrainEdgeJoin(box(0, 0, 1), box(420, 420, 1))).toBeNull()
    expect(terrainEdgeJoin(box(0, 0, 2), box(840, 840, 1))).toBeNull()
  })

  it('joins negative-coordinate neighbours on the west and north sides', () => {
    expect(terrainEdgeJoin(box(0, 0, 1), box(-420, 0, 1))?.edge).toBe(3)
    expect(terrainEdgeJoin(box(0, 0, 1), box(0, -420, 1))?.edge).toBe(0)
  })

  it('returns null when a neighbour only touches at one point of the edge', () => {
    expect(terrainEdgeJoin(box(0, 0, 1), box(420, 420, 2))).toBeNull()
    expect(terrainEdgeJoin(box(0, 0, 2), box(-420, 840, 1))).toBeNull()
  })
})
