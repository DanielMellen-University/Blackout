import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig } from '../aircraft/flightConfig'

export type TouchResult = 'air' | 'roll' | 'landed' | 'crash'

/**
 * Ground contact outcomes for Phase 2.
 * Ground plane is y = 0; aircraft uses gear/belly height above it.
 */
export class CollisionSystem {
  readonly groundY = 0

  /** Last evaluated contact state. */
  lastResult: TouchResult = 'air'

  /**
   * Call after FlightModel.step.
   * Sets lastResult; for crash returns true so main can freeze / banner.
   */
  check(aircraft: Aircraft): TouchResult {
    const gearY = aircraft.controls.gearDown
      ? flightConfig.gearHeight
      : flightConfig.bellyHeight
    const minY = this.groundY + gearY
    const onPad = aircraft.position.y <= minY + 0.2
    const vy = aircraft.velocity.y
    const gs = Math.hypot(aircraft.velocity.x, aircraft.velocity.z)

    if (!onPad) {
      this.lastResult = 'air'
      return 'air'
    }

    // Hard impact
    const crashLimit = aircraft.controls.gearDown
      ? flightConfig.crashVy
      : flightConfig.crashVy * 0.55 // gear up more fragile
    if (vy < crashLimit) {
      this.lastResult = 'crash'
      return 'crash'
    }

    // Soft landing: was airborne-ish, now gentle contact
    if (vy < -0.5 && vy > flightConfig.softLandingVy && gs < 55 && aircraft.controls.gearDown) {
      this.lastResult = 'landed'
      return 'landed'
    }

    this.lastResult = 'roll'
    return 'roll'
  }
}
