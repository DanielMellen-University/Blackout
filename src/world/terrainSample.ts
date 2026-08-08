import { clamp01, fbm, ridged, smoothstep } from './noise'

/**
 * Balanced multi-biome world: land is the default, oceans are coastal/sea
 * pockets (~15-25% of area), mountains are rare belts. No single biome dominates.
 *
 * Approximate land mix (of land cells): plains ~22%, forest ~16%, rainforest ~10%,
 * desert ~12%, mesa ~7%, swamp ~8%, hills ~14%, mountain ~6%, snow ~3%, lakes ~2%.
 * Ocean covers a minority of the map via a continent mask.
 */

export const RUNWAY_FLAT_INNER = 100
export const RUNWAY_FLAT_OUTER = 300
/** Sea surface height (mesh / contact for ocean). */
export const SEA_LEVEL = 0

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
  | 'ocean'

export interface Climate {
  height: number
  moisture: number
  temperature: number
  biome: Biome
  river: number
  /** 0 = deep ocean, 1 = solid land. */
  land: number
}

function warp(x: number, z: number): [number, number] {
  const wx = x + (fbm(x * 0.00006 + 2, z * 0.00006 - 1, 3) - 0.5) * 1100
  const wz = z + (fbm(x * 0.00006 - 4, z * 0.00006 + 8, 3) - 0.5) * 1100
  return [wx, wz]
}

/**
 * Continent / land mask. Tuned so most area is land; oceans form seas and
 * coasts, not a global flood. Spawn island always solid land.
 */
export function sampleLand(x: number, z: number): number {
  const dist = Math.hypot(x, z)
  // Always land near runway
  if (dist < RUNWAY_FLAT_OUTER) {
    return Math.max(0.92, 1 - dist / (RUNWAY_FLAT_OUTER * 4))
  }

  const [wx, wz] = warp(x, z)
  // Large continents: threshold low → more land (~0.7-0.8 land fraction)
  const continent = fbm(wx * 0.000055, wz * 0.000055, 5)
  const detail = fbm(wx * 0.0002 + 40, wz * 0.0002 - 20, 3)
  // Shift up so land dominates (raw mean ~0.5 → land if > 0.38)
  let land = clamp01((continent * 0.75 + detail * 0.25 - 0.28) / 0.55)

  // Occasional inland seas (not oceans everywhere): punch holes where basin is high
  const inlandSea = fbm(wx * 0.00012 + 300, wz * 0.00012 - 150, 4)
  if (inlandSea > 0.78 && land > 0.5) {
    land *= smoothstep(0.92, 0.78, inlandSea)
  }

  return land
}

export function sampleMoisture(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const a = fbm(wx * 0.00007, wz * 0.00007, 5)
  const b = fbm(wx * 0.00025 + 30, wz * 0.00025 - 10, 3)
  return clamp01(a * 0.7 + b * 0.3)
}

export function sampleTemperature(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  // Mild N/S + large warm/cool cells for desert vs forest belts
  const lat = 0.5 + z * 0.00004
  const cells = fbm(wx * 0.00008 - 50, wz * 0.00008 + 20, 4)
  return clamp01(lat * 0.3 + cells * 0.7)
}

export function sampleRiver(x: number, z: number): number {
  const [wx, wz] = warp(x * 1.05, z * 1.05)
  const path = Math.abs(fbm(wx * 0.00038, wz * 0.00038, 3) - 0.5) * 2
  const channel = 1 - smoothstep(0.02, 0.1, path)
  const valley = smoothstep(0.6, 0.9, ridged(wx * 0.0005 + 90, wz * 0.0005 - 40, 3))
  return clamp01(channel * valley * 1.2)
}

/** Rare mountain belt strength 0..1 (most of the map is ~0). */
function mountainBelt(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  // Very sparse: only extreme ridged + a second gate
  const spine = ridged(wx * 0.00028 - 2, wz * 0.00028 + 6, 4)
  const gate = fbm(wx * 0.00015 + 70, wz * 0.00015 - 30, 3)
  // Both must be high → ~ few % of land
  return smoothstep(0.72, 0.9, spine) * smoothstep(0.55, 0.8, gate)
}

/**
 * Land elevation in meters. Mostly low plains/hills; peaks only on rare belts.
 */
