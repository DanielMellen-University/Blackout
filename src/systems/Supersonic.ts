/** One-shot Mach-crossing feedback for the arcade flight envelope. */
export const SUPERSONIC_THRESHOLD_MPS = 340
export const SUPERSONIC_REARM_MPS = 300

export type SupersonicTransition = 'boom' | 'subsonic' | 'none'

/**
 * Tracks the supersonic state with a lower re-arm threshold so speed jitter
 * cannot retrigger the boom while the aircraft hovers near Mach 1.
 */
export class SupersonicTracker {
  private activeValue = false

  reset(speed = 0): void {
    const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
    this.activeValue = safeSpeed >= SUPERSONIC_THRESHOLD_MPS
  }

  update(speed: number): SupersonicTransition {
    const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
    if (!this.activeValue && safeSpeed >= SUPERSONIC_THRESHOLD_MPS) {
      this.activeValue = true
      return 'boom'
    }
    if (this.activeValue && safeSpeed <= SUPERSONIC_REARM_MPS) {
      this.activeValue = false
      return 'subsonic'
    }
    return 'none'
  }

  get active(): boolean {
    return this.activeValue
  }
}
