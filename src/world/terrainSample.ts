import { clamp01, fbm, ridged, smoothstep } from './noise'

/**
 * Half-scale biomes, tall ranges, carved water features, coasts, and slope cues.
 * sampleClimate is the single-pass mesh / contact path.
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
  /** 1 on beach shelf between land and open sea. */
  coastal: number
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

/**
 * Long mountain ranges. Soft wide belt so you fly along a real chain,
 * not isolated spikes.
 */
function mountainBelt(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const spine = ridged(wx * 0.00024 - 2, wz * 0.00024 + 6, 5)
  const gate = fbm(wx * 0.00015 + 70, wz * 0.00015 - 30, 3)
  // Wider range footprint
  return smoothstep(0.42, 0.72, spine) * smoothstep(0.35, 0.62, gate)
}

/**
 * High-relief land height (meters).
 * Plains/hills as before; mountain ranges often 300–900 m, big peaks ~1000–1400 m.
 */
function landElevation(x: number, z: number, land: number): number {
  const [wx, wz] = warp(x, z)

  // Continental undulation: broad valleys and high ground
  const continental = (fbm(wx * 0.00035, wz * 0.00035, 5) - 0.32) * 95

  // Multi-scale rolling relief (always some height change)
  const rollA = (fbm(wx * 0.0011 + 11, wz * 0.0011 - 7, 4) - 0.48) * 48
  const rollB = (fbm(wx * 0.0035 - 3, wz * 0.0035 + 9, 3) - 0.5) * 28
  const detail = (fbm(wx * 0.014, wz * 0.014, 2) - 0.5) * 8

  // Hill country: common mid-elevation mounds (not rare)
  const hillN = fbm(wx * 0.0016 + 20, wz * 0.0016, 4)
  const hills =
    smoothstep(0.38, 0.72, hillN) * 55 +
    smoothstep(0.55, 0.85, hillN) * 50

  // Secondary ridgelines (foothill / highland spines)
  const miniRidge = ridged(wx * 0.0009 + 40, wz * 0.0009 - 15, 3)
  const ridges = smoothstep(0.5, 0.82, miniRidge) * 75

  // Major mountain chain — ~2x prior peak scale, multi-octave jaggedness
  const belt = mountainBelt(x, z)
  const foothills = belt * 200
  // Layered peak noise: main crest + secondary summits + cliff/saddle mix
  const crest = ridged(wx * 0.00075, wz * 0.00075, 5)
  const summits = ridged(wx * 0.0018 + 12, wz * 0.0018 - 8, 4)
  const crags = ridged(wx * 0.0045 - 5, wz * 0.0045 + 3, 3)
  const saddle = fbm(wx * 0.0012 + 90, wz * 0.0012, 3) // dips between peaks
  const peakBody =
    crest * 0.55 + summits * 0.3 + crags * 0.15 - (saddle - 0.45) * 0.2
  // Full belt peaks roughly 400–1100 m extra; partial belt = foothill scale
  const peaks =
    Math.pow(Math.max(0, belt), 1.2) * (400 + clamp01(peakBody) * 700)

  // Occasional deep valleys between high ground
  const basin = fbm(wx * 0.0008 + 100, wz * 0.0008 - 50, 3)
  const valleys = -smoothstep(0.62, 0.88, basin) * 55

  let h =
    18 +
    continental +
    rollA +
    rollB +
    detail +
    hills +
    ridges +
    foothills +
    peaks +
    valleys

  h *= smoothstep(0.32, 0.78, land)
  return Math.max(h, 0.5)
}

function sampleCanyon(x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  return smoothstep(0.55, 0.86, ridged(wx * 0.002 + 200, wz * 0.002 - 100, 3))
}

/**
 * Badlands / mesa country: layered buttes, sharp arroyos, steep-walled valleys.
 * Not gentle hills — flat tops and hard drops.
 */
function mesaHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)

  // Layered sedimentary steps (butte/mesa tops)
  const stepNoise = fbm(wx * 0.0014, wz * 0.0014, 3)
  const stepH = 18 + stepNoise * 22
  const stacked = Math.floor(Math.max(20, base * 0.85 + 55) / stepH) * stepH
  const topJitter = (fbm(wx * 0.02, wz * 0.02, 2) - 0.5) * 3
  const plateau = stacked + topJitter

  // Cliff edges around plateaus
  const edge = ridged(wx * 0.004, wz * 0.004, 3)
  const cliff = smoothstep(0.28, 0.62, edge)

  // Dense network of steep arroyos / washes (badlands signature)
  const arroyoA = 1 - smoothstep(0.02, 0.11, Math.abs(fbm(wx * 0.0035, wz * 0.0035, 3) - 0.5) * 2)
  const arroyoB = 1 - smoothstep(0.015, 0.09, Math.abs(fbm(wx * 0.006 + 40, wz * 0.006 - 20, 2) - 0.48) * 2)
  const gully = clamp01(Math.max(arroyoA * 0.85, arroyoB) * smoothstep(0.4, 0.75, ridged(wx * 0.0022, wz * 0.0022, 2)))

  // Deep canyon corridors
  const canyon = sampleCanyon(x, z)
  const deepCut = canyon * canyon * (55 + plateau * 0.25)
  const arroyoCut = gully * gully * (40 + plateau * 0.2)

  // Floor of valleys stays low; rims stay high → steep walls
  const floor = Math.min(base * 0.25, 12)
  const rim = plateau + 18
  let h = floor + (rim - floor) * (1 - cliff * 0.92)
  h -= deepCut
  h -= arroyoCut

  // Secondary hoodoo-scale nubs on remaining high ground
  if (gully < 0.35 && cliff < 0.45) {
    h += ridged(wx * 0.012, wz * 0.012, 2) * 12
  }

  return Math.max(h, 1)
}

