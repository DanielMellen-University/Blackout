import { MathUtils, Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig as C } from '../aircraft/flightConfig'
import { fuelWarningLevel } from '../aircraft/FuelSystem'

export type WarningLevel = 'none' | 'caution' | 'warning'

/** Event cue selected when a warning state first becomes visible. */
export type WarningCue = 'warning' | 'obstacle' | 'overspeed' | 'stall' | 'gear-warning' | 'fuel' | 'go-around' | 'flare' | null

/** Keep threshold warnings readable without delaying an urgent escalation. */
export const WARNING_CLEAR_HOLD_SEC = 0.22
export const WARNING_SWITCH_HOLD_SEC = 0.12

export interface WarningState {
  /** Highest-priority active warning label, or null. */
  text: string | null
  level: WarningLevel
  /** Individual flags for HUD styling / future audio. */
  stall: boolean
  gear: boolean
  flare: boolean
  goAround: boolean
  overspeed: boolean
  fuel: boolean
  obstacle: boolean
}

/**
 * Keep warning audio specific without making the render loop understand every
 * predicate. The tracker still controls cadence, so this is called only when
 * the visible warning label changes.
 */
export function warningCueForState(state: WarningState): WarningCue {
  if (!state.text) return null
  if (state.obstacle) return 'obstacle'
  if (state.stall) return 'stall'
  if (state.gear) return 'gear-warning'
  if (state.goAround) return 'go-around'
  if (state.overspeed) return 'overspeed'
  if (state.fuel) return 'fuel'
  if (state.flare) return 'flare'
  return 'warning'
}

const _fwd = new Vector3()
const _up = new Vector3()
const _vel = new Vector3()
// Fixed fractions keep the obstacle lookahead allocation-free at the HUD
// cadence while preserving the near/mid/far early-exit order.
const OBSTACLE_LOOKAHEAD_FRACTIONS = [0.35, 0.68, 1] as const
const OBSTACLE_LOOKAHEAD_MIN_SPEED_SQ = 60 ** 2

const NONE_WARNING = Object.freeze({
  text: null,
  level: 'none',
  stall: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  obstacle: false,
}) as WarningState
const STALL_WARNING = Object.freeze({
  text: 'STALL',
  level: 'warning',
  stall: true,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  obstacle: false,
}) as WarningState
const GEAR_WARNING = Object.freeze({
  text: 'GEAR',
  level: 'caution',
  stall: false,
  gear: true,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  obstacle: false,
}) as WarningState
const OVERSPEED_WARNING = Object.freeze({
  text: 'OVERSPEED',
  level: 'caution',
  stall: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: true,
  fuel: false,
  obstacle: false,
}) as WarningState
const FUEL_LOW_WARNING = Object.freeze({
  text: 'FUEL LOW',
  level: 'caution',
  stall: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: true,
  obstacle: false,
}) as WarningState
const FUEL_EMPTY_WARNING = Object.freeze({
  text: 'FUEL EMPTY',
  level: 'warning',
  stall: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: true,
  obstacle: false,
}) as WarningState

const OBSTACLE_WARNING = Object.freeze({
  text: 'OBSTACLE',
  level: 'warning',
  stall: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  obstacle: true,
}) as WarningState
const FLARE_WARNING = Object.freeze({
  text: 'FLARE',
  level: 'caution',
  stall: false,
  gear: false,
  flare: true,
  goAround: false,
  overspeed: false,
  fuel: false,
  obstacle: false,
}) as WarningState
const GO_AROUND_WARNING = Object.freeze({
  text: 'GO AROUND',
  level: 'warning',
  stall: false,
  gear: false,
  flare: false,
  goAround: true,
  overspeed: false,
  fuel: false,
  obstacle: false,
}) as WarningState

/**
 * Hold a warning briefly while its raw predicate jitters near a boundary.
 * Entering a more severe state is immediate; only clearing or replacing a
 * warning with an equal/lower-priority state needs a short stable sample.
 */
export class FlightWarningTracker {
  private currentValue: WarningState = NONE_WARNING
  private pendingText: string | null = null
  private pendingSeconds = 0

  reset(initial: WarningState = NONE_WARNING): void {
    this.currentValue = initial
    this.pendingText = null
    this.pendingSeconds = 0
  }

  update(candidate: WarningState, dt: number): WarningState {
    if (candidate.text === this.currentValue.text && candidate.level === this.currentValue.level) {
      this.clearPending()
      return this.currentValue
    }

    if (warningPriority(candidate) > warningPriority(this.currentValue)) {
      this.currentValue = candidate
      this.clearPending()
      return this.currentValue
    }

    if (candidate.text !== this.pendingText) {
      this.pendingText = candidate.text
      this.pendingSeconds = 0
    }
    this.pendingSeconds += Number.isFinite(dt) ? Math.max(0, Math.min(.5, dt)) : 0
    const hold = candidate.text === null ? WARNING_CLEAR_HOLD_SEC : WARNING_SWITCH_HOLD_SEC
    if (this.pendingSeconds < hold) return this.currentValue

    this.currentValue = candidate
    this.clearPending()
    return this.currentValue
  }

  get state(): WarningState {
    return this.currentValue
  }

