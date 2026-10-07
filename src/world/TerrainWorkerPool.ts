import type { TerrainGeometryBuffers, TerrainGeometryData } from './TerrainGeometry'
import type { TerrainLod } from './TerrainGeometry'
import type { getOpsPad } from './terrainSample'
import { WorkerWatchdog } from '../core/WorkerWatchdog'

export interface TerrainBuildRequest {
  id: number
  generation: number
  seed: number
  pad: ReturnType<typeof getOpsPad>
  cx: number
  cz: number
  size: number
  lod: TerrainLod
  skirtEdges: readonly [boolean, boolean, boolean, boolean]
}
export interface TerrainBuildReply {
  id: number
  generation: number
  data: TerrainGeometryData
}
interface Slot { worker: Worker; job: TerrainBuildRequest | null; retire: boolean; watchdog: WorkerWatchdog }

/** One outstanding job per worker bounds memory and prevents stale FIFO backlogs. */
export class TerrainWorkerPool {
  private slots: Slot[] = []
  private disabled = false
  private disposed = false
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
    return !this.disabled && !this.disposed && this.slots.some(slot => slot.job === null && !slot.retire)
  }

  /** Adjust concurrency without interrupting a terrain job already in flight. */
  setWorkerLimit(maxWorkers: number): void {
    if (this.disposed) return
    const next = Math.min(normalizeWorkerLimit(maxWorkers), this.hardwareWorkerLimit)
    if (next === this.workerLimit) return
    this.workerLimit = next
    if (this.disabled) return
    this.reconcileSlots()
  }
  submit(job: TerrainBuildRequest): boolean {
    if (this.disposed) return false
    // Dispatch runs for every streamed tile. Keep the slot scan explicit so
    // the normal worker path does not allocate a callback for Array.find().
    let slot: Slot | undefined
    for (const candidate of this.slots) {
      if (candidate.job === null && !candidate.retire) {
        slot = candidate
        break
      }
    }
    if (!slot) return false
    slot.job = job
    slot.watchdog.begin()
    this.busyCount++
    try { slot.worker.postMessage(job) } catch { this.fail(); return false }
    return true
  }

  /** A worker can stop responding without emitting an error or messageerror. */
  advance(seconds: number): void {
    if (this.disabled || this.disposed || this.busyCount === 0) return
    for (const slot of this.slots) {
      if (slot.job && slot.watchdog.advance(seconds)) {
        this.fail()
        return
      }
    }
  }

  /** Cancel stale terrain work while keeping the configured worker capacity. */
  cancelJobs(): void {
    if (this.disabled || this.disposed) return
    // Walk backwards because removeSlot() splice-removes the current entry.
    // This avoids cloning the slot array during every world reseed.
    for (let index = this.slots.length - 1; index >= 0; index--) {
      const slot = this.slots[index]!
      if (!slot.job) continue
      slot.job = null
      this.busyCount = Math.max(0, this.busyCount - 1)
      this.removeSlot(slot)
    }
    this.reconcileSlots()
  }

  private fail(): void {
    this.disabled = true
    const jobs = this.slots.flatMap(slot => slot.job ? [slot.job] : [])
    this.dispose()
    for (const job of jobs) this.retry(job)
  }

  private createSlot(): void {
    const worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' })
    const slot: Slot = { worker, job: null, retire: false, watchdog: new WorkerWatchdog() }
    worker.onmessage = (event: MessageEvent<TerrainBuildReply>) => {
      const job = slot.job
      if (!job) return
      const reply = event?.data
      if (!reply || reply.id !== job.id || reply.generation !== job.generation) return
      if (!isTerrainGeometryData(reply.data)) {
        // A worker can survive a structured-clone or application-level
        // protocol failure without emitting onerror. Do not leave the slot
        // busy forever or pass malformed buffers into Three.js; disable the
        // pool and route every in-flight job through the synchronous fallback.
        this.fail()
        return
      }
      slot.job = null
      slot.watchdog.clear()
      this.busyCount = Math.max(0, this.busyCount - 1)
      const shouldRetire = slot.retire || this.slots.length > this.workerLimit
      if (shouldRetire) this.removeSlot(slot)
      this.reconcileSlots()
      this.complete(job, reply.data)
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

  /** Reconcile pending retirements after a quality change or worker completion. */
  private reconcileSlots(): void {
    if (this.disabled || this.disposed) return
    // A later quality change can make a previously scheduled retirement
    // unnecessary. Recompute the retirement set from the current target so a
    // rapid Low -> High switch cannot strand the pool below its new limit.
    for (const slot of this.slots) slot.retire = false
    if (this.slots.length < this.workerLimit) {
      try {
        while (this.slots.length < this.workerLimit) this.createSlot()
      } catch {
        this.fail()
      }
      return
    }

    let excess = this.slots.length - this.workerLimit
    for (let i = this.slots.length - 1; i >= 0 && excess > 0; i--) {
      const slot = this.slots[i]!
      if (slot.job) {
        slot.retire = true
        excess--
      } else {
        this.removeSlot(slot)
        excess--
      }
    }
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
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

function isTerrainGeometryData(value: unknown): value is TerrainGeometryData {
  if (!isRecord(value) || !Number.isInteger(value.segs) || value.segs < 1) return false
  const expected = (value.segs + 1) ** 2
  if (!(value.heights instanceof Float32Array) || value.heights.length !== expected) return false
  if (!(value.waterLevels instanceof Float32Array) || value.waterLevels.length !== expected) return false
  return isTerrainGeometryBuffers(value.ground) &&
    (value.water === null || isTerrainGeometryBuffers(value.water))
}

function isTerrainGeometryBuffers(value: unknown): value is TerrainGeometryBuffers {
  if (!isRecord(value) || !isRecord(value.attributes) || !isRecord(value.bounds)) return false
  const bounds = value.bounds
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.z) || !Number.isFinite(bounds.radius)) return false
  for (const name in value.attributes) {
    const attribute = value.attributes[name]
    if (!isRecord(attribute) || !Number.isInteger(attribute.itemSize) || attribute.itemSize < 1) return false
    if (!ArrayBuffer.isView(attribute.array)) return false
  }
  return value.index === null || ArrayBuffer.isView(value.index)
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}
