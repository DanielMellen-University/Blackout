import { clamp01, fbm, ridged, smoothstep } from './noise'

/**
 * Half-scale biomes (~0.5–1.2 km), long mountain ranges, carved water features
 * (rivers, streams, ravines, lakes, ponds). sampleClimate is the mesh path.
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

export interface TerrainFeatures {
  river: number
  ravine: number
  pond: number
  lake: number
  stream: number
}

export interface Climate {
  height: number
  moisture: number
  temperature: number
  biome: Biome
  /** Convenience: features.river */
  river: number
  land: number
  features: TerrainFeatures
}

function warp(x: number, z: number): [number, number] {
  const wx = x + (fbm(x * 0.00028 + 2, z * 0.00028 - 1, 2) - 0.5) * 280
  const wz = z + (fbm(x * 0.00028 - 4, z * 0.00028 + 8, 2) - 0.5) * 280
  return [wx, wz]
}

export function sampleLand(x: number, z: number): number {
  const dist = Math.hypot(x, z)
  if (dist < RUNWAY_FLAT_OUTER) {
    return Math.max(0.92, 1 - dist / (RUNWAY_FLAT_OUTER * 4))
  }

  const [wx, wz] = warp(x, z)
  const continent = fbm(wx * 0.00032, wz * 0.00032, 4)
  const detail = fbm(wx * 0.0009 + 40, wz * 0.0009 - 20, 2)
  let land = clamp01((continent * 0.72 + detail * 0.28 - 0.26) / 0.52)

  const inlandSea = fbm(wx * 0.0007 + 300, wz * 0.0007 - 150, 3)
  if (inlandSea > 0.8 && land > 0.5) {
    land *= smoothstep(0.93, 0.8, inlandSea)
  }

  return land
}

export function sampleMoisture(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const a = fbm(wx * 0.00044, wz * 0.00044, 4)
  const b = fbm(wx * 0.0014 + 30, wz * 0.0014 - 10, 2)
  return clamp01(a * 0.68 + b * 0.32)
}

export function sampleTemperature(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const lat = 0.5 + z * 0.00006
  const cells = fbm(wx * 0.00048 - 50, wz * 0.00048 + 20, 3)
  return clamp01(lat * 0.22 + cells * 0.78)
}

export function sampleRiver(x: number, z: number): number {
  const [wx, wz] = warp(x * 1.08, z * 1.08)
  const path = Math.abs(fbm(wx * 0.00085, wz * 0.00085, 3) - 0.5) * 2
  const channel = 1 - smoothstep(0.018, 0.14, path)
  const valley = smoothstep(0.5, 0.88, ridged(wx * 0.0007 + 90, wz * 0.0007 - 40, 3))
  return clamp01(channel * valley * 1.35)
}

export function sampleStream(x: number, z: number): number {
  const [wx, wz] = warp(x * 1.3, z * 0.9)
  const path = Math.abs(fbm(wx * 0.0018 + 12, wz * 0.0018 - 7, 2) - 0.5) * 2
  return clamp01((1 - smoothstep(0.01, 0.055, path)) * 1.1)
}

export function sampleRavine(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const path = Math.abs(fbm(wx * 0.0011 - 40, wz * 0.0011 + 55, 3) - 0.48) * 2
  const slot = 1 - smoothstep(0.008, 0.06, path)
  const depthGate = smoothstep(0.45, 0.78, ridged(wx * 0.0009 + 15, wz * 0.0009, 2))
  return clamp01(slot * depthGate * 1.25)
}

export function samplePond(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return smoothstep(0.78, 0.92, fbm(wx * 0.0045 + 8, wz * 0.0045 - 3, 3))
}

export function sampleLake(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return smoothstep(0.72, 0.88, fbm(wx * 0.0011 + 200, wz * 0.0011 - 90, 4))
}

/** Long continuous ranges: low-frequency spine, wider soft belt. */
function mountainBelt(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const spine = ridged(wx * 0.00028 - 2, wz * 0.00028 + 6, 4)
  const gate = fbm(wx * 0.00018 + 70, wz * 0.00018 - 30, 3)
  return smoothstep(0.52, 0.78, spine) * smoothstep(0.42, 0.68, gate)
}