function landElevation(x: number, z: number, land: number): number {
  const [wx, wz] = warp(x, z)
  // Broad gentle base (typically 8–45 m)
  const shelf = 12 + (fbm(wx * 0.00012, wz * 0.00012, 5) - 0.35) * 38
  const roll = (fbm(wx * 0.0007 + 11, wz * 0.0007 - 7, 4) - 0.5) * 28
  const detail = (fbm(wx * 0.008, wz * 0.008, 2) - 0.5) * 5

  // Hills layer (moderate)
  const hillN = fbm(wx * 0.0009 + 20, wz * 0.0009, 3)
  const hills = smoothstep(0.52, 0.78, hillN) * 35

  // Rare mountains
  const belt = mountainBelt(x, z)
  const peaks = belt * belt * (90 + ridged(wx * 0.0012, wz * 0.0012, 3) * 120)

  let h = shelf + roll + detail + hills + peaks
  // Coast: ramp down toward sea
  h *= smoothstep(0.35, 0.75, land)
  return Math.max(h, 0.5)
}

function sampleCanyon(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return smoothstep(0.62, 0.9, ridged(wx * 0.0011 + 200, wz * 0.0011 - 100, 3))
}

function mesaHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const stepNoise = fbm(wx * 0.0004, wz * 0.0004, 3)
  const stepH = 14 + stepNoise * 18
  const plateau = Math.floor(Math.max(8, base + 20) / stepH) * stepH
  const edge = ridged(wx * 0.0022, wz * 0.0022, 3)
  const cliff = smoothstep(0.4, 0.75, edge)
  const top = plateau + 6 + (fbm(wx * 0.01, wz * 0.01, 2) - 0.5) * 2
  const wall = base * 0.4
  return wall + (top - wall) * (1 - cliff * 0.8)
}

function duneHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const dunes =
    Math.sin(wx * 0.011 + fbm(wx * 0.002, wz * 0.002, 2) * 3) *
    Math.cos(wz * 0.008) *
    6
  return Math.max(2, base * 0.55 + 8 + dunes)
}

/**
 * Biome pick biased for variety: elevation gates mountains/snow/ocean only;
 * on ordinary land, moisture×temperature partitions the rest.
 */
export function classifyBiome(
  elev: number,
  moisture: number,
  temperature: number,
  river: number,
  land: number,
  distFromOrigin: number,
): Biome {
  if (distFromOrigin < RUNWAY_FLAT_INNER) return 'runway'

  // Ocean / sea (minority of map via land mask)
  if (land < 0.42) return 'ocean'

  // Small lakes / river water
  if (elev < 1.5 && moisture > 0.55 && land > 0.5) return 'water'
  if (river > 0.78 && elev < 40) return 'water'

  // Rare highlands only (elev itself is sparse because peaks are gated)
  if (elev > 140) return 'snow'
  if (elev > 95) return 'mountain'

  // --- Land biomes by climate (primary variety) ---
  // Use slightly different thresholds so no single band eats the map

  // Hot + dry
  if (temperature > 0.58 && moisture < 0.36) {
    if (elev > 32 && elev < 85 && moisture < 0.3) return 'mesa'
    return 'desert'
  }

  // Hot + wet → rainforest
  if (temperature > 0.52 && moisture > 0.62 && elev < 70) return 'rainforest'

  // Cool/wet low → swamp
  if (moisture > 0.58 && elev < 22 && temperature < 0.58) return 'swamp'

  // Moderate wet → forest
  if (moisture > 0.46 && elev < 75 && temperature > 0.28) return 'forest'

  // Mid elevation → hills (not mountain)
  if (elev > 42 && elev <= 95) return 'hills'

  // Default majority: plains
  return 'plains'
}

/**
 * Height sample. Oceans sit at SEA_LEVEL; land is mostly low with rare peaks.
 */
