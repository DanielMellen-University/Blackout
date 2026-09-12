import { MathUtils, Quaternion, Vector3 } from 'three'
import type { Aircraft, AircraftImpact, ContactSurfaceKind } from '../aircraft/Aircraft'
import { flightConfig as C } from '../aircraft/flightConfig'
import {
  contactMinY,
  sampleGroundSurfaceInto,
  type GroundSurfaceSample,
} from '../world/ground'

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

interface AttitudeState {
  pitch: number
  roll: number
  upY: number
}

/**
 * Ground and obstacle outcomes. Uses the pre-resolution impact snapshot when
 * the flight model recorded one this step.
 */
export class CollisionSystem {
  private readonly hitObstacle: (aircraft: Aircraft) => boolean
  private readonly pose: AttitudeState = { pitch: 0, roll: 0, upY: 1 }
  private readonly contact: ContactClassification = {
    airborne: false,
    impact: null,
    onPad: false,
    gearDown: true,
    vy: 0,
    groundSpeed: 0,
    pitch: 0,
    roll: 0,
    upY: 1,
    obstacle: false,
    surface: 'land',
  }
  private readonly surfaceSample: GroundSurfaceSample = {
    height: 0,
    kind: 'land',
  }

  constructor(hitObstacle: (aircraft: Aircraft) => boolean = () => false) {
    this.hitObstacle = hitObstacle
  }

  /**
   * Call after FlightModel.step.
   * Main freezes / shows banner on crash or landed.
   */
  check(aircraft: Aircraft): TouchResult {
    if (aircraft.status === 'crashed') return 'crash'

    const impact = aircraft.impact
    // FlightModel already resolved the rich surface on an impact. For normal
    // flight, only grounded or near-ground poses need a second surface query;
    // a high airborne jet can classify as air from the cached grounded check.
    const grounded = impact ? false : aircraft.onGround
    let onPad = !!impact || grounded
    let surface: ContactSurfaceKind = impact?.surface ?? 'land'
    if (!impact && !grounded) {
      const minY = contactMinY(
        aircraft.position.x,
        aircraft.position.z,
        aircraft.controls.gearDown,
      )
      onPad = aircraft.position.y <= minY + 0.2
    }
    if (!impact && onPad) {
      surface = sampleGroundSurfaceInto(
        aircraft.position.x,
        aircraft.position.z,
        this.surfaceSample,
      ).kind
    }

    const vy = aircraft.impactVy < 0 ? aircraft.impactVy : aircraft.velocity.y
    const gs = Math.hypot(aircraft.velocity.x, aircraft.velocity.z)
    const pose = attitudeInto(this.pose, aircraft.orientation)

    const contact = this.contact
    contact.airborne = impact?.startedAirborne ?? !grounded
    contact.impact = impact
    contact.onPad = onPad
    contact.gearDown = aircraft.controls.gearDown
    contact.vy = vy
    contact.groundSpeed = gs
    contact.pitch = pose.pitch
    contact.roll = pose.roll
    contact.upY = pose.upY
    contact.obstacle = this.hitObstacle(aircraft)
    contact.surface = surface
    return classifyContact(contact)
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

export function attitudeInto(out: AttitudeState, orientation: Quaternion): AttitudeState {
  _fwd.set(0, 0, 1).applyQuaternion(orientation)
  out.pitch = Math.asin(MathUtils.clamp(_fwd.y, -1, 1))
  _up.set(0, 1, 0).applyQuaternion(orientation)
  out.upY = _up.y
  _inv.copy(orientation).invert()
  _localUp.set(0, 1, 0).applyQuaternion(_inv)
  out.roll = Math.atan2(-_localUp.x, _localUp.y)
  return out
}
