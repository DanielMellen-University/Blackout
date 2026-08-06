import type { Aircraft } from '../aircraft/Aircraft'

/**
 * Ground collision + crash handling — Phase 2 (not wired yet).
 * Phase 0 uses a soft floor in Aircraft.freeFlyStep.
 */
export class CollisionSystem {
  groundY = 0
  /** Touchdown vertical speed limit (m/s, negative is down). */
  crashSpeedThreshold = -12

  /** @returns true if a crash was triggered. */
  check(_aircraft: Aircraft): boolean {
    return false
  }
}
