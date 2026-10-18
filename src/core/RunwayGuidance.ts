/** Near-threshold PAPI placement, in runway-local metres (+Z is inbound). */
export const RUNWAY_PAPI_X = -13.5
export const RUNWAY_PAPI_Z = -38

export type RunwayGlideCue = 'high' | 'on-slope' | 'low'
export interface RunwayApproach {
  height: number
  distance: number
  inApproach: boolean
}
interface Position { x: number; y: number; z: number }

/** Number of white lenses. Invalid inputs retain the neutral light pattern. */
export function papiLightPattern(height: number, distance: number): number {
  if (!Number.isFinite(height) || !Number.isFinite(distance)) return 2
  const angleDeg = Math.atan2(Math.max(0, height), Math.max(1, distance)) * 180 / Math.PI
  if (angleDeg >= 3.5) return 4
  if (angleDeg >= 3) return 3
  if (angleDeg >= 2.5) return 2
  if (angleDeg >= 1.8) return 1
  return 0
}

/** The HUD agrees with the lights: two white/two red is the 2.5–3° window. */
export function runwayGlideCue(height: number, distance: number): RunwayGlideCue | null {
  if (!Number.isFinite(height) || !Number.isFinite(distance)) return null
  const pattern = papiLightPattern(height, distance)
  return pattern > 2 ? 'high' : pattern < 2 ? 'low' : 'on-slope'
}

/** Caller-owned output; no square root for distant fly-bys or opposite-end flight. */
export function writeRunwayApproach(
  out: RunwayApproach,
  aircraft: Position,
  runway: Position,
  yaw: number,
): void {
  out.height = 0
  out.distance = 0
  out.inApproach = false
  const dx = aircraft.x - runway.x
  const dz = aircraft.z - runway.z
  const height = aircraft.y - runway.y
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(height) || !Number.isFinite(yaw)) return
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const along = RUNWAY_PAPI_Z - (s * dx + c * dz)
  const lateral = c * dx - s * dz - RUNWAY_PAPI_X
  // PAPI faces the near (-Z) threshold, not the spawn point or runway centre.
  if (!(along > 8 && along < 1200 && Math.abs(lateral) < 100)) return
  out.height = height
  out.distance = Math.hypot(along, lateral)
  out.inApproach = true
}

/** Hide glide advice on rollout, departures and crossings, even inside the corridor. */
export function landingGlideCue(
  approach: RunwayApproach,
  heading: number,
  velocityX: number,
  velocityZ: number,
  runwayYaw: number,
  onGround: boolean,
): RunwayGlideCue | null {
  if (onGround || !approach.inApproach || !Number.isFinite(heading) ||
    !Number.isFinite(velocityX) || !Number.isFinite(velocityZ) || !Number.isFinite(runwayYaw)) return null
  // Final-approach advice needs both nose and track within 30 degrees of inbound.
  // A positive forward component alone also admits almost perpendicular fly-bys.
  // Compare local components to avoid a speed root, retaining crosswind crabs.
  const s = Math.sin(runwayYaw)
  const c = Math.cos(runwayYaw)
  const forwardSpeed = velocityX * s + velocityZ * c
  const lateralSpeed = velocityX * c - velocityZ * s
  // Trig and rotated components can round either way at the inclusive boundary.
  // Scale the track allowance with speed; it is far below a measurable angle.
  const rounding = 8 * Number.EPSILON
  if (!(Math.cos(heading - runwayYaw) >= Math.sqrt(3) / 2 - rounding) ||
    !Number.isFinite(forwardSpeed) || !Number.isFinite(lateralSpeed) || forwardSpeed <= 1e-6 ||
    Math.abs(lateralSpeed) > forwardSpeed * (1 / Math.sqrt(3) + rounding)) return null
  return runwayGlideCue(approach.height, approach.distance)
}
