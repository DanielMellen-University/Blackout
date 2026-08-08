import { clamp01, fbm, hash2, ridged, smoothstep } from './noise'

/**
 * Half-scale biomes, tall ranges, carved water features, coasts, and slope cues.
 * sampleClimate is the hot path — one warp, fewer noise octaves.
 */

export const RUNWAY_FLAT_INNER = 100
export const RUNWAY_FLAT_OUTER = 280
export const SEA_LEVEL = 0

/** Airfield / ops center — terrain is forced flat around this point. */
let opsX = 0
let opsZ = 0

export function setOpsCenter(x: number, z: number): void {
  opsX = x
  opsZ = z
}

export function getOpsCenter(): { x: number; z: number } {
  return { x: opsX, z: opsZ }
}

function opsDist(x: number, z: number): number {
  return Math.hypot(x - opsX, z - opsZ)
}

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
  /** 1 on beach shelf between land and open sea. */
  coastal: number
}

/** Single domain warp used by the hot climate path. */
function warp(x: number, z: number): [number, number] {
  const wx = x + (fbm(x * 0.00028 + 2, z * 0.00028 - 1, 2) - 0.5) * 280
  const wz = z + (fbm(x * 0.00028 - 4, z * 0.00028 + 8, 2) - 0.5) * 280
  return [wx, wz]
}

function landAt(wx: number, wz: number, distFromOps: number): number {
  if (distFromOps < RUNWAY_FLAT_OUTER) {
    return Math.max(0.92, 1 - distFromOps / (RUNWAY_FLAT_OUTER * 4))
  }
  // Larger landmasses (lower freq) + strong land bias → oceans less common/smaller
  const continent = fbm(wx * 0.0002, wz * 0.0002, 3)
  const detail = fbm(wx * 0.00065 + 40, wz * 0.00065 - 20, 2)
  let land = clamp01((continent * 0.78 + detail * 0.22 - 0.12) / 0.5)
  // Rare inland seas only (was punching too many holes in the continents)
  const inlandSea = fbm(wx * 0.00095 + 300, wz * 0.00095 - 150, 2)
  if (inlandSea > 0.9 && land > 0.6) {
    land *= smoothstep(0.97, 0.9, inlandSea)
  }
  return land
}

function moistureAt(wx: number, wz: number): number {
  return clamp01(
    fbm(wx * 0.00044, wz * 0.00044, 3) * 0.72 +
      fbm(wx * 0.0014 + 30, wz * 0.0014 - 10, 2) * 0.28,
  )
}

function temperatureAt(wx: number, wz: number, z: number): number {
  const lat = 0.5 + z * 0.00006
  return clamp01(lat * 0.22 + fbm(wx * 0.00048 - 50, wz * 0.00048 + 20, 2) * 0.78)
}

/**
 * Large-scale badlands province (~3–6 km). Higher = more likely mesa country.
 */
function mesaProvince(wx: number, wz: number): number {
  const a = fbm(wx * 0.00014 + 90, wz * 0.00014 - 40, 3)
  const b = fbm(wx * 0.00032 + 12, wz * 0.00032 - 8, 2)
  return clamp01(a * 0.7 + b * 0.3)
}

/** Cheap feature pack from already-warped coords (one river/ravine/lake each). */
function featuresAt(wx: number, wz: number): TerrainFeatures {
  const pathR = Math.abs(fbm(wx * 0.00085, wz * 0.00085, 2) - 0.5) * 2
  const river = clamp01(
    (1 - smoothstep(0.018, 0.14, pathR)) *
      smoothstep(0.5, 0.88, ridged(wx * 0.0007 + 90, wz * 0.0007 - 40, 2)) *
      1.25,
  )
  const pathV = Math.abs(fbm(wx * 0.0011 - 40, wz * 0.0011 + 55, 2) - 0.48) * 2
  const ravine = clamp01(
    (1 - smoothstep(0.01, 0.07, pathV)) *
      smoothstep(0.45, 0.78, ridged(wx * 0.0009 + 15, wz * 0.0009, 2)),
  )
  const lake = smoothstep(0.72, 0.9, fbm(wx * 0.0011 + 200, wz * 0.0011 - 90, 2))
  const pond = smoothstep(0.8, 0.93, fbm(wx * 0.0045 + 8, wz * 0.0045 - 3, 2))
  const pathS = Math.abs(fbm(wx * 0.0018 + 12, wz * 0.0018 - 7, 2) - 0.5) * 2
  const stream = clamp01(1 - smoothstep(0.015, 0.06, pathS))
  return { river, ravine, pond, lake, stream }
}

