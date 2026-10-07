/** A single, pause-safe impact sequence. No timers and no scoring after death. */
export class CrashCinematic<T> {
  private pending: T | null = null
  private elapsed = 0
  private duration = 3.2

  get active(): boolean { return this.pending !== null }
  get progress(): number { return Math.min(1, this.elapsed / this.duration) }
  get effectTimeScale(): number { return this.elapsed < 0.65 ? 0.45 : 1 }

  begin(result: T, reducedMotion = false): void {
    this.pending = result
    this.elapsed = 0
    this.duration = reducedMotion ? 1.2 : 3.2
  }

  /** Paused/hidden frames supply zero; a long hitch cannot skip the shot. */
  update(dt: number): T | null {
    if (!this.active || !Number.isFinite(dt) || dt <= 0) return null
    this.elapsed = Math.min(this.duration, this.elapsed + Math.min(dt, 0.25))
    if (this.elapsed < this.duration) return null
    const result = this.pending
    this.pending = null
    return result
  }

  reset(): void {
    this.pending = null
    this.elapsed = 0
  }
}
