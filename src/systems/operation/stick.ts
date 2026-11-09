/** Stick and rudder for one ridge-relay step. Axes are -1..1. Throttle is 0..1. */
export interface OperationStick {
  pitch: number
  roll: number
  yaw: number
  throttle: number
  boost: boolean
  airbrake: boolean
}

function axis(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value!))
}

function clamp01(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value!))
}

export function neutralOperationStick(throttle = 0.5): OperationStick {
  return {
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttle: clamp01(throttle),
    boost: false,
    airbrake: false,
  }
}

/** Keep a player or a test command inside the aircraft control range. */
export function clampOperationStick(value: Partial<OperationStick> | null | undefined): OperationStick {
  return {
    pitch: axis(value?.pitch),
    roll: axis(value?.roll),
    yaw: axis(value?.yaw),
    throttle: clamp01(value?.throttle),
    boost: value?.boost === true,
    airbrake: value?.airbrake === true,
  }
}
