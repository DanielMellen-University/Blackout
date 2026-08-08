import { fbm, ridged, smoothstep } from './noise'

/**
 * Pure height / climate / biome sampling for infinite terrain.
 * Must match mesh generation so aircraft contact and visuals agree.
 */

/** Half-width of flat ops area around runway (meters). */
export const RUNWAY_FLAT_INNER = 95
/** Distance where full terrain height returns. */
export const RUNWAY_FLAT_OUTER = 220

export type Biome =
  | 'runway'
  | 'plains'
  | 'forest'
  | 'desert'
  | 'hills'
  | 'mountain'
  | 'snow'
  | 'water'

export interface Climate {
  height: number
  moisture: number
  temperature: number
  biome: Biome
}

/** Moisture field 0..1 (wet → dry). */
export function sampleMoisture(x: number, z: number): number {
  return fbm(x * 0.00045 + 40, z * 0.00045 - 12, 4)
}

/** Temperature 0..1 (cold → hot), large-scale. */
export function sampleTemperature(x: number, z: number): number {
  // North-ish gradient + noise
  const lat = 0.5 + z * 0.00012
  const n = fbm(x * 0.00035 - 90, z * 0.00035 + 20, 3)
  return Math.min(1, Math.max(0, lat * 0.55 + n * 0.55))
}

/**
 * Terrain surface height in meters.
 * Near origin (runway) the surface is forced flat at y ≈ 0.
 */
export function sampleTerrainHeight(x: number, z: number): number {
  const dist = Math.hypot(x, z)
  const mask = smoothstep(RUNWAY_FLAT_INNER, RUNWAY_FLAT_OUTER, dist)
  if (mask <= 0) return 0

  // Continental base (gentle)
  const base = (fbm(x * 0.0009, z * 0.0009, 5) - 0.42) * 55

  // Rolling hills
  const hills = (fbm(x * 0.0028 + 17, z * 0.0028 - 9, 4) - 0.5) * 48

  // Mountain ranges (ridged)
  const ridge = ridged(x * 0.0011 - 3, z * 0.0011 + 5, 5)
  const mountainMask = smoothstep(0.42, 0.72, ridge)
  const mountains = mountainMask * mountainMask * (140 + ridge * 160)

  // Local detail
  const detail = (fbm(x * 0.012, z * 0.012, 2) - 0.5) * 6

  // Low basins (lakes when wet)
  const basin = fbm(x * 0.0016 + 200, z * 0.0016 - 80, 3)
  const dip = smoothstep(0.58, 0.78, basin) * -18

  let h = base + hills + mountains + detail + dip
  // Soft floor so we rarely go deep underground far away
  h = Math.max(h, -8)
  return h * mask
}

export function sampleClimate(x: number, z: number): Climate {
  const dist = Math.hypot(x, z)
  if (dist < RUNWAY_FLAT_INNER * 0.92) {
    return { height: 0, moisture: 0.4, temperature: 0.55, biome: 'runway' }
  }

  const height = sampleTerrainHeight(x, z)
  const moisture = sampleMoisture(x, z)
  const temperature = sampleTemperature(x, z)
  const biome = classifyBiome(height, moisture, temperature, dist)
  return { height, moisture, temperature, biome }
}

export function classifyBiome(
  height: number,
  moisture: number,
  temperature: number,
  distFromOrigin: number,
): Biome {
  if (distFromOrigin < RUNWAY_FLAT_INNER) return 'runway'

  // Water basins
  if (height < 1.2 && moisture > 0.52) return 'water'

  // High altitude
  if (height > 130 || (height > 95 && temperature < 0.38)) return 'snow'
  if (height > 72) return 'mountain'
  if (height > 38 && moisture < 0.55) return 'hills'

  // Arid lowlands
  if (temperature > 0.62 && moisture < 0.38 && height < 50) return 'desert'

  // Wet lowlands
  if (moisture > 0.55 && height < 55) return 'forest'

  return 'plains'
}

/** Vertex RGB for a biome / height blend (0..1 channels). */
export function biomeColor(
  biome: Biome,
  height: number,
  moisture: number,
  x: number,
  z: number,
): [number, number, number] {
  const n = fbm(x * 0.05, z * 0.05, 2)
  const speck = (n - 0.5) * 0.06

  switch (biome) {
    case 'runway':
      return [0.22 + speck, 0.28 + speck, 0.2]
    case 'water':
      return [0.12, 0.28 + n * 0.08, 0.42 + n * 0.05]
    case 'desert':
      return [0.72 + speck, 0.62 + speck * 0.5, 0.38 + speck]
    case 'forest':
      return [0.12 + speck, 0.32 + moisture * 0.12, 0.14]
    case 'hills':
      return [0.28 + speck, 0.4 + speck, 0.22]
    case 'mountain': {
      const rock = 0.38 + n * 0.12
      return [rock, rock * 0.98, rock * 0.95]
    }
    case 'snow': {
      const t = smoothstep(100, 160, height)
      const rock = 0.4
      const snow = 0.9
      const c = rock + (snow - rock) * t
      return [c, c, c + 0.02]
    }
    case 'plains':
    default:
      return [0.22 + speck, 0.38 + speck + moisture * 0.05, 0.16]
  }
}
