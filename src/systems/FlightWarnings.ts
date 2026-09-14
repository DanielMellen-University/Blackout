import { Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig as C } from '../aircraft/flightConfig'
import { fuelWarningLevel } from '../aircraft/FuelSystem'

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
  fuel: boolean
  terrainClosure: boolean
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
  fuel: false,
  terrainClosure: false,
}) as WarningState
const STALL_WARNING = Object.freeze({
  text: 'STALL',
  level: 'warning',
  stall: true,
  lowAlt: false,
  gear: false,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
}) as WarningState
const LOW_ALT_WARNING = Object.freeze({
  text: 'LOW ALT',
  level: 'caution',
  stall: false,
  lowAlt: true,
  gear: false,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
}) as WarningState
const GEAR_WARNING = Object.freeze({
  text: 'GEAR',
  level: 'caution',
  stall: false,
  lowAlt: false,
  gear: true,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
}) as WarningState
const OVERSPEED_WARNING = Object.freeze({
  text: 'OVERSPEED',
  level: 'caution',
  stall: false,
  lowAlt: false,
  gear: false,
  overspeed: true,
  fuel: false,
  terrainClosure: false,
}) as WarningState
const FUEL_LOW_WARNING = Object.freeze({
  text: 'FUEL LOW',
  level: 'caution',
  stall: false,
  lowAlt: false,
  gear: false,
  overspeed: false,
  fuel: true,
  terrainClosure: false,
}) as WarningState
const FUEL_EMPTY_WARNING = Object.freeze({
  text: 'FUEL EMPTY',
  level: 'warning',
  stall: false,
  lowAlt: false,
  gear: false,
  overspeed: false,
  fuel: true,
  terrainClosure: false,
}) as WarningState

const TERRAIN_CLOSURE_WARNING = Object.freeze({
  text: 'PULL UP',
  level: 'warning',
  stall: false,
  lowAlt: false,
  gear: false,
  overspeed: false,
  fuel: false,
  terrainClosure: true,
}) as WarningState

/**
 * Arcade flight cautions: stall, speed-scaled low altitude, and approach gear.
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
  const gear = gearWarningActive(
    altAgl,
    speed,
    aircraft.velocity.y,
    aircraft.controls.gearDown,
  )
  const terrainClosure = terrainClosureWarningActive(
    altAgl,
    speed,
    aircraft.velocity.y,
  )
  const overspeed = overspeedWarningActive(speed)
  const fuelLevel = fuelWarningLevel(aircraft.fuel)

  if (stall) return STALL_WARNING
  if (terrainClosure) return TERRAIN_CLOSURE_WARNING
  if (gear) return GEAR_WARNING
  if (lowAlt) return LOW_ALT_WARNING
  if (overspeed) return OVERSPEED_WARNING
  if (fuelLevel === 'critical') return FUEL_EMPTY_WARNING
  if (fuelLevel === 'low') return FUEL_LOW_WARNING
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

/** Warn about a retracted gear only during a low, descending approach. */
export function gearWarningActive(
  altAgl: number,
  speed: number,
  verticalSpeed: number,
  gearDown: boolean,
): boolean {
  if (gearDown || !Number.isFinite(speed) || !Number.isFinite(altAgl)) return false
  const safeSpeed = Math.max(0, speed)
  const safeAlt = Math.max(0, altAgl)
  if (safeSpeed <= 35 || safeAlt <= 1.5) return false
  const descending = Number.isFinite(verticalSpeed) && verticalSpeed < -1.5 && safeAlt < 48
  return safeAlt < 10 || descending
}

/** Warn only after the jet leaves the dry displayed airspeed envelope. */
export function overspeedWarningActive(speed: number): boolean {
  return Number.isFinite(speed) && speed > C.maxSpeed
}

/** Predict a fast sink into terrain before the normal low-altitude caution arrives. */
export function terrainClosureWarningActive(
  altAgl: number,
  speed: number,
  verticalSpeed: number,
): boolean {
  if (!Number.isFinite(altAgl) || !Number.isFinite(speed) || !Number.isFinite(verticalSpeed)) return false
  const safeAlt = Math.max(0, altAgl)
  const safeSpeed = Math.max(0, speed)
  if (safeAlt <= 2 || safeSpeed < 84 || verticalSpeed >= -8) return false
  const secondsToTerrain = safeAlt / Math.max(8, -verticalSpeed)
  return secondsToTerrain <= 2.6
}
