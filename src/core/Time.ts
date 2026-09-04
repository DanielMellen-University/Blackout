/** Fixed simulation step. Render may run faster or slower; gameplay does not. */
export const SIM_STEP = 1 / 60
const MAX_STEPS = 5
const SUSPEND_AFTER = 0.25

export interface FrameTiming {
  /** Wall time since the previous rendered frame, seconds. */
  frameDt: number
  /** Number of fixed simulation steps to run this frame. */
  steps: number
  stepDt: number
}

/**
 * Frame timing helper. Simulation uses a fixed-step accumulator so low FPS
 * does not slow the jet down; leftover time past MAX_STEPS is dropped.
 */
export class Time {
  private lastMs: number | null = null
  private fpsSmoothed = 60
  private accum = 0
  readonly stepDt = SIM_STEP

  /**
   * Call once per animation frame while the sim is live.
   */
  beginFrame(nowMs: number): FrameTiming {
    if (this.lastMs === null) {
      this.lastMs = nowMs
      return { frameDt: 0, steps: 0, stepDt: this.stepDt }
    }

    let frameDt = (nowMs - this.lastMs) / 1000
    this.lastMs = nowMs

    if (frameDt > SUSPEND_AFTER) {
      // Tab hide / long hitch: do not catch up a multi-second stall.
      this.accum = 0
      this.noteFps(this.stepDt)
      return { frameDt: this.stepDt, steps: 1, stepDt: this.stepDt }
    }

    this.noteFps(frameDt)
    this.accum += Math.max(0, frameDt)

    let steps = 0
    while (this.accum >= this.stepDt && steps < MAX_STEPS) {
      this.accum -= this.stepDt
      steps++
    }
    if (steps >= MAX_STEPS) this.accum = 0

    return { frameDt, steps, stepDt: this.stepDt }
  }

  /**
   * Advance the wall clock without simulating. Use while paused, on the
   * title screen, or when the tab is hidden so resume does not dump dt.
   */
  skipFrame(nowMs: number): void {
    if (this.lastMs !== null) {
      const frameDt = (nowMs - this.lastMs) / 1000
      if (frameDt > 0 && frameDt <= SUSPEND_AFTER) this.noteFps(frameDt)
    }
    this.lastMs = nowMs
    this.accum = 0
  }

  /** Discard wall time accumulated while paused, hidden, or unfocused. */
  reset(nowMs: number | null = null): void {
    this.lastMs = nowMs
    this.accum = 0
  }

  get fps(): number {
    return this.fpsSmoothed
  }

  private noteFps(frameDt: number): void {
    this.fpsSmoothed = this.fpsSmoothed * 0.9 + (1 / Math.max(frameDt, 1e-6)) * 0.1
  }
}