export function sampleLand(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return landAt(wx, wz, opsDist(x, z))
}

export function sampleMoisture(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return moistureAt(wx, wz)
}

export function sampleTemperature(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return temperatureAt(wx, wz, z)
}

export function sampleRiver(x: number, z: number): number {
  return featuresAt(...warp(x, z)).river
}

export function sampleStream(x: number, z: number): number {
  return featuresAt(...warp(x, z)).stream
}

export function sampleRavine(x: number, z: number): number {
  return featuresAt(...warp(x, z)).ravine
}

export function samplePond(x: number, z: number): number {
  return featuresAt(...warp(x, z)).pond
}

export function sampleLake(x: number, z: number): number {
  return featuresAt(...warp(x, z)).lake
}

/**
 * Mountain-range mask. Soft outer ramp into foothills, firmer core.
 */
function mountainBeltW(wx: number, wz: number): number {
  const spine = ridged(wx * 0.00022 - 2, wz * 0.00022 + 6, 3)
  const gate = fbm(wx * 0.00014 + 70, wz * 0.00014 - 30, 2)
  return smoothstep(0.34, 0.72, spine) * smoothstep(0.3, 0.62, gate)
}

/**
 * Ridged massifs from pre-warped coords (avoids re-warp in hot path).
 */
function mountainMassifW(
  base: number,
  wx: number,
  wz: number,
  belt: number,
): number {
  if (belt < 0.001) return base
  const t = belt
  const r1 = ridged(wx * 0.00048, wz * 0.00048, 3)
  const r2 = ridged(wx * 0.00072 + 40, wz * 0.00072 - 15, 2)
  const ridge = Math.max(r1, r2 * 0.82)
  const chain = fbm(wx * 0.00055 + 12, wz * 0.00055 - 8, 3)
  const summit = Math.pow(smoothstep(0.38, 0.92, chain), 1.35)
  const col = 1 - 0.42 * (1 - smoothstep(0.22, 0.52, chain))
  const crest = Math.pow(ridge, 1.65)
  const flank = Math.pow(ridge, 1.12)
  const apron = t * flank * (200 + fbm(wx * 0.00055, wz * 0.00055, 2) * 140)
  const wall = t * t * crest * col * (560 + summit * 380)
  const peaks = t * t * crest * summit * (320 + chain * 260)
  const slopeProxy = clamp01(ridge * (1 - ridge) * 4)
  const rockA =
    (fbm(wx * 0.0024 + 3, wz * 0.0024, 2) - 0.5) * 100 * slopeProxy * t
  const rockB = ridged(wx * 0.0019 - 5, wz * 0.0019, 2) * 55 * crest * t
  const crag = ridged(wx * 0.0028, wz * 0.0028, 2) * 45 * summit * crest * t
  return base * (1 - t * 0.88) + apron + wall + peaks + rockA + rockB + crag
}

