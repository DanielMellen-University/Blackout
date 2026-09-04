/**
 * Frame timing helper. Variable dt, clamped after tab backgrounding.
 */
export class Time {
  private lastMs: number | null = null
  private fpsSmoothed = 60

  /**
   * Call once per animation frame.
   * @returns frameDt in seconds (clamped after tab backgrounding)
   */
  beginFrame(nowMs: number): { frameDt: number } {
    if (this.lastMs === null) {
      this.lastMs = nowMs
      return { frameDt: 0 }
    }

    let frameDt = (nowMs - this.lastMs) / 1000
    this.lastMs = nowMs

    // Spiral-of-death clamp after long background pauses
    if (frameDt > 0.25) frameDt = 0.25

    this.fpsSmoothed = this.fpsSmoothed * 0.9 + (1 / Math.max(frameDt, 1e-6)) * 0.1
    return { frameDt }
  }

  /** Discard wall time accumulated while paused, hidden, or unfocused. */
  reset(nowMs: number | null = null): void {
    this.lastMs = nowMs
  }

  get fps(): number {
    return this.fpsSmoothed
  }
}
