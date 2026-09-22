import { MathUtils } from 'three'

/** World-space spacing between deterministic thermal pockets. */
export const THERMAL_CELL_SIZE_M = 1_800
export const THERMAL_MIN_ALTITUDE_M = 90
export const THERMAL_PEAK_ALTITUDE_M = 420
export const THERMAL_FADE_ALTITUDE_M = 1_800

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
  if (!airborne || !Number.isFinite(seed) || !Number.isFinite(x) ||
    !Number.isFinite(altitudeM) || !Number.isFinite(z)) return 0
  const safeAltitude = Math.max(0, altitudeM)
  const low = MathUtils.smoothstep(safeAltitude, THERMAL_MIN_ALTITUDE_M, THERMAL_PEAK_ALTITUDE_M)
  const high = 1 - MathUtils.smoothstep(safeAltitude, THERMAL_PEAK_ALTITUDE_M, THERMAL_FADE_ALTITUDE_M)
  if (low <= 0 || high <= 0) return 0

  const cellX = Math.floor(x / THERMAL_CELL_SIZE_M)
  const cellZ = Math.floor(z / THERMAL_CELL_SIZE_M)
  let strongest = 0
  for (let offset = 0; offset < 5; offset += 1) {
    const sampleCellX = cellX + (offset === 1 ? -1 : offset === 2 ? 1 : 0)
    const sampleCellZ = cellZ + (offset === 3 ? -1 : offset === 4 ? 1 : 0)
    const centerX = (sampleCellX + 0.5 + (thermalHash(seed, sampleCellX, sampleCellZ, 11) - 0.5) * 0.64) * THERMAL_CELL_SIZE_M
    const centerZ = (sampleCellZ + 0.5 + (thermalHash(seed, sampleCellX, sampleCellZ, 17) - 0.5) * 0.64) * THERMAL_CELL_SIZE_M
    const radius = 360 + thermalHash(seed, sampleCellX, sampleCellZ, 23) * 220
    const distance = Math.hypot(x - centerX, z - centerZ)
    const radial = 1 - MathUtils.smoothstep(distance, radius * 0.48, radius)
    if (radial <= 0) continue
    const strength = 0.58 + thermalHash(seed, sampleCellX, sampleCellZ, 29) * 0.42
    strongest = Math.max(strongest, radial * strength)
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
