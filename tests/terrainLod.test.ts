import { InstancedMesh, Mesh, MeshStandardMaterial, Scene } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flightConfig } from '../src/aircraft/flightConfig'
import { planTerrainTiles } from '../src/world/TerrainLayout'
import {
  sampleGroundHeight,
  sampleGroundSurfaceInto,
  setContactHeightSampler,
  setGroundHeightSampler,
  setGroundSurfaceSampler,
} from '../src/world/ground'
import {
  CHUNK_SIZE,
  buildTerrainSkirtGeometry,
  interpolateGridHeight,
  lodFromDist,
  lodWithHysteresis,
  pondIntersectsBounds,
  segsForLod,
  TerrainSystem,
  terrainSnowCoverage,
  VIEW_RADIUS,
  waterSegsForLod,
} from '../src/world/TerrainSystem'
import { waterLandmarks } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'
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

  it('detects ponds that fall between coarse far-tile vertices', () => {
    setWorldSeed(1)
    const pond = waterLandmarks(-2, -2).find(basin => basin.pond)
    expect(pond).toBeDefined()
    const originX = Math.floor(pond!.x / CHUNK_SIZE) * CHUNK_SIZE
    const originZ = Math.floor(pond!.z / CHUNK_SIZE) * CHUNK_SIZE
    expect(pondIntersectsBounds(originX, originZ, CHUNK_SIZE)).toBe(true)
    expect(pondIntersectsBounds(originX + CHUNK_SIZE * 8, originZ + CHUNK_SIZE * 8, CHUNK_SIZE)).toBe(false)
  })

  it('keeps nearby water detailed and distant water bounded', () => {
    expect(waterSegsForLod(0, CHUNK_SIZE)).toBe(56)
    expect(waterSegsForLod(1, CHUNK_SIZE * 2)).toBe(40)
    expect(waterSegsForLod(2, CHUNK_SIZE * 3)).toBe(21)
    expect(waterSegsForLod(2, CHUNK_SIZE * 3)).toBeLessThan(waterSegsForLod(1, CHUNK_SIZE * 2))
  })

  it('accumulates snow on flat lowlands and leaves steep faces exposed', () => {
    expect(terrainSnowCoverage(1, 0, 1)).toBeCloseTo(.32)
    expect(terrainSnowCoverage(.66, 0, 1)).toBeCloseTo(.2112)
    expect(terrainSnowCoverage(1, 3200, 1)).toBeCloseTo(.8)
    expect(terrainSnowCoverage(1, 3200, .2)).toBe(0)
  })

  it('covers dry LOD edges without building walls through water', () => {
    const heights = new Float32Array(9).fill(100)
    const colors = new Float32Array(27).fill(.4)
    const dry = buildTerrainSkirtGeometry(heights, new Float32Array(9), colors, 2, CHUNK_SIZE)
    expect(dry).not.toBeNull()
    expect(dry!.getAttribute('position').count).toBe(48)
    expect(Math.min(...(dry!.getAttribute('position').array as Float32Array))).toBeLessThan(100)
    dry!.dispose()
    const wetLevels = new Float32Array(9).fill(120)
    expect(buildTerrainSkirtGeometry(heights, wetLevels, colors, 2, CHUNK_SIZE)).toBeNull()
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

  it('retires fallback coverage after sustained maximum-speed flight', () => {
    // Exercise the deterministic build-cost budget independently of test-host
    // wall-clock speed. The browser benchmark covers the real 2 ms deadline.
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const terrain = new TerrainSystem(new Scene())
    let x = 210
    try {
      pump(terrain, x, 210, 400)
      let peakTiles = terrain.root.children.length
      for (let frame = 0; frame < 600; frame++) {
        x += flightConfig.maxSpeedBoost / 60
        terrain.update(x, 210, 1 / 60)
        peakTiles = Math.max(peakTiles, terrain.root.children.length)
      }
      expect(peakTiles).toBeLessThan(750)
      pump(terrain, x, 210, 400)
      const expected = planTerrainTiles(Math.floor(x / CHUNK_SIZE) + .5, .5, VIEW_RADIUS)
      expect(terrain.root.children.length).toBe(expected.length)
      expect(terrain.chunkStats(Math.floor(x / CHUNK_SIZE), 0)?.lod).toBe(0)
    } finally {
      terrain.clearAll()
      clock.mockRestore()
    }
  }, 20_000)

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
    // Streaming has a wall-clock budget; a busy test host can need more frames.
    for (let i = 0; i < 1000 && terrain.chunkStats(0, 12)?.lod !== 2; i++) pump(terrain, 210, 210, 1)
    expect(terrain.chunkStats(0, 12)?.lod).toBe(2)
  }, 20_000)

  it('updates rain and snow response without rebuilding the terrain stream', () => {
    const terrain = new TerrainSystem(new Scene())
    try {
      terrain.setWeatherEffects(1.4, -.2)
      expect(terrain.weatherEffects).toEqual({ rain: 1, snow: 0 })
      terrain.setWeatherEffects(.2, .8)
      expect(terrain.weatherEffects).toEqual({ rain: .2, snow: .8 })
    } finally {
      terrain.clearAll()
    }
  })

  it('injects weather shading after the normal is initialized', () => {
    const terrain = new TerrainSystem(new Scene())
    try {
      const material = (terrain as unknown as { groundMatNear: MeshStandardMaterial }).groundMatNear
      const shader = {
        uniforms: {},
        vertexShader: '#include <common>\n#include <begin_vertex>',
        fragmentShader: '#include <common>\n#include <color_fragment>\n#include <normal_fragment_begin>\n#include <normal_fragment_maps>',
      }
      material.onBeforeCompile(shader as never, undefined as never)
      const normalChunk = shader.fragmentShader.indexOf('#include <normal_fragment_maps>')
      expect(shader.fragmentShader.indexOf('float slopeExposure')).toBeGreaterThan(normalChunk)
      expect(shader.fragmentShader).toContain('uniform float terrainRain')
      expect(shader.fragmentShader).toContain('uniform float terrainClouds')
      expect(shader.fragmentShader).toContain('float cloudShadow')
      expect(shader.fragmentShader).toContain('float wetLowland')
    } finally {
      terrain.clearAll()
    }
  })
})

