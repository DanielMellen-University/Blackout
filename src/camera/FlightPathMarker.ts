import { PerspectiveCamera, Vector3 } from 'three'

/** Screen-space placement for the HUD velocity-vector cue. */
export interface FlightPathMarkerPosition {
  x: number
  y: number
  visible: boolean
}

/**
 * Show the velocity-vector cue once external flight has enough airspeed to
 * make drift useful, while keeping the existing cockpit cue available during
 * the takeoff roll.
 */
export function shouldShowFlightPathMarker(
  cockpit: boolean,
  onGround: boolean,
  speed: number,
): boolean {
  if (cockpit) return true
  return !onGround && Number.isFinite(speed) && speed >= 60
}

const _point = new Vector3()

/**
 * Project the aircraft's velocity direction into the active camera.
 *
 * The marker stays useful at high speed by looking a short, bounded distance
 * ahead of the lens. It clamps to the HUD edge when the vector leaves the
 * view, but disappears when the direction points behind the camera or the jet
 * is effectively stationary.
 */
export function writeFlightPathMarker(
  camera: PerspectiveCamera,
  origin: Vector3,
  velocity: Vector3,
  out: FlightPathMarkerPosition,
): void {
  const speedSq = velocity.lengthSq()
  if (!Number.isFinite(speedSq) || speedSq < 100) {
    out.visible = false
    return
  }

  const speed = Math.sqrt(speedSq)
  const lead = Math.max(50, Math.min(140, speed * 0.12))
  _point.copy(origin).addScaledVector(velocity, lead / speed)
  _point.project(camera)

  if (
    !Number.isFinite(_point.x) ||
    !Number.isFinite(_point.y) ||
    !Number.isFinite(_point.z) ||
    _point.z < -1 ||
    _point.z > 1
  ) {
    out.visible = false
    return
  }

  // Keep the symbol inside the readable portion of the HUD while preserving
  // the direction when the velocity vector runs off-screen.
  out.x = clamp((_point.x * 0.5 + 0.5) * 100, 6, 94)
  out.y = clamp((-_point.y * 0.5 + 0.5) * 100, 6, 94)
  out.visible = true
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
