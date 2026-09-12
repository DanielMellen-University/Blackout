import { Vector3 } from 'three'
import { flightConfig } from '../aircraft/flightConfig'
import {
  sampleTerrainSurface,
  type TerrainSurface,
} from './terrainSample'

/**
 * Optional sampler that returns the *rendered* heightfield (chunk triangle
 * interpolation). Contact, AGL, and cameras use this when a tile exists so
 * physics cannot float above or sink through visible triangles. A full surface
 * result also resolves water contact at the rendered, clipped shoreline.
 */
export type MeshHeightSampler = (x: number, z: number) => number | TerrainSurface | null
export type GroundHeightSampler = (x: number, z: number) => number | null

let meshHeightSampler: MeshHeightSampler | null = null
let groundHeightSampler: GroundHeightSampler | null = null

export function setContactHeightSampler(sampler: MeshHeightSampler | null): void {
  meshHeightSampler = sampler
  // The dedicated height callback belongs to the same streamed terrain
  // lifetime. Clearing the contact sampler must not leave a disposed world
  // feeding stale heights to AGL, camera, or effect queries.
  groundHeightSampler = null
}

/** Register the allocation-free height path used by hot queries. */
export function setGroundHeightSampler(sampler: GroundHeightSampler | null): void {
  groundHeightSampler = sampler
}

/**
 * Single source of truth for terrain height and aircraft contact height.
 * Near the aircraft this is the visible chunk mesh; elsewhere it is the
 * same procedural surface used to build tiles.
 */

/** World ground surface Y at horizontal position (infinite heightfield). */
export function sampleGroundHeight(x: number, z: number): number {
  const height = groundHeightSampler?.(x, z)
  if (height != null && Number.isFinite(height)) return height
  // Preserve the public fallback behavior for callers that only provide the
  // richer contact sampler, including test and tooling integrations.
  const sampled = meshHeightSampler?.(x, z)
  if (typeof sampled === 'number' && Number.isFinite(sampled)) return sampled
  if (sampled != null && typeof sampled !== 'number' && Number.isFinite(sampled.height)) {
    return sampled.height
  }
  // The richer callback has already been sampled above. Fall back directly
  // to the analytic surface instead of invoking it a second time when a
  // streamed tile is not ready.
  return sampleTerrainSurface(x, z).height
}

/** Prefer the visible mesh, falling back to procedural terrain outside loaded tiles. */
export function sampleGroundSurface(x: number, z: number): TerrainSurface {
  const sampled = meshHeightSampler?.(x, z)
  if (sampled != null && typeof sampled !== 'number') return sampled
  const surface = sampleTerrainSurface(x, z)
  const meshH = sampled
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
