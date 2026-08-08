import { flightConfig } from '../aircraft/flightConfig'

/**
 * Single source of truth for terrain height and aircraft contact height.
 *
 * Phase 2 world is a flat plane at y = 0 (runway asphalt sits on this plane).
 * Later: sample heightmap / raycast here without changing callers.
 */

/** World ground surface Y at horizontal position (flat 0 for now). */
export function sampleGroundHeight(_x: number, _z: number): number {
  return 0
}

/** Gear or belly clearance above the surface (meters). */
export function undercarriageClearance(gearDown: boolean): number {
  return gearDown ? flightConfig.gearHeight : flightConfig.bellyHeight
}

/**
 * Minimum aircraft origin Y for soft contact (surface + gear/belly).
 * Aircraft position.y should not go below this when on the ground.
 */
export function contactMinY(x: number, z: number, gearDown: boolean): number {
  return sampleGroundHeight(x, z) + undercarriageClearance(gearDown)
}

/** Camera floor Y so the lens does not clip through the ground. */
export function cameraMinY(x: number, z: number, clearance = 1.15): number {
  return sampleGroundHeight(x, z) + clearance
}

/**
 * AGL-style altitude for HUD: height of aircraft above local ground,
 * minus typical gear height so runway reads ~0 m when parked.
 */
export function altitudeAgl(x: number, y: number, z: number): number {
  return Math.max(0, y - sampleGroundHeight(x, z) - flightConfig.gearHeight)
}
