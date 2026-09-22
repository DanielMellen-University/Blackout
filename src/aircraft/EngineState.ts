import { MathUtils } from 'three'
import type { ControlState } from '../core/types'
import { flightConfig as C } from './flightConfig'

/**
 * The resolved engine command shared by flight physics and aircraft visuals.
 * `afterburnerActive` is the authoritative activation flag for other systems.
 */
export interface EngineState {
  /** Pilot throttle lever, clamped to 0..1. */
  lever: number
  afterburnerRequested: boolean
  afterburnerActive: boolean
  /** Heat protection lockout state, while dry thrust remains available. */
  afterburnerHeatLocked: boolean
  /** Level-flight equilibrium for this lever, m/s. Not a speed hold. */
  targetSpeed: number
  /** Dive cap in m/s. */
  maxSpeed: number
  /** Thrust acceleration available at this lever, m/s². */
  maxAcceleration: number
  /** Normalized engine output for feedback systems. */
  effectivePower: number
  /** Whether the tank still has usable fuel for engine thrust. */
  fuelAvailable: boolean
}

export function createEngineState(): EngineState {
  return {
    lever: 0,
    afterburnerRequested: false,
    afterburnerActive: false,
    afterburnerHeatLocked: false,
    targetSpeed: 0,
    maxSpeed: C.maxSpeed,
    maxAcceleration: C.maxAccel,
    effectivePower: 0,
    fuelAvailable: true,
  }
}

/** Resolve controls once so thrust, visuals, audio, and HUD can agree. */
export function resolveEngineState(
  controls: Pick<ControlState, 'throttle' | 'boost'>,
  out: EngineState,
  fuelFraction = 1,
  afterburnerHeatLocked = false,
): EngineState {
  const lever = Number.isFinite(controls.throttle)
    ? MathUtils.clamp(controls.throttle, 0, 1)
    : 0
  const safeFuel = Number.isFinite(fuelFraction) ? MathUtils.clamp(fuelFraction, 0, 1) : 0
  const fuelAvailable = safeFuel > 0.0001
  const afterburnerRequested = controls.boost === true
  // Heat and the fuel-reserve lock are retired. Burner stays available until the tank is empty.
  const afterburnerActive = fuelAvailable &&
    afterburnerRequested &&
    lever >= C.afterburnerMinThrottle
  const cruise = afterburnerActive ? C.cruiseSpeedBoost : C.cruiseSpeed
  const thrustMul = afterburnerActive ? (C.cruiseSpeedBoost / C.cruiseSpeed) ** 2 : 1

  out.lever = lever
  out.afterburnerRequested = afterburnerRequested
  out.afterburnerActive = afterburnerActive
  out.afterburnerHeatLocked = false
  void afterburnerHeatLocked
  // Equilibrium of thrust against quadratic drag. The flight model does not chase it.
  out.targetSpeed = fuelAvailable ? Math.sqrt(lever) * cruise : 0
  out.maxSpeed = C.maxSpeed
  out.maxAcceleration = fuelAvailable ? C.milAccel * lever * thrustMul : 0
  out.effectivePower = afterburnerActive
    ? MathUtils.lerp(0.82, 1, lever)
    : fuelAvailable ? lever * 0.78 : 0
  out.fuelAvailable = fuelAvailable
  return out
}