  private clearPending(): void {
    this.pendingText = null
    this.pendingSeconds = 0
  }
}

function warningPriority(state: WarningState): number {
  if (state.level === 'warning') return 2
  if (state.level === 'caution') return 1
  return 0
}

/**
 * Arcade flight cautions: stall, obstacle, approach gear, flare, go-around, overspeed, and fuel.
 */
export function evaluateWarnings(
  aircraft: Aircraft,
  altAgl: number,
  obstacleSampler: ((x: number, y: number, z: number) => boolean) | null = null,
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
  const gear = gearWarningActive(
    altAgl,
    speed,
    aircraft.velocity.y,
    aircraft.controls.gearDown,
  )
  const flare = flareWarningActive(
    altAgl,
    speed,
    aircraft.velocity.y,
    aircraft.controls.gearDown,
  )
  const goAround = goAroundWarningActive(
    altAgl,
    speed,
    aircraft.velocity.y,
    aircraft.controls.gearDown,
  )
  // Obstacle lookahead uses horizontal velocity. Most
  // HUD ticks are below the obstacle lookahead floor, so reject those with a
  // squared gate and pay for the square root only when a probe can run.
  const horizontalSpeedSq = aircraft.velocity.x ** 2 + aircraft.velocity.z ** 2
  const horizontalSpeed = horizontalSpeedSq >= OBSTACLE_LOOKAHEAD_MIN_SPEED_SQ
    ? Math.hypot(aircraft.velocity.x, aircraft.velocity.z)
    : 0
  let obstacle = false
  if (obstacleSampler && obstacleLookaheadWarningActive(altAgl, speed)) {
    if (horizontalSpeed >= 60) {
      const invHorizontalSpeed = 1 / horizontalSpeed
      const dirX = aircraft.velocity.x * invHorizontalSpeed
      const dirZ = aircraft.velocity.z * invHorizontalSpeed
      const lookaheadDistance = MathUtils.clamp(horizontalSpeed * 1.1, 90, 420)
      for (const fraction of OBSTACLE_LOOKAHEAD_FRACTIONS) {
        const distance = lookaheadDistance * fraction
        const secondsAhead = distance / horizontalSpeed
        const y = aircraft.position.y + aircraft.velocity.y * secondsAhead
        if (obstacleSampler(
          aircraft.position.x + dirX * distance,
          y,
          aircraft.position.z + dirZ * distance,
        )) {
          obstacle = true
          break
        }
      }
    }
  }
  const overspeed = overspeedWarningActive(speed)
  const fuelLevel = fuelWarningLevel(aircraft.fuel)

  if (stall) return STALL_WARNING
  if (obstacle) return OBSTACLE_WARNING
  if (gear) return GEAR_WARNING
  if (goAround) return GO_AROUND_WARNING
  if (flare) return FLARE_WARNING
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

/** Cue the final flare window on a configured approach. */
export function flareWarningActive(
  altAgl: number,
  speed: number,
  verticalSpeed: number,
  gearDown: boolean,
): boolean {
  if (!gearDown || !Number.isFinite(altAgl) || !Number.isFinite(speed) || !Number.isFinite(verticalSpeed)) {
    return false
  }
  const safeAlt = Math.max(0, altAgl)
  const safeSpeed = Math.max(0, speed)
  return safeAlt > 1.5 && safeAlt <= 14 &&
    safeSpeed >= 38 && safeSpeed <= C.maxLandingSpeed &&
    verticalSpeed < -0.8 && verticalSpeed > -7.5
}

/** Flag an unstable low approach before it turns into a hard touchdown. */
export function goAroundWarningActive(
  altAgl: number,
  speed: number,
  verticalSpeed: number,
  gearDown: boolean,
): boolean {
  if (!gearDown || !Number.isFinite(altAgl) || !Number.isFinite(speed) || !Number.isFinite(verticalSpeed)) {
    return false
  }
  const safeAlt = Math.max(0, altAgl)
  const safeSpeed = Math.max(0, speed)
  if (safeAlt <= 1.5 || safeAlt > 28) return false
  // Cover the end of the flare envelope without a silent sink-rate gap.
  const fastSink = verticalSpeed <= -7.5 && safeSpeed >= 34
  const deepStall = safeSpeed < 34 && safeAlt > 4
  // A configured descending approach over the contact-speed limit must not
  // receive FLARE or stay silent. Climbing takeoffs remain quiet.
  const tooFast = safeSpeed > C.maxLandingSpeed && verticalSpeed < -.8
  return fastSink || deepStall || tooFast
}

/** Warn only after the jet leaves the dry displayed airspeed envelope. */
export function overspeedWarningActive(speed: number): boolean {
  return Number.isFinite(speed) && speed > C.maxSpeed
}

/**
 * Gate the optional world-object lookahead to airborne, fast enough flight.
 * The sampler already checks the padded collision envelope, so keeping the
 * altitude guard here prevents city-scale probes from becoming a low-speed
 * taxi alarm while preserving a generous warning band for tall structures.
 */
export function obstacleLookaheadWarningActive(altAgl: number, speed: number): boolean {
  if (!Number.isFinite(altAgl) || !Number.isFinite(speed)) return false
  return Math.max(0, altAgl) <= 360 && Math.max(0, speed) >= 60
}
