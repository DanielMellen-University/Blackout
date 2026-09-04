import { Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig as C } from '../aircraft/flightConfig'

export type WarningLevel = 'none' | 'caution' | 'warning'

export interface WarningState {
  /** Highest-priority active warning label, or null. */
  text: string | null
  level: WarningLevel
  /** Individual flags for HUD styling / future audio. */
  stall: boolean
  lowAlt: boolean
  gear: boolean
}

const _fwd = new Vector3()
const _up = new Vector3()
const _vel = new Vector3()

/**
 * Arcade flight cautions: stall (AoA / low speed), low altitude, gear up on approach.
 * Priority: STALL > GEAR > LOW ALT.
 */
export function evaluateWarnings(
  aircraft: Aircraft,
  altAgl: number,
): WarningState {
  const none: WarningState = {
    text: null,
    level: 'none',
    stall: false,
    lowAlt: false,
    gear: false,
  }

  if (aircraft.status === 'crashed') return none
  if (aircraft.onGround) return none

  const speed = aircraft.speed
  _fwd.set(0, 0, 1).applyQuaternion(aircraft.orientation)
  _up.set(0, 1, 0).applyQuaternion(aircraft.orientation)

  let aoaAbs = 0
  if (speed > 2) {
    _vel.copy(aircraft.velocity).normalize()
    const aoa = Math.atan2(_vel.dot(_up), Math.max(0.05, _vel.dot(_fwd)))
    aoaAbs = Math.abs(aoa)
  }

  // Stall: high AoA or mushy low airspeed while airborne
  const slow = speed < C.minSpeed * 0.92 && altAgl > 8
  const highAoA = aoaAbs > C.stallAoA && speed < C.liftSpeed * 1.2
  const stall = slow || highAoA

  // Terrain warning only when height is closing quickly. This stays quiet during
  // a slow, gear-down flare while still warning about a fast descent into terrain.
  const descendingFast = aircraft.velocity.y < -4
  const approachConfigured = aircraft.controls.gearDown && speed < 62
  const lowAlt =
    altAgl < 48 && altAgl > 1.5 && speed > 35 && descendingFast && !approachConfigured

  // Gear is automatic; no GEAR caution
  const gear = false

  let text: string | null = null
  let level: WarningLevel = 'none'
  if (stall) {
    text = 'STALL'
    level = 'warning'
  } else if (gear) {
    text = 'GEAR'
    level = 'caution'
  } else if (lowAlt) {
    text = 'LOW ALT'
    level = 'caution'
  }

  return { text, level, stall, lowAlt, gear }
}
