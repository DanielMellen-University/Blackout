/** Fixed-timestep accumulator for stable simulation. */
export class Time {
  readonly fixedDt: number

  private accumulator = 0
  private lastMs: number | null = null
  private fpsSmoothed = 60

  constructor(fixedHz = 60) {
    this.fixedDt = 1 / fixedHz
  }

  /** Call once per animation frame. Returns how many fixed steps to run. */
  beginFrame(nowMs: number): { steps: number; alpha: number; frameDt: number } {
    if (this.lastMs === null) {
      this.lastMs = nowMs
      return { steps: 0, alpha: 0, frameDt: 0 }
    }

    let frameDt = (nowMs - this.lastMs) / 1000
    this.lastMs = nowMs

    // Clamp spiral-of-death after tab backgrounding
    if (frameDt > 0.25) frameDt = 0.25

    this.fpsSmoothed = this.fpsSmoothed * 0.9 + (1 / Math.max(frameDt, 1e-6)) * 0.1

    this.accumulator += frameDt
    let steps = 0
    const maxSteps = 5
    while (this.accumulator >= this.fixedDt && steps < maxSteps) {
      this.accumulator -= this.fixedDt
      steps++
    }
    // Drop leftover if we hit the cap
    if (steps === maxSteps) this.accumulator = 0

    const alpha = this.accumulator / this.fixedDt
    return { steps, alpha, frameDt }
  }

  get fps(): number {
    return this.fpsSmoothed
  }
}
