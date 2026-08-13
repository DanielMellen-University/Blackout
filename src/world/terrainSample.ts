import { clamp01, fbm, hash2, ridged, smoothstep } from './noise'

/**
 * Half-scale biomes, tall ranges, carved water features, coasts, and slope cues.
 * sampleClimate is the hot path — one warp, fewer noise octaves.
 */

export const RUNWAY_FLAT_INNER = 100
export const RUNWAY_FLAT_OUTER = 280
export const SEA_LEVEL = 0
/** Flatten this far ahead of the runway so takeoff isn’t into a wall. */
const TAKEOFF_FLAT_AHEAD = 1050
const TAKEOFF_FLAT_BEHIND = 80
const TAKEOFF_FLAT_HALF_W = 90

/** Airfield / ops center — terrain is forced flat around this point. */
let opsX = 0
let opsZ = 0
/** Takeoff heading (same yaw as the jet: +Z rotated about Y). */
let opsYaw = 0

export function setOpsCenter(x: number, z: number, yaw = 0): void {
  opsX = x
  opsZ = z
  opsYaw = yaw
}

export function getOpsCenter(): { x: number; z: number; yaw: number } {
  return { x: opsX, z: opsZ, yaw: opsYaw }
}

function opsDist(x: number, z: number): number {
  return Math.hypot(x - opsX, z - opsZ)
}

/** 1 = fully flattened (runway pad or takeoff corridor). */
function opsFlatten(x: number, z: number): number {
  const dist = opsDist(x, z)
  const radial = 1 - smoothstep(RUNWAY_FLAT_INNER, RUNWAY_FLAT_OUTER, dist)

  const dx = x - opsX
  const dz = z - opsZ
  const fx = Math.sin(opsYaw)
  const fz = Math.cos(opsYaw)
  const along = dx * fx + dz * fz
  const lat = Math.abs(-dx * fz + dz * fx)
  const alongW =
    along < 0
      ? smoothstep(-TAKEOFF_FLAT_BEHIND, -25, along)
      : 1 - smoothstep(TAKEOFF_FLAT_AHEAD * 0.72, TAKEOFF_FLAT_AHEAD, along)
  const latW = 1 - smoothstep(TAKEOFF_FLAT_HALF_W * 0.55, TAKEOFF_FLAT_HALF_W, lat)
  const corridor = along > -TAKEOFF_FLAT_BEHIND && along < TAKEOFF_FLAT_AHEAD ? alongW * latW : 0

  return Math.max(radial, corridor)
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
  /** Second biome for seamless color/height cross-fade. */
  biomeB: Biome
  /** 0 = full primary, 1 = full secondary. */
  biomeMix: number
  /** Convenience: features.river */
  river: number
  land: number
  features: TerrainFeatures
  /** 1 on beach shelf between land and open sea. */
  coastal: number
}

/** Single domain warp — larger warp = softer large-scale biome edges. */
function warp(x: number, z: number): [number, number] {
  const wx = x + (fbm(x * 0.00018 + 2, z * 0.00018 - 1, 2) - 0.5) * 420
  const wz = z + (fbm(x * 0.00018 - 4, z * 0.00018 + 8, 2) - 0.5) * 420
  return [wx, wz]
}

function landAt(wx: number, wz: number, distFromOps: number, flatten = 0): number {
  if (distFromOps < RUNWAY_FLAT_OUTER || flatten > 0.35) {
    return Math.max(0.92, 1 - distFromOps / (RUNWAY_FLAT_OUTER * 4))
  }
  // Slightly larger continents + seas
  const continent = fbm(wx * 0.00016, wz * 0.00016, 3)
  const detail = fbm(wx * 0.00055 + 40, wz * 0.00055 - 20, 2)
  let land = clamp01((continent * 0.78 + detail * 0.22 - 0.16) / 0.54)
  const inlandSea = fbm(wx * 0.00055 + 300, wz * 0.00055 - 150, 2)
  if (inlandSea > 0.86 && land > 0.55) {
    land *= smoothstep(0.95, 0.86, inlandSea)
  }
  return land
}

/**
 * Large-scale arid / desert provinces (declared early so climate can dry out).
 * Wider ramp than before so deserts show up as big sand seas, not crumbs.
 */
function aridProvince(wx: number, wz: number): number {
  return smoothstep(0.36, 0.68, fbm(wx * 0.00012 - 120, wz * 0.00012 + 60, 3))
}