function landElevationW(wx: number, wz: number, land: number): number {
  const continental = (fbm(wx * 0.00035, wz * 0.00035, 3) - 0.32) * 95
  const rollA = (fbm(wx * 0.0011 + 11, wz * 0.0011 - 7, 3) - 0.48) * 52
  const rollB = (fbm(wx * 0.0038 - 3, wz * 0.0038 + 9, 2) - 0.5) * 42
  const detail = (fbm(wx * 0.012, wz * 0.012, 2) - 0.5) * 8

  const hillN = fbm(wx * 0.0017 + 20, wz * 0.0017, 3)
  const hills =
    smoothstep(0.34, 0.7, hillN) * 70 + smoothstep(0.5, 0.82, hillN) * 58
  const knolls =
    smoothstep(0.4, 0.75, hillN) *
    ((fbm(wx * 0.0045, wz * 0.0045, 2) - 0.5) * 38 +
      ridged(wx * 0.0032 + 7, wz * 0.0032, 2) * 32)

  const miniRidge = ridged(wx * 0.00085 + 40, wz * 0.00085 - 15, 2)
  const ridges = smoothstep(0.45, 0.82, miniRidge) * 80

  const belt = mountainBeltW(wx, wz)
  let h = 18 + continental + rollA + rollB + detail + hills + knolls + ridges

  const basin = fbm(wx * 0.0008 + 100, wz * 0.0008 - 50, 2)
  h -= smoothstep(0.6, 0.88, basin) * 42 * (1 - belt * 0.75)

  if (belt > 0.04) {
    const mtn = mountainMassifW(h, wx, wz, belt)
    const w = smoothstep(0.08, 0.42, belt)
    h = h * (1 - w) + mtn * w
  }

  h *= smoothstep(0.32, 0.78, land)
  return Math.max(h, 0.5)
}

/**
 * Badlands: rolling red hills + buttes/mesas and arroyos (not pure flat tablelands).
 */
function mesaHeightW(base: number, wx: number, wz: number): number {
  // Rolling badland hills (main body of the province)
  const hillRoll =
    (fbm(wx * 0.0016, wz * 0.0016, 3) - 0.38) * 70 +
    (fbm(wx * 0.0038 + 5, wz * 0.0038, 2) - 0.5) * 38
  const knolls = ridged(wx * 0.0024 + 11, wz * 0.0024, 2) * 42

  // Layered butte tops rising above the hills
  const stepNoise = fbm(wx * 0.0011, wz * 0.0011, 2)
  const stepH = 20 + stepNoise * 26
  const stacked = Math.floor(Math.max(25, base * 0.7 + hillRoll + 50) / stepH) * stepH
  const plateau = stacked + (fbm(wx * 0.018, wz * 0.018, 2) - 0.5) * 4
  const cliff = smoothstep(0.32, 0.7, ridged(wx * 0.0032, wz * 0.0032, 2))

  // Arroyos / washes cut into the hills (less dense than pure slot canyons)
  const arroyoA =
    1 - smoothstep(0.03, 0.14, Math.abs(fbm(wx * 0.0028, wz * 0.0028, 2) - 0.5) * 2)
  const gully = clamp01(
    arroyoA * 0.85 * smoothstep(0.42, 0.78, ridged(wx * 0.0018, wz * 0.0018, 2)),
  )
  const canyon = smoothstep(0.58, 0.88, ridged(wx * 0.0016 + 200, wz * 0.0016 - 100, 2))

  // Blend: hills as default, buttes where cliff mask is high
  const hillBase = Math.max(8, base * 0.45 + 22 + hillRoll + knolls)
  const butte = plateau + 14
  let h = hillBase + (butte - hillBase) * (1 - cliff * 0.88) * 0.55
  // Stronger butte contribution on rims
  h += (butte - h) * (1 - cliff) * 0.4

  h -= canyon * canyon * (48 + Math.max(0, h) * 0.18)
  h -= gully * gully * (32 + Math.max(0, h) * 0.12)
  return Math.max(h, 2)
}

function duneHeightW(base: number, wx: number, wz: number): number {
  const dunes =
    Math.sin(wx * 0.014 + fbm(wx * 0.0035, wz * 0.0035, 2) * 3.5) *
    Math.cos(wz * 0.011) *
    12
  const mega = Math.sin(wx * 0.004 + wz * 0.003) * 8 * fbm(wx * 0.001, wz * 0.001, 2)
  return Math.max(3, base * 0.65 + 14 + dunes + mega)
}

export function sampleFeatures(x: number, z: number): TerrainFeatures {
  return featuresAt(...warp(x, z))
}