function landElevation(x: number, z: number, land: number): number {
  const [wx, wz] = warp(x, z)
  const shelf = 12 + (fbm(wx * 0.0005, wz * 0.0005, 4) - 0.35) * 34
  const roll = (fbm(wx * 0.0022 + 11, wz * 0.0022 - 7, 3) - 0.5) * 22
  const detail = (fbm(wx * 0.012, wz * 0.012, 2) - 0.5) * 4
  const hillN = fbm(wx * 0.0028 + 20, wz * 0.0028, 2)
  const hills = smoothstep(0.54, 0.8, hillN) * 30

  const belt = mountainBelt(x, z)
  const foothills = belt * 55
  const peaks = belt * belt * (120 + ridged(wx * 0.0011, wz * 0.0011, 3) * 160)

  let h = shelf + roll + detail + hills + foothills + peaks
  h *= smoothstep(0.35, 0.75, land)
  return Math.max(h, 0.5)
}

function sampleCanyon(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return smoothstep(0.6, 0.88, ridged(wx * 0.0022 + 200, wz * 0.0022 - 100, 2))
}

function mesaHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const stepNoise = fbm(wx * 0.0012, wz * 0.0012, 2)
  const stepH = 14 + stepNoise * 16
  const plateau = Math.floor(Math.max(8, base + 18) / stepH) * stepH
  const edge = ridged(wx * 0.004, wz * 0.004, 2)
  const cliff = smoothstep(0.4, 0.75, edge)
  const top = plateau + 5 + (fbm(wx * 0.014, wz * 0.014, 2) - 0.5) * 2
  const wall = base * 0.4
  return wall + (top - wall) * (1 - cliff * 0.8)
}

function duneHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const dunes =
    Math.sin(wx * 0.016 + fbm(wx * 0.004, wz * 0.004, 2) * 3) *
    Math.cos(wz * 0.012) *
    6
  return Math.max(2, base * 0.55 + 8 + dunes)
}

export function sampleFeatures(x: number, z: number): TerrainFeatures {
  return {
    river: sampleRiver(x, z),
    ravine: sampleRavine(x, z),
    pond: samplePond(x, z),
    lake: sampleLake(x, z),
    stream: sampleStream(x, z),
  }
}

export function classifyBiome(
  elev: number,
  moisture: number,
  temperature: number,
  features: TerrainFeatures,
  land: number,
  distFromOrigin: number,
): Biome {
  if (distFromOrigin < RUNWAY_FLAT_INNER) return 'runway'
  if (land < 0.42) return 'ocean'

  if (features.lake > 0.55 && elev < 45) return 'water'
  if (features.pond > 0.72 && elev < 35) return 'water'
  if (features.river > 0.74 && elev < 45) return 'water'
  if (elev < 1.2 && moisture > 0.55) return 'water'

  if (elev > 155) return 'snow'
  if (elev > 100) return 'mountain'

  if (temperature > 0.58 && moisture < 0.36) {
    if (elev > 32 && elev < 90 && moisture < 0.3) return 'mesa'
    return 'desert'
  }
  if (temperature > 0.52 && moisture > 0.62 && elev < 70) return 'rainforest'
  if (moisture > 0.58 && elev < 22 && temperature < 0.58) return 'swamp'
  if (moisture > 0.46 && elev < 75 && temperature > 0.28) return 'forest'
  if (elev > 40 && elev <= 100) return 'hills'
  return 'plains'
}

