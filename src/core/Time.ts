/**
 * Frame timing helper.
 * Phase 0 integrates with variable frame dt; fixed-step fields remain
 * available for Phase 1 physics if needed.
 */
export class Time {
  /** Fixed step size reserved for future FlightModel integration. */
  readonly fixedDt: number

  private lastMs: number | null = null
  private fpsSmoothed = 60

  constructor(fixedHz = 60) {
    this.fixedDt = 1 / fixedHz
  }

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

  get fps(): number {
    return this.fpsSmoothed
  }
}
