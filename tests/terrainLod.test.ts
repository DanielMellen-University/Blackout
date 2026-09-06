import { Mesh, Scene } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { sampleGroundHeight, setContactHeightSampler } from '../src/world/ground'
import {
  CHUNK_SIZE,
  interpolateGridHeight,
  lodFromDist,
  lodWithHysteresis,
  segsForLod,
  TerrainSystem,
} from '../src/world/TerrainSystem'
import { sampleTerrainHeight } from '../src/world/terrainSample'

function pump(terrain: TerrainSystem, x: number, z: number, frames: number): void {
  for (let i = 0; i < frames; i++) terrain.update(x, z, 1 / 60)
}

describe('terrain LOD bands', () => {
  it('promotes after the inner ring and demotes only past hysteresis', () => {
    expect(lodFromDist(0)).toBe(0)
    expect(lodFromDist(11)).toBe(1)
    expect(lodFromDist(12)).toBe(2)

    expect(lodWithHysteresis(4, 0)).toBe(0)
    expect(lodWithHysteresis(5, 0)).toBe(1)
    expect(lodWithHysteresis(2.2, 1)).toBe(0)
    expect(lodWithHysteresis(12, 1)).toBe(1)
    expect(lodWithHysteresis(13, 1)).toBe(2)
    expect(lodWithHysteresis(0, 2)).toBe(0)
  })
})

describe('interpolateGridHeight', () => {
  it('matches PlaneGeometry triangulation on a 1-cell quad', () => {
    const heights = new Float32Array([0, 10, 30, 20])
    // iy * 2 + ix: (0,0)=0, (1,0)=10, (0,1)=30, (1,1)=20
    expect(interpolateGridHeight(heights, 1, 0, 0, 0, 0)).toBe(0)
    expect(interpolateGridHeight(heights, 1, 0, 0, CHUNK_SIZE, 0)).toBe(10)
    expect(interpolateGridHeight(heights, 1, 0, 0, 0, CHUNK_SIZE)).toBe(30)
    expect(interpolateGridHeight(heights, 1, 0, 0, CHUNK_SIZE, CHUNK_SIZE)).toBe(20)
    // Center sits on the b-d diagonal; triangle sample is 20, bilinear would be 15.
    const mid = interpolateGridHeight(
      heights,
      1,
      0,
      0,
      CHUNK_SIZE / 2,
      CHUNK_SIZE / 2,
    )
    expect(mid).toBeCloseTo(20)
  })
})

describe('TerrainSystem streaming LOD', () => {
  afterEach(() => {
    setContactHeightSampler(null)
  })

  it('promotes a far tile to near detail after flying onto it', () => {
    const terrain = new TerrainSystem(new Scene())
    for (let i = 0; i < 1000 && !terrain.chunkStats(0, 12); i++) pump(terrain, 210, 210, 1)
    const far = terrain.chunkStats(0, 12)
    expect(far).not.toBeNull()
    expect(far!.lod).toBe(2)
    expect(far!.segs).toBeLessThan(segsForLod(0))

    pump(terrain, 210, 12 * CHUNK_SIZE + 210, 80)
    const near = terrain.chunkStats(0, 12)
    expect(near).not.toBeNull()
    expect(near!.lod).toBe(0)
    expect(near!.segs).toBe(segsForLod(0))
    expect(near!.vertices).toBeGreaterThan(far!.vertices)
  }, 20_000)

  it('demotes the same tile after flying away', () => {
    const terrain = new TerrainSystem(new Scene())
    for (let i = 0; i < 1000 && !terrain.chunkStats(0, 12); i++) pump(terrain, 210, 210, 1)
    pump(terrain, 210, 12 * CHUNK_SIZE + 210, 80)
    expect(terrain.chunkStats(0, 12)?.lod).toBe(0)
    pump(terrain, 210, 210, 80)
    expect(terrain.chunkStats(0, 12)?.lod).toBe(2)
  }, 20_000)
})

describe('visible mesh contact sampling', () => {
  afterEach(() => {
    setContactHeightSampler(null)
  })

  it('matches the rendered vertex at a chunk corner', () => {
    const terrain = new TerrainSystem(new Scene())
    pump(terrain, 210, 210, 40)
    expect(terrain.chunkStats(0, 0)).not.toBeNull()
    const x = 0
    const z = 0
    expect(sampleGroundHeight(x, z)).toBe(Math.fround(sampleTerrainHeight(x, z)))
  })

  it('uses triangle interpolation instead of the continuous function off-vertex', () => {
    const terrain = new TerrainSystem(new Scene())
    pump(terrain, 210, 210, 40)
    const stats = terrain.chunkStats(0, 0)
    expect(stats).not.toBeNull()
    const x = CHUNK_SIZE / stats!.segs / 2
    const z = CHUNK_SIZE / stats!.segs / 2
    const meshH = terrain.sampleMeshHeight(x, z)
    expect(meshH).not.toBeNull()
    expect(sampleGroundHeight(x, z)).toBeCloseTo(meshH!, 5)
  })

  it('matches heights and lighting normals across neighbouring near tiles', () => {
    const terrain = new TerrainSystem(new Scene())
    pump(terrain, 210, 210, 12)
    const left = terrain.root.getObjectByName('chunk_0_0')!.getObjectByName('TerrainChunk') as Mesh
    const right = terrain.root.getObjectByName('chunk_1_0')!.getObjectByName('TerrainChunk') as Mesh
    const segs = terrain.chunkStats(0, 0)!.segs
    for (let z = 0; z <= segs; z++) {
      const a = z * (segs + 1) + segs
      const b = z * (segs + 1)
      expect(left.geometry.attributes.position!.getY(a))
        .toBeCloseTo(right.geometry.attributes.position!.getY(b), 5)
      for (const axis of [0, 1, 2]) {
        expect(left.geometry.attributes.normal!.getComponent(a, axis))
          .toBeCloseTo(right.geometry.attributes.normal!.getComponent(b, axis), 5)
      }
    }
    terrain.clearAll()
  })

  it('keeps the temporary vegetation hold free of tree and rock groups', () => {
    const terrain = new TerrainSystem(new Scene())
    pump(terrain, 210, 210, 24)
    expect(terrain.root.getObjectByName('TerrainProps')).toBeUndefined()
    terrain.clearAll()
  })
})
