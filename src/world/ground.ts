import { flightConfig } from '../aircraft/flightConfig'
import { sampleTerrainHeight } from './terrainSample'

/**
 * Single source of truth for terrain height and aircraft contact height.
 * Height comes from the same pure function used to build streaming chunks.
 */

/** World ground surface Y at horizontal position (infinite heightfield). */
export function sampleGroundHeight(x: number, z: number): number {
  const h = sampleTerrainHeight(x, z)
  // Treat open ocean as a flat sea surface for contact / AGL
  return h < 0 ? 0 : h
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
 * Radio altitude: gap between wheels/belly and the terrain under the jet.
 * Parked on the strip this reads 0. Over a ridge or valley it tracks that surface.
 */
export function altitudeAgl(
  x: number,
  y: number,
  z: number,
  gearDown = true,
): number {
  return Math.max(0, y - contactMinY(x, z, gearDown))
}
