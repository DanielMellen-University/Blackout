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
  overspeed: boolean
}

const _fwd = new Vector3()
const _up = new Vector3()
const _vel = new Vector3()

const NONE_WARNING = Object.freeze({
  text: null,
  level: 'none',
  stall: false,
  lowAlt: false,
  gear: false,
  overspeed: false,
}) as WarningState
const STALL_WARNING = Object.freeze({
  text: 'STALL',
  level: 'warning',
  stall: true,
  lowAlt: false,
  gear: false,
  overspeed: false,
}) as WarningState
const LOW_ALT_WARNING = Object.freeze({
  text: 'LOW ALT',
  level: 'caution',
  stall: false,
  lowAlt: true,
  gear: false,
  overspeed: false,
}) as WarningState
const OVERSPEED_WARNING = Object.freeze({
  text: 'OVERSPEED',
  level: 'caution',
  stall: false,
  lowAlt: false,
  gear: false,
  overspeed: true,
}) as WarningState

/**
 * Arcade flight cautions: stall (AoA / low speed) and speed-scaled low altitude.
 * Automatic gear does not need a separate caution.
 */
export function evaluateWarnings(
  aircraft: Aircraft,
  altAgl: number,
): WarningState {
  if (aircraft.status === 'crashed') return NONE_WARNING
  if (aircraft.onGround) return NONE_WARNING

  const speed = aircraft.speed
  _fwd.set(0, 0, 1).applyQuaternion(aircraft.orientation)
  _up.set(0, 1, 0).applyQuaternion(aircraft.orientation)

  let aoaAbs = 0
  if (speed > 2) {
    _vel.copy(aircraft.velocity).normalize()
    const aoa = Math.atan2(_vel.dot(_up), Math.max(0.05, _vel.dot(_fwd)))
    aoaAbs = Math.abs(aoa)
  }

  const stall = stallWarningActive(speed, aoaAbs, altAgl)
  const lowAlt = lowAltitudeWarningActive(
    altAgl,
    speed,
    aircraft.velocity.y,
    aircraft.controls.gearDown,
  )
  const overspeed = overspeedWarningActive(speed)

  if (stall) return STALL_WARNING
  if (lowAlt) return LOW_ALT_WARNING
  if (overspeed) return OVERSPEED_WARNING
  return NONE_WARNING
}

/** Stall threshold shared by the warning path and focused tests. */
export function stallWarningActive(speed: number, aoaAbs: number, altAgl: number): boolean {
  if (!Number.isFinite(speed) || !Number.isFinite(altAgl)) return false
  const safeSpeed = Math.max(0, speed)
  const safeAoa = Number.isFinite(aoaAbs) ? Math.abs(aoaAbs) : 0
  const slow = safeSpeed < C.minSpeed * 0.92 && altAgl > 8
  const highAoA = safeAoa > C.stallAoA && safeSpeed < C.liftSpeed * 1.2
  return slow || highAoA
}

/** Raise the terrain-caution ceiling for fast descents, capped for readability. */
export function lowAltitudeWarningCeiling(speed: number): number {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
  return Math.min(96, Math.max(48, 32 + safeSpeed * 0.08))
}

/** Speed-scaled terrain caution that stays quiet during a configured flare. */
export function lowAltitudeWarningActive(
  altAgl: number,
  speed: number,
  verticalSpeed: number,
  gearDown: boolean,
): boolean {
  if (!Number.isFinite(speed) || !Number.isFinite(altAgl)) return false
  const safeSpeed = Math.max(0, speed)
  const descendingFast = Number.isFinite(verticalSpeed) && verticalSpeed < -4
  const approachConfigured = gearDown && safeSpeed < 62
  return altAgl < lowAltitudeWarningCeiling(safeSpeed) &&
    altAgl > 1.5 &&
    safeSpeed > 35 &&
    descendingFast &&
    !approachConfigured
}

/** Warn only after the jet leaves the dry displayed airspeed envelope. */
export function overspeedWarningActive(speed: number): boolean {
  return Number.isFinite(speed) && speed > C.maxSpeed
}
