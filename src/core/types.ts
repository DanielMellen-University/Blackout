/** Normalized control axes in [-1, 1] (throttle is 0-1). */
export interface ControlState {
  /** Pitch stick: +W = nose up, -S = nose down. */
  pitch: number
  /** Roll stick: +Q = roll right, -E = roll left. */
  roll: number
  /** Yaw / rudder: +A = yaw right, -D = yaw left. */
  yaw: number
  /** 0-1 throttle. Shift raises, Ctrl/1 lowers. */
  throttle: number
  gearDown: boolean
  /** Afterburner / thrust boost (Space). */
  boost: boolean
  /** Speed brake / drag panels (B while held). */
  airbrake: boolean
  /** Gentle pitch and bank trim when the pilot releases those axes. */
  stabilityAssist: boolean
}

/** The flight views toggled by C - see CameraSystem. */
export type CameraMode = 'chase' | 'orbit' | 'cockpit'

export const CAMERA_MODES: readonly CameraMode[] = [
  'chase',
  'orbit',
  'cockpit',
] as const

export const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  chase: 'external',
  orbit: 'orbit',
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
    airbrake: false,
    stabilityAssist: false,
  }
}