export function classifyBiome(
  elev: number,
  moisture: number,
  temperature: number,
  features: TerrainFeatures,
  land: number,
  distFromOrigin: number,
  /** Large-scale badlands province 0..1 (optional, defaults to 0). */
  mesaProv = 0,
): Biome {
  if (distFromOrigin < RUNWAY_FLAT_INNER) return 'runway' // dist = ops center
  // Deep ocean only — higher bar so seas are less common
  if (land < 0.3) return 'ocean'

  if (features.lake > 0.55 && elev < 55) return 'water'
  if (features.pond > 0.72 && elev < 40) return 'water'
  if (features.river > 0.74 && elev < 55) return 'water'
  if (elev < 1.2 && moisture > 0.55) return 'water'

  // High alpine / big peaks (thresholds match taller ranges)
  if (elev > 520) return 'snow'
  if (elev > 220) return 'mountain'

  // --- Mesa / badlands: larger provinces + looser climate gate ---
  // Big contiguous regions when mesaProv is high; also classic arid mid-elev.
  const aridish = moisture < 0.5 && temperature > 0.42
  const inMesaElev = elev > 12 && elev < 300
  if (inMesaElev && aridish) {
    // Large province: most of the arid mid-band becomes mesa
    if (mesaProv > 0.36 && moisture < 0.52) return 'mesa'
    // Classic hot/dry mid elevation
    if (temperature > 0.48 && moisture < 0.44 && elev > 18) return 'mesa'
  }
  // Remaining very dry low flats stay sand desert
  if (temperature > 0.55 && moisture < 0.34 && elev < 48) return 'desert'

  if (temperature > 0.52 && moisture > 0.62 && elev < 100) return 'rainforest'
  if (moisture > 0.58 && elev < 30 && temperature < 0.58) return 'swamp'
  if (moisture > 0.46 && elev < 110 && temperature > 0.28) return 'forest'
  // Rolling / highland hills (common mid band) — not in strong mesa province
  if (elev > 45 && elev <= 160 && mesaProv < 0.4) return 'hills'
  return 'plains'
}

