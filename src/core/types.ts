/** Normalized control axes in [-1, 1] (throttle is 0-1). */
export interface ControlState {
  /** Pitch stick: +W = nose up, -S = nose down. */
  pitch: number
  /** Roll stick: +Q = roll right, -E = roll left. */
  roll: number
  /** Yaw / rudder: +D = yaw right, -A = yaw left. */
  yaw: number
  /** 0-1 throttle. Shift raises, Ctrl/1 lowers. */
  throttle: number
  gearDown: boolean
  /** Afterburner / thrust boost (Space). */
  boost: boolean
}

/** Cycle order for the C key - see CameraSystem. */
export type CameraMode = 'chase' | 'close' | 'cockpit' | 'wingman' | 'orbit'

export const CAMERA_MODES: readonly CameraMode[] = [
  'chase',
  'close',
  'cockpit',
  'wingman',
  'orbit',
] as const

export const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  chase: 'chase',
  close: 'close chase',
  cockpit: 'cockpit',
  wingman: 'wingman',
  orbit: 'orbit',
}

export function createDefaultControls(): ControlState {
  return {
    pitch: 0,
    roll: 0,
    yaw: 0,
    throttle: 0,
    gearDown: true,
    boost: false,
  }
}
