import type { Aircraft } from '../aircraft/Aircraft'

/**
 * Ground collision + crash handling (Phase 2).
 * Phase 0 only exposes a soft floor inside Aircraft.freeFlyStep.
 */
export class CollisionSystem {
  groundY = 0
  /** Minimum safe vertical speed on touchdown (m/s, negative is down). */
  crashSpeedThreshold = -12

  /**
   * Returns true if a crash was triggered.
   * Stub — always false in Phase 0.
   */
  check(_aircraft: Aircraft): boolean {
    return false
  }
}
