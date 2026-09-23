import { MathUtils } from 'three'

/**
 * Arcade stick and speed-brake panel targets for the procedural F-35.
 * Throws stay chase-readable; holding B dumps the boards without new meshes.
 */
export function controlSurfaceTargets(
  pitch: number,
  roll: number,
  yaw: number,
  airbrake: boolean,
): {
  flaperonLeftX: number
  flaperonRightX: number
  stabilatorLeftX: number
  stabilatorRightX: number
  rudderY: number
} {
  const p = MathUtils.clamp(Number.isFinite(pitch) ? pitch : 0, -1, 1)
  const r = MathUtils.clamp(Number.isFinite(roll) ? roll : 0, -1, 1)
  const y = MathUtils.clamp(Number.isFinite(yaw) ? yaw : 0, -1, 1)
  const b = airbrake ? 1 : 0
  return {
    flaperonLeftX: -p * 0.28 - r * 0.24 + b * 0.34,
    flaperonRightX: -p * 0.28 + r * 0.24 + b * 0.34,
    stabilatorLeftX: -p * 0.22 - r * 0.12 + b * 0.28,
    stabilatorRightX: -p * 0.22 + r * 0.12 + b * 0.28,
    rudderY: y * 0.22,
  }
}

/**
 * Wingtip vapor for mil-cruise turns: quiet in straight flight, readable when
 * the jet is pulling, without permanent trails at the raised cruise.
 */
export function wingtipVaporIntensity(speed: number, loadFactor: number): number {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
  const safeLoad = Number.isFinite(loadFactor) ? Math.abs(loadFactor) : 1
  const speedT = MathUtils.smoothstep(safeSpeed, 220, 520)
  const loadT = MathUtils.smoothstep(safeLoad, 1.2, 3.2)
  return MathUtils.clamp(speedT * loadT * 0.22, 0, 0.22)
}
