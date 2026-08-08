import { clamp01, fbm, ridged, smoothstep } from './noise'

/**
 * Balanced multi-biome world with mid-scale biomes (~1–2.5 km cells).
 * Land dominates; oceans are seas/coasts; mountains stay rare.
 *
 * sampleClimate is the cheap-once path used by meshes; height reuses the same fields.
 */

export const RUNWAY_FLAT_INNER = 100
export const RUNWAY_FLAT_OUTER = 280
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
  land: number
}

/** Smaller warp = tighter biome patches. */
function warp(x: number, z: number): [number, number] {
  const wx = x + (fbm(x * 0.00014 + 2, z * 0.00014 - 1, 2) - 0.5) * 420
  const wz = z + (fbm(x * 0.00014 - 4, z * 0.00014 + 8, 2) - 0.5) * 420
  return [wx, wz]
}

export function sampleLand(x: number, z: number): number {
  const dist = Math.hypot(x, z)
  if (dist < RUNWAY_FLAT_OUTER) {
    return Math.max(0.92, 1 - dist / (RUNWAY_FLAT_OUTER * 4))
  }

  const [wx, wz] = warp(x, z)
  // ~2–4 km seas/coasts, not planet-scale oceans
  const continent = fbm(wx * 0.00016, wz * 0.00016, 4)
  const detail = fbm(wx * 0.00045 + 40, wz * 0.00045 - 20, 2)
  let land = clamp01((continent * 0.72 + detail * 0.28 - 0.26) / 0.52)

  const inlandSea = fbm(wx * 0.00035 + 300, wz * 0.00035 - 150, 3)
  if (inlandSea > 0.8 && land > 0.5) {
    land *= smoothstep(0.93, 0.8, inlandSea)
  }

  return land
}

export function sampleMoisture(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  // ~1.2–2 km biome cells
  const a = fbm(wx * 0.00022, wz * 0.00022, 4)
  const b = fbm(wx * 0.0007 + 30, wz * 0.0007 - 10, 2)
  return clamp01(a * 0.68 + b * 0.32)
}

export function sampleTemperature(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const lat = 0.5 + z * 0.00005
  const cells = fbm(wx * 0.00024 - 50, wz * 0.00024 + 20, 3)
  return clamp01(lat * 0.25 + cells * 0.75)
}

export function sampleRiver(x: number, z: number): number {
  const [wx, wz] = warp(x * 1.05, z * 1.05)
  const path = Math.abs(fbm(wx * 0.0007, wz * 0.0007, 2) - 0.5) * 2
  const channel = 1 - smoothstep(0.025, 0.12, path)
  const valley = smoothstep(0.62, 0.9, ridged(wx * 0.0009 + 90, wz * 0.0009 - 40, 2))
  return clamp01(channel * valley * 1.15)
}

function mountainBelt(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const spine = ridged(wx * 0.00055 - 2, wz * 0.00055 + 6, 3)
  const gate = fbm(wx * 0.00035 + 70, wz * 0.00035 - 30, 2)
  return smoothstep(0.74, 0.92, spine) * smoothstep(0.58, 0.82, gate)
}

function landElevation(x: number, z: number, land: number): number {
  const [wx, wz] = warp(x, z)
  const shelf = 12 + (fbm(wx * 0.00028, wz * 0.00028, 4) - 0.35) * 36
  const roll = (fbm(wx * 0.0014 + 11, wz * 0.0014 - 7, 3) - 0.5) * 24
  const detail = (fbm(wx * 0.01, wz * 0.01, 2) - 0.5) * 4
  const hillN = fbm(wx * 0.0018 + 20, wz * 0.0018, 2)
  const hills = smoothstep(0.54, 0.8, hillN) * 32
  const belt = mountainBelt(x, z)
  const peaks = belt * belt * (85 + ridged(wx * 0.002, wz * 0.002, 2) * 100)
  let h = shelf + roll + detail + hills + peaks
  h *= smoothstep(0.35, 0.75, land)
  return Math.max(h, 0.5)
}

function sampleCanyon(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return smoothstep(0.64, 0.9, ridged(wx * 0.002 + 200, wz * 0.002 - 100, 2))
}

function mesaHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const stepNoise = fbm(wx * 0.0008, wz * 0.0008, 2)
  const stepH = 14 + stepNoise * 16
  const plateau = Math.floor(Math.max(8, base + 18) / stepH) * stepH
  const edge = ridged(wx * 0.0035, wz * 0.0035, 2)
  const cliff = smoothstep(0.4, 0.75, edge)
  const top = plateau + 5 + (fbm(wx * 0.012, wz * 0.012, 2) - 0.5) * 2
  const wall = base * 0.4
  return wall + (top - wall) * (1 - cliff * 0.8)
}

function duneHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const dunes =
    Math.sin(wx * 0.014 + fbm(wx * 0.003, wz * 0.003, 2) * 3) *
    Math.cos(wz * 0.01) *
    5.5
  return Math.max(2, base * 0.55 + 8 + dunes)
}

export function classifyBiome(
  elev: number,
  moisture: number,
  temperature: number,
  river: number,
  land: number,
  distFromOrigin: number,
): Biome {
  if (distFromOrigin < RUNWAY_FLAT_INNER) return 'runway'
  if (land < 0.42) return 'ocean'
  if (elev < 1.5 && moisture > 0.55 && land > 0.5) return 'water'
  if (river > 0.78 && elev < 40) return 'water'
  if (elev > 140) return 'snow'
  if (elev > 95) return 'mountain'

  if (temperature > 0.58 && moisture < 0.36) {
    if (elev > 32 && elev < 85 && moisture < 0.3) return 'mesa'
    return 'desert'
  }
  if (temperature > 0.52 && moisture > 0.62 && elev < 70) return 'rainforest'
  if (moisture > 0.58 && elev < 22 && temperature < 0.58) return 'swamp'
  if (moisture > 0.46 && elev < 75 && temperature > 0.28) return 'forest'
  if (elev > 42 && elev <= 95) return 'hills'
  return 'plains'
}

/** Build height from already-sampled climate fields (no re-noise). */
function heightFromFields(
  x: number,
  z: number,
  land: number,
  moisture: number,
  temperature: number,
  river: number,
  dist: number,
): number {
  const flatMask = smoothstep(RUNWAY_FLAT_INNER, RUNWAY_FLAT_OUTER, dist)
  if (flatMask <= 0) return 0

  if (land < 0.42) {
    const deep = (0.42 - land) * 40
    return (SEA_LEVEL - 0.4 - deep * 0.02) * flatMask
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
      h = duneHeight(base, x, z) - sampleCanyon(x, z) * 22
      break
    case 'mesa':
      h = mesaHeight(base, x, z) - sampleCanyon(x, z) * 28
      break
    case 'swamp':
      h = Math.min(base * 0.3, 6) + (fbm(x * 0.01, z * 0.01, 2) - 0.5) * 1.2
      h = Math.max(h, 0.3)
      break
    case 'plains':
      h = Math.max(1, base * 0.55 + (fbm(x * 0.0025, z * 0.0025, 2) - 0.5) * 10)
      break
    case 'forest':
      h = base * 0.65 + (fbm(x * 0.003, z * 0.003, 2) - 0.5) * 16
      break
    case 'rainforest':
      h = base * 0.6 + (fbm(x * 0.0032, z * 0.0032, 2) - 0.5) * 18
      break
    case 'hills':
      h = base * 0.9 + (fbm(x * 0.0045, z * 0.0045, 2) - 0.45) * 28
      break
    case 'mountain':
      h = base + ridged(x * 0.002, z * 0.002, 2) * 50
      break
    case 'snow':
      h = base + ridged(x * 0.0016, z * 0.0016, 2) * 65
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

  if (
    moisture > 0.72 &&
    h < 5 &&
    rough !== 'desert' &&
    rough !== 'mesa' &&
    fbm(x * 0.005, z * 0.005, 2) > 0.72
  ) {
    h = Math.min(h, 0.35)
  }

  h = Math.max(h, rough === 'ocean' ? SEA_LEVEL - 2 : 0)
  return h * flatMask
}

/** Single-pass climate (preferred for mesh generation). */
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
  const height = heightFromFields(x, z, land, moisture, temperature, river, dist)
  const biome = classifyBiome(height, moisture, temperature, river, land, dist)
  return { height, moisture, temperature, biome, river, land }
}

export function sampleTerrainHeight(x: number, z: number): number {
  return sampleClimate(x, z).height
}

export function biomeColor(
  biome: Biome,
  height: number,
  moisture: number,
  x: number,
  z: number,
  river = 0,
): [number, number, number] {
  const n = fbm(x * 0.05, z * 0.05, 2)
  const speck = (n - 0.5) * 0.05

  if (river > 0.5 && biome !== 'desert' && biome !== 'mesa' && biome !== 'ocean') {
    return [0.16, 0.3 + n * 0.05, 0.24]
  }

  switch (biome) {
    case 'runway':
      return [0.24 + speck, 0.3 + speck, 0.2]
    case 'ocean': {
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