function heightFromFieldsW(
  wx: number,
  wz: number,
  land: number,
  moisture: number,
  temperature: number,
  features: TerrainFeatures,
  dist: number,
): number {
  // dist = distance from airfield ops center
  const flatMask = smoothstep(RUNWAY_FLAT_INNER, RUNWAY_FLAT_OUTER, dist)
  if (flatMask <= 0) return 0

  if (land < 0.3) {
    const deep = (0.3 - land) * 70
    return (SEA_LEVEL - 0.15 - deep * 0.04) * flatMask
  }

  let base = landElevationW(wx, wz, land)
  base += (0.5 - moisture) * 10
  base += (temperature - 0.5) * 6

  // Beach ramp between deep ocean and solid land
  const beach = smoothstep(0.3, 0.5, land)
  base = base * beach + (1.5 + base * 0.15) * (1 - beach)

  let h = base

  if (features.lake > 0.35 && moisture > 0.35) {
    h -= features.lake * features.lake * (22 + Math.max(0, h) * 0.22)
  }
  if (features.pond > 0.55) {
    h -= features.pond * features.pond * 16
  }

  const mesaProv = mesaProvince(wx, wz)
  // Bias base height upward in mesa provinces so elev gate lands in mid band
  if (mesaProv > 0.35 && moisture < 0.5) {
    h += mesaProv * 28
    base += mesaProv * 22
  }

  const rough = classifyBiome(
    h,
    moisture,
    temperature,
    features,
    land,
    dist,
    mesaProv,
  )

  switch (rough) {
    case 'ocean':
      h = SEA_LEVEL - 0.4
      break
    case 'desert':
      h =
        duneHeightW(Math.max(h, base * 0.55), wx, wz) -
        smoothstep(0.55, 0.86, ridged(wx * 0.002 + 200, wz * 0.002 - 100, 2)) * 40
      break
    case 'mesa':
      h = mesaHeightW(Math.max(h, base * 0.75), wx, wz)
      if (features.ravine > 0.2) {
        h -= features.ravine * features.ravine * (50 + Math.max(0, h) * 0.35)
      }
      break
    case 'swamp':
      h = Math.min(h * 0.4, 12) + (fbm(wx * 0.01, wz * 0.01, 2) - 0.5) * 3
      h = Math.max(h, 0.25)
      break
    case 'plains':
      h = Math.max(1, h * 0.72 + (fbm(wx * 0.003, wz * 0.003, 2) - 0.5) * 18)
      break
    case 'forest':
      h = h * 0.85 + (fbm(wx * 0.0035, wz * 0.0035, 2) - 0.5) * 24
      break
    case 'rainforest':
      h = h * 0.8 + (fbm(wx * 0.004, wz * 0.004, 2) - 0.5) * 28
      break
    case 'hills':
      h =
        h * 1.06 +
        (fbm(wx * 0.004, wz * 0.004, 2) - 0.42) * 48 +
        ridged(wx * 0.0026, wz * 0.0026, 2) * 42
      break
    case 'mountain':
    case 'snow': {
      // Massif already applied; light polish only
      const belt = mountainBeltW(wx, wz)
      const r = ridged(wx * 0.0007, wz * 0.0007, 2)
      h += belt * (r * r * 100 + (fbm(wx * 0.002, wz * 0.002, 2) - 0.5) * 35)
      if (rough === 'snow') h += smoothstep(0.45, 0.85, belt) * 80
      break
    }
    case 'water':
      h = Math.min(h * 0.12, 0.35)
      break
    default:
      break
  }

  if (features.river > 0.12 && rough !== 'snow' && rough !== 'ocean') {
    h -= features.river * features.river * (22 + Math.max(0, h) * 0.14)
  }
  if (features.stream > 0.35 && rough !== 'ocean' && rough !== 'desert') {
    h -= features.stream * features.stream * 8
  }
  if (features.ravine > 0.18 && rough !== 'ocean') {
    h -= features.ravine * features.ravine * (55 + Math.max(0, h) * 0.4)
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
  const dist = opsDist(x, z)
  if (dist < RUNWAY_FLAT_INNER * 0.9) {
    return {
      height: 0,
      moisture: 0.42,
      temperature: 0.55,
      biome: 'runway',
      river: 0,
      land: 1,
      features: { river: 0, ravine: 0, pond: 0, lake: 0, stream: 0 },
      coastal: 0,
    }
  }

  // One warp for the entire sample — biggest CPU win on the mesh path
  const [wx, wz] = warp(x, z)
  const land = landAt(wx, wz, dist)
  const moisture = moistureAt(wx, wz)
  const temperature = temperatureAt(wx, wz, z)
  const features = featuresAt(wx, wz)
  const mesaProv = mesaProvince(wx, wz)
  const height = heightFromFieldsW(
    wx,
    wz,
    land,
    moisture,
    temperature,
    features,
    dist,
  )
  const biome = classifyBiome(
    height,
    moisture,
    temperature,
    features,
    land,
    dist,
    mesaProv,
  )
  const coastal =
    land > 0.28 && land < 0.52
      ? (1 - Math.abs(land - 0.4) / 0.12) * (height < 18 ? 1 : 0.35)
      : 0
  return {
    height,
    moisture,
    temperature,
    biome,
    river: features.river,
    land,
    features,
    coastal: clamp01(coastal),
  }
}

/** Biomes allowed for airfield spawn (flat / flyable pads). */
const FLAT_SPAWN_BIOMES: ReadonlySet<Biome> = new Set([
  'plains',
  'swamp',
  'desert',
  'forest',
])

export interface FlatSpawn {
  x: number
  z: number
  /** Surface height before ops flatten (usually ~0 after ops set). */
  y: number
  yaw: number
  biome: Biome
}

/**
 * Search for a flat spawn candidate. Call AFTER setWorldSeed / randomizeWorldSeed
 * and BEFORE setOpsCenter so samples see natural terrain (ops still at old center).
 */
export function findFlatSpawn(maxRadius = 9000): FlatSpawn {
  let best: FlatSpawn | null = null
  let bestScore = -1e9

  // Spiral-ish polar search for a flat pad large enough for a runway
  for (let ring = 0; ring <= maxRadius; ring += 280) {
    const steps = ring < 1 ? 1 : Math.min(24, 6 + ((ring / 280) | 0) * 2)
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2 + ring * 0.01
      const x = Math.cos(ang) * ring
      const z = Math.sin(ang) * ring
      const score = scoreFlatPad(x, z)
      if (score > bestScore) {
        bestScore = score
        const c = sampleClimate(x, z)
        best = {
          x,
          z,
          y: c.height,
          yaw: ang + Math.PI, // face roughly outward / along search ray
          biome: c.biome,
        }
      }
      // Good enough early exit
      if (bestScore > 80) {
        return best!
      }
    }
  }

  // Fallback: origin plains-ish (ops flatten will fix it)
  return best ?? { x: 0, z: 0, y: 0, yaw: 0, biome: 'plains' }
}

