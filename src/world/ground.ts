import { Vector3 } from 'three'
import { flightConfig } from '../aircraft/flightConfig'
import {
  sampleTerrainSurface,
  sampleTerrainSurfaceInto,
  sampleTerrainSurfaceHeightFast,
  type TerrainSurfaceKind,
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
export interface GroundSurfaceSample {
  height: number
  kind: TerrainSurfaceKind
}
export type GroundSurfaceSampler = (
  x: number,
  z: number,
  out: GroundSurfaceSample,
) => boolean

let meshHeightSampler: MeshHeightSampler | null = null
let groundHeightSampler: GroundHeightSampler | null = null
let groundSurfaceSampler: GroundSurfaceSampler | null = null
let samplerRevision = 0

interface GroundHeightCacheEntry {
  x: number
  z: number
  height: number
}

/**
 * Small caller-owned cache for repeated height probes during one update.
 *
 * The cache deliberately has no world-lifetime state: terrain tiles can be
 * replaced underneath a moving camera, so callers should clear it at the
 * start of each simulation/render solve. The sampler revision is a second
 * guard for tests, reseeds, and world disposal.
 */
export interface GroundHeightCache {
  readonly entries: GroundHeightCacheEntry[]
  cursor: number
  revision: number
}

export function createGroundHeightCache(capacity = 8): GroundHeightCache {
  const safeCapacity = Math.max(1, Math.min(32, Math.floor(Number.isFinite(capacity) ? capacity : 8)))
  const entries: GroundHeightCacheEntry[] = []
  for (let i = 0; i < safeCapacity; i++) entries.push({ x: 0, z: 0, height: 0 })
  return { entries, cursor: 0, revision: samplerRevision }
}

export function clearGroundHeightCache(cache: GroundHeightCache): void {
  cache.cursor = 0
  cache.revision = samplerRevision
  for (const entry of cache.entries) {
    entry.x = Number.NaN
    entry.z = Number.NaN
  }
}

export function setContactHeightSampler(sampler: MeshHeightSampler | null): void {
  meshHeightSampler = sampler
  samplerRevision++
  // The dedicated height callback belongs to the same streamed terrain
  // lifetime. Clearing the contact sampler must not leave a disposed world
  // feeding stale heights to AGL, camera, or effect queries.
  groundHeightSampler = null
  groundSurfaceSampler = null
}

/** Register the allocation-free height path used by hot queries. */
export function setGroundHeightSampler(sampler: GroundHeightSampler | null): void {
  groundHeightSampler = sampler
  samplerRevision++
}

/** Register the caller-owned surface path used by collision hot loops. */
export function setGroundSurfaceSampler(sampler: GroundSurfaceSampler | null): void {
  groundSurfaceSampler = sampler
  samplerRevision++
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
  return sampleTerrainSurfaceHeightFast(x, z)
}

/**
 * Height probe backed by a tiny caller-owned cache. This is intended for
 * camera/physics solves that may ask for the exact same coordinate more than
 * once in a frame. Non-finite coordinates bypass the cache entirely.
 */
export function sampleGroundHeightCached(
  x: number,
  z: number,
  cache: GroundHeightCache,
): number {
  if (cache.revision !== samplerRevision) clearGroundHeightCache(cache)
  if (!Number.isFinite(x) || !Number.isFinite(z)) return sampleGroundHeight(x, z)
  for (const entry of cache.entries) {
    if (entry.x === x && entry.z === z) return entry.height
  }
  const height = sampleGroundHeight(x, z)
  if (!Number.isFinite(height)) return height
  const entry = cache.entries[cache.cursor]!
  entry.x = x
  entry.z = z
  entry.height = height
  cache.cursor = (cache.cursor + 1) % cache.entries.length
  return height
}

/** Camera floor probe using the same frame-scoped height cache. */
export function cameraMinYCached(
  x: number,
  z: number,
  clearance: number,
  cache: GroundHeightCache,
): number {
  return sampleGroundHeightCached(x, z, cache) + clearance
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
 * Fill a caller-owned height/kind record without allocating on loaded tiles.
 * Rich biome metadata remains available through sampleGroundSurface().
 */
export function sampleGroundSurfaceInto(
  x: number,
  z: number,
  out: GroundSurfaceSample,
): GroundSurfaceSample {
  if (groundSurfaceSampler?.(x, z, out) === true && Number.isFinite(out.height)) {
    out.kind = out.kind === 'water' ? 'water' : 'land'
    return out
  }
  const sampled = meshHeightSampler?.(x, z)
  if (sampled == null || (typeof sampled === 'number' && !Number.isFinite(sampled))) {
    sampleTerrainSurfaceInto(out, x, z)
    return out
  }
  if (typeof sampled !== 'number') {
    out.height = sampled.height
    out.kind = sampled.kind === 'water' ? 'water' : 'land'
    return out
  }
  const surface = sampleGroundSurface(x, z)
  out.height = sampled
  out.kind = surface.kind
  return out
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