describe('visible mesh contact sampling', () => {
  afterEach(() => {
    setContactHeightSampler(null)
  })

  it('uses the dedicated height path without asking for contact metadata', () => {
    let contactCalls = 0
    let heightCalls = 0
    setContactHeightSampler(() => {
      contactCalls++
      return { height: 12, kind: 'land', biome: 'plains' }
    })
    setGroundHeightSampler(() => {
      heightCalls++
      return 42
    })

    expect(sampleGroundHeight(8, -3)).toBe(42)
    expect(heightCalls).toBe(1)
    expect(contactCalls).toBe(0)
  })

  it('fills contact height and kind through one caller-owned record', () => {
    let calls = 0
    setGroundSurfaceSampler((_x, _z, out) => {
      calls++
      out.height = 24
      out.kind = 'water'
      return true
    })
    const out = { height: 0, kind: 'land' as const }
    expect(sampleGroundSurfaceInto(8, -3, out)).toBe(out)
    expect(out).toEqual({ height: 24, kind: 'water' })
    expect(calls).toBe(1)
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

  it('streams a bounded near-field vegetation kit', () => {
    const terrain = new TerrainSystem(new Scene())
    pump(terrain, 210, 210, 24)
    const props = terrain.root.getObjectByName('TerrainProps')
    expect(props).toBeDefined()
    const instances: InstancedMesh[] = []
    props!.traverse(object => { if (object instanceof InstancedMesh) instances.push(object) })
    expect(instances.length).toBeLessThanOrEqual(20)
    const scaledInstances: InstancedMesh[] = []
    terrain.root.traverse(object => { if (object instanceof InstancedMesh) scaledInstances.push(object) })
    expect(scaledInstances.length).toBeGreaterThan(0)
    const chunks = (terrain as unknown as {
      chunks: Map<string, { hasProps: boolean; props: object | null; propMeshes: object[] }>
    }).chunks
    const propChunk = [...chunks.values()].find(chunk => chunk.hasProps)
    expect(propChunk?.props).not.toBeNull()
    const cachedMeshes = propChunk?.propMeshes.length ?? -1
    let traversedMeshes = 0
    ;(propChunk?.props as { traverse?: (visit: (object: object) => void) => void } | null)?.traverse?.(object => {
      if (object instanceof InstancedMesh) traversedMeshes++
    })
    expect(cachedMeshes).toBe(traversedMeshes)
    terrain.setVegetationScale(0)
    for (const instance of scaledInstances) expect(instance.visible).toBe(false)
    terrain.setVegetationScale(1)
    expect(scaledInstances.some(instance => instance.visible && instance.count > 0)).toBe(true)
    terrain.clearAll()
  })
})