function moistureAt(wx: number, wz: number): number {
  // Slight dry bias so sand/mesa aren't fighting mid-wet noise forever
  let m =
    fbm(wx * 0.00028, wz * 0.00028, 3) * 0.66 +
    fbm(wx * 0.0009 + 30, wz * 0.0009 - 10, 2) * 0.24 +
    fbm(wx * 0.0022 - 15, wz * 0.0022 + 9, 2) * 0.1
  m -= 0.04
  // Arid provinces pull moisture down hard → real desert belts
  const arid = aridProvince(wx, wz)
  m -= arid * 0.28
  return clamp01(m)
}

function temperatureAt(wx: number, wz: number, z: number): number {
  const lat = 0.5 + z * 0.000045
  let t =
    lat * 0.18 +
    fbm(wx * 0.0003 - 50, wz * 0.0003 + 20, 2) * 0.68 +
    fbm(wx * 0.0009 + 8, wz * 0.0009 - 4, 2) * 0.14
  // Arid belts run hotter (classic desert heat)
  t += aridProvince(wx, wz) * 0.12
  return clamp01(t)
}

/**
 * Large-scale badlands province. Higher = more likely mesa country.
 * Slightly less common so flat desert can win low arid land.
 */
function mesaProvince(wx: number, wz: number): number {
  const a = fbm(wx * 0.00011 + 90, wz * 0.00011 - 40, 3)
  const b = fbm(wx * 0.00026 + 12, wz * 0.00026 - 8, 2)
  return clamp01(a * 0.7 + b * 0.3 - 0.08)
}

