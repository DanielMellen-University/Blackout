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
 * Temporary kill-switches until warnings are retuned.
 * Flip back to true to restore STALL / LOW ALT cautions.
 */
const ENABLE_STALL_WARNING = false
const ENABLE_LOW_ALT_WARNING = false

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
  const stallAoA = aoaAbs > C.stallAoA * 0.88
  const stallSpeed = speed < C.minSpeed * 0.92 && altAgl > 6
  const stall = ENABLE_STALL_WARNING && (stallAoA || stallSpeed)

  // Low alt: close to ground after leaving the runway environment
  const lowAlt =
    ENABLE_LOW_ALT_WARNING && altAgl < 45 && altAgl > 1.5 && speed > 8

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