/** Higher is better. Negative = reject. */
function scoreFlatPad(x: number, z: number): number {
  const c = sampleClimate(x, z)
  if (!FLAT_SPAWN_BIOMES.has(c.biome)) return -1e6
  if (c.land < 0.55) return -1e6
  if (c.features.river > 0.45 || c.features.lake > 0.45) return -1e6
  if (c.features.ravine > 0.25) return -1e6
  // Prefer low absolute relief
  if (c.height > 45) return -1e5
  if (c.height > 28 && c.biome !== 'plains') return -5e4

  // Slope: check neighbors
  const d = 40
  const h0 = c.height
  const hx = sampleClimate(x + d, z).height
  const hz = sampleClimate(x, z + d).height
  const hxm = sampleClimate(x - d, z).height
  const hzm = sampleClimate(x, z - d).height
  const slope =
    (Math.abs(hx - h0) + Math.abs(hz - h0) + Math.abs(hxm - h0) + Math.abs(hzm - h0)) / 4
  if (slope > 6) return -1e5

  // Prefer plains over other flat biomes
  let score = 100 - c.height * 0.8 - slope * 8
  if (c.biome === 'plains') score += 40
  else if (c.biome === 'forest') score += 10
  else if (c.biome === 'desert') score += 15
  else if (c.biome === 'swamp') score += 5

  // Prefer somewhat near origin for shorter first load (optional mild bias)
  const r = Math.hypot(x, z)
  score -= r * 0.002
  return score
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
  coastal = 0,
  land = 1,
): [number, number, number] {
  // Cheap speck (no fbm) — hash is enough for vertex fleck
  const n = hash2(Math.floor(x * 0.5), Math.floor(z * 0.5))
  const speck = (n - 0.5) * 0.05
  const river = features?.river ?? 0
  const ravine = features?.ravine ?? 0

  if (ravine > 0.4 && biome !== 'ocean') {
    const rock = 0.22 + n * 0.08
    return [rock, rock * 0.95, rock * 0.9]
  }

  // River floodplain: darker wet soil / green banks
  if (river > 0.4 && biome !== 'desert' && biome !== 'mesa' && biome !== 'ocean') {
    return [0.16 + speck, 0.34 + n * 0.06, 0.22]
  }

  if ((features?.lake ?? 0) > 0.45 || (features?.pond ?? 0) > 0.65) {
    if (biome === 'water' || height < 1.5) {
      return [0.1, 0.28 + n * 0.08, 0.4 + n * 0.06]
    }
  }

  let col: [number, number, number]

  switch (biome) {
    case 'runway':
      col = [0.24 + speck, 0.3 + speck, 0.2]
      break
    case 'ocean': {
      // Turquoise shallows near coast, deep blue offshore
      const shallow = clamp01((land - 0.25) / 0.2)
      const deep = 1 - shallow
      col = [
        0.04 + shallow * 0.12 + n * 0.02,
        0.16 + shallow * 0.22 + n * 0.05,
        0.28 + shallow * 0.12 + deep * 0.2 + n * 0.04,
      ]
      break
    }
    case 'water':
      col = [0.1, 0.3 + n * 0.08, 0.44 + n * 0.06]
      break
    case 'desert':
      col = [0.78 + speck, 0.66 + speck * 0.4, 0.38 + speck]
      break
    case 'mesa': {
      // Badlands: reddish-orange strata, darker in valleys
      const band = Math.sin(height * 0.55) * 0.06
      const depth = smoothstep(5, 80, height)
      const r = 0.72 + band + speck * 0.5 + depth * 0.12
      const g = 0.28 + band * 0.35 + depth * 0.14 + speck * 0.2
      const b = 0.12 + depth * 0.06
      col = [Math.min(0.95, r), Math.min(0.55, g), Math.min(0.28, b)]
      break
    }
    case 'swamp':
      col = [0.2 + speck, 0.3 + moisture * 0.08, 0.16]
      break
    case 'forest':
      col = [0.15 + speck, 0.36 + moisture * 0.1, 0.14]
      break
    case 'rainforest':
      col = [0.07 + speck, 0.3 + moisture * 0.1, 0.1]
      break
    case 'hills': {
      // Rockier as it climbs toward mountain country
      const rockBlend = smoothstep(70, 180, height)
      const grass: [number, number, number] = [0.3 + speck, 0.42 + speck, 0.2]
      const rock: [number, number, number] = [0.4 + n * 0.08, 0.38, 0.34]
      col = [
        grass[0] + (rock[0] - grass[0]) * rockBlend,
        grass[1] + (rock[1] - grass[1]) * rockBlend,
        grass[2] + (rock[2] - grass[2]) * rockBlend,
      ]
      break
    }
    case 'mountain': {
      // Grey rock with alpine snow dust high up
      const rock = 0.4 + n * 0.1
      const snowAmt = smoothstep(350, 700, height)
      const c = rock + (0.92 - rock) * snowAmt
      col = [c, c * (1 - snowAmt * 0.02), c + snowAmt * 0.02]
      break
    }
    case 'snow': {
      const t = smoothstep(400, 1000, height)
      const c = 0.5 + t * 0.45
      col = [c, c, c + 0.02]
      break
    }
    case 'plains':
    default:
      col = [0.28 + speck, 0.44 + speck + moisture * 0.04, 0.18]
      break
  }

  // Sandy beach tint on coastal land
  if (coastal > 0.15 && biome !== 'ocean' && biome !== 'water' && biome !== 'mesa') {
    const sand: [number, number, number] = [0.82 + speck, 0.72 + speck * 0.5, 0.48]
    const t = clamp01(coastal)
    col = [
      col[0] + (sand[0] - col[0]) * t,
      col[1] + (sand[1] - col[1]) * t,
      col[2] + (sand[2] - col[2]) * t,
    ]
  }

  return col
}

