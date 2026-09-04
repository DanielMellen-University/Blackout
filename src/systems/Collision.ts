import { MathUtils, Quaternion, Vector3 } from 'three'
import type { Aircraft, AircraftImpact, ContactSurfaceKind } from '../aircraft/Aircraft'
import { flightConfig as C } from '../aircraft/flightConfig'
import { contactMinY, sampleGroundSurface } from '../world/ground'

export type TouchResult = 'air' | 'roll' | 'landed' | 'crash'

export interface ContactClassification {
  airborne: boolean
  impact: AircraftImpact | null
  onPad: boolean
  gearDown: boolean
  vy: number
  groundSpeed: number
  pitch: number
  roll: number
  upY: number
  obstacle: boolean
  surface: ContactSurfaceKind
}

const _fwd = new Vector3()
const _up = new Vector3()
const _inv = new Quaternion()
const _localUp = new Vector3()

/**
 * Ground and obstacle outcomes. Uses the pre-resolution impact snapshot when
 * the flight model recorded one this step.
 */
export class CollisionSystem {
  private readonly hitObstacle: (aircraft: Aircraft) => boolean

  constructor(hitObstacle: (aircraft: Aircraft) => boolean = () => false) {
    this.hitObstacle = hitObstacle
  }

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
    const vy = aircraft.impactVy < 0 ? aircraft.impactVy : aircraft.velocity.y
    const gs = Math.hypot(aircraft.velocity.x, aircraft.velocity.z)
    const pose = attitude(aircraft.orientation)
    const surface = sampleGroundSurface(aircraft.position.x, aircraft.position.z).kind

    return classifyContact({
      airborne: aircraft.impact?.startedAirborne ?? !aircraft.onGround,
      impact: aircraft.impact,
      onPad,
      gearDown: aircraft.controls.gearDown,
      vy,
      groundSpeed: gs,
      pitch: pose.pitch,
      roll: pose.roll,
      upY: pose.upY,
      obstacle: this.hitObstacle(aircraft),
      surface,
    })
  }
}

/** Pure classifier so landing rules can be unit-tested without a renderer. */
export function classifyContact(input: ContactClassification): TouchResult {
  if (input.obstacle) return 'crash'

  const impact = input.impact
  const contacting = !!impact || input.onPad
  if (!contacting) return 'air'

  const airborne = impact?.startedAirborne ?? input.airborne
  const gearDown = impact?.gearDown ?? input.gearDown
  const vy = impact?.verticalVelocity ?? input.vy
  const gs = impact?.tangentialSpeed ?? input.groundSpeed
  const surface = impact?.surface ?? input.surface
  const nVel = impact?.normalVelocity ?? vy
  const slope = impact
    ? Math.acos(MathUtils.clamp(impact.surfaceNormal.y, -1, 1))
    : 0

  if (surface === 'water' && airborne) return 'crash'
  if (input.upY < 0.35) return 'crash'
  if (Math.abs(input.pitch) > C.maxLandingPitch) return 'crash'
  if (Math.abs(input.roll) > C.maxLandingBank) return 'crash'
  if (airborne && slope > C.maxLandingSlope) return 'crash'

  const crashLimit = gearDown ? C.crashVy : C.crashVy * 0.55
  if (vy < crashLimit) return 'crash'
  if (nVel < crashLimit) return 'crash'
  if (airborne && !gearDown && gs > 28) return 'crash'
  if (airborne && gs > C.maxLandingSpeed) return 'crash'

  if (
    airborne &&
    gearDown &&
    vy < -0.5 &&
    vy > C.softLandingVy &&
    gs < 55
  ) {
    return 'landed'
  }

  return 'roll'
}

function attitude(orientation: Quaternion): { pitch: number; roll: number; upY: number } {
  _fwd.set(0, 0, 1).applyQuaternion(orientation)
  const pitch = Math.asin(MathUtils.clamp(_fwd.y, -1, 1))
  _up.set(0, 1, 0).applyQuaternion(orientation)
  _inv.copy(orientation).invert()
  _localUp.set(0, 1, 0).applyQuaternion(_inv)
  const roll = Math.atan2(-_localUp.x, _localUp.y)
  return { pitch, roll, upY: _up.y }
}