export function sampleTerrainHeight(x: number, z: number): number {
  const dist = Math.hypot(x, z)
  const flatMask = smoothstep(RUNWAY_FLAT_INNER, RUNWAY_FLAT_OUTER, dist)
  if (flatMask <= 0) return 0

  const land = sampleLand(x, z)
  const moisture = sampleMoisture(x, z)
  const temperature = sampleTemperature(x, z)
  const river = sampleRiver(x, z)

  // Ocean body
  if (land < 0.42) {
    // Gentle waves under the surface for visual; contact uses SEA_LEVEL
    const deep = (0.42 - land) * 40
    const h = SEA_LEVEL - 0.4 - deep * 0.02
    return h * flatMask
  }

  let base = landElevation(x, z, land)
  base += (0.5 - moisture) * 6
  base += (temperature - 0.5) * 4

  const rough = classifyBiome(base, moisture, temperature, river, land, dist)

  let h = base
  switch (rough) {
    case 'ocean':
      h = SEA_LEVEL - 0.4
      break
    case 'desert':
      h = duneHeight(base, x, z)
      h -= sampleCanyon(x, z) * 22
      break
    case 'mesa':
      h = mesaHeight(base, x, z)
      h -= sampleCanyon(x, z) * 28
      break
    case 'swamp':
      h = Math.min(base * 0.3, 6) + (fbm(x * 0.008, z * 0.008, 2) - 0.5) * 1.2
      h = Math.max(h, 0.3)
      break
    case 'plains':
      h = base * 0.55 + (fbm(x * 0.0014, z * 0.0014, 3) - 0.5) * 10
      h = Math.max(h, 1)
      break
    case 'forest':
      h = base * 0.65 + (fbm(x * 0.0018, z * 0.0018, 3) - 0.5) * 16
      break
    case 'rainforest':
      h = base * 0.6 + (fbm(x * 0.002, z * 0.002, 3) - 0.5) * 20
      break
    case 'hills':
      h = base * 0.9 + (fbm(x * 0.003, z * 0.003, 3) - 0.45) * 32
      break
    case 'mountain':
      h = base + ridged(x * 0.0014, z * 0.0014, 3) * 55
      break
    case 'snow':
      h = base + ridged(x * 0.0011, z * 0.0011, 4) * 70
      break
    case 'water':
      h = Math.min(base * 0.2, 0.4)
      break
    default:
      break
  }

  if (river > 0.2 && rough !== 'snow' && rough !== 'ocean' && rough !== 'desert') {
    h -= river * river * (12 + Math.max(0, h) * 0.08)
  }

  // Inland ponds, small
  if (
    moisture > 0.72 &&
    h < 5 &&
    rough !== 'desert' &&
    rough !== 'mesa' &&
    fbm(x * 0.004, z * 0.004, 2) > 0.72
  ) {
    h = Math.min(h, 0.35)
  }

  h = Math.max(h, rough === 'ocean' ? SEA_LEVEL - 2 : 0)
  return h * flatMask
}

export function sampleClimate(x: number, z: number): Climate {
  const dist = Math.hypot(x, z)
  if (dist < RUNWAY_FLAT_INNER * 0.9) {
    return {
      height: 0,
      moisture: 0.42,
      temperature: 0.55,
      biome: 'runway',
      river: 0,
      land: 1,
    }
  }

  const land = sampleLand(x, z)
  const moisture = sampleMoisture(x, z)
  const temperature = sampleTemperature(x, z)
  const river = sampleRiver(x, z)
  const height = sampleTerrainHeight(x, z)
  const biome = classifyBiome(height, moisture, temperature, river, land, dist)
  return { height, moisture, temperature, biome, river, land }
}

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

  if (river > 0.5 && biome !== 'desert' && biome !== 'mesa' && biome !== 'ocean') {
    return [0.16, 0.3 + n * 0.05, 0.24]
  }

  switch (biome) {
    case 'runway':
      return [0.24 + speck, 0.3 + speck, 0.2]
    case 'ocean': {
      // Deep blue-green seas
      const deep = clamp01((-height + 0.5) * 0.15)
      return [0.05 + deep * 0.02, 0.18 + n * 0.06, 0.38 + n * 0.08 + deep * 0.1]
    }
    case 'water':
      return [0.12, 0.3 + n * 0.08, 0.42 + n * 0.06]
    case 'desert':
      return [0.78 + speck, 0.66 + speck * 0.4, 0.38 + speck]
    case 'mesa': {
      const band = Math.sin(height * 0.4) * 0.05
      return [0.58 + band + speck, 0.34 + band * 0.4, 0.22 + speck]
    }
    case 'swamp':
      return [0.2 + speck, 0.3 + moisture * 0.08, 0.16]
    case 'forest':
      return [0.15 + speck, 0.36 + moisture * 0.1, 0.14]
    case 'rainforest':
      return [0.07 + speck, 0.3 + moisture * 0.1, 0.1]
    case 'hills':
      return [0.32 + speck, 0.44 + speck, 0.22]
    case 'mountain': {
      const rock = 0.42 + n * 0.1
      return [rock, rock * 0.97, rock * 0.94]
    }
    case 'snow': {
      const t = smoothstep(100, 180, height)
      const c = 0.45 + t * 0.48
      return [c, c, c + 0.02]
    }
    case 'plains':
    default:
      return [0.28 + speck, 0.44 + speck + moisture * 0.04, 0.18]
  }
}
