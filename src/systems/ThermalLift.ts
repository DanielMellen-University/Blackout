import { MathUtils } from 'three'

/** World-space spacing between deterministic thermal pockets. */
export const THERMAL_CELL_SIZE_M = 1_800
export const THERMAL_MIN_ALTITUDE_M = 90
export const THERMAL_PEAK_ALTITUDE_M = 420
/** Keep lift useful above tall relief without creating an unbounded force band. */
export const THERMAL_FADE_ALTITUDE_M = 3_600
/** Include diagonal cells so pockets do not disappear at streamed-cell corners. */
export const THERMAL_NEIGHBOUR_RADIUS_CELLS = 1

export interface ThermalPocket {
  readonly cellX: number
  readonly cellZ: number
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly strength: number
}

/** Return the stable pocket geometry used by both the flight field and authored routes. */
export function thermalPocketForCell(
  seed: number,
  cellX: number,
  cellZ: number,
): ThermalPocket | null {
  if (!Number.isFinite(seed) || !Number.isFinite(cellX) || !Number.isFinite(cellZ)) return null
  const safeCellX = Math.trunc(cellX)
  const safeCellZ = Math.trunc(cellZ)
  return {
    cellX: safeCellX,
    cellZ: safeCellZ,
    x: (safeCellX + 0.5 + (thermalHash(seed, safeCellX, safeCellZ, 11) - 0.5) * 0.64) * THERMAL_CELL_SIZE_M,
    z: (safeCellZ + 0.5 + (thermalHash(seed, safeCellX, safeCellZ, 17) - 0.5) * 0.64) * THERMAL_CELL_SIZE_M,
    radius: 360 + thermalHash(seed, safeCellX, safeCellZ, 23) * 220,
    strength: 0.58 + thermalHash(seed, safeCellX, safeCellZ, 29) * 0.42,
  }
}

/** Find the nearest candidate in the same fixed 3x3 neighbourhood sampled in flight. */
export function nearestThermalPocket(
  seed: number,
  x: number,
  z: number,
): ThermalPocket | null {
  if (!Number.isFinite(seed) || !Number.isFinite(x) || !Number.isFinite(z)) return null
  const cellX = Math.floor(x / THERMAL_CELL_SIZE_M)
  const cellZ = Math.floor(z / THERMAL_CELL_SIZE_M)
  let nearest: ThermalPocket | null = null
  let nearestDistanceSquared = Number.POSITIVE_INFINITY
  for (let offsetX = -THERMAL_NEIGHBOUR_RADIUS_CELLS; offsetX <= THERMAL_NEIGHBOUR_RADIUS_CELLS; offsetX += 1) {
    for (let offsetZ = -THERMAL_NEIGHBOUR_RADIUS_CELLS; offsetZ <= THERMAL_NEIGHBOUR_RADIUS_CELLS; offsetZ += 1) {
      const pocket = thermalPocketForCell(seed, cellX + offsetX, cellZ + offsetZ)
      if (!pocket) continue
      const dx = x - pocket.x
      const dz = z - pocket.z
      const distanceSquared = dx * dx + dz * dz
      if (distanceSquared < nearestDistanceSquared) {
        nearest = pocket
        nearestDistanceSquared = distanceSquared
      }
    }
  }
  return nearest
}

/**
 * Return a stable, bounded updraft envelope for the supplied world sample.
 *
 * The field is intentionally analytic: five neighbouring cells are checked,
 * there are no generated objects, and the same seed always produces the same
 * pockets. Daylight helps thermals, while precipitation damps them gently.
 */
export function thermalLiftIntensity(
  seed: number,
  x: number,
  altitudeM: number,
  z: number,
  daylight = 1,
  rain = 0,
  snow = 0,
  airborne = true,
): number {
  if (airborne !== true || !Number.isFinite(seed) || !Number.isFinite(x) ||
    !Number.isFinite(altitudeM) || !Number.isFinite(z)) return 0
  const safeAltitude = Math.max(0, altitudeM)
  const low = MathUtils.smoothstep(safeAltitude, THERMAL_MIN_ALTITUDE_M, THERMAL_PEAK_ALTITUDE_M)
  const high = 1 - MathUtils.smoothstep(safeAltitude, THERMAL_PEAK_ALTITUDE_M, THERMAL_FADE_ALTITUDE_M)
  if (low <= 0 || high <= 0) return 0

  const cellX = Math.floor(x / THERMAL_CELL_SIZE_M)
  const cellZ = Math.floor(z / THERMAL_CELL_SIZE_M)
  let strongest = 0
  for (let offsetX = -THERMAL_NEIGHBOUR_RADIUS_CELLS; offsetX <= THERMAL_NEIGHBOUR_RADIUS_CELLS; offsetX += 1) {
    for (let offsetZ = -THERMAL_NEIGHBOUR_RADIUS_CELLS; offsetZ <= THERMAL_NEIGHBOUR_RADIUS_CELLS; offsetZ += 1) {
      const sampleCellX = cellX + offsetX
      const sampleCellZ = cellZ + offsetZ
      // Keep this fixed-step path allocation-free. Route planning uses the
      // object helper above once per mission, while flight samples stay scalar.
      const centerX = (sampleCellX + 0.5 + (thermalHash(seed, sampleCellX, sampleCellZ, 11) - 0.5) * 0.64) * THERMAL_CELL_SIZE_M
      const centerZ = (sampleCellZ + 0.5 + (thermalHash(seed, sampleCellX, sampleCellZ, 17) - 0.5) * 0.64) * THERMAL_CELL_SIZE_M
      const radius = 360 + thermalHash(seed, sampleCellX, sampleCellZ, 23) * 220
      const dx = x - centerX
      const dz = z - centerZ
      const distanceSquared = dx * dx + dz * dz
      if (!Number.isFinite(distanceSquared) || distanceSquared >= radius * radius) continue
      const innerRadius = radius * 0.48
      const radial = distanceSquared <= innerRadius * innerRadius
        ? 1
        : 1 - MathUtils.smoothstep(Math.sqrt(distanceSquared), innerRadius, radius)
      if (radial <= 0) continue
      const strength = 0.58 + thermalHash(seed, sampleCellX, sampleCellZ, 29) * 0.42
      strongest = Math.max(strongest, radial * strength)
    }
  }

  const safeDaylight = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  const safeRain = Number.isFinite(rain) ? MathUtils.clamp(rain, 0, 1) : 0
  const safeSnow = Number.isFinite(snow) ? MathUtils.clamp(snow, 0, 1) : 0
  const weather = MathUtils.clamp(0.42 + safeDaylight * 0.78 - safeRain * 0.2 - safeSnow * 0.36, 0.18, 1)
  return MathUtils.clamp(strongest * low * high * weather, 0, 1)
}

/** Small integer hash with a stable [0, 1) result for a seed and cell. */
function thermalHash(seed: number, cellX: number, cellZ: number, salt: number): number {
  let value = Math.trunc(seed) | 0
  value = Math.imul(value ^ Math.imul(cellX | 0, 0x45d9f3b), 0x27d4eb2d)
  value = Math.imul(value ^ Math.imul(cellZ | 0, 0x165667b1), 0x85ebca6b)
  value = Math.imul(value ^ Math.imul(salt, 0x9e3779b9), 0xc2b2ae35)
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}