function duneHeight(base: number, x: number, z: number): number {
  const [wx, wz] = warp(x, z)
  const dunes =
    Math.sin(wx * 0.014 + fbm(wx * 0.0035, wz * 0.0035, 2) * 3.5) *
    Math.cos(wz * 0.011) *
    12
  const mega =
    Math.sin(wx * 0.004 + wz * 0.003) * 8 * fbm(wx * 0.001, wz * 0.001, 2)
  return Math.max(3, base * 0.65 + 14 + dunes + mega)
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

  if (features.lake > 0.55 && elev < 55) return 'water'
  if (features.pond > 0.72 && elev < 40) return 'water'
  if (features.river > 0.74 && elev < 55) return 'water'
  if (elev < 1.2 && moisture > 0.55) return 'water'

  // High alpine / big peaks (thresholds match taller ranges)
  if (elev > 520) return 'snow'
  if (elev > 220) return 'mountain'

  if (temperature > 0.58 && moisture < 0.36) {
    if (elev > 40 && elev < 160 && moisture < 0.3) return 'mesa'
    return 'desert'
  }
  if (temperature > 0.52 && moisture > 0.62 && elev < 100) return 'rainforest'
  if (moisture > 0.58 && elev < 30 && temperature < 0.58) return 'swamp'
  if (moisture > 0.46 && elev < 110 && temperature > 0.28) return 'forest'
  // Rolling / highland hills (common mid band)
  if (elev > 45 && elev <= 160) return 'hills'
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
    // Continental shelf: shallows near coast, deeper offshore
    const deep = (0.42 - land) * 55
    const waves = (fbm(x * 0.02, z * 0.02, 2) - 0.5) * 0.15
    return (SEA_LEVEL - 0.15 - deep * 0.04 + waves) * flatMask
  }

  let base = landElevation(x, z, land)
  // Mild climate bias, keep strong relief
  base += (0.5 - moisture) * 10
  base += (temperature - 0.5) * 6

  // Soft beach ramp (land 0.42–0.58) so coasts aren't cliffs into the sea
  const beach = smoothstep(0.42, 0.58, land)
  base = base * beach + (1 + fbm(x * 0.03, z * 0.03, 2) * 2) * (1 - beach) * 0.35
    + base * (1 - beach) * 0.15

  let h = base

  // Deeper lake/pond bowls so basins read against hills
  if (features.lake > 0.35 && moisture > 0.35) {
    h -= features.lake * features.lake * (22 + Math.max(0, h) * 0.22)
  }
  if (features.pond > 0.55) {
    h -= features.pond * features.pond * 16
  }

  const rough = classifyBiome(h, moisture, temperature, features, land, dist)

  switch (rough) {
    case 'ocean':
      h = SEA_LEVEL - 0.4
      break
    case 'desert':
      h = duneHeight(Math.max(h, base * 0.55), x, z) - sampleCanyon(x, z) * 40
      break
    case 'mesa':
      // Full badlands reshape (steep valleys baked into mesaHeight)
      h = mesaHeight(Math.max(h, base * 0.7), x, z)
      // Extra ravine cuts for sheer gorges
      if (features.ravine > 0.15) {
        h -= features.ravine * features.ravine * (70 + Math.max(0, h) * 0.45)
      }
      break
    case 'swamp':
      // Low but not pancake-flat
      h = Math.min(h * 0.4, 12) + (fbm(x * 0.01, z * 0.01, 2) - 0.5) * 3
      h = Math.max(h, 0.25)
      break
    case 'plains':
      // Keep more of the base relief so plains still roll
      h = Math.max(1, h * 0.72 + (fbm(x * 0.003, z * 0.003, 3) - 0.5) * 18)
      break
    case 'forest':
      h = h * 0.85 + (fbm(x * 0.0035, z * 0.0035, 3) - 0.5) * 24
      break
    case 'rainforest':
      h = h * 0.8 + (fbm(x * 0.004, z * 0.004, 3) - 0.5) * 28
      break
    case 'hills':
      // Amplify rolling high ground
      h = h * 1.05 + (fbm(x * 0.0045, z * 0.0045, 3) - 0.4) * 45
      h += ridged(x * 0.0025, z * 0.0025, 2) * 35
      break
    case 'mountain': {
      // Extra jagged massif variation: crests, shoulders, cliff faces
      const massif = ridged(x * 0.0009, z * 0.0009, 4)
      const teeth = ridged(x * 0.0028 + 5, z * 0.0028 - 2, 3)
      const spires = ridged(x * 0.006 + 1, z * 0.006, 2)
      h =
        h * 1.12 +
        massif * 220 +
        teeth * 140 +
        spires * 70 +
        (fbm(x * 0.003, z * 0.003, 2) - 0.5) * 60
      break
    }
    case 'snow': {
      const massif = ridged(x * 0.0008, z * 0.0008, 4)
      const teeth = ridged(x * 0.0022 + 3, z * 0.0022, 3)
      h = h * 1.15 + massif * 280 + teeth * 160 + ridged(x * 0.005, z * 0.005, 2) * 80
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
  // Deep ravines for vertical drama
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
      coastal: 0,
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
  // Beach band: landward side of the coast mask
  const coastal =
    land > 0.4 && land < 0.62
      ? (1 - Math.abs(land - 0.5) / 0.12) * (height < 18 ? 1 : 0.35)
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
  const n = fbm(x * 0.05, z * 0.05, 2)
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
