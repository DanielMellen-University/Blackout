const FULL_ROLL_RADIANS = Math.PI * 2
const ROLL_RATE_DEADZONE = 0.12
const MAX_ROLLS_PER_UPDATE = 3

/** Keep stunt progress bounded so malformed input cannot grow run state. */
export const MAX_STUNT_ROLLS = 12

export interface StuntEvent {
  kind: 'barrel-roll'
  rolls: number
  totalRolls: number
}

/**
 * Event-driven airshow stunt tracking. Progress is accumulated from the
 * aircraft body roll rate, so it adds no scene objects or render-loop work.
 */
export class StuntTracker {
  totalRolls = 0
  private rollTravel = 0
  private rollDirection = 0

  reset(): void {
    this.totalRolls = 0
    this.rollTravel = 0
    this.rollDirection = 0
  }

  update(dt: number, airborne: boolean, rollRateRadSec: number): StuntEvent | null {
    if (!airborne) {
      this.rollTravel = 0
      this.rollDirection = 0
      return null
    }

    const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.5) : 0
    const safeRate = Number.isFinite(rollRateRadSec)
      ? Math.max(-10, Math.min(10, rollRateRadSec))
      : 0
    if (safeDt <= 0 || Math.abs(safeRate) < ROLL_RATE_DEADZONE || this.totalRolls >= MAX_STUNT_ROLLS) {
      return null
    }

    const direction = Math.sign(safeRate)
    if (this.rollDirection !== 0 && direction !== this.rollDirection) {
      this.rollTravel = 0
    }
    this.rollDirection = direction
    this.rollTravel += Math.abs(safeRate) * safeDt

    const completed = Math.min(
      MAX_ROLLS_PER_UPDATE,
      Math.floor(this.rollTravel / FULL_ROLL_RADIANS),
      MAX_STUNT_ROLLS - this.totalRolls,
    )
    if (completed <= 0) return null

    this.rollTravel -= completed * FULL_ROLL_RADIANS
    this.totalRolls += completed
    return {
      kind: 'barrel-roll',
      rolls: completed,
      totalRolls: this.totalRolls,
    }
  }

  get progress(): number {
    return Math.max(0, Math.min(1, this.rollTravel / FULL_ROLL_RADIANS))
  }
}