/**
 * Post-shade: cliff faces go rocky/darker; steep badlands get deeper red.
 * slope01 is 0 flat → 1 vertical-ish (from mesh finite differences).
 */
export function applySlopeShading(
  col: [number, number, number],
  slope01: number,
  biome: Biome,
  height: number,
): [number, number, number] {
  const s = clamp01(slope01)
  if (s < 0.12) return col

  if (biome === 'mesa') {
    // Steep badlands walls: darker burnt orange
    const wall: [number, number, number] = [0.45, 0.16, 0.08]
    const t = smoothstep(0.15, 0.7, s)
    return [
      col[0] + (wall[0] - col[0]) * t,
      col[1] + (wall[1] - col[1]) * t,
      col[2] + (wall[2] - col[2]) * t,
    ]
  }

  if (biome === 'mountain' || biome === 'snow' || biome === 'hills') {
    const rock: [number, number, number] = [0.32, 0.3, 0.28]
    const t = smoothstep(0.18, 0.75, s) * (biome === 'hills' ? 0.7 : 1)
    // Keep snow on high gentle slopes
    const snowKeep = biome === 'snow' || height > 500 ? smoothstep(0.5, 0.15, s) * 0.4 : 0
    const t2 = Math.max(0, t - snowKeep)
    return [
      col[0] + (rock[0] - col[0]) * t2,
      col[1] + (rock[1] - col[1]) * t2,
      col[2] + (rock[2] - col[2]) * t2,
    ]
  }

  // Mild rock bleed on any steep face
  const t = smoothstep(0.35, 0.85, s) * 0.45
  return [
    col[0] * (1 - t) + 0.35 * t,
    col[1] * (1 - t) + 0.32 * t,
    col[2] * (1 - t) + 0.28 * t,
  ]
}
