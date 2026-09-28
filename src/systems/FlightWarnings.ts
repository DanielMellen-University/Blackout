import { MathUtils, Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig as C } from '../aircraft/flightConfig'
import { fuelWarningLevel } from '../aircraft/FuelSystem'
import { sampleGroundHeight, undercarriageClearance } from '../world/ground'

export type WarningLevel = 'none' | 'caution' | 'warning'

/** Event cue selected when a warning state first becomes visible. */
export type WarningCue = 'warning' | 'pull-up' | 'obstacle' | 'overspeed' | 'stall' | 'gear-warning' | null

/** Keep threshold warnings readable without delaying an urgent escalation. */
export const WARNING_CLEAR_HOLD_SEC = 0.22
export const WARNING_SWITCH_HOLD_SEC = 0.12

export interface WarningState {
  /** Highest-priority active warning label, or null. */
  text: string | null
  level: WarningLevel
  /** Individual flags for HUD styling / future audio. */
  stall: boolean
  lowAlt: boolean
  gear: boolean
  flare: boolean
  goAround: boolean
  overspeed: boolean
  fuel: boolean
  terrainClosure: boolean
  obstacle: boolean
}

/**
 * Keep warning audio specific without making the render loop understand every
 * predicate. The tracker still controls cadence, so this is called only when
 * the visible warning label changes.
 */
export function warningCueForState(state: WarningState): WarningCue {
  if (!state.text) return null
  if (state.terrainClosure) return 'pull-up'
  if (state.obstacle) return 'obstacle'
  if (state.stall) return 'stall'
  if (state.gear) return 'gear-warning'
  if (state.overspeed) return 'overspeed'
  return 'warning'
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
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
  obstacle: false,
}) as WarningState
const STALL_WARNING = Object.freeze({
  text: 'STALL',
  level: 'warning',
  stall: true,
  lowAlt: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
  obstacle: false,
}) as WarningState
const LOW_ALT_WARNING = Object.freeze({
  text: 'LOW ALT',
  level: 'caution',
  stall: false,
  lowAlt: true,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
  obstacle: false,
}) as WarningState
const GEAR_WARNING = Object.freeze({
  text: 'GEAR',
  level: 'caution',
  stall: false,
  lowAlt: false,
  gear: true,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
  obstacle: false,
}) as WarningState
const OVERSPEED_WARNING = Object.freeze({
  text: 'OVERSPEED',
  level: 'caution',
  stall: false,
  lowAlt: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: true,
  fuel: false,
  terrainClosure: false,
  obstacle: false,
}) as WarningState
const FUEL_LOW_WARNING = Object.freeze({
  text: 'FUEL LOW',
  level: 'caution',
  stall: false,
  lowAlt: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: true,
  terrainClosure: false,
  obstacle: false,
}) as WarningState
const FUEL_EMPTY_WARNING = Object.freeze({
  text: 'FUEL EMPTY',
  level: 'warning',
  stall: false,
  lowAlt: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: true,
  terrainClosure: false,
  obstacle: false,
}) as WarningState

