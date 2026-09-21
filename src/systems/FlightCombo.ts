export type FlightComboAction = 'gate' | 'stunt'

export interface FlightComboEvent {
  action: FlightComboAction
  combo: number
  milestone: boolean
}

/** Keep the airshow reward finite even if a malformed event source misbehaves. */
export const MAX_COMBO_COUNT = 20
export const COMBO_WINDOW_SEC = 8
const COMBO_MILESTONES = [2, 4, 8, 12, 16] as const

/** Event-driven combo tracking for clean gates and airborne stunts. */
export class FlightComboTracker {
  current = 0
  best = 0
  private nextMilestone = 0
  private quietSeconds = 0

  reset(): void {
    this.current = 0
    this.best = 0
    this.nextMilestone = 0
    this.quietSeconds = 0
  }

  break(): void {
    this.current = 0
    this.nextMilestone = 0
    this.quietSeconds = 0
  }

  /** Expire an idle chain without allocating or touching the render path. */
  update(dt: number): boolean {
    if (this.current <= 0) return false
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.5)) : 0
    if (safeDt <= 0) return false
    this.quietSeconds += safeDt
    if (this.quietSeconds < COMBO_WINDOW_SEC) return false
    this.break()
    return true
  }

  /** Whole seconds left to keep the live chain, clamped for HUD use. */
  get remainingSeconds(): number {
    if (this.current <= 0) return 0
    return Math.max(0, Math.ceil(COMBO_WINDOW_SEC - this.quietSeconds))
  }

  record(action: FlightComboAction): FlightComboEvent | null {
    if (action !== 'gate' && action !== 'stunt') return null
    this.current = Math.min(MAX_COMBO_COUNT, this.current + 1)
    this.best = Math.max(this.best, this.current)
    this.quietSeconds = 0
    let milestone = false
    while (
      this.nextMilestone < COMBO_MILESTONES.length &&
      this.current >= COMBO_MILESTONES[this.nextMilestone]!
    ) {
      this.nextMilestone += 1
      milestone = true
    }
    return { action, combo: this.current, milestone }
  }
}
