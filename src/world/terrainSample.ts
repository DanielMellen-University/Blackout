import { fbm, ridged, smoothstep } from './noise'

/**
 * Large-scale climate + height for infinite terrain.
 * Biomes span multi-km regions; geographic features (rivers, canyons,
 * mesas, ridges) reshape height on top of continental structure.
 */

/** Half-width of flat ops area around runway (meters). */
export const RUNWAY_FLAT_INNER = 100
/** Distance where full terrain height returns. */
export const RUNWAY_FLAT_OUTER = 280

export type Biome =
  | 'runway'
  | 'plains'
  | 'forest'
  | 'rainforest'
  | 'desert'
  | 'mesa'
  | 'swamp'
  | 'hills'
  | 'mountain'
  | 'snow'
  | 'water'

export interface Climate {
  height: number
  moisture: number
  temperature: number
  biome: Biome
  /** 0..1 river proximity (for props / water color). */
  river: number
}

/** Domain warp so biomes have organic coastlines (not grid blobs). */
function warp(x: number, z: number): [number, number] {
  const wx = x + (fbm(x * 0.00007 + 2, z * 0.00007 - 1, 3) - 0.5) * 1400
  const wz = z + (fbm(x * 0.00007 - 4, z * 0.00007 + 8, 3) - 0.5) * 1400
  return [wx, wz]
}

/**
 * Moisture 0..1 — VERY large scale so biomes are kilometers wide.
 * (fbm frequency ~1/12–15 km)
 */
export function sampleMoisture(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const continental = fbm(wx * 0.000065, wz * 0.000065, 5)
  const regional = fbm(wx * 0.00022 + 30, wz * 0.00022 - 10, 3)
  return Math.min(1, Math.max(0, continental * 0.72 + regional * 0.28))
}

/** Temperature 0..1 (cold → hot), large scale + mild latitude. */
export function sampleTemperature(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const lat = 0.5 + z * 0.000045
  const n = fbm(wx * 0.00007 - 50, wz * 0.00007 + 20, 4)
  return Math.min(1, Math.max(0, lat * 0.35 + n * 0.65))
}

/** Continental base elevation before biome shaping (meters). */
function continentalBase(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  // Broad landmass undulation
  const shelf = (fbm(wx * 0.00009, wz * 0.00009, 6) - 0.38) * 95
  // Rolling mid-frequency
  const roll = (fbm(wx * 0.00055 + 11, wz * 0.00055 - 7, 4) - 0.5) * 42
  // Mountain spine belts
  const ridge = ridged(wx * 0.00038 - 2, wz * 0.00038 + 6, 5)
  const range = smoothstep(0.38, 0.78, ridge)
  const peaks = range * range * (180 + ridge * 220)
  // Detail
  const detail = (fbm(wx * 0.006, wz * 0.006, 2) - 0.5) * 8
  return shelf + roll + peaks + detail
}

/**
 * River field: low values = river centerline (carved).
 * Returns 0..1 how "river-like" (1 = on river).
 */
export function sampleRiver(x: number, z: number): number {
  const [wx, wz] = warp(x * 1.1, z * 1.1)
  // Ridged noise inverted → valley corridors
  const r = ridged(wx * 0.00055 + 90, wz * 0.00055 - 40, 4)
  // Narrow channels where ridged is high along a warped path
  const path = Math.abs(fbm(wx * 0.0004, wz * 0.0004, 3) - 0.5) * 2
  const channel = 1 - smoothstep(0.02, 0.11, path)
  const valley = smoothstep(0.55, 0.88, r)
  return Math.min(1, channel * valley * 1.35)
}

/** Canyon strength 0..1 (arid highlands). */
function sampleCanyon(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const gully = ridged(wx * 0.0012 + 200, wz * 0.0012 - 100, 4)
  return smoothstep(0.55, 0.9, gully)
}

