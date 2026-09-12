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
  /**
   * 0..1 blend from the previous physics pose to the current one.
   * 1 means snap to the latest state (first frame, hitch, overload).
   */
  alpha: number
}

/**
 * Static title, pause, and results frames do not need world streaming work.
 * Keep the predicate pure so the animation loop and regression tests share
 * the same idle-frame policy.
 */
export function shouldAdvanceWorld(
  simulationLive: boolean,
  simDt: number,
  visualDt: number,
): boolean {
  if (simulationLive) return true
  return simDt > 0 || visualDt > 0
}

/** Keep the live HUD frozen under pause/results overlays until flight resumes. */
export function shouldUpdateLiveHud(playing: boolean, simulationLive: boolean): boolean {
  return playing && simulationLive
}

/** Do not submit WebGL work while the document is hidden or the context is lost. */
export function shouldRenderFrame(documentHidden: boolean, contextLost: boolean): boolean {
  return !documentHidden && !contextLost
}

/** Pause active flight when the window loses focus without auto-resuming. */
export function shouldPauseForFocusLost(
  playing: boolean,
  menuPaused: boolean,
  resultsOpen: boolean,
): boolean {
  return playing && !menuPaused && !resultsOpen
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
  /** Reused render timing record so the animation loop stays allocation-free. */
  private readonly frame: FrameTiming = {
    frameDt: 0,
    steps: 0,
    stepDt: SIM_STEP,
    alpha: 1,
  }

  /**
   * Call once per animation frame while the sim is live.
   */
  beginFrame(nowMs: number): FrameTiming {
    const safeNow = Number.isFinite(nowMs) ? nowMs : (this.lastMs ?? 0)
    if (this.lastMs === null) {
      this.lastMs = safeNow
      this.frame.frameDt = 0
      this.frame.steps = 0
      this.frame.alpha = 1
      return this.frame
    }

    // RAF timestamps should be monotonic, but a test harness, restored page,
    // or browser clock edge can still hand us a bad value. Never let one
    // malformed frame turn the accumulator or FPS estimate into NaN/Infinity.
    const monotonicNow = Math.max(this.lastMs, safeNow)
    const frameDt = Math.max(0, (monotonicNow - this.lastMs) / 1000)
    this.lastMs = monotonicNow

    if (frameDt > SUSPEND_AFTER) {
      // Tab hide / long hitch: do not catch up a multi-second stall.
      this.accum = 0
      this.noteFps(this.stepDt)
      this.frame.frameDt = this.stepDt
      this.frame.steps = 1
      this.frame.alpha = 1
      return this.frame
    }

    this.noteFps(frameDt)
    this.accum += Math.max(0, frameDt)

    let steps = 0
    while (this.accum >= this.stepDt && steps < MAX_STEPS) {
      this.accum -= this.stepDt
      steps++
    }
    if (steps >= MAX_STEPS) {
      this.accum = 0
      this.frame.frameDt = frameDt
      this.frame.steps = steps
      this.frame.alpha = 1
      return this.frame
    }

    this.frame.frameDt = frameDt
    this.frame.steps = steps
    this.frame.alpha = this.accum / this.stepDt
    return this.frame
  }

  /**
   * Advance the wall clock without simulating. Use while paused, on the
   * title screen, or when the tab is hidden so resume does not dump dt.
   */
  skipFrame(nowMs: number): void {
    if (this.lastMs !== null) {
      const safeNow = Number.isFinite(nowMs) ? nowMs : this.lastMs
      const monotonicNow = Math.max(this.lastMs, safeNow)
      const frameDt = (monotonicNow - this.lastMs) / 1000
      if (frameDt > 0 && frameDt <= SUSPEND_AFTER) this.noteFps(frameDt)
      this.lastMs = monotonicNow
    } else if (Number.isFinite(nowMs)) {
      this.lastMs = nowMs
    }
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
    if (!Number.isFinite(frameDt) || frameDt <= 0) return
    this.fpsSmoothed = this.fpsSmoothed * 0.9 + (1 / Math.max(frameDt, 1e-6)) * 0.1
  }
}
