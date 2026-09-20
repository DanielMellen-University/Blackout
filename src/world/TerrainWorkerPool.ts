import type { TerrainGeometryData } from './TerrainGeometry'
import type { TerrainLod } from './TerrainGeometry'
import type { getOpsPad } from './terrainSample'

export interface TerrainBuildRequest {
  id: number
  generation: number
  seed: number
  pad: ReturnType<typeof getOpsPad>
  cx: number
  cz: number
  size: number
  lod: TerrainLod
  withProps: boolean
  skirtEdges: readonly [boolean, boolean, boolean, boolean]
}
export interface TerrainBuildReply {
  id: number
  generation: number
  data: TerrainGeometryData
}
interface Slot { worker: Worker; job: TerrainBuildRequest | null }

/** One outstanding job per worker bounds memory and prevents stale FIFO backlogs. */
export class TerrainWorkerPool {
  private slots: Slot[] = []
  private disabled = false
  private readonly complete: (job: TerrainBuildRequest, data: TerrainGeometryData) => void
  private readonly retry: (job: TerrainBuildRequest) => void
  constructor(
    complete: (job: TerrainBuildRequest, data: TerrainGeometryData) => void,
    retry: (job: TerrainBuildRequest) => void,
  ) {
    this.complete = complete
    this.retry = retry
    if (typeof Worker === 'undefined') return
    const cores = typeof navigator === 'undefined' ? 4 : navigator.hardwareConcurrency || 4
    // Leave CPU capacity for rendering, physics, and settlement generation.
    const count = Math.min(6, Math.max(1, cores - 2))
    try {
      for (let i = 0; i < count; i++) {
        const worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' })
        const slot: Slot = { worker, job: null }
        worker.onmessage = (event: MessageEvent<TerrainBuildReply>) => {
          const job = slot.job
          if (!job || event.data.id !== job.id || event.data.generation !== job.generation) return
          slot.job = null
          this.complete(job, event.data.data)
        }
        worker.onerror = () => this.fail()
        worker.onmessageerror = () => this.fail()
        this.slots.push(slot)
      }
    } catch {
      this.fail()
    }
  }
  get size(): number { return this.slots.length }
  get busy(): number { return this.slots.filter(slot => slot.job !== null).length }
  get available(): boolean { return !this.disabled && this.slots.some(slot => slot.job === null) }
  submit(job: TerrainBuildRequest): boolean {
    const slot = this.slots.find(candidate => candidate.job === null)
    if (!slot) return false
    slot.job = job
    try { slot.worker.postMessage(job) } catch { this.fail(); return false }
    return true
  }
  private fail(): void {
    this.disabled = true
    const jobs = this.slots.flatMap(slot => slot.job ? [slot.job] : [])
    this.dispose()
    for (const job of jobs) this.retry(job)
  }
  dispose(): void {
    for (const slot of this.slots) {
      slot.job = null
      slot.worker.onmessage = null
      slot.worker.onerror = null
      slot.worker.onmessageerror = null
      slot.worker.terminate()
    }
    this.slots.length = 0
  }
}
