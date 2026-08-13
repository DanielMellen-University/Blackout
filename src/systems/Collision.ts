import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig } from '../aircraft/flightConfig'
import { contactMinY } from '../world/ground'

export type TouchResult = 'air' | 'roll' | 'landed' | 'crash'

/**
 * Ground contact outcomes. Floor comes from the shared terrain heightfield.
 */
export class CollisionSystem {
  /**
   * Call after FlightModel.step.
   * Main freezes / shows banner on crash or landed.
   */
  check(aircraft: Aircraft): TouchResult {
    const minY = contactMinY(
      aircraft.position.x,
      aircraft.position.z,
      aircraft.controls.gearDown,
    )
    const onPad = aircraft.position.y <= minY + 0.2
    // Flight model zeros vy on contact — use the pre-clamp impact speed.
    const vy = aircraft.impactVy < 0 ? aircraft.impactVy : aircraft.velocity.y
    const gs = Math.hypot(aircraft.velocity.x, aircraft.velocity.z)

    if (!onPad) return 'air'

    // Hard impact (gear up more fragile)
    const crashLimit = aircraft.controls.gearDown
      ? flightConfig.crashVy
      : flightConfig.crashVy * 0.55
    if (vy < crashLimit) return 'crash'

    // Soft landing: gentle contact with gear down
    if (vy < -0.5 && vy > flightConfig.softLandingVy && gs < 55 && aircraft.controls.gearDown) {
      return 'landed'
    }

    return 'roll'
  }
}
