import { Vector3 } from 'three'
import { flightConfig } from '../aircraft/flightConfig'
import {
  sampleTerrainSurface,
  type TerrainSurface,
} from './terrainSample'

/**
 * Optional sampler that returns the *rendered* heightfield (chunk triangle
 * interpolation). Contact, AGL, and cameras use this when a tile exists so
 * physics cannot float above or sink through visible triangles. Kind / biome
 * still come from the procedural surface.
 */
export type MeshHeightSampler = (x: number, z: number) => number | null

let meshHeightSampler: MeshHeightSampler | null = null

export function setContactHeightSampler(sampler: MeshHeightSampler | null): void {
  meshHeightSampler = sampler
}

/**
 * Single source of truth for terrain height and aircraft contact height.
 * Near the aircraft this is the visible chunk mesh; elsewhere it is the
 * same procedural surface used to build tiles.
 */

/** World ground surface Y at horizontal position (infinite heightfield). */
export function sampleGroundHeight(x: number, z: number): number {
  return sampleGroundSurface(x, z).height
}

/** Procedural kind/biome, with height overridden by the visible mesh when present. */
export function sampleGroundSurface(x: number, z: number): TerrainSurface {
  const surface = sampleTerrainSurface(x, z)
  const meshH = meshHeightSampler?.(x, z)
  if (meshH == null || !Number.isFinite(meshH)) return surface
  if (meshH === surface.height) return surface
  return { height: meshH, kind: surface.kind, biome: surface.biome }
}

/**
 * Up-facing surface normal, sampled from the resolved contact heightfield.
 * Pass a target in hot paths to avoid allocating a Vector3 every query.
 */
export function sampleGroundNormal(
  x: number,
  z: number,
  sampleDistance = 2,
  target = new Vector3(),
): Vector3 {
  const d = Math.max(0.05, sampleDistance)
  const dx = sampleGroundHeight(x + d, z) - sampleGroundHeight(x - d, z)
  const dz = sampleGroundHeight(x, z + d) - sampleGroundHeight(x, z - d)
  return target.set(-dx, d * 2, -dz).normalize()
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