/** Extra province masks for biome variety (large, soft). */
function wetProvince(wx: number, wz: number): number {
  return smoothstep(0.42, 0.72, fbm(wx * 0.00014 + 200, wz * 0.00014 - 80, 3))
}
function coldProvince(wx: number, wz: number): number {
  return smoothstep(0.5, 0.8, fbm(wx * 0.00012 + 40, wz * 0.00012 + 180, 2))
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
 * Mountain-range mask — soft wide foothills, firm core for real peaks.
 */
function mountainBeltW(wx: number, wz: number): number {
  const spine = ridged(wx * 0.00018 - 2, wz * 0.00018 + 6, 3)
  const gate = fbm(wx * 0.00011 + 70, wz * 0.00011 - 30, 2)
  return smoothstep(0.26, 0.76, spine) * smoothstep(0.22, 0.66, gate)
}

/**
 * Ridged massifs: soft flanks / aprons, but sharp summits where crest is high.
 */
function mountainMassifW(
  base: number,
  wx: number,
  wz: number,
  belt: number,
): number {
  if (belt < 0.001) return base
  const t = belt
  const r1 = ridged(wx * 0.00042, wz * 0.00042, 3)
  const r2 = ridged(wx * 0.00065 + 40, wz * 0.00065 - 15, 2)
  const ridge = Math.max(r1, r2 * 0.85)
  const chain = fbm(wx * 0.00048 + 12, wz * 0.00048 - 8, 3)
  const summit = Math.pow(smoothstep(0.4, 0.93, chain), 1.4)
  const col = 1 - 0.4 * (1 - smoothstep(0.2, 0.55, chain))
  // Flanks soft; crest sharp only near true ridgelines
  const crestSoft = Math.pow(ridge, 1.15)
  const crestSharp = Math.pow(ridge, 1.85)
  const crest = crestSoft * (1 - summit * 0.65) + crestSharp * (summit * 0.65 + 0.15)
  const flank = Math.pow(ridge, 0.9)
  const apron = t * flank * (240 + fbm(wx * 0.0005, wz * 0.0005, 2) * 160)
  const wall = t * t * crest * col * (480 + summit * 340)
  // Peaks punch up hard when summit mask is on
  const peaks = t * t * crestSharp * summit * (380 + chain * 280)
  const slopeProxy = clamp01(ridge * (1 - ridge) * 4)
  const rockA =
    (fbm(wx * 0.0022 + 3, wz * 0.0022, 2) - 0.5) * 85 * slopeProxy * t
  const rockB = ridged(wx * 0.0017 - 5, wz * 0.0017, 2) * 48 * crest * t
  const crag =
    ridged(wx * 0.0026, wz * 0.0026, 2) * 40 * summit * crestSharp * t
  return base * (1 - t * 0.85) + apron + wall + peaks + rockA + rockB + crag
}

function landElevationW(wx: number, wz: number, land: number): number {
  // Stronger multi-scale height variation
  const continental = (fbm(wx * 0.00026, wz * 0.00026, 3) - 0.3) * 120
  const rollA = (fbm(wx * 0.00085 + 11, wz * 0.00085 - 7, 3) - 0.48) * 62
  const rollB = (fbm(wx * 0.0028 - 3, wz * 0.0028 + 9, 2) - 0.5) * 48
  const detail = (fbm(wx * 0.009, wz * 0.009, 2) - 0.5) * 10

  const hillN = fbm(wx * 0.00125 + 20, wz * 0.00125, 3)
  const hills =
    smoothstep(0.28, 0.72, hillN) * 82 + smoothstep(0.44, 0.86, hillN) * 64
  const knolls =
    smoothstep(0.34, 0.78, hillN) *
    ((fbm(wx * 0.0038, wz * 0.0038, 2) - 0.5) * 40 +
      ridged(wx * 0.0028 + 7, wz * 0.0028, 2) * 30)

  const miniRidge = ridged(wx * 0.0007 + 40, wz * 0.0007 - 15, 2)
  const ridges = smoothstep(0.36, 0.86, miniRidge) * 78

  const belt = mountainBeltW(wx, wz)
  let h = 16 + continental + rollA + rollB + detail + hills + knolls + ridges

  const basin = fbm(wx * 0.0006 + 100, wz * 0.0006 - 50, 2)
  h -= smoothstep(0.52, 0.9, basin) * 48 * (1 - belt * 0.75)

  if (belt > 0.03) {
    const mtn = mountainMassifW(h, wx, wz, belt)
    // Soft foothill blend; core takes over fully at high belt
    const w = smoothstep(0.04, 0.5, belt)
    h = h * (1 - w) + mtn * w
  }

  h *= smoothstep(0.3, 0.8, land)
  return Math.max(h, 0.5)
}

/** Soft stair: like floor() but with eased risers between layers. */
function softSteps(value: number, stepH: number): number {
  const n = value / Math.max(4, stepH)
  const fl = Math.floor(n)
  const frac = n - fl
  // Smooth riser instead of a hard shelf edge
  const eased = frac * frac * (3 - 2 * frac)
  return (fl + eased) * stepH
}

/**
 * Badlands: rolling red hills + buttes/mesas and arroyos (not pure flat tablelands).
 */
function mesaHeightW(base: number, wx: number, wz: number): number {
  // Rolling badland hills (main body of the province)
  const hillRoll =
    (fbm(wx * 0.0016, wz * 0.0016, 3) - 0.38) * 70 +
    (fbm(wx * 0.0038 + 5, wz * 0.0038, 2) - 0.5) * 38
  const knolls = ridged(wx * 0.0024 + 11, wz * 0.0024, 2) * 36

  // Layered butte tops — soft steps, not hard terraces
  const stepNoise = fbm(wx * 0.0011, wz * 0.0011, 2)
  const stepH = 22 + stepNoise * 24
  const stacked = softSteps(Math.max(25, base * 0.7 + hillRoll + 50), stepH)
  const plateau = stacked + (fbm(wx * 0.014, wz * 0.014, 2) - 0.5) * 5
  // Wider cliff mask = gentler butte sides
  const cliff = smoothstep(0.22, 0.78, ridged(wx * 0.0028, wz * 0.0028, 2))

  // Arroyos / washes — broader, shallower cuts
  const arroyoA =
    1 - smoothstep(0.04, 0.18, Math.abs(fbm(wx * 0.0028, wz * 0.0028, 2) - 0.5) * 2)
  const gully = clamp01(
    arroyoA * 0.8 * smoothstep(0.36, 0.82, ridged(wx * 0.0018, wz * 0.0018, 2)),
  )
  const canyon = smoothstep(0.52, 0.92, ridged(wx * 0.0016 + 200, wz * 0.0016 - 100, 2))

  const hillBase = Math.max(8, base * 0.45 + 22 + hillRoll + knolls)
  const butte = plateau + 12
  // Heavier hill base, softer butte blend
  let h = hillBase + (butte - hillBase) * (1 - cliff * 0.75) * 0.48
  h += (butte - h) * (1 - cliff) * 0.32

  // Softer carve (less squared blowout)
  h -= Math.pow(canyon, 1.35) * (36 + Math.max(0, h) * 0.14)
  h -= Math.pow(gully, 1.35) * (24 + Math.max(0, h) * 0.1)
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

/** Land biomes that participate in soft height/color blending. */
const BLEND_BIOMES: readonly Biome[] = [
  'plains',
  'forest',
  'rainforest',
  'desert',
  'mesa',
  'swamp',
  'hills',
  'mountain',
  'snow',
] as const

type BiomeWeightMap = Partial<Record<Biome, number>>

/**
 * Soft fitness scores for each land biome — used for seamless height + color.
 * Scores are unnormalized; caller normalizes / picks top two.
 */
function biomeFitness(
  elev: number,
  moisture: number,
  temperature: number,
  features: TerrainFeatures,
  land: number,
  mesaProv: number,
  wet: number,
  arid: number,
  cold: number,
): BiomeWeightMap {
  const w: BiomeWeightMap = {}

  // Snow / mountain — elevation driven, cold province helps snow lower
  w.snow =
    smoothstep(380, 620, elev) * (0.55 + cold * 0.55) +
    smoothstep(280, 480, elev) * cold * 0.45
  w.mountain =
    smoothstep(140, 280, elev) * (1 - smoothstep(520, 720, elev) * 0.7) +
    smoothstep(100, 200, elev) * mountainBeltHint(elev) * 0.35

  // Mesa / desert — arid provinces. Desert owns low flats; mesa owns mid/high badlands.
  const aridish =
    clamp01((0.55 - moisture) * 2.4) * clamp01((temperature - 0.32) * 2.1)
  // Mesa prefers some relief / province signal, not pure flats
  w.mesa =
    smoothstep(28, 70, elev) *
    (1 - smoothstep(240, 320, elev)) *
    aridish *
    (0.25 + mesaProv * 1.05 + arid * 0.35)
  // Desert: low–mid elev sand seas; much stronger when arid province is on
  w.desert =
    smoothstep(0.32, 0.5, land) *
    (1 - smoothstep(90, 160, elev)) * // allow taller dunes / scrub flats
    clamp01((0.52 - moisture) * 2.6) *
    clamp01((temperature - 0.34) * 2.0) *
    (0.55 + arid * 1.15 + aridish * 0.45) *
    (1 - mesaProv * 0.35) // mesa no longer steals most dry land

  // Wet biomes (slightly weaker so they don't blanket everything)
  w.rainforest =
    smoothstep(0.5, 0.74, moisture) *
    smoothstep(0.42, 0.65, temperature) *
    (1 - smoothstep(90, 140, elev)) *
    (0.35 + wet * 0.7) *
    (1 - arid * 0.85)
  w.swamp =
    smoothstep(0.52, 0.74, moisture) *
    (1 - smoothstep(22, 48, elev)) *
    (1 - smoothstep(0.62, 0.78, temperature)) *
    (0.4 + wet * 0.5) *
    (1 - arid)
  w.forest =
    smoothstep(0.4, 0.6, moisture) *
    (1 - smoothstep(130, 190, elev)) *
    smoothstep(0.22, 0.4, temperature) *
    (0.45 + wet * 0.35 + (1 - arid) * 0.2) *
    (1 - arid * 0.75)

  // Hills mid band — weaker in arid belts
  w.hills =
    smoothstep(35, 70, elev) *
    (1 - smoothstep(150, 210, elev)) *
    (1 - mesaProv * 0.55) *
    (1 - arid * 0.55) *
    (0.55 + (1 - Math.abs(moisture - 0.45) * 1.2) * 0.35)

  // Plains: step back hard in arid provinces so sand can win
  w.plains =
    (1 - smoothstep(70, 120, elev)) *
    (1 - clamp01(moisture - 0.55) * 1.4) *
    (0.4 + (1 - wet * 0.3) * 0.35) *
    (1 - aridish * 0.75) *
    (1 - arid * 0.85)

  // Inland water depression (soft, rarely dominates land)
  const waterFit =
    Math.max(features.lake, features.pond * 0.9, features.river * 0.85) *
    (1 - smoothstep(40, 80, elev))
  if (waterFit > 0.2) w.water = waterFit * 1.1

  // Kill tiny noise
  for (const k of Object.keys(w) as Biome[]) {
    if ((w[k] ?? 0) < 0.04) delete w[k]
  }
  return w
}

function mountainBeltHint(elev: number): number {
  return smoothstep(120, 240, elev)
}

/** Normalize weights; return primary, secondary, mix t, and full map. */
function resolveBiomeBlend(weights: BiomeWeightMap): {
  primary: Biome
  secondary: Biome
  mix: number
  weights: BiomeWeightMap
} {
  let best: Biome = 'plains'
  let bestV = -1
  let second: Biome = 'plains'
  let secondV = -1
  let sum = 0
  for (const b of BLEND_BIOMES) {
    const v = weights[b] ?? 0
    if (v <= 0) continue
    sum += v
    if (v > bestV) {
      second = best
      secondV = bestV
      best = b
      bestV = v
    } else if (v > secondV) {
      second = b
      secondV = v
    }
  }
  if (weights.water && (weights.water ?? 0) > bestV) {
    second = best
    secondV = bestV
    best = 'water'
    bestV = weights.water
    sum += weights.water
  }
  // Normalize retained weights
  const norm: BiomeWeightMap = {}
  if (sum <= 1e-6) {
    norm.plains = 1
    return { primary: 'plains', secondary: 'plains', mix: 0, weights: norm }
  }
  for (const b of Object.keys(weights) as Biome[]) {
    norm[b] = (weights[b] ?? 0) / sum
  }
  // Mix toward secondary when close (seamless boundary)
  const mix =
    bestV > 0 && secondV > 0
      ? clamp01((secondV / bestV) * 0.55)
      : 0
  return { primary: best, secondary: second, mix, weights: norm }
}

export function classifyBiome(
  elev: number,
  moisture: number,
  temperature: number,
  features: TerrainFeatures,
  land: number,
  distFromOrigin: number,
  mesaProv = 0,
  wx = 0,
  wz = 0,
): Biome {
  if (distFromOrigin < RUNWAY_FLAT_INNER) return 'runway'
  if (land < 0.36) return 'ocean'
  if (features.lake > 0.62 && elev < 50) return 'water'
  if (features.pond > 0.78 && elev < 35) return 'water'
  if (features.river > 0.78 && elev < 50) return 'water'
  if (elev < 1.0 && moisture > 0.55) return 'water'

  const wet = wetProvince(wx, wz)
  const arid = aridProvince(wx, wz)
  const cold = coldProvince(wx, wz)
  const fit = biomeFitness(
    elev,
    moisture,
    temperature,
    features,
    land,
    mesaProv,
    wet,
    arid,
    cold,
  )
  return resolveBiomeBlend(fit).primary
}

/**
 * Spatial smooth weight for foothills/valleys.
 * Peaks keep sharp silhouettes (smooth falls off with elevation / ridge).
 */
const HEIGHT_SMOOTH = 0.34
const HEIGHT_SMOOTH_D = 28

function shapedHeightForBiome(
  biome: Biome,
  base: number,
  h: number,
  wx: number,
  wz: number,
  features: TerrainFeatures,
): number {
  switch (biome) {
    case 'desert':
      return (
        duneHeightW(Math.max(h, base * 0.55), wx, wz) -
        smoothstep(0.5, 0.9, ridged(wx * 0.0018 + 200, wz * 0.0018 - 100, 2)) * 36
      )
    case 'mesa': {
      let mh = mesaHeightW(Math.max(h, base * 0.75), wx, wz)
      if (features.ravine > 0.2) {
        mh -= Math.pow(features.ravine, 1.45) * (38 + Math.max(0, mh) * 0.28)
      }
      return mh
    }
    case 'swamp':
      return Math.max(
        0.25,
        Math.min(h * 0.4, 12) + (fbm(wx * 0.009, wz * 0.009, 2) - 0.5) * 3.5,
      )
    case 'plains':
      return Math.max(
        1,
        h * 0.7 + (fbm(wx * 0.0024, wz * 0.0024, 2) - 0.5) * 22,
      )
    case 'forest':
      return h * 0.84 + (fbm(wx * 0.0028, wz * 0.0028, 2) - 0.5) * 26
    case 'rainforest':
      return h * 0.78 + (fbm(wx * 0.0032, wz * 0.0032, 2) - 0.5) * 30
    case 'hills':
      return (
        h * 1.08 +
        (fbm(wx * 0.003, wz * 0.003, 2) - 0.42) * 52 +
        ridged(wx * 0.0019, wz * 0.0019, 2) * 38
      )
    case 'mountain':
    case 'snow': {
      const belt = mountainBeltW(wx, wz)
      const r = ridged(wx * 0.00058, wz * 0.00058, 2)
      // Sharp ridgeline polish on peaks
      let out =
        h +
        belt *
          (Math.pow(r, 1.7) * 95 +
            Math.pow(r, 1.1) * 40 +
            (fbm(wx * 0.0016, wz * 0.0016, 2) - 0.5) * 32)
      if (biome === 'snow') out += smoothstep(0.38, 0.88, belt) * 90
      return out
    }
    case 'water':
      return Math.min(h * 0.12, 0.35)
    default:
      return h
  }
}

/**
 * Raw height at warped coords (no spatial smooth). Soft-blends biome shapes.
 */
function heightCoreW(
  wx: number,
  wz: number,
  land: number,
  moisture: number,
  temperature: number,
  features: TerrainFeatures,
  _dist: number,
  flatten: number,
): number {
  const flatMask = 1 - flatten
  if (flatMask <= 0) return 0

  if (land < 0.36) {
    const deep = (0.36 - land) * 60
    return (SEA_LEVEL - 0.15 - deep * 0.04) * flatMask
  }

  let base = landElevationW(wx, wz, land)
  base += (0.5 - moisture) * 12
  base += (temperature - 0.5) * 8

  const beach = smoothstep(0.34, 0.58, land)
  base = base * beach + (1.5 + base * 0.15) * (1 - beach)

  let h = base

  if (features.lake > 0.35 && moisture > 0.35) {
    h -= Math.pow(features.lake, 1.4) * (18 + Math.max(0, h) * 0.18)
  }
  if (features.pond > 0.55) {
    h -= Math.pow(features.pond, 1.4) * 12
  }

  const mesaProv = mesaProvince(wx, wz)
  const wet = wetProvince(wx, wz)
  const arid = aridProvince(wx, wz)
  const cold = coldProvince(wx, wz)
  if (mesaProv > 0.4 && moisture < 0.48) {
    h += mesaProv * 28
    base += mesaProv * 18
  }

  const fit = biomeFitness(
    h,
    moisture,
    temperature,
    features,
    land,
    mesaProv,
    wet,
    arid,
    cold,
  )
  const { weights, primary } = resolveBiomeBlend(fit)

  // Weighted height from top biomes (seamless across province edges)
  let hBlend = 0
  let wSum = 0
  for (const b of Object.keys(weights) as Biome[]) {
    const wt = weights[b] ?? 0
    if (wt < 0.03) continue
    hBlend += wt * shapedHeightForBiome(b, base, h, wx, wz, features)
    wSum += wt
  }
  if (wSum > 1e-6) h = hBlend / wSum
  else h = shapedHeightForBiome(primary, base, h, wx, wz, features)

  // Shared soft carves (all land)
  if (features.river > 0.12 && primary !== 'snow' && primary !== 'ocean') {
    h -= Math.pow(features.river, 1.45) * (18 + Math.max(0, h) * 0.12)
  }
  if (features.stream > 0.35 && primary !== 'ocean' && primary !== 'desert') {
    h -= Math.pow(features.stream, 1.4) * 6
  }
  if (features.ravine > 0.18 && primary !== 'ocean') {
    h -= Math.pow(features.ravine, 1.45) * (42 + Math.max(0, h) * 0.32)
  }

  if (
    (features.lake > 0.55 || features.pond > 0.72 || features.river > 0.75) &&
    h < 4 &&
    primary !== 'desert' &&
    primary !== 'mesa' &&
    primary !== 'ocean'
  ) {
    h = Math.min(h, 0.3)
  }

  h = Math.max(h, primary === 'ocean' ? SEA_LEVEL - 2 : -2)
  return h * flatMask
}

/** Neighbor sample at offset warped coords (re-samples climate fields). */
function heightAtWarped(wx: number, wz: number, dist: number, flatten: number): number {
  const land = landAt(wx, wz, dist, flatten)
  const moisture = moistureAt(wx, wz)
  const temperature = temperatureAt(wx, wz, wz)
  const features = featuresAt(wx, wz)
  return heightCoreW(wx, wz, land, moisture, temperature, features, dist, flatten)
}

/**
 * Height with peak-preserving spatial smooth: foothills ease, summits stay sharp.
 */
function heightFromFieldsW(
  wx: number,
  wz: number,
  land: number,
  moisture: number,
  temperature: number,
  features: TerrainFeatures,
  dist: number,
  flatten: number,
): number {
  const h0 = heightCoreW(wx, wz, land, moisture, temperature, features, dist, flatten)
  if (land < 0.34 || flatten > 0.85) return h0

  const d = HEIGHT_SMOOTH_D
  const avg =
    (heightAtWarped(wx + d, wz, dist, flatten) +
      heightAtWarped(wx - d, wz, dist, flatten) +
      heightAtWarped(wx, wz + d, dist, flatten) +
      heightAtWarped(wx, wz - d, dist, flatten)) *
    0.25

  // High peaks: almost no smooth (keep sharp silhouettes)
  const peakKeep = smoothstep(200, 480, h0)
  const w = HEIGHT_SMOOTH * (1 - peakKeep * 0.9)
  return h0 * (1 - w) + avg * w
}

export function sampleClimate(x: number, z: number): Climate {
  const dist = opsDist(x, z)
  const flatten = opsFlatten(x, z)
  if (dist < RUNWAY_FLAT_INNER * 0.9 || flatten > 0.92) {
    return {
      height: 0,
      moisture: 0.42,
      temperature: 0.55,
      biome: flatten > 0.92 && dist >= RUNWAY_FLAT_INNER ? 'plains' : 'runway',
      biomeB: 'plains',
      biomeMix: 0,
      river: 0,
      land: 1,
      features: { river: 0, ravine: 0, pond: 0, lake: 0, stream: 0 },
      coastal: 0,
    }
  }

  const [wx, wz] = warp(x, z)
  const land = landAt(wx, wz, dist, flatten)
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
    flatten,
  )

  let biome: Biome
  let biomeB: Biome
  let biomeMix = 0
  if (land < 0.36) {
    biome = 'ocean'
    biomeB = 'ocean'
  } else if (dist < RUNWAY_FLAT_INNER) {
    biome = 'runway'
    biomeB = 'runway'
  } else {
    const wet = wetProvince(wx, wz)
    const arid = aridProvince(wx, wz)
    const cold = coldProvince(wx, wz)
    const fit = biomeFitness(
      height,
      moisture,
      temperature,
      features,
      land,
      mesaProv,
      wet,
      arid,
      cold,
    )
    // Water overrides when strong
    if (
      (features.lake > 0.62 && height < 50) ||
      (features.pond > 0.78 && height < 35) ||
      (features.river > 0.78 && height < 50)
    ) {
      biome = 'water'
      biomeB = resolveBiomeBlend(fit).primary
      biomeMix = 0.2
    } else {
      const blend = resolveBiomeBlend(fit)
      biome = blend.primary
      biomeB = blend.secondary
      biomeMix = blend.mix
    }
  }

  const coastal =
    land > 0.32 && land < 0.55
      ? (1 - Math.abs(land - 0.43) / 0.12) * (height < 18 ? 1 : 0.35)
      : 0
  return {
    height,
    moisture,
    temperature,
    biome,
    biomeB,
    biomeMix,
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
 * Search for a flat spawn with a clear takeoff lane.
 * Call AFTER setWorldSeed / BEFORE setOpsCenter (natural heights).
 */
export function findFlatSpawn(maxRadius = 9000): FlatSpawn {
  let best: FlatSpawn | null = null
  let bestScore = -1e9

  for (let ring = 0; ring <= maxRadius; ring += 280) {
    const steps = ring < 1 ? 1 : Math.min(24, 6 + ((ring / 280) | 0) * 2)
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2 + ring * 0.01
      const x = Math.cos(ang) * ring
      const z = Math.sin(ang) * ring
      const pad = scoreFlatPad(x, z)
      if (pad < 0) continue
      const dep = bestDeparture(x, z)
      if (dep.score < -2e5) continue
      const score = pad + dep.score
      if (score > bestScore) {
        bestScore = score
        const c = sampleClimate(x, z)
        best = { x, z, y: c.height, yaw: dep.yaw, biome: c.biome }
      }
      // Need a decent pad AND a clear departure — don't early-out on pad alone
      if (bestScore > 160 && dep.score > 20) return best!
    }
  }

  return best ?? { x: 0, z: 0, y: 0, yaw: 0, biome: 'plains' }
}

/** Higher is better. Negative = reject. */
function scoreFlatPad(x: number, z: number): number {
  const c = sampleClimate(x, z)
  if (!FLAT_SPAWN_BIOMES.has(c.biome)) return -1e6
  if (c.land < 0.55) return -1e6
  if (c.features.river > 0.45 || c.features.lake > 0.45) return -1e6
  if (c.features.ravine > 0.25) return -1e6
  if (c.height > 45) return -1e5
  if (c.height > 28 && c.biome !== 'plains') return -5e4

  const d = 40
  const h0 = c.height
  const hx = sampleClimate(x + d, z).height
  const hz = sampleClimate(x, z + d).height
  const hxm = sampleClimate(x - d, z).height
  const hzm = sampleClimate(x, z - d).height
  const slope =
    (Math.abs(hx - h0) + Math.abs(hz - h0) + Math.abs(hxm - h0) + Math.abs(hzm - h0)) / 4
  if (slope > 6) return -1e5

  let score = 100 - c.height * 0.8 - slope * 8
  if (c.biome === 'plains') score += 40
  else if (c.biome === 'forest') score += 10
  else if (c.biome === 'desert') score += 15
  else if (c.biome === 'swamp') score += 5

  score -= Math.hypot(x, z) * 0.002
  return score
}

/**
 * Pick a takeoff heading with the lowest rise ahead (no mountain in the face).
 */
function bestDeparture(x: number, z: number): { yaw: number; score: number } {
  const h0 = sampleClimate(x, z).height
  let bestYaw = 0
  let best = -1e9
  const dirs = 16
  for (let i = 0; i < dirs; i++) {
    const yaw = (i / dirs) * Math.PI * 2
    const s = scoreDeparture(x, z, yaw, h0)
    if (s > best) {
      best = s
      bestYaw = yaw
    }
  }
  return { yaw: bestYaw, score: best }
}

function scoreDeparture(x: number, z: number, yaw: number, h0: number): number {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  let score = 0
  const ranges = [90, 180, 320, 480, 680, 900, 1150]
  for (const d of ranges) {
    for (const lat of [0, -55, 55]) {
      const h = sampleClimate(x + fx * d + rx * lat, z + fz * d + rz * lat).height
      const rise = h - h0
      // Wall in the near departure — reject
      if (d <= 500 && rise > 55) return -1e6
      if (d <= 900 && rise > 110) return -4e5
      if (rise > 180) return -2e5
      const near = 1 + 500 / d
      score -= Math.max(0, rise) * 0.9 * near
      score += Math.max(0, -rise) * 0.12
    }
  }
  return score
}

export function sampleTerrainHeight(x: number, z: number): number {
  return sampleClimate(x, z).height
}

function biomeColorSolid(
  biome: Biome,
  height: number,
  moisture: number,
  n: number,
  speck: number,
  land: number,
): [number, number, number] {
  switch (biome) {
    case 'runway':
      return [0.24 + speck, 0.3 + speck, 0.2]
    case 'ocean': {
      const shallow = clamp01((land - 0.25) / 0.2)
      const deep = 1 - shallow
      return [
        0.04 + shallow * 0.12 + n * 0.02,
        0.16 + shallow * 0.22 + n * 0.05,
        0.28 + shallow * 0.12 + deep * 0.2 + n * 0.04,
      ]
    }
    case 'water':
      return [0.1, 0.3 + n * 0.08, 0.44 + n * 0.06]
    case 'desert':
      return [0.78 + speck, 0.66 + speck * 0.4, 0.38 + speck]
    case 'mesa': {
      const band = Math.sin(height * 0.55) * 0.06
      const depth = smoothstep(5, 80, height)
      const r = 0.72 + band + speck * 0.5 + depth * 0.12
      const g = 0.28 + band * 0.35 + depth * 0.14 + speck * 0.2
      const b = 0.12 + depth * 0.06
      return [Math.min(0.95, r), Math.min(0.55, g), Math.min(0.28, b)]
    }
    case 'swamp':
      return [0.2 + speck, 0.3 + moisture * 0.08, 0.16]
    case 'forest':
      return [0.15 + speck, 0.36 + moisture * 0.1, 0.14]
    case 'rainforest':
      return [0.07 + speck, 0.3 + moisture * 0.1, 0.1]
    case 'hills': {
      const rockBlend = smoothstep(70, 180, height)
      const grass: [number, number, number] = [0.3 + speck, 0.42 + speck, 0.2]
      const rock: [number, number, number] = [0.4 + n * 0.08, 0.38, 0.34]
      return [
        grass[0] + (rock[0] - grass[0]) * rockBlend,
        grass[1] + (rock[1] - grass[1]) * rockBlend,
        grass[2] + (rock[2] - grass[2]) * rockBlend,
      ]
    }
    case 'mountain': {
      const rock = 0.4 + n * 0.1
      const snowAmt = smoothstep(350, 700, height)
      const c = rock + (0.92 - rock) * snowAmt
      return [c, c * (1 - snowAmt * 0.02), c + snowAmt * 0.02]
    }
    case 'snow': {
      const t = smoothstep(400, 1000, height)
      const c = 0.5 + t * 0.45
      return [c, c, c + 0.02]
    }
    case 'plains':
    default:
      return [0.28 + speck, 0.44 + speck + moisture * 0.04, 0.18]
  }
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
  biomeB: Biome = biome,
  biomeMix = 0,
): [number, number, number] {
  const n = hash2(Math.floor(x * 0.5), Math.floor(z * 0.5))
  const speck = (n - 0.5) * 0.05
  const river = features?.river ?? 0
  const ravine = features?.ravine ?? 0

  if (ravine > 0.4 && biome !== 'ocean') {
    const rock = 0.22 + n * 0.08
    return [rock, rock * 0.95, rock * 0.9]
  }
  if (river > 0.4 && biome !== 'desert' && biome !== 'mesa' && biome !== 'ocean') {
    return [0.16 + speck, 0.34 + n * 0.06, 0.22]
  }
  if ((features?.lake ?? 0) > 0.45 || (features?.pond ?? 0) > 0.65) {
    if (biome === 'water' || height < 1.5) {
      return [0.1, 0.28 + n * 0.08, 0.4 + n * 0.06]
    }
  }

  let col = biomeColorSolid(biome, height, moisture, n, speck, land)
  // Seamless cross-fade into neighboring biome color
  if (biomeMix > 0.04 && biomeB !== biome) {
    const colB = biomeColorSolid(biomeB, height, moisture, n, speck, land)
    const t = clamp01(biomeMix)
    col = [
      col[0] + (colB[0] - col[0]) * t,
      col[1] + (colB[1] - col[1]) * t,
      col[2] + (colB[2] - col[2]) * t,
    ]
  }

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
