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

/** The two flight views toggled by C - see CameraSystem. */
export type CameraMode = 'chase' | 'cockpit'

export const CAMERA_MODES: readonly CameraMode[] = [
  'chase',
  'cockpit',
] as const

export const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  chase: 'external',
  cockpit: 'cockpit',
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
