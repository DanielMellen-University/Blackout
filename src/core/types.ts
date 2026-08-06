/** Normalized control axes in [-1, 1] (throttle is 0–1). */
export interface ControlState {
  /**
   * Phase 0 free-fly: forward/back (W/S).
   * Phase 1+: pitch stick.
   */
  pitch: number
  /**
   * Phase 0 free-fly: yaw turn (A/D).
   * Phase 1+: roll stick.
   */
  roll: number
  /**
   * Phase 0 free-fly: vertical (E/Q).
   * Phase 1+: yaw stick / rudder.
   */
  yaw: number
  /** 0–1. Free-fly speed scale; later real throttle. */
  throttle: number
  gearDown: boolean
  boost: boolean
}

/** Cycle order for the C key — see CameraSystem. */
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
    throttle: 0.35,
    gearDown: true,
    boost: false,
  }
}
