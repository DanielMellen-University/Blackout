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
  /** Commanded arcade airspeed in m/s. */
  targetSpeed: number
  /** Current engine-limited top speed in m/s. */
  maxSpeed: number
  /** Positive speed-seek acceleration limit in m/s². */
  maxAcceleration: number
  /** Normalized engine output for feedback systems. */
  effectivePower: number
}

export function createEngineState(): EngineState {
  return {
    lever: 0,
    afterburnerRequested: false,
    afterburnerActive: false,
    targetSpeed: 0,
    maxSpeed: C.maxSpeed,
    maxAcceleration: C.maxAccel,
    effectivePower: 0,
  }
}

/** Resolve controls once so thrust, visuals, audio, and HUD can agree. */
export function resolveEngineState(
  controls: Pick<ControlState, 'throttle' | 'boost'>,
  out: EngineState,
): EngineState {
  const lever = MathUtils.clamp(controls.throttle, 0, 1)
  const afterburnerRequested = controls.boost
  const afterburnerActive = afterburnerRequested && lever >= C.afterburnerMinThrottle
  const maxSpeed = afterburnerActive ? C.maxSpeedBoost : C.maxSpeed

  out.lever = lever
  out.afterburnerRequested = afterburnerRequested
  out.afterburnerActive = afterburnerActive
  // ENG remains a speed command. Afterburner raises the available envelope,
  // but it no longer bypasses a low or closed throttle lever.
  out.targetSpeed = lever * maxSpeed
  out.maxSpeed = maxSpeed
  out.maxAcceleration = afterburnerActive
    ? MathUtils.lerp(C.maxAccel, C.maxAccelBoost, lever)
    : C.maxAccel
  out.effectivePower = afterburnerActive
    ? MathUtils.lerp(0.82, 1, lever)
    : lever * 0.78
  return out
}