/** Mesa plateau steps — flat tops with steep walls. */
function mesaHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  // Terrace height varies by region (taller steps in bigger mesa country)
  const stepNoise = fbm(wx * 0.0004, wz * 0.0004, 3)
  const stepH = 16 + stepNoise * 22 + fbm(wx * 0.0002, wz * 0.0002, 2) * 10
  const plateau = Math.floor(Math.max(0, base + 40) / stepH) * stepH
  // Cliff edges: blend toward full base near terrace breaks
  const edge = ridged(wx * 0.0025, wz * 0.0025, 3)
  const cliff = smoothstep(0.35, 0.7, edge)
  // Top is flat, walls drop
  const top = plateau + 8 + (fbm(wx * 0.01, wz * 0.01, 2) - 0.5) * 3
  const wall = base * 0.35 + plateau * 0.2
  return wall + (top - wall) * (1 - cliff * 0.85)
}

/** Sand dunes for desert. */
function duneHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const dunes =
    Math.sin(wx * 0.012 + fbm(wx * 0.002, wz * 0.002, 2) * 4) *
    Math.cos(wz * 0.009) *
    7
  const ripples = (fbm(wx * 0.02, wz * 0.02, 2) - 0.5) * 3
  return Math.max(2, base * 0.45 + 12 + dunes + ripples)
}

/**
 * Classify large biomes from climate + elevation.
 * Order matters: water/runway first, then extreme elev, then moisture×temp.
 */
export function classifyBiome(
  elev: number,
  moisture: number,
  temperature: number,
  river: number,
  distFromOrigin: number,
): Biome {
  if (distFromOrigin < RUNWAY_FLAT_INNER) return 'runway'

  // Standing water / river mouths
  if (elev < 2.5 && moisture > 0.48) return 'water'
  if (river > 0.72 && elev < 55) return 'water'

  // Alpine / peaks
  if (elev > 175 || (elev > 130 && temperature < 0.4)) return 'snow'
  if (elev > 105) return 'mountain'

  // Hot arid
  if (temperature > 0.58 && moisture < 0.34) {
    // Mesas prefer mid-elevation arid plateaus
    if (elev > 28 && elev < 120) return 'mesa'
    return 'desert'
  }

  // Very wet lowlands
  if (moisture > 0.72 && elev < 45) {
    if (temperature > 0.55) return 'rainforest'
    return 'swamp'
  }

  // Wet tropics mid elev
  if (moisture > 0.62 && temperature > 0.52 && elev < 80) return 'rainforest'

  // Swamp: wet + cool/low
  if (moisture > 0.6 && elev < 28 && temperature < 0.62) return 'swamp'

  // Hills
  if (elev > 48 && elev <= 105) return 'hills'

  // Temperate forest
  if (moisture > 0.48 && elev < 70) return 'forest'

  return 'plains'
}

/**
 * Terrain surface height (meters). Matches streaming mesh sampling.
 */
