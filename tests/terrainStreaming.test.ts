import { Group, Mesh, MeshStandardMaterial, Scene } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateTerrainGeometry, type TerrainGeometryData } from '../src/world/TerrainGeometry'
import { tileKey } from '../src/world/TerrainLayout'
import { TerrainSystem } from '../src/world/TerrainSystem'
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
interface Chunk { root: Group; fadeAge: number; alpha: number; targetAlpha: number; fadingOut: boolean }
interface Internals {
  desiredTiles: Map<string, Tile>
  chunks: Map<string, Chunk>
  pending: (Tile & { rebuild: boolean })[]
  pendingKeys: Set<string>
  replacementKeys: Map<string, string[]>
  dispatchWorkers(): void
  drainBuildQueue(): void
  install(job: TerrainBuildRequest, data: TerrainGeometryData): void
  updateFades(cx: number, cz: number, dt: number): void
}
let terrain: TerrainSystem
let internal: Internals
let fixture: TerrainGeometryData
const key = (cx: number, size = 1): string => tileKey(cx, 0, size)
function job(cx: number, lod: 0 | 1 | 2 = 1, size = 1): TerrainBuildRequest {
  return { id: cx + 100, generation: 0, seed: 1, pad: null, cx, cz: 0, size, lod,
    withProps: false, skirtEdges: [false, false, false, false] }
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
  it('uploads closer completed chunks first even when the farther worker finishes first', () => {
    queue(5, 5)
    queue(9, 9)
    internal.dispatchWorkers()
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

  it('starts new chunks invisible and fades ground from zero to one over 0.65 seconds', () => {
    desire(5, 5)
    internal.install(job(5), fixture)
    const chunk = internal.chunks.get(key(5))!
    expect(chunk.root.visible).toBe(false)
    expect(material(chunk).opacity).toBe(0)
    expect(material(chunk).alphaHash).toBe(true)
    internal.updateFades(0, 0, .325)
    expect(chunk.root.visible).toBe(true)
    expect(material(chunk).opacity).toBeCloseTo(.5)
    internal.updateFades(0, 0, .325)
    expect(material(chunk).opacity).toBe(1)
  })

  it('keeps old LOD coverage until the replacement finishes its fade', () => {
    desire(5, 12)
    internal.install(job(5, 2), fixture)
    internal.updateFades(0, 0, .65)
    const old = internal.chunks.get(key(5))!
    const geometry = (old.root.children[0] as Mesh).geometry
    const disposed = vi.spyOn(geometry, 'dispose')
    desire(5, 4)
    internal.install(job(5, 1), fixture)
    expect(terrain.root.children).toHaveLength(2)
    internal.updateFades(0, 0, .3)
    expect(old.root.parent).toBe(terrain.root)
    expect(disposed).not.toHaveBeenCalled()
    internal.updateFades(0, 0, .36)
    expect(old.root.parent).toBeNull()
    expect(disposed).toHaveBeenCalledOnce()
    expect(terrain.root.children).toHaveLength(1)
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

  it('retries failed worker jobs through synchronous fallback', () => {
    queue(5, 5)
    internal.dispatchWorkers()
    FakeWorker.instances[0]!.onerror?.()
    expect(terrain.streamingStats.workers).toBe(0)
    expect(terrain.streamingStats.pending).toBe(1)
    internal.drainBuildQueue()
    expect(internal.chunks.has(key(5))).toBe(true)
    expect(terrain.streamingStats.pending).toBe(0)
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
})
