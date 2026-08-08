import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig } from '../aircraft/flightConfig'
import { contactMinY, sampleGroundHeight } from '../world/ground'

export type TouchResult = 'air' | 'roll' | 'landed' | 'crash'

/**
 * Ground contact outcomes for Phase 2.
 * Floor height comes from the shared ground query (flat + runway today).
 */
export class CollisionSystem {
  /** Last evaluated contact state. */
  lastResult: TouchResult = 'air'

  /** Surface Y under the aircraft (for debug / future terrain). */
  surfaceY(aircraft: Aircraft): number {
    return sampleGroundHeight(aircraft.position.x, aircraft.position.z)
  }

  /**
   * Call after FlightModel.step.
   * Sets lastResult; main freezes / shows banner on crash or landed.
   */
  check(aircraft: Aircraft): TouchResult {
    const minY = contactMinY(
      aircraft.position.x,
      aircraft.position.z,
      aircraft.controls.gearDown,
    )
    const onPad = aircraft.position.y <= minY + 0.2
    const vy = aircraft.velocity.y
    const gs = Math.hypot(aircraft.velocity.x, aircraft.velocity.z)

    if (!onPad) {
      this.lastResult = 'air'
      return 'air'
    }

    // Hard impact (gear up more fragile)
    const crashLimit = aircraft.controls.gearDown
      ? flightConfig.crashVy
      : flightConfig.crashVy * 0.55
    if (vy < crashLimit) {
      this.lastResult = 'crash'
      return 'crash'
    }

    // Soft landing: gentle contact with gear down
    if (vy < -0.5 && vy > flightConfig.softLandingVy && gs < 55 && aircraft.controls.gearDown) {
      this.lastResult = 'landed'
      return 'landed'
    }

    this.lastResult = 'roll'
    return 'roll'
  }
}