export function sampleTerrainHeight(x: number, z: number): number {
  const dist = Math.hypot(x, z)
  const mask = smoothstep(RUNWAY_FLAT_INNER, RUNWAY_FLAT_OUTER, dist)
  if (mask <= 0) return 0

  const moisture = sampleMoisture(x, z)
  const temperature = sampleTemperature(x, z)
  const river = sampleRiver(x, z)
  let base = continentalBase(x, z)

  // Soft climate influence on raw elevation (wet → lower basins)
  base += (0.5 - moisture) * 12
  base += (temperature - 0.5) * 8

  // Pre-classify from rough elev for biome shaping
  const roughBiome = classifyBiome(base, moisture, temperature, river, dist)

  let h = base
  switch (roughBiome) {
    case 'desert':
      h = duneHeight(base, x, z)
      // Canyons
      h -= sampleCanyon(x, z) * (35 + base * 0.15)
      break
    case 'mesa':
      h = mesaHeight(base, x, z)
      h -= sampleCanyon(x, z) * 50
      break
    case 'swamp':
      h = Math.min(base * 0.25, 8) + (fbm(x * 0.008, z * 0.008, 2) - 0.5) * 1.5
      h = Math.max(h, 0.2)
      break
    case 'plains':
      h = base * 0.35 + (fbm(x * 0.0015, z * 0.0015, 3) - 0.5) * 14
      h = Math.max(h, 1)
      break
    case 'forest':
      h = base * 0.5 + (fbm(x * 0.002, z * 0.002, 3) - 0.5) * 22
      break
    case 'rainforest':
      h = base * 0.45 + (fbm(x * 0.0022, z * 0.0022, 3) - 0.5) * 28
      // Small wet valleys
      h -= smoothstep(0.55, 0.8, fbm(x * 0.003, z * 0.003, 2)) * 12
      break
    case 'hills':
      h = base * 0.85 + (fbm(x * 0.0035, z * 0.0035, 4) - 0.4) * 55
      break
    case 'mountain':
      h = base * 1.05 + ridged(x * 0.0015, z * 0.0015, 4) * 80
      break
    case 'snow':
      h = base * 1.1 + ridged(x * 0.0012, z * 0.0012, 5) * 100
      break
    case 'water':
      h = Math.min(base * 0.15, 0.5)
      break
    default:
      break
  }

  // Carve rivers (geographic feature) — wide valleys + channel
  if (river > 0.15 && roughBiome !== 'snow') {
    const carve = river * river * (18 + Math.max(0, h) * 0.12)
    h -= carve
  }

  // Lakes in deep wet basins
  if (moisture > 0.65 && h < 6 && roughBiome !== 'desert' && roughBiome !== 'mesa') {
    h = Math.min(h, 0.4)
  }

  h = Math.max(h, -6)
  return h * mask
}

export function sampleClimate(x: number, z: number): Climate {
  const dist = Math.hypot(x, z)
  if (dist < RUNWAY_FLAT_INNER * 0.9) {
    return {
      height: 0,
      moisture: 0.4,
      temperature: 0.55,
      biome: 'runway',
      river: 0,
    }
  }

  const moisture = sampleMoisture(x, z)
  const temperature = sampleTemperature(x, z)
  const river = sampleRiver(x, z)
  const height = sampleTerrainHeight(x, z)
  const biome = classifyBiome(height, moisture, temperature, river, dist)
  return { height, moisture, temperature, biome, river }
}

/** Vertex RGB for biome / features (0..1). */
export function biomeColor(
  biome: Biome,
  height: number,
  moisture: number,
  x: number,
  z: number,
  river = 0,
): [number, number, number] {
  const n = fbm(x * 0.04, z * 0.04, 2)
  const speck = (n - 0.5) * 0.05

  // River overlay (silt / wet banks)
  if (river > 0.45 && biome !== 'desert' && biome !== 'mesa') {
    const wet = 0.15 + n * 0.05
    return [0.18, 0.28 + wet, 0.22]
  }

  switch (biome) {
    case 'runway':
      return [0.24 + speck, 0.3 + speck, 0.2]
    case 'water':
      return [0.1, 0.26 + n * 0.1, 0.4 + n * 0.08]
    case 'desert':
      return [0.76 + speck, 0.64 + speck * 0.4, 0.36 + speck]
    case 'mesa': {
      // Red rock / sandstone bands by height
      const band = Math.sin(height * 0.35) * 0.04
      return [0.55 + band + speck, 0.32 + band * 0.5, 0.2 + speck]
    }
    case 'swamp':
      return [0.18 + speck, 0.28 + moisture * 0.08, 0.16]
    case 'forest':
      return [0.14 + speck, 0.34 + moisture * 0.1, 0.14]
    case 'rainforest':
      return [0.08 + speck, 0.28 + moisture * 0.12, 0.1]
    case 'hills':
      return [0.3 + speck, 0.42 + speck, 0.22]
    case 'mountain': {
      const rock = 0.4 + n * 0.12
      return [rock, rock * 0.97, rock * 0.94]
    }
    case 'snow': {
      const t = smoothstep(120, 200, height)
      const rock = 0.42
      const snow = 0.92
      const c = rock + (snow - rock) * t
      return [c, c, c + 0.02]
    }
    case 'plains':
    default:
      return [0.26 + speck, 0.42 + speck + moisture * 0.04, 0.18]
  }
}
