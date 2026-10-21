import { BackSide, DoubleSide, FrontSide, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateTerrainGeometry, type TerrainGeometryData, type TerrainGeometrySteps } from '../src/world/TerrainGeometry'
import { TERRAIN_ROOT_SIZE, tileKey } from '../src/world/TerrainLayout'
import { CHUNK_SIZE, TerrainSystem } from '../src/world/TerrainSystem'
import type { TerrainBuildRequest, TerrainBuildReply } from '../src/world/TerrainWorkerPool'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<TerrainBuildReply>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  posted: TerrainBuildRequest[] = []
  terminated = false
  constructor() { FakeWorker.instances.push(this) }
  postMessage(job: TerrainBuildRequest): void { this.posted.push(job) }
  terminate(): void { this.terminated = true }
  finish(data: TerrainGeometryData): void {
    const job = this.posted[this.posted.length - 1]!
    this.onmessage?.({ data: { id: job.id, generation: job.generation, data } } as MessageEvent<TerrainBuildReply>)
  }
}
interface Tile { cx: number; cz: number; size: number; dist: number }
interface Chunk { root: Group; fadeAge: number; alpha: number; targetAlpha: number; fadingOut: boolean; settled: boolean }
interface Internals {
  desiredTiles: Map<string, Tile>
  desiredTileBuckets: Map<string, Tile[]>
  chunks: Map<string, Chunk>
  sampledChunk: unknown
  retiring: Array<{ key: string; root: Group }>
  pending: (Tile & { rebuild: boolean })[]
  pendingKeys: Set<string>
  replacementKeys: Map<string, string[]>
  sampledChunkLookup: Map<string, unknown>
  groundMatFar: MeshStandardMaterial
  groundMatNear: MeshStandardMaterial
  waterMat: MeshStandardMaterial
  ready: { job: TerrainBuildRequest; data: TerrainGeometryData }[]
  fallback: { job: TerrainBuildRequest; key: string; steps: TerrainGeometrySteps } | null
  focusX: number
  focusZ: number
  scheduleAround(cx: number, cz: number): void
  dispatchWorkers(): void
  drainBuildQueue(): void
  install(job: TerrainBuildRequest, data: TerrainGeometryData): void
  updateFades(cx: number, cz: number, dt: number): void
  prepareChunkForFade(chunk: Chunk): void
  applyChunkAlpha(chunk: Chunk): void
}
let terrain: TerrainSystem
let internal: Internals
let fixture: TerrainGeometryData
const key = (cx: number, size = 1): string => tileKey(cx, 0, size)
function job(cx: number, lod: 0 | 1 | 2 = 1, size = 1): TerrainBuildRequest {
  return { id: cx + 100, generation: 0, seed: 1, pad: null, cx, cz: 0, size, lod,
    skirtEdges: [false, false, false, false] }
}
function desire(cx: number, dist: number, size = 1): void {
  internal.desiredTiles.set(key(cx, size), { cx, cz: 0, size, dist })
}
function queue(cx: number, dist: number): void {
  desire(cx, dist)
  internal.pending.push({ cx, cz: 0, size: 1, dist, rebuild: false })
  internal.pendingKeys.add(key(cx))
}
function material(chunk: Chunk): MeshStandardMaterial {
  return (chunk.root.children.find(child => child.name === 'TerrainChunk') as Mesh).material as MeshStandardMaterial
}

