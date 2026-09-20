import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateTerrainGeometry, type TerrainGeometryData } from '../src/world/TerrainGeometry'
import { TerrainWorkerPool, type TerrainBuildRequest, type TerrainBuildReply } from '../src/world/TerrainWorkerPool'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<TerrainBuildReply>) => void) | null = null
  onerror: (() => void) | null = null
  onmessageerror: (() => void) | null = null
  posted: TerrainBuildRequest[] = []
  terminate = vi.fn()
  postMessage = vi.fn((job: TerrainBuildRequest) => { this.posted.push(job) })
  constructor() { FakeWorker.instances.push(this) }
  reply(reply: TerrainBuildReply): void { this.onmessage?.({ data: reply } as MessageEvent<TerrainBuildReply>) }
}
const request = (id: number, generation = 0): TerrainBuildRequest => ({
  id, generation, seed: 1, pad: null, cx: id, cz: 0, size: 1, lod: 2,
  withProps: false, skirtEdges: [false, false, false, false],
})
let data: TerrainGeometryData

beforeEach(() => {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
  data = generateTerrainGeometry(0, 0, 2)
})
afterEach(() => vi.unstubAllGlobals())

describe('terrain worker pool', () => {
  it.each([[1, 1], [2, 1], [4, 2], [8, 6], [64, 6]])('bounds concurrency on %i cores to %i workers', (cores, count) => {
    vi.stubGlobal('navigator', { hardwareConcurrency: cores })
    const pool = new TerrainWorkerPool(vi.fn(), vi.fn())
    expect(pool.size).toBe(count)
    for (let id = 1; id <= count; id++) expect(pool.submit(request(id))).toBe(true)
    expect(pool.busy).toBe(count)
    expect(pool.available).toBe(false)
    expect(pool.submit(request(99))).toBe(false)
    expect(FakeWorker.instances.every(worker => worker.posted.length === 1)).toBe(true)
    pool.dispose()
  })

  it('ignores unrelated and stale replies without freeing a busy slot', () => {
    const complete = vi.fn()
    const pool = new TerrainWorkerPool(complete, vi.fn())
    pool.submit(request(1, 7))
    const worker = FakeWorker.instances[0]!
    worker.reply({ id: 2, generation: 7, data })
    worker.reply({ id: 1, generation: 6, data })
    expect(complete).not.toHaveBeenCalled()
    expect(pool.busy).toBe(1)
    worker.reply({ id: 1, generation: 7, data })
    expect(complete).toHaveBeenCalledExactlyOnceWith(request(1, 7), data)
    expect(pool.busy).toBe(0)
    pool.dispose()
  })

  it.each(['onerror', 'onmessageerror'] as const)('returns every in-flight job for fallback on %s', event => {
    const retry = vi.fn()
    const pool = new TerrainWorkerPool(vi.fn(), retry)
    pool.submit(request(1))
    pool.submit(request(2))
    FakeWorker.instances[0]![event]?.()
    expect(retry.mock.calls.map(([job]) => job.id)).toEqual([1, 2])
    expect(pool.size).toBe(0)
    expect(pool.available).toBe(false)
    expect(pool.submit(request(3))).toBe(false)
    expect(FakeWorker.instances.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true)
  })

  it('retries a postMessage failure and disables the failed pool', () => {
    const retry = vi.fn()
    const pool = new TerrainWorkerPool(vi.fn(), retry)
    FakeWorker.instances[0]!.postMessage.mockImplementationOnce(() => { throw new Error('worker closed') })
    expect(pool.submit(request(1))).toBe(false)
    expect(retry).toHaveBeenCalledExactlyOnceWith(request(1))
    expect(pool.size).toBe(0)
  })

  it('terminates workers and ignores a reply already queued when disposed', () => {
    const complete = vi.fn()
    const retry = vi.fn()
    const pool = new TerrainWorkerPool(complete, retry)
    pool.submit(request(1))
    const queuedHandler = FakeWorker.instances[0]!.onmessage!
    pool.dispose()
    queuedHandler({ data: { id: 1, generation: 0, data } } as MessageEvent<TerrainBuildReply>)
    expect(complete).not.toHaveBeenCalled()
    expect(retry).not.toHaveBeenCalled()
    expect(pool.size).toBe(0)
    expect(FakeWorker.instances.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true)
  })

  it('supports environments without Worker', () => {
    vi.stubGlobal('Worker', undefined)
    const pool = new TerrainWorkerPool(vi.fn(), vi.fn())
    expect(pool.size).toBe(0)
    expect(pool.available).toBe(false)
    expect(pool.submit(request(1))).toBe(false)
    pool.dispose()
  })
})