function heightFromFields(
  x: number,
  z: number,
  land: number,
  moisture: number,
  temperature: number,
  features: TerrainFeatures,
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
  let h = base

  if (features.lake > 0.35 && moisture > 0.35) {
    h -= features.lake * features.lake * (14 + Math.max(0, h) * 0.15)
  }
  if (features.pond > 0.55) {
    h -= features.pond * features.pond * 10
  }

  const rough = classifyBiome(h, moisture, temperature, features, land, dist)

  switch (rough) {
    case 'ocean':
      h = SEA_LEVEL - 0.4
      break
    case 'desert':
      h = duneHeight(Math.max(h, base * 0.5), x, z) - sampleCanyon(x, z) * 24
      break
    case 'mesa':
      h = mesaHeight(Math.max(h, base * 0.5), x, z) - sampleCanyon(x, z) * 30
      break
    case 'swamp':
      h = Math.min(h * 0.35, 5) + (fbm(x * 0.012, z * 0.012, 2) - 0.5) * 1.2
      h = Math.max(h, 0.25)
      break
    case 'plains':
      h = Math.max(1, h * 0.55 + (fbm(x * 0.0035, z * 0.0035, 2) - 0.5) * 9)
      break
    case 'forest':
      h = h * 0.65 + (fbm(x * 0.004, z * 0.004, 2) - 0.5) * 14
      break
    case 'rainforest':
      h = h * 0.6 + (fbm(x * 0.0045, z * 0.0045, 2) - 0.5) * 16
      break
    case 'hills':
      h = h * 0.9 + (fbm(x * 0.0055, z * 0.0055, 2) - 0.45) * 26
      break
    case 'mountain':
      h = h + ridged(x * 0.0015, z * 0.0015, 3) * 70
      break
    case 'snow':
      h = h + ridged(x * 0.0012, z * 0.0012, 3) * 90
      break
    case 'water':
      h = Math.min(h * 0.15, 0.35)
      break
    default:
      break
  }

  if (features.river > 0.12 && rough !== 'snow' && rough !== 'ocean') {
    h -= features.river * features.river * (16 + Math.max(0, h) * 0.12)
  }
  if (features.stream > 0.35 && rough !== 'ocean' && rough !== 'desert') {
    h -= features.stream * features.stream * 5
  }
  if (features.ravine > 0.2 && rough !== 'ocean') {
    h -= features.ravine * features.ravine * (35 + Math.max(0, h) * 0.35)
  }

  if (
    (features.lake > 0.55 || features.pond > 0.72 || features.river > 0.75) &&
    h < 4 &&
    rough !== 'desert' &&
    rough !== 'mesa' &&
    rough !== 'ocean'
  ) {
    h = Math.min(h, 0.3)
  }

  h = Math.max(h, rough === 'ocean' ? SEA_LEVEL - 2 : -2)
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
      features: { river: 0, ravine: 0, pond: 0, lake: 0, stream: 0 },
    }
  }

  const land = sampleLand(x, z)
  const moisture = sampleMoisture(x, z)
  const temperature = sampleTemperature(x, z)
  const features = sampleFeatures(x, z)
  const height = heightFromFields(
    x,
    z,
    land,
    moisture,
    temperature,
    features,
    dist,
  )
  const biome = classifyBiome(height, moisture, temperature, features, land, dist)
  return {
    height,
    moisture,
    temperature,
    biome,
    river: features.river,
    land,
    features,
  }
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
  features?: TerrainFeatures,
): [number, number, number] {
  const n = fbm(x * 0.05, z * 0.05, 2)
  const speck = (n - 0.5) * 0.05
  const river = features?.river ?? 0
  const ravine = features?.ravine ?? 0

  if (ravine > 0.4 && biome !== 'ocean') {
    const rock = 0.22 + n * 0.08
    return [rock, rock * 0.95, rock * 0.9]
  }

  if (river > 0.4 && biome !== 'desert' && biome !== 'mesa' && biome !== 'ocean') {
    return [0.18, 0.32 + n * 0.05, 0.26]
  }

  if ((features?.lake ?? 0) > 0.45 || (features?.pond ?? 0) > 0.65) {
    if (biome === 'water' || height < 1.5) {
      return [0.1, 0.28 + n * 0.08, 0.4 + n * 0.06]
    }
  }

  switch (biome) {
    case 'runway':
      return [0.24 + speck, 0.3 + speck, 0.2]
    case 'ocean': {
      const deep = clamp01((-height + 0.5) * 0.15)
      return [0.05 + deep * 0.02, 0.18 + n * 0.06, 0.38 + n * 0.08 + deep * 0.1]
    }
    case 'water':
      return [0.1, 0.3 + n * 0.08, 0.44 + n * 0.06]
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
