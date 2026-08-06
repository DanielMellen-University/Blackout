import type { Quaternion, Vector3 } from 'three'

/** Normalized aircraft control axes in [-1, 1] (except throttle 0–1). */
export interface ControlState {
  pitch: number
  roll: number
  yaw: number
  /** Throttle 0–1. Phase 0 uses this as a speed multiplier for free-fly. */
  throttle: number
  gearDown: boolean
  boost: boolean
}

export interface AircraftState {
  position: Vector3
  velocity: Vector3
  orientation: Quaternion
  angularVelocity: Vector3
  controls: ControlState
  mass: number
}

export type CameraMode = 'orbit' | 'follow'

export function createDefaultControls(): ControlState {
  return {
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttle: 0.35,
    gearDown: true,
    boost: false,
  }
}
