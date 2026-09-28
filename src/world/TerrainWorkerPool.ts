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
interface Slot { worker: Worker; job: TerrainBuildRequest | null; retire: boolean }

/** One outstanding job per worker bounds memory and prevents stale FIFO backlogs. */
export class TerrainWorkerPool {
  private slots: Slot[] = []
  private disabled = false
  private busyCount = 0
  private readonly hardwareWorkerLimit: number
  private workerLimit: number
  private readonly complete: (job: TerrainBuildRequest, data: TerrainGeometryData) => void
  private readonly retry: (job: TerrainBuildRequest) => void
  constructor(
    complete: (job: TerrainBuildRequest, data: TerrainGeometryData) => void,
    retry: (job: TerrainBuildRequest) => void,
    maxWorkers = 6,
  ) {
    this.complete = complete
    this.retry = retry
    this.hardwareWorkerLimit = typeof navigator === 'undefined'
      ? 2
      : Math.max(1, (navigator.hardwareConcurrency || 4) - 2)
    this.workerLimit = Math.min(normalizeWorkerLimit(maxWorkers), this.hardwareWorkerLimit)
    if (typeof Worker === 'undefined') return
    try {
      while (this.slots.length < this.workerLimit) this.createSlot()
    } catch {
      this.fail()
    }
  }
  get size(): number { return this.slots.length }
  get busy(): number { return this.busyCount }
  get available(): boolean {
    return !this.disabled && this.slots.some(slot => slot.job === null && !slot.retire)
  }

  /** Adjust concurrency without interrupting a terrain job already in flight. */
  setWorkerLimit(maxWorkers: number): void {
    const next = Math.min(normalizeWorkerLimit(maxWorkers), this.hardwareWorkerLimit)
    if (next === this.workerLimit) return
    this.workerLimit = next
    if (this.disabled) return

    if (next > this.slots.length) {
      for (const slot of this.slots) slot.retire = false
      try {
        while (this.slots.length < next) this.createSlot()
      } catch {
        this.fail()
      }
      return
    }

    let excess = this.slots.length - next
    for (let i = this.slots.length - 1; i >= 0 && excess > 0; i--) {
      const slot = this.slots[i]!
      if (slot.job) {
        if (!slot.retire) {
          slot.retire = true
          excess--
        }
        continue
      }
      this.removeSlot(slot)
      excess--
    }
  }
  submit(job: TerrainBuildRequest): boolean {
    const slot = this.slots.find(candidate => candidate.job === null && !candidate.retire)
    if (!slot) return false
    slot.job = job
    this.busyCount++
    try { slot.worker.postMessage(job) } catch { this.fail(); return false }
    return true
  }
  private fail(): void {
    this.disabled = true
    const jobs = this.slots.flatMap(slot => slot.job ? [slot.job] : [])
    this.dispose()
    for (const job of jobs) this.retry(job)
  }

  private createSlot(): void {
    const worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' })
    const slot: Slot = { worker, job: null, retire: false }
    worker.onmessage = (event: MessageEvent<TerrainBuildReply>) => {
      const job = slot.job
      if (!job || event.data.id !== job.id || event.data.generation !== job.generation) return
      slot.job = null
      this.busyCount = Math.max(0, this.busyCount - 1)
      const shouldRetire = slot.retire || this.slots.length > this.workerLimit
      if (shouldRetire) this.removeSlot(slot)
      this.complete(job, event.data.data)
    }
    worker.onerror = () => this.fail()
    worker.onmessageerror = () => this.fail()
    this.slots.push(slot)
  }

  private removeSlot(slot: Slot): void {
    const index = this.slots.indexOf(slot)
    if (index < 0) return
    slot.worker.onmessage = null
    slot.worker.onerror = null
    slot.worker.onmessageerror = null
    slot.worker.terminate()
    this.slots.splice(index, 1)
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
    this.busyCount = 0
  }
}

function normalizeWorkerLimit(value: number): number {
  return Math.min(6, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 6))
}