const TERRAIN_CLOSURE_WARNING = Object.freeze({
  text: 'PULL UP',
  level: 'warning',
  stall: false,
  lowAlt: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  terrainClosure: true,
  obstacle: false,
}) as WarningState
const OBSTACLE_WARNING = Object.freeze({
  text: 'OBSTACLE',
  level: 'warning',
  stall: false,
  lowAlt: false,
  gear: false,
  flare: false,
  goAround: false,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
  obstacle: true,
}) as WarningState
const FLARE_WARNING = Object.freeze({
  text: 'FLARE',
  level: 'caution',
  stall: false,
  lowAlt: false,
  gear: false,
  flare: true,
  goAround: false,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
  obstacle: false,
}) as WarningState
const GO_AROUND_WARNING = Object.freeze({
  text: 'GO AROUND',
  level: 'warning',
  stall: false,
  lowAlt: false,
  gear: false,
  flare: false,
  goAround: true,
  overspeed: false,
  fuel: false,
  terrainClosure: false,
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
 * Arcade flight cautions: stall, speed-scaled low altitude, approach gear, flare, and go-around.
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
  let terrainClosure = terrainClosureWarningActive(
    altAgl,
    speed,
    aircraft.velocity.y,
  )
  if (!terrainClosure) {
    const horizontalSpeed = Math.hypot(aircraft.velocity.x, aircraft.velocity.z)
    if (horizontalSpeed >= 84) {
      const groundNow = sampleGroundHeight(aircraft.position.x, aircraft.position.z)
      if (Number.isFinite(groundNow)) {
        const invHorizontalSpeed = 1 / horizontalSpeed
        const dirX = aircraft.velocity.x * invHorizontalSpeed
        const dirZ = aircraft.velocity.z * invHorizontalSpeed
        const lookaheadDistance = MathUtils.clamp(horizontalSpeed * 1.2, 120, 640)
        const nearDistance = lookaheadDistance * .5
        const nearGround = sampleGroundHeight(
          aircraft.position.x + dirX * nearDistance,
          aircraft.position.z + dirZ * nearDistance,
        )
        const farGround = sampleGroundHeight(
          aircraft.position.x + dirX * lookaheadDistance,
          aircraft.position.z + dirZ * lookaheadDistance,
        )
        const aheadRise = Math.max(
          0,
          Number.isFinite(nearGround) ? nearGround - groundNow : 0,
          Number.isFinite(farGround) ? farGround - groundNow : 0,
        )
        const currentSurfaceClearance = Math.max(
          0,
          aircraft.position.y - groundNow - undercarriageClearance(aircraft.controls.gearDown),
        )
        terrainClosure = terrainLookaheadWarningActive(
          Math.min(Number.isFinite(altAgl) ? Math.max(0, altAgl) : 0, currentSurfaceClearance),
          speed,
          aircraft.velocity.y,
          aheadRise,
          lookaheadDistance,
        )
      }
    }
  }
  let obstacle = false
  if (obstacleSampler && obstacleLookaheadWarningActive(altAgl, speed)) {
    const horizontalSpeed = Math.hypot(aircraft.velocity.x, aircraft.velocity.z)
    if (horizontalSpeed >= 60) {
      const invHorizontalSpeed = 1 / horizontalSpeed
      const dirX = aircraft.velocity.x * invHorizontalSpeed
      const dirZ = aircraft.velocity.z * invHorizontalSpeed
      const lookaheadDistance = MathUtils.clamp(horizontalSpeed * 1.1, 90, 420)
      const nearDistance = lookaheadDistance * .35
      const midDistance = lookaheadDistance * .68
      const farDistance = lookaheadDistance
      const probe = (distance: number): boolean => {
        const secondsAhead = distance / horizontalSpeed
        const y = aircraft.position.y + aircraft.velocity.y * secondsAhead
        return obstacleSampler(
          aircraft.position.x + dirX * distance,
          y,
          aircraft.position.z + dirZ * distance,
        )
      }
      obstacle = probe(nearDistance) || probe(midDistance) || probe(farDistance)
    }
  }
  const overspeed = overspeedWarningActive(speed)
  const fuelLevel = fuelWarningLevel(aircraft.fuel)

  if (stall) return STALL_WARNING
  if (terrainClosure) return TERRAIN_CLOSURE_WARNING
  if (obstacle) return OBSTACLE_WARNING
  if (gear) return GEAR_WARNING
  if (goAround) return GO_AROUND_WARNING
  if (flare) return FLARE_WARNING
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

/** Cue the final flare window instead of letting the low-altitude caution spam. */
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
    safeSpeed >= 38 && safeSpeed <= 78 &&
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
  const fastSink = verticalSpeed < -8.5 && safeSpeed >= 34
  const deepStall = safeSpeed < 34 && safeAlt > 4
  return fastSink || deepStall
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

/**
 * Predict a ridge closure along the actual horizontal velocity vector. The
 * caller supplies a bounded near/far terrain rise so the warning path stays
 * scalar and cheap at the HUD cadence instead of running during every physics
 * step. A small positive climb is allowed to clear a shoulder; steep terrain
 * still wins when the predicted clearance is below the speed-scaled margin.
 */
export function terrainLookaheadWarningActive(
  altAgl: number,
  speed: number,
  verticalSpeed: number,
  aheadTerrainRise: number,
  aheadDistance: number,
): boolean {
  if (
    !Number.isFinite(altAgl) ||
    !Number.isFinite(speed) ||
    !Number.isFinite(verticalSpeed) ||
    !Number.isFinite(aheadTerrainRise) ||
    !Number.isFinite(aheadDistance)
  ) return false
  const safeAlt = Math.max(0, altAgl)
  const safeSpeed = Math.max(0, speed)
  const safeRise = Math.max(0, aheadTerrainRise)
  const safeDistance = Math.max(1, aheadDistance)
  if (safeAlt <= 2 || safeSpeed < 84 || safeRise < 20) return false
  const secondsAhead = safeDistance / safeSpeed
  const predictedClearance = safeAlt + verticalSpeed * secondsAhead - safeRise
  const safetyMargin = MathUtils.clamp(safeSpeed * .12, 18, 96)
  // Positive climb is not a free pass: only suppress the cue when the
  // projected flight path actually clears the ridge by the speed-scaled
  // margin. A shallow climb toward a tall shoulder still needs PULL UP.
  return predictedClearance <= safetyMargin
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