beforeEach(() => {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('navigator', { hardwareConcurrency: 4 })
  setWorldSeed(1)
  clearOpsPad()
  terrain = new TerrainSystem(new Scene())
  internal = terrain as unknown as Internals
  fixture = generateTerrainGeometry(0, 0, 2)
})
afterEach(() => {
  terrain.dispose()
  clearOpsPad()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('terrain streaming integration', () => {
  it('pins exact fade shader variants across warmups and releases them on terrain teardown', async () => {
    const scene = new Scene(), camera = new PerspectiveCamera()
    const live = [internal.groundMatNear, internal.groundMatFar, internal.waterMat]
    const liveDisposals = live.map(m => vi.spyOn(m, 'dispose'))
    let privateDisposals: ReturnType<typeof vi.spyOn>[] = []
    let geometryDisposal: ReturnType<typeof vi.spyOn> | undefined
    const compileAsync = vi.fn(async (fixtures: Group) => {
      const meshes: Mesh[] = []
      fixtures.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
      expect(meshes).toHaveLength(6)
      expect(meshes.slice(0, 3).map(m => m.material)).toEqual(live)
      const fades = meshes.slice(3)
      expect(fades.map(m => m.receiveShadow)).toEqual([true, true, false])
      expect(fades.map(m => (m.material as MeshStandardMaterial).side)).toEqual([FrontSide, BackSide, FrontSide])
      for (const mesh of fades) {
        const material = mesh.material as MeshStandardMaterial
        expect(material.transparent).toBe(true)
        expect(material.depthWrite).toBe(false)
        expect(material.alphaHash).toBe(false)
        expect(material.opacity).toBe(.5)
        expect(material.customProgramCacheKey()).toBe(internal.groundMatNear.customProgramCacheKey())
        privateDisposals.push(vi.spyOn(material, 'dispose'))
      }
      geometryDisposal = vi.spyOn(meshes[0]!.geometry, 'dispose')
      return fixtures
    })
    const renderer = { compileAsync, render: vi.fn(), getContext: () => ({ isContextLost: () => true }) as unknown as WebGL2RenderingContext }
    await terrain.warmupMaterials(renderer, camera, scene)
    expect(compileAsync).toHaveBeenCalledOnce()
    expect(privateDisposals).toHaveLength(3)
    for (const dispose of privateDisposals) expect(dispose).not.toHaveBeenCalled()
    for (const dispose of liveDisposals) expect(dispose).not.toHaveBeenCalled()
    expect(geometryDisposal).toHaveBeenCalledOnce()
    expect(scene.children).toHaveLength(0)
    const pinned = (terrain as unknown as { warmupFadeMaterials: MeshStandardMaterial[] }).warmupFadeMaterials.slice()
    await terrain.warmupMaterials(renderer, camera, scene)
    expect((terrain as unknown as { warmupFadeMaterials: MeshStandardMaterial[] }).warmupFadeMaterials).toEqual(pinned)
    terrain.dispose()
    for (const dispose of privateDisposals) expect(dispose).toHaveBeenCalledOnce()
  })

  it('advances worker recovery only by the bounded active terrain delta', () => {
    const workers = (terrain as unknown as { workers: { advance(dt: number): void } }).workers
    const advance = vi.spyOn(workers, 'advance')
    terrain.update(0, 0, 0)
    terrain.update(0, 0, Number.NaN)
    terrain.update(0, 0, .05)
    terrain.update(0, 0, 300)
    expect(advance.mock.calls.map(([dt]) => dt)).toEqual([0, 0, .05, .1])
  })

  it('indexes desired leaves by aligned quadtree roots', () => {
    terrain.update(0, 0, 0)

    let indexed = 0
    for (const bucket of internal.desiredTileBuckets.values()) indexed += bucket.length
    expect(indexed).toBe(internal.desiredTiles.size)
    for (const tile of internal.desiredTiles.values()) {
      const rootCx = Math.floor(tile.cx / TERRAIN_ROOT_SIZE) * TERRAIN_ROOT_SIZE
      const rootCz = Math.floor(tile.cz / TERRAIN_ROOT_SIZE) * TERRAIN_ROOT_SIZE
      expect(internal.desiredTileBuckets.get(tileKey(rootCx, rootCz, TERRAIN_ROOT_SIZE))).toContain(tile)
    }
  })

  it('fills caller-owned streaming telemetry without allocating a snapshot', () => {
    const stats = { loaded: -1, pending: -1, inFlight: -1, ready: -1, workers: -1 }
    expect(terrain.streamingStatsInto(stats)).toBe(stats)
    expect(stats).toEqual(terrain.streamingStats)
  })

  it('retains placed tile matrices without forced recomputation and honors explicit parent moves', () => {
    const scene = terrain.root.parent as Scene
    scene.matrixAutoUpdate = false
    desire(5, 5); internal.install(job(5), fixture)
    scene.updateMatrixWorld()
    const mesh = internal.chunks.get(key(5))!.root.children[0] as Mesh
    const placed = mesh.matrixWorld.clone()
    const multiply = vi.spyOn(mesh.matrixWorld, 'multiplyMatrices')
    scene.updateMatrixWorld()
    expect(multiply).not.toHaveBeenCalled()
    expect(mesh.matrixWorld.equals(placed)).toBe(true)
    terrain.root.position.x = 100; terrain.root.updateMatrix()
    scene.updateMatrixWorld()
    expect(multiply).toHaveBeenCalledOnce()
    expect(mesh.matrixWorld.elements[12]).toBe(placed.elements[12]! + 100)
    desire(6, 5); internal.install(job(6), fixture)
    scene.updateMatrixWorld()
    const arriving = internal.chunks.get(key(6))!.root.children[0] as Mesh
    expect(arriving.matrixWorld.elements[12]).toBe(6 * CHUNK_SIZE + CHUNK_SIZE / 2 + 100)
  })

  it('uploads closer completed chunks first even when the farther worker finishes first', () => {
    queue(5, 5)
    queue(9, 9)
    internal.dispatchWorkers()
    expect(FakeWorker.instances[0]!.posted[0]!.cx).toBe(5)
    expect(FakeWorker.instances[1]!.posted[0]!.cx).toBe(9)
    FakeWorker.instances[1]!.finish(fixture)
    FakeWorker.instances[0]!.finish(fixture)
    expect(terrain.streamingStats.ready).toBe(2)
    // The upload deadline expires after the first attachment.
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(3)
    internal.drainBuildQueue()
    expect(internal.chunks.has(key(5))).toBe(true)
    expect(internal.chunks.has(key(9))).toBe(false)
    expect(terrain.streamingStats.ready).toBe(1)
  })

  it('drains every ready result without changing nearest-first upload order', () => {
    desire(4, 4)
    desire(6, 6)
    desire(8, 8)
    internal.ready.push(
      { job: job(8), data: fixture },
      { job: job(4), data: fixture },
      { job: job(6), data: fixture },
    )
    vi.spyOn(performance, 'now').mockReturnValue(0)
    internal.drainBuildQueue()
    expect(internal.chunks.has(key(4))).toBe(true)
    expect(internal.chunks.has(key(6))).toBe(true)
    expect(internal.chunks.has(key(8))).toBe(true)
    expect(terrain.streamingStats.ready).toBe(0)
  })

  it('starts new chunks invisible and fades ground from zero to one over 0.65 seconds', () => {
    desire(5, 5)
    internal.install(job(5), fixture)
    const chunk = internal.chunks.get(key(5))!
    expect(chunk.root.visible).toBe(false)
    expect(material(chunk).opacity).toBe(0)
    expect(material(chunk).transparent).toBe(true)
    expect(material(chunk).alphaHash).toBe(false)
    expect(material(chunk).depthWrite).toBe(false)
    internal.updateFades(0, 0, .325)
    expect(chunk.root.visible).toBe(true)
    expect(material(chunk).opacity).toBeCloseTo(.5)
    internal.updateFades(0, 0, .325)
    expect(material(chunk).opacity).toBe(1)
    expect(chunk.settled).toBe(true)
    expect(material(chunk)).toBe(internal.groundMatFar)
  })

  it('retains ordered back/front near-terrain fades and one opaque pass through replacement', () => {
    desire(5, 2)
    internal.install(job(5, 0), fixture)
    const old = internal.chunks.get(key(5))!
    const front = old.root.getObjectByName('TerrainChunk') as Mesh
    const back = old.root.getObjectByName('TerrainBackfaces') as Mesh
    expect(back.id).toBeLessThan(front.id)
    expect(back.geometry).toBe(front.geometry)
    expect((front.material as MeshStandardMaterial).side).toBe(FrontSide)
    expect((back.material as MeshStandardMaterial).side).toBe(BackSide)
    internal.updateFades(0, 0, .325)
    expect((front.material as MeshStandardMaterial).opacity).toBeCloseTo(.5)
    expect((back.material as MeshStandardMaterial).opacity).toBeCloseTo(.5)
    internal.updateFades(0, 0, .325)
    expect(back.visible).toBe(false)
    expect(front.material).toBe(internal.groundMatNear)
    expect(internal.groundMatNear.side).toBe(DoubleSide)
    internal.prepareChunkForFade(old)
    expect(back.visible).toBe(true)
    const privateBack = back.material as MeshStandardMaterial, disposed = vi.spyOn(privateBack, 'dispose')
    desire(5, 12)
    internal.install(job(5, 2), fixture)
    expect(back.visible).toBe(false)
    expect(disposed).toHaveBeenCalledOnce()
    expect((front.material as MeshStandardMaterial).side).toBe(DoubleSide)
    expect((front.material as MeshStandardMaterial).transparent).toBe(false)
    internal.prepareChunkForFade(old)
    expect(back.visible).toBe(true)
    expect((front.material as MeshStandardMaterial).side).toBe(FrontSide)
    expect((back.material as MeshStandardMaterial).side).toBe(BackSide)
    expect((back.material as MeshStandardMaterial).onBeforeCompile)
      .toBe((front.material as MeshStandardMaterial).onBeforeCompile)
    const geometryDisposed = vi.spyOn(front.geometry, 'dispose')
    terrain.clearAll()
    expect(geometryDisposed).toHaveBeenCalledOnce()
  })

  it('shares entering water and isolates fallback bias without changing sibling offsets', () => {
    desire(5, 12); desire(6, 12)
    internal.install(job(5, 2), { ...fixture, water: fixture.ground })
    internal.install(job(6, 2), { ...fixture, water: fixture.ground })
    const old = internal.chunks.get(key(5))!, sibling = internal.chunks.get(key(6))!
    const water = (chunk: Chunk) => (chunk.root.children.find(c => c.name === 'WaterSurface') as Mesh)
      .material as MeshStandardMaterial
    expect(water(old)).toBe(internal.waterMat)
    expect(water(sibling)).toBe(internal.waterMat)
    // Replace while the old tile is still entering, before it has settled.
    desire(5, 4)
    internal.install(job(5, 1), { ...fixture, water: fixture.ground })
    const replacement = internal.chunks.get(key(5))!
    const privateWater = water(old), dispose = vi.spyOn(privateWater, 'dispose')
    expect(privateWater).not.toBe(internal.waterMat)
    expect(privateWater.polygonOffsetFactor).toBe(0)
    expect(privateWater.onBeforeCompile).toBe(internal.waterMat.onBeforeCompile)
    expect(water(sibling)).toBe(internal.waterMat)
    expect(water(replacement)).toBe(internal.waterMat)
    expect(internal.waterMat.polygonOffsetFactor).toBe(-2)
    internal.updateFades(0, 0, .65)
    expect(dispose).toHaveBeenCalledOnce()
    expect(water(replacement)).toBe(internal.waterMat)
    terrain.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('keeps old LOD coverage until the replacement finishes its fade', () => {
    desire(5, 12)
    internal.install(job(5, 2), fixture)
    internal.updateFades(0, 0, .65)
    const old = internal.chunks.get(key(5))!
    expect(old.settled).toBe(true)
    const geometry = (old.root.children[0] as Mesh).geometry
    const disposed = vi.spyOn(geometry, 'dispose')
    desire(5, 4)
    internal.install(job(5, 1), fixture)
    expect(terrain.root.children).toHaveLength(2)
    expect(material(old)).not.toBe(internal.groundMatFar)
    expect(material(old).transparent).toBe(false)
    expect(material(old).depthWrite).toBe(true)
    expect(material(old).opacity).toBe(1)
    internal.updateFades(0, 0, .3)
    expect(old.root.parent).toBe(terrain.root)
    expect(disposed).not.toHaveBeenCalled()
    internal.updateFades(0, 0, .36)
    expect(old.root.parent).toBeNull()
    expect(disposed).toHaveBeenCalledOnce()
    expect(terrain.root.children).toHaveLength(1)
  })

  it('preserves terrain and water shaders on opaque fallback coverage', () => {
    desire(5, 12)
    internal.install(job(5, 2), { ...fixture, water: fixture.ground })
    internal.updateFades(0, 0, .65)
    const old = internal.chunks.get(key(5))!
    desire(5, 4)
    internal.install(job(5, 1), fixture)
    const meshes = old.root.children as Mesh[]
    for (const mesh of meshes) {
      const source = mesh.name === 'WaterSurface' ? internal.waterMat : internal.groundMatFar
      const fallback = mesh.material as MeshStandardMaterial
      expect(fallback).not.toBe(source)
      expect(fallback.onBeforeCompile).toBe(source.onBeforeCompile)
      expect(fallback.customProgramCacheKey()).toBe(source.customProgramCacheKey())
      expect(fallback.transparent).toBe(false)
      expect(fallback.depthWrite).toBe(true)
      expect(fallback.opacity).toBe(1)
      expect(fallback.polygonOffset).toBe(true)
      expect(fallback.polygonOffsetFactor).toBe(mesh.name === 'WaterSurface' ? 0 : 2)
      expect(source.polygonOffset).toBe(mesh.name === 'WaterSurface')
      expect(source.polygonOffsetFactor).toBe(mesh.name === 'WaterSurface' ? -2 : 0)
    }
    internal.updateFades(0, 0, .3)
    expect(material(old).opacity).toBe(1)
  })

  it('keeps water opaque and depth-writing through entry, LOD replacement, and resumed fading', () => {
    const waterMaterial = (chunk: Chunk) => (chunk.root.children.find(child => child.name === 'WaterSurface') as Mesh)
      .material as MeshStandardMaterial
    const expectStableWater = (chunk: Chunk) => {
      const water = waterMaterial(chunk)
      expect(water.transparent).toBe(false)
      expect(water.depthWrite).toBe(true)
      expect(water.opacity).toBe(1)
      expect(water.alphaHash).toBe(false)
      expect(water.customProgramCacheKey()).toBe(internal.waterMat.customProgramCacheKey())
    }
    desire(5, 12)
    internal.install(job(5, 2), { ...fixture, water: fixture.ground })
    const old = internal.chunks.get(key(5))!
    expectStableWater(old)
    internal.updateFades(0, 0, .325)
    expect(material(old).opacity).toBeCloseTo(.5)
    expectStableWater(old)
    internal.updateFades(0, 0, .325)
    expect(waterMaterial(old)).toBe(internal.waterMat)

    // Rehydrate a settled tile, including the path for restored fallback coverage.
    internal.prepareChunkForFade(old)
    old.alpha = .4
    internal.applyChunkAlpha(old)
    expectStableWater(old)
    desire(5, 4)
    internal.install(job(5, 1), { ...fixture, water: fixture.ground })
    const replacement = internal.chunks.get(key(5))!
    internal.updateFades(0, 0, .325)
    expectStableWater(old)
    expectStableWater(replacement)
    expect(waterMaterial(old).polygonOffsetFactor).toBe(0)
    expect(waterMaterial(replacement).polygonOffsetFactor).toBe(-2)
    internal.prepareChunkForFade(old)
    expect(waterMaterial(old).polygonOffsetFactor).toBe(-2)
    expectStableWater(old)
    internal.updateFades(0, 0, .325)
    expect(old.root.parent).toBeNull()
    expect(waterMaterial(replacement)).toBe(internal.waterMat)
    expectStableWater(replacement)
  })

  it('drains disposable retiring tiles beside a still-fading replacement', () => {
    for (const cx of [20, 21, 22]) {
      desire(cx, 12)
      internal.install(job(cx, 2), fixture)
    }
    internal.updateFades(0, 0, .65)
    for (const cx of [20, 21, 22]) {
      desire(cx, 4)
      internal.install(job(cx, 1), fixture)
    }

    // Leave the first replacement waiting while the other two are ready to
    // retire. A swap-pop teardown must revisit the swapped-in entry instead
    // of skipping it until a later frame.
    internal.chunks.get(key(20))!.fadeAge = 0
    internal.chunks.get(key(21))!.fadeAge = .65
    internal.chunks.get(key(22))!.fadeAge = .65
    expect(internal.retiring).toHaveLength(3)
    internal.updateFades(0, 0, 0)

    expect(internal.retiring).toHaveLength(1)
    expect(internal.retiring[0]!.key).toBe(key(20))
    expect(internal.chunks.has(key(21))).toBe(true)
    expect(internal.chunks.has(key(22))).toBe(true)
  })

  it('retires covered outer-ring fallback even when its replacement stays below full opacity', () => {
    desire(77, 77, 2)
    internal.install(job(77, 2, 2), fixture)
    internal.updateFades(0, 0, .65)
    const old = internal.chunks.get(key(77, 2))!
    internal.desiredTiles.delete(key(77, 2))
    desire(77, 77)
    internal.install(job(77, 2), fixture)
    old.fadingOut = true
    internal.replacementKeys.set(key(77, 2), [key(77)])
    internal.updateFades(0, 0, .65)
    const replacement = internal.chunks.get(key(77))!
    expect(replacement.targetAlpha).toBeGreaterThan(0)
    expect(replacement.targetAlpha).toBeLessThan(1)
    internal.updateFades(0, 0, .01)
    expect(internal.chunks.has(key(77, 2))).toBe(false)
    expect(old.root.parent).toBeNull()
    expect(internal.chunks.has(key(77))).toBe(true)
  })

  it('ignores old world replies after clearing and reseeding', () => {
    queue(5, 5)
    internal.dispatchWorkers()
    setWorldSeed(2)
    terrain.clearAll()
    FakeWorker.instances[0]!.finish(fixture)
    internal.drainBuildQueue()
    expect(terrain.streamingStats.loaded).toBe(0)
    expect(terrain.streamingStats.ready).toBe(0)
    expect(terrain.root.children).toHaveLength(0)
  })

  it('caches coarse tile ownership across contact probes and clears it on replacement', () => {
    const coarse = generateTerrainGeometry(0, 0, 2, 2)
    desire(0, 12, 2)
    internal.install(job(0, 2, 2), coarse)
    expect(terrain.sampleMeshHeight(CHUNK_SIZE * 1.2, CHUNK_SIZE * 1.2)).not.toBeNull()
    expect(internal.sampledChunkLookup.size).toBe(1)
    expect(terrain.sampleMeshHeight(CHUNK_SIZE * 1.25, CHUNK_SIZE * 1.25)).not.toBeNull()
    expect(internal.sampledChunkLookup.size).toBe(1)
    internal.desiredTiles.delete(key(0, 2))
    desire(0, 4, 2)
    internal.install(job(0, 1, 2), coarse)
    expect(internal.sampledChunkLookup.size).toBe(0)
  })

  it('chooses the finest aligned resident tile during overlapping LOD coverage', () => {
    const coarse = generateTerrainGeometry(0, 0, 2, 4)
    const fine = generateTerrainGeometry(CHUNK_SIZE, 0, 1)
    desire(0, 30, 4)
    internal.install(job(0, 2, 4), coarse)
    desire(1, 4)
    internal.install(job(1, 1), fine)

    expect(terrain.sampleMeshHeight(CHUNK_SIZE * 1.2, CHUNK_SIZE * .2)).not.toBeNull()
    expect(internal.sampledChunk).toBe(internal.chunks.get(key(1)))
  })

  it('clears every cached cell when an unloaded chunk is disposed', () => {
    const coarse = generateTerrainGeometry(0, 0, 2, 1)
    desire(0, 4)
    desire(2, 4)
    internal.install(job(0, 1), coarse)
    internal.install(job(2, 1), coarse)
    internal.updateFades(0, 0, .65)

    const chunkAHeight = terrain.sampleMeshHeight(CHUNK_SIZE * .2, CHUNK_SIZE * .2)
    const chunkBHeight = terrain.sampleMeshHeight(CHUNK_SIZE * 2.2, CHUNK_SIZE * .2)
    expect(chunkAHeight).not.toBeNull()
    expect(chunkBHeight).not.toBeNull()
    expect(internal.sampledChunkLookup.size).toBe(2)

    internal.desiredTiles.delete(key(0))
    const removed = internal.chunks.get(key(0))!
    removed.fadingOut = true
    removed.targetAlpha = 0
    internal.updateFades(0, 0, .65)
    internal.updateFades(0, 0, .65)

    expect(internal.chunks.has(key(0))).toBe(false)
    expect(internal.sampledChunkLookup.size).toBe(0)
    expect(terrain.sampleMeshHeight(CHUNK_SIZE * .2, CHUNK_SIZE * .2)).toBeNull()
    expect(terrain.sampleMeshHeight(CHUNK_SIZE * 2.2, CHUNK_SIZE * .2)).not.toBeNull()
  })

  it('retries failed worker jobs through synchronous fallback', () => {
    queue(5, 5)
    internal.dispatchWorkers()
    FakeWorker.instances[0]!.onerror?.()
    expect(terrain.streamingStats.workers).toBe(0)
    expect(terrain.streamingStats.pending).toBe(1)
    vi.spyOn(performance, 'now').mockReturnValue(0)
    internal.drainBuildQueue()
    expect(internal.chunks.has(key(5))).toBe(true)
    expect(terrain.streamingStats.pending).toBe(0)
  })

  it('does not duplicate a tile already requeued after synchronous post failure', () => {
    queue(5, 5)
    vi.spyOn(FakeWorker.instances[0]!, 'postMessage').mockImplementation(() => {
      throw new Error('worker closed before dispatch')
    })

    internal.dispatchWorkers()

    expect(terrain.streamingStats.workers).toBe(0)
    expect(terrain.streamingStats.pending).toBe(1)
    vi.spyOn(performance, 'now').mockReturnValue(0)
    internal.drainBuildQueue()
    expect(internal.chunks.has(key(5))).toBe(true)
    expect(terrain.streamingStats.pending).toBe(0)
  })

  it('suspends a fallback tile at the frame deadline and installs only completed geometry', () => {
    queue(0, 0)
    internal.dispatchWorkers()
    FakeWorker.instances[0]!.onerror?.()
    const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(3)
    internal.drainBuildQueue()
    expect(terrain.streamingStats).toMatchObject({ loaded: 0, pending: 0, inFlight: 1, workers: 0 })
    expect(internal.fallback).not.toBeNull()
    const steps = internal.fallback!.steps
    const advance = vi.spyOn(steps, 'next')
    clock.mockReturnValueOnce(0).mockReturnValue(3)
    internal.drainBuildQueue()
    expect(advance).toHaveBeenCalledOnce()
    expect(terrain.streamingStats.loaded).toBe(0)
    clock.mockReturnValue(0)
    for (let frame = 0; frame < 20 && !internal.chunks.has(key(0)); frame++) internal.drainBuildQueue()
    expect(internal.chunks.has(key(0))).toBe(true)
    expect(terrain.streamingStats.inFlight).toBe(0)
    expect(internal.fallback).toBeNull()
  })

  it.each(['clear', 'dispose', 'unwanted', 'seed'] as const)('cancels suspended fallback on %s', reason => {
    queue(0, 0)
    internal.dispatchWorkers()
    FakeWorker.instances[0]!.onerror?.()
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(3)
    internal.drainBuildQueue()
    const steps = internal.fallback!.steps
    const cancel = vi.spyOn(steps, 'return')
    if (reason === 'clear') terrain.clearAll()
    if (reason === 'dispose') terrain.dispose()
    if (reason === 'unwanted') { internal.desiredTiles.delete(key(0)); internal.drainBuildQueue() }
    if (reason === 'seed') { setWorldSeed(2); internal.drainBuildQueue() }
    expect(cancel).toHaveBeenCalledOnce()
    expect(internal.fallback).toBeNull()
    expect(terrain.streamingStats.inFlight).toBe(0)
    expect(terrain.streamingStats.loaded).toBe(0)
  })

  it('bounds fallback advances even when the timer never advances', () => {
    queue(0, 0)
    internal.dispatchWorkers()
    FakeWorker.instances[0]!.onerror?.()
    const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(3)
    internal.drainBuildQueue()
    const advance = vi.spyOn(internal.fallback!.steps, 'next').mockReturnValue({ done: false, value: 'climate' })
    clock.mockReturnValue(0)
    internal.drainBuildQueue()
    expect(advance).toHaveBeenCalledTimes(256)
    expect(terrain.streamingStats.loaded).toBe(0)
    expect(terrain.streamingStats.inFlight).toBe(1)
  })

  it('releases a failed iterator instead of trying to install its empty next result', () => {
    queue(0, 0)
    internal.dispatchWorkers()
    FakeWorker.instances[0]!.onerror?.()
    const clock = vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValue(3)
    internal.drainBuildQueue()
    const steps = internal.fallback!.steps
    const cancel = vi.spyOn(steps, 'return')
    vi.spyOn(steps, 'next').mockImplementation(() => { throw new Error('generation failed') })
    clock.mockReturnValue(0)
    expect(() => internal.drainBuildQueue()).toThrow('generation failed')
    expect(cancel).toHaveBeenCalledOnce()
    expect(internal.fallback).toBeNull()
    expect(terrain.streamingStats.inFlight).toBe(0)
    expect(() => internal.drainBuildQueue()).not.toThrow()
    expect(terrain.streamingStats.loaded).toBe(0)
  })

  it('terminates all workers and never adds chunks from late replies after disposal', () => {
    queue(5, 5)
    internal.dispatchWorkers()
    const worker = FakeWorker.instances[0]!
    const request = worker.posted[0]!
    const queuedHandler = worker.onmessage!
    terrain.dispose()
    queuedHandler({ data: { id: request.id, generation: request.generation, data: fixture } } as MessageEvent<TerrainBuildReply>)
    terrain.update(0, 0, .1)
    expect(FakeWorker.instances.every(instance => instance.terminated)).toBe(true)
    expect(terrain.streamingStats.ready).toBe(0)
    expect(terrain.streamingStats.loaded).toBe(0)
    expect(terrain.root.children).toHaveLength(0)
    expect(terrain.root.parent).toBeNull()
  })

  it('keeps terrain teardown idempotent across repeated shutdown calls', () => {
    const nearDispose = vi.spyOn(internal.groundMatFar, 'dispose')
    terrain.dispose()
    terrain.dispose()
    expect(nearDispose).toHaveBeenCalledOnce()
    expect(terrain.root.parent).toBeNull()
  })
})

it('retains contact tile identities through unrelated installs and distinguishes replacements and reseeds', () => {
  desire(5, 12); internal.install(job(5, 2), fixture)
  const x = 5 * CHUNK_SIZE + 20, z = 20, first = terrain.sampleMeshRevision(x, z)
  expect(first).toBeGreaterThan(0)
  desire(6, 12); internal.install(job(6, 2), fixture)
  expect(terrain.sampleMeshRevision(x, z)).toBe(first)
  desire(5, 4); internal.install(job(5, 1), fixture)
  const replacement = terrain.sampleMeshRevision(x, z)
  expect(replacement).toBeGreaterThan(first)
  terrain.clearAll(); expect(terrain.sampleMeshRevision(x, z)).toBe(0)
  desire(5, 4); internal.install({ ...job(5, 1), generation: 1 }, fixture)
  expect(terrain.sampleMeshRevision(x, z)).toBeGreaterThan(replacement)
})
