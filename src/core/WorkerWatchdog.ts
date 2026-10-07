/** Far above measured terrain build times; only silent/stalled workers expire. */
export const WORKER_STALL_SECONDS = 15

/** Active-update clock, with no timers, wall-clock reads, or per-frame allocations. */
export class WorkerWatchdog {
  private elapsed: number | null = null

  begin(): void { this.elapsed = 0 }
  clear(): void { this.elapsed = null }

  /** A zero/invalid delta leaves a paused job untouched. */
  advance(seconds: number): boolean {
    if (this.elapsed === null || !Number.isFinite(seconds) || seconds <= 0) return false
    this.elapsed = Math.min(WORKER_STALL_SECONDS, this.elapsed + seconds)
    return this.elapsed >= WORKER_STALL_SECONDS
  }
}
