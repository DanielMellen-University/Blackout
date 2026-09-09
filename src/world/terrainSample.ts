import { clamp01, smoothstep, valueNoise } from './noise'
import { sampleGeography } from './Geography'

/**
 * Resolved geographic surfaces, local airfield grading, spawn selection and
 * biome palettes. The deterministic landform generator lives in Geography.
 */

export const SEA_LEVEL = 0

/** Fully level disk for the strip + hangar. Outside this, terrain is natural. */
export const OPS_PAD_INNER = 78
/** Blend from pad height back to natural ground. */
export const OPS_PAD_OUTER = 118

let opsX = 0
let opsZ = 0
let opsY = 0
let opsYaw = 0
let opsOn = false

/** Disable pad leveling while searching for a natural flat. */
export function clearOpsPad(): void {
  opsOn = false
}

/** Level only the immediate airfield to this surface height (not a corridor). */
export function setOpsPad(x: number, z: number, y: number, yaw?: number): void {
  opsX = x
  opsZ = z
  opsY = y
  opsYaw = yaw !== undefined && Number.isFinite(yaw) ? yaw : 0
  opsOn = true
}

function padBlend(x: number, z: number): number {
  if (!opsOn) return 0
  const d = Math.hypot(x - opsX, z - opsZ)
  if (d <= OPS_PAD_INNER) return 1
  if (d >= OPS_PAD_OUTER) return 0
  return 1 - smoothstep(OPS_PAD_INNER, OPS_PAD_OUTER, d)
}

export function getOpsPad(): { x: number; z: number; y: number; yaw?: number } | null {
  if (!opsOn) return null
  return { x: opsX, z: opsZ, y: opsY, yaw: opsYaw }
}

export function opsPadBlend(x: number, z: number): number {
  return padBlend(x, z)
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
  | 'tundra'
  | 'savanna'
  | 'volcanic'
  | 'saltflat'

export interface TerrainFeatures {
  river: number
  ravine: number
  pond: number
  lake: number
  stream: number
}

export interface Climate {
  biomeWeights?: [Biome, number][]
  height: number
  /** Water surface elevation; the height field underneath describes the bed. */
  waterLevel?: number
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
  /** Continuous landform signals used for material detail without props. */
  landform: {
    ridge: number
    alpineValley: number
    plateau: number
    caldera: number
    /** Broad mountain-to-lowland shoulder used for material separation. */
    foothills?: number
  }
}

export type TerrainSurfaceKind = 'land' | 'water'

/**
 * The physical and rendered top of the world at one horizontal position.
 *
 * Climate height describes the generated terrain before water is filled.  It
 * is useful to biome generation, but it is not always the visible surface:
 * ocean and inland water are deliberately flat.  Rendering, collision, AGL,
 * props, and cameras must use this resolved surface instead of applying their
 * own water rules.
 */
export interface TerrainSurface {
  height: number
  kind: TerrainSurfaceKind
  biome: Biome
}

export const INLAND_WATER_LEVEL = 0.35

export function terrainSurfaceFromClimate(
  climate: Pick<Climate, 'height' | 'biome' | 'waterLevel'>,
): TerrainSurface {
  if (climate.biome === 'ocean') {
    return { height: SEA_LEVEL, kind: 'water', biome: climate.biome }
  }
  if (climate.biome === 'water') {
    return {
      height: climate.waterLevel ?? INLAND_WATER_LEVEL,
      kind: 'water',
      biome: climate.biome,
    }
  }
  return { height: climate.height, kind: 'land', biome: climate.biome }
}

/** Geography first, then a local airfield cut into the resolved surface. */
export function sampleClimate(x: number, z: number): Climate {
  const climate = sampleGeography(x, z)
  const padT = padBlend(x, z)
  if (padT > 0) {
    const surface = terrainSurfaceFromClimate(climate)
    climate.height = surface.height * (1 - padT) + opsY * padT
    if (climate.height > (climate.waterLevel ?? 0)) {
      if (climate.biome === 'ocean' || climate.biome === 'water') climate.biome = 'plains'
      climate.biomeB = climate.biome
      climate.biomeMix = 0
      climate.biomeWeights = undefined
    }
  }
  return climate
}

/** Biomes allowed for airfield spawn (inland flats, never coast/ocean). */
const FLAT_SPAWN_BIOMES: ReadonlySet<Biome> = new Set([
  'plains',
  'desert',
  'forest',
])

export interface FlatSpawn {
  x: number
  z: number
  /** Natural surface height at the pad center. */
  y: number
  yaw: number
  biome: Biome
}

/**
 * Search for naturally flat inland ground with a clear takeoff lane.
 * Returns null instead of throwing so boot/reseed can keep the previous world
 * or fall back to {@link findInlandFallback} / {@link findAnyDryLand}.
 */
export function findFlatSpawn(maxRadius = 18000): FlatSpawn | null {
  let best: FlatSpawn | null = null
  let bestScore = -1e9

  for (let ring = 0; ring <= maxRadius; ring += 200) {
    const steps = ring < 1 ? 1 : Math.min(36, 10 + ((ring / 200) | 0) * 2)
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2 + ring * 0.017
      const x = Math.cos(ang) * ring
      const z = Math.sin(ang) * ring
      const c = sampleClimate(x, z)
      const pad = scoreFlatPad(x, z, c)
      if (pad < 0) continue
      // The coastal scan is far more expensive than the local pad test.  Only
      // run it for candidates that could actually become an airfield.
      if (nearOcean(x, z)) continue
      const dep = bestDeparture(x, z, c.height)
      if (dep.score < -2e5) continue
      const foot = footprintRelief(x, z, dep.yaw)
      if (!foot || foot.relief > 2.4) continue
      const score = pad + dep.score - foot.relief * 18
      if (score > bestScore) {
        const cand: FlatSpawn = { x, z, y: c.height, yaw: dep.yaw, biome: c.biome }
        if (!isUsableAirfield(cand)) continue
        bestScore = score
        best = cand
        if (bestScore > 90 && dep.score > 25 && foot.relief < 1.15) return best
      }
    }
  }

  if (best && isUsableAirfield(best)) return best

  for (let r = 300; r <= 24000; r += 280) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r * 0.01
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const c = sampleClimate(x, z)
      if (scoreFlatPad(x, z, c) <= 0) continue
      if (nearOcean(x, z)) continue
      const dep = bestDeparture(x, z, c.height)
      if (dep.score < -2e5) continue
      const foot = footprintRelief(x, z, dep.yaw)
      if (!foot || foot.relief > 2.4) continue
      const cand: FlatSpawn = { x, z, y: c.height, yaw: dep.yaw, biome: c.biome }
      if (isUsableAirfield(cand)) return cand
    }
  }

  for (let n = 0; n < 500; n++) {
    const r = 600 + ((n * 173) % 20000)
    const a = n * 2.399963
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const c = sampleClimate(x, z)
    if (scoreFlatPad(x, z, c) <= 0) continue
    if (nearOcean(x, z)) continue
    const dep = bestDeparture(x, z, c.height)
    if (dep.score < -2e5) continue
    const foot = footprintRelief(x, z, dep.yaw)
    if (!foot || foot.relief > 3.5) continue
    const cand: FlatSpawn = { x, z, y: c.height, yaw: dep.yaw, biome: c.biome }
    if (isUsableAirfield(cand)) return cand
  }
  return null
}

/**
 * Cheaper inland hunt used when the full search finds nothing. Skips the
 * 800 m coastal grid but still refuses ocean, lakes, and a wet jet spawn.
 */
export function findInlandFallback(maxRadius = 32000): FlatSpawn | null {
  let best: FlatSpawn | null = null
  let bestScore = -1e9
  for (let ring = 400; ring <= maxRadius; ring += 220) {
    const steps = 14 + ((ring / 700) | 0)
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 + ring * 0.011
      const x = Math.cos(a) * ring
      const z = Math.sin(a) * ring
      const c = sampleClimate(x, z)
      const pad = scoreFlatPad(x, z, c)
      if (pad <= 0) continue
      if (hasWetNeighbors(x, z, 90)) continue
      const dep = bestDeparture(x, z, c.height)
      if (dep.score < -4e5) continue
      const cand: FlatSpawn = { x, z, y: c.height, yaw: dep.yaw, biome: c.biome }
      if (!isUsableAirfield(cand)) continue
      const score = pad + dep.score * 0.12
      if (score > bestScore) {
        bestScore = score
        best = cand
        if (pad > 35) return cand
      }
    }
  }
  return best
}

/**
 * Last-ditch spiral: any dry land high enough to sit a strip on.
 * Never returns ocean or inland water.
 */
export function findAnyDryLand(): FlatSpawn | null {
  for (let n = 0; n < 2200; n++) {
    const r = 350 + ((n * 137) % 36000)
    const a = n * 2.399963
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const c = sampleClimate(x, z)
    if (c.biome === 'ocean' || c.biome === 'water' || c.biome === 'swamp') continue
    if (c.land < 0.76 || c.height < 7 || c.coastal > 0.08) continue
    if (terrainSurfaceFromClimate(c).kind !== 'land') continue
    const dep = bestDeparture(x, z, c.height)
    const cand: FlatSpawn = {
      x,
      z,
      y: Math.max(8, c.height),
      yaw: dep.yaw,
      biome: FLAT_SPAWN_BIOMES.has(c.biome) ? c.biome : 'plains',
    }
    if (isUsableAirfield(cand)) return cand
  }
  return null
}

/** True if the pad and the jet spawn 45 m behind it are dry land. */
export function isUsableAirfield(pad: FlatSpawn): boolean {
  if (!Number.isFinite(pad.x) || !Number.isFinite(pad.z)) return false
  const fx = Math.sin(pad.yaw)
  const fz = Math.cos(pad.yaw)
  const rx = Math.cos(pad.yaw)
  const rz = -Math.sin(pad.yaw)
  const spots: [number, number][] = [
    [pad.x, pad.z],
    [pad.x - fx * 45, pad.z - fz * 45],
    [pad.x + fx * 36, pad.z + fz * 36],
    [pad.x + rx * 18, pad.z + rz * 18],
    [pad.x - rx * 18, pad.z - rz * 18],
  ]
  for (const [x, z] of spots) {
    const c = sampleClimate(x, z)
    if (c.biome === 'ocean' || c.biome === 'water' || c.biome === 'swamp') return false
    if (c.land < 0.62 || c.height < 4) return false
    if (terrainSurfaceFromClimate(c).kind !== 'land') return false
  }
  return true
}

function hasWetNeighbors(x: number, z: number, r: number): boolean {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const s = sampleClimate(x + Math.cos(a) * r, z + Math.sin(a) * r)
    if (s.biome === 'ocean' || s.biome === 'water' || s.land < 0.55) return true
  }
  return false
}

/** Always a dry inland pad. Retries a cheap search before giving up. */
export function findPlayableSpawn(maxRadius = 18000): FlatSpawn | null {
  const found = findFlatSpawn(maxRadius)
  if (found && isUsableAirfield(found)) return found
  const inland = findInlandFallback()
  if (inland) return inland
  return findAnyDryLand()
}

/** Higher is better. Negative = reject. */
function isWet(c: Climate): boolean {
  return (
    c.biome === 'ocean' ||
    c.biome === 'water' ||
    c.biome === 'swamp' ||
    c.land < 0.68 ||
    c.coastal > 0.04 ||
    c.height < 4
  )
}

function scoreFlatPad(x: number, z: number, c: Climate): number {
  if (!FLAT_SPAWN_BIOMES.has(c.biome)) return -1e6
  if (isWet(c)) return -1e6
  if (c.land < 0.78) return -1e6
  if (c.features.river > 0.28 || c.features.lake > 0.25 || c.features.pond > 0.45) {
    return -1e6
  }
  if (c.features.ravine > 0.18) return -1e6
  if (c.height > 450) return -1e5
  if (c.height < 7) return -1e6

  const d = 28
  const h0 = c.height
  const hx = sampleClimate(x + d, z).height
  const hz = sampleClimate(x, z + d).height
  const hxm = sampleClimate(x - d, z).height
  const hzm = sampleClimate(x, z - d).height
  const slope =
    (Math.abs(hx - h0) + Math.abs(hz - h0) + Math.abs(hxm - h0) + Math.abs(hzm - h0)) / 4
  if (slope > 2.2) return -1e5

  let score = 120 - c.height * 0.08 - slope * 22
  if (c.biome === 'plains') score += 48
  else if (c.biome === 'desert') score += 22
  else if (c.biome === 'forest') score += 8

  score -= Math.hypot(x, z) * 0.0018
  return score
}

/** Height range across the runway + hangar footprint in heading frame. */
function footprintRelief(
  x: number,
  z: number,
  yaw: number,
): { relief: number } | null {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  const pts: [number, number][] = [
    [0, 0],
    [0, 55],
    [0, -55],
    [0, 22],
    [0, -22],
    [9, 40],
    [-9, 40],
    [9, -40],
    [-9, -40],
    [22, -4],
    [38, 2],
    [38, -12],
    [38, 14],
    [20, -46],
  ]
  let minH = 1e9
  let maxH = -1e9
  for (const [lat, along] of pts) {
    const px = x + fx * along + rx * lat
    const pz = z + fz * along + rz * lat
    const s = sampleClimate(px, pz)
    if (isWet(s)) return null
    if (s.features.ravine > 0.22 || s.features.river > 0.55) return null
    if (s.height > minH + 8 && minH < 1e8) return null
    minH = Math.min(minH, s.height)
    maxH = Math.max(maxH, s.height)
  }
  return { relief: maxH - minH }
}

/**
 * Pick a takeoff heading with the lowest rise ahead (no mountain in the face).
 */
function bestDeparture(x: number, z: number, h0: number): { yaw: number; score: number } {
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

/** True if ocean/water/coast sits inside ~800 m (dense grid so gaps cannot hide sea). */
function nearOcean(x: number, z: number): boolean {
  if (isWet(sampleClimate(x, z))) return true
  for (let dx = -800; dx <= 800; dx += 200) {
    for (let dz = -800; dz <= 800; dz += 200) {
      if (dx === 0 && dz === 0) continue
      if (dx * dx + dz * dz > 800 * 800) continue
      const s = sampleClimate(x + dx, z + dz)
      if (s.biome === 'ocean' || s.biome === 'water' || s.land < 0.5 || s.coastal > 0.15) {
        return true
      }
    }
  }
  return false
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
      const s = sampleClimate(x + fx * d + rx * lat, z + fz * d + rz * lat)
      if (isWet(s) || s.land < 0.5) return -1e6
      const h = s.height
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

export function sampleTerrainSurface(x: number, z: number): TerrainSurface {
  return terrainSurfaceFromClimate(sampleClimate(x, z))
}

/** Resolved rendered/contact surface height. */
export function sampleTerrainHeight(x: number, z: number): number {
  return sampleTerrainSurface(x, z).height
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
      return [0.045, 0.23 + n * 0.025, 0.31 + n * 0.025]
    case 'volcanic':
      // Basalt starts charcoal so volcanic provinces do not wash into the
      // adjacent snow and mountain weights under bright flight lighting.
      return [.105 + speck * .65, .085 + speck * .58, .07 + speck * .48]
    case 'saltflat':
      return [.82 + speck, .8 + speck, .71 + speck]
    case 'tundra':
      return [.37 + speck, .39 + speck, .29 + speck]
    case 'savanna':
      return [.53 + speck, .46 + speck, .22 + speck]
    case 'desert':
      return [0.78 + speck, 0.66 + speck * 0.4, 0.38 + speck]
    case 'mesa': {
      const band = Math.sin(height * 0.055) * 0.035
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
      const rock = 0.3 + n * 0.08
      return [rock, rock * .98, rock * .95]
    }
    case 'snow': {
      // Snow is cool blue-gray rather than clipped white. The darker base
      // leaves ridge shadow and exposed stone readable in bright daylight.
      const t = smoothstep(450, 2200, height)
      return [0.34 + t * .28 + n * .025, 0.39 + t * .27 + n * .02, 0.47 + t * .3]
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
  biomeWeights?: [Biome, number][],
  landform?: Climate['landform'],
): [number, number, number] {
  const n = valueNoise(x / 90, z / 90)
  const speck = (n - 0.5) * 0.05
  const river = features?.river ?? 0
  const lake = features?.lake ?? 0
  const pond = features?.pond ?? 0
  const stream = features?.stream ?? 0
  const ravine = features?.ravine ?? 0
  if (biome === 'ocean' || biome === 'water') {
    // This mesh is sediment below the independent water surface, never blue
    // paint. Feature-aware mud and gravel tones keep a shallow exposed bank
    // from reading as a repeated dark cutout when the water is below it.
    const wetNoise = valueNoise(x / 240 + 17, z / 240 - 9) - .5
    if (biome === 'ocean') {
      return [.11 + wetNoise * .035, .2 + wetNoise * .045, .24 + wetNoise * .055]
    }
    const channel = clamp01(Math.max(stream, river) * .8 + pond * .35 + lake * .25)
    const shore = clamp01(coastal)
    return [
      .31 + wetNoise * .06 - channel * .035 + shore * .12,
      .28 + wetNoise * .055 + channel * .01 + shore * .1,
      .2 + wetNoise * .04 + channel * .035 + shore * .055,
    ]
  }

  let col = biomeColorSolid(biome, height, moisture, n, speck, land)
  // Seamless cross-fade into neighboring biome color
  if (biomeWeights?.length) {
    col = [0, 0, 0]
    let total = 0
    for (const [candidate, weight] of biomeWeights) {
      const w = weight * weight
      if (w === 0) continue
      const c = biomeColorSolid(candidate, height, moisture, n, speck, land)
      for (let i = 0; i < 3; i++) col[i]! += c[i]! * w
      total += w
    }
    col = col.map(c => c / Math.max(total, .00001)) as [number, number, number]
  } else if (biomeMix > 0 && biomeB !== biome) {
    const colB = biomeColorSolid(biomeB, height, moisture, n, speck, land)
    const t = clamp01(biomeMix)
    col = [
      col[0] + (colB[0] - col[0]) * t,
      col[1] + (colB[1] - col[1]) * t,
      col[2] + (colB[2] - col[2]) * t,
    ]
  }

  // Volcanic provinces need more than one gray tone to read as cooled lava,
  // ash shelves, and occasional warm fissures from flight scale. Keep the
  // breakup deterministic and material-only so it costs no extra geometry or
  // draw call, and let caldera interiors carry the strongest warm accent.
  if (biome === 'volcanic') {
    const ashField = valueNoise(x / 520, z / 520)
    const cinder = (ashField - .5) * .2
    col = [
      clamp01(col[0] + cinder * .9),
      clamp01(col[1] + cinder * .82),
      clamp01(col[2] + cinder * .72),
    ]
    const fissureField = valueNoise(x / 980 + 37, z / 980 - 19)
    const calderaBoost = landform?.caldera ?? 0
    const fissure = smoothstep(.72, .92, fissureField) * (.15 + calderaBoost * .68)
    const flowField = valueNoise(x / 920 - 23, z / 920 + 41) * .7 +
      valueNoise(x / 240 + 71, z / 240 - 17) * .3
    const flow = smoothstep(.58, .82, flowField) * (.12 + calderaBoost * .26)
    const ember: [number, number, number] = [0.48 + ashField * .14, .075 + ashField * .035, .018]
    col = [
      col[0] + (ember[0] - col[0]) * fissure,
      col[1] + (ember[1] - col[1]) * fissure,
      col[2] + (ember[2] - col[2]) * fissure,
    ]
    const lavaRock: [number, number, number] = [.3 + ashField * .1, .055 + ashField * .03, .016]
    col = [
      col[0] + (lavaRock[0] - col[0]) * flow,
      col[1] + (lavaRock[1] - col[1]) * flow,
      col[2] + (lavaRock[2] - col[2]) * flow,
    ]
  }

  // Lowland terrain is intentionally prop-free for now, so distant green
  // regions need a little visual structure in the existing vertex colors.
  // Two broad, world-space noise scales create meadow patches and soil
  // variation without hard biome borders, extra textures, or new draw calls.
  // The signal is applied after biome blending so transitions stay continuous.
  const texturedLand = biome === 'plains' || biome === 'forest' || biome === 'rainforest' ||
    biome === 'savanna' || biome === 'swamp' || biome === 'hills' || biome === 'desert' || biome === 'mesa' || biome === 'volcanic'
  if (texturedLand) {
    const regional = valueNoise(x / 520, z / 520)
    const patch = valueNoise(x / 155, z / 155)
    const broad = (regional - .5) * .11
    const fine = (patch - .5) * .035
    const breakup = broad + fine
    const green = biome === 'plains' || biome === 'forest' || biome === 'rainforest' || biome === 'swamp' || biome === 'hills'
    col = [
      col[0] * (1 + breakup) + (green ? (regional - .5) * .012 : 0),
      col[1] * (1 + breakup * .82) + (green ? (regional - .5) * .022 : 0),
      col[2] * (1 + breakup * .64) - (green ? (regional - .5) * .008 : 0),
    ]
  }

  // Give dry river shoulders their own ecological band. Hydrology already
  // provides a smooth river/stream distance signal, so reuse it here rather
  // than adding a second texture or mesh. The small noise-dependent strength
  // keeps a long channel from becoming one perfectly uniform green stripe.
  const riparian = clamp01(Math.max(river * .86, stream))
  const riparianBiomes = biome === 'plains' || biome === 'forest' || biome === 'rainforest' ||
    biome === 'hills' || biome === 'swamp' || biome === 'savanna'
  if (riparian > .02 && riparianBiomes) {
    const riparianColor: [number, number, number] = biome === 'savanna'
      ? [.36, .5, .2]
      : biome === 'swamp'
        ? [.16, .4, .2]
        : [.18, .5, .22]
    const riparianMix = smoothstep(.04, .82, riparian) * (.1 + n * .05)
    col = [
      col[0] + (riparianColor[0] - col[0]) * riparianMix,
      col[1] + (riparianColor[1] - col[1]) * riparianMix,
      col[2] + (riparianColor[2] - col[2]) * riparianMix,
    ]
  }

  // Inland basins deserve a soft wet shore instead of a hard blue-to-green
  // boundary. Hydrology already fades lake and pond features across the
  // exposed bank, so this reuses that signal as a warm silt tint with no
  // shoreline mesh, texture lookup, or extra draw call.
  const inlandShore = clamp01(Math.max(lake, pond))
  if (inlandShore > 0) {
    const wetSand: [number, number, number] = [0.53 + speck * .4, 0.55 + speck * .25, 0.38]
    const shoreMix = smoothstep(.04, .72, inlandShore) * .42
    col = [
      col[0] + (wetSand[0] - col[0]) * shoreMix,
      col[1] + (wetSand[1] - col[1]) * shoreMix,
      col[2] + (wetSand[2] - col[2]) * shoreMix,
    ]
  }

  if (landform) {
    // Bake geology into vertex color so distant LODs keep relief cues without
    // extra meshes, props, or a second terrain pass.
    const ridgeLight = landform.ridge * (biome === 'snow' ? .055 : .09)
    const valleyShade = landform.alpineValley * (biome === 'snow' ? .14 : .1)
    const calderaShade = landform.caldera * .12
    const relief = ridgeLight - valleyShade - calderaShade
    col = col.map(c => c * (1 + relief)) as [number, number, number]
    if (landform.plateau > .35 && (biome === 'mesa' || biome === 'desert')) {
      const shelf = smoothstep(.35, .9, landform.plateau) * .08
      col[0] = Math.min(.98, col[0] + shelf)
      col[1] = Math.min(.72, col[1] + shelf * .45)
    }

    // Foothills are a broad transition zone, not a new biome. A restrained
    // olive/stone lift keeps green provinces from reading as one flat sheet
    // beside a massif while preserving smooth biome blending and the existing
    // vertex-only material path.
    const foothill = smoothstep(.16, .82, landform.foothills ?? 0)
    if (foothill > 0 && (biome === 'plains' || biome === 'forest' || biome === 'hills' || biome === 'savanna')) {
      const shoulder: [number, number, number] = biome === 'savanna'
        ? [.38, .36, .18]
        : [.2, .34, .18]
      const shoulderMix = foothill * .18
      col = [
        col[0] + (shoulder[0] - col[0]) * shoulderMix,
        col[1] + (shoulder[1] - col[1]) * shoulderMix,
        col[2] + (shoulder[2] - col[2]) * shoulderMix,
      ]
    }

    // Snow and high alpine faces need a second visual scale. A single pale
    // snow palette made broad ridges read as one featureless white sheet from
    // the chase camera. Stable mid-scale exposure bands reveal dark stone on
    // wind-scoured shoulders and caldera rims, while valley floors stay cool
    // blue instead of becoming noisy spikes or extra geometry.
    if (biome === 'snow' || biome === 'mountain') {
      const strata = valueNoise(x / 520, z / 520)
      const altitudeExposure = smoothstep(900, 2800, height)
      const exposure = clamp01((strata - .34) * 2.35 + landform.ridge * .34 +
        landform.caldera * .42 + altitudeExposure * .16)
      const rockMix = smoothstep(.4, .84, exposure) * (biome === 'snow' ? .72 : .46)
      const rock: [number, number, number] = biome === 'snow'
        ? [.12, .16, .22]
        : [.22, .215, .21]
      col = [
        col[0] + (rock[0] - col[0]) * rockMix,
        col[1] + (rock[1] - col[1]) * rockMix,
        col[2] + (rock[2] - col[2]) * rockMix,
      ]
      const valley = smoothstep(.18, .9, landform.alpineValley)
      col[0] *= 1 - valley * .22
      col[1] *= 1 - valley * .14
      col[2] = Math.min(1, col[2] + valley * .14)
    }
  }

  const ravineShade = smoothstep(.25, .9, ravine) * .3
  const riverShade = smoothstep(.1, .9, river) * .12
  col = col.map(c => c * (1 - ravineShade - riverShade)) as [number, number, number]
  if (coastal > 0) {
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
): [number, number, number] {
  // Derive rock tint from the already blended palette. Discrete biome switches
  // and distance-limited shading used to draw hard borders across mountains.
  const t = smoothstep(.14, .8, clamp01(slope01)) * .65
  const warmth = clamp01((col[0] - col[2]) * 2)
  const rock: [number, number, number] = [.32 + warmth * .14, .3 - warmth * .12, .28 - warmth * .16]
  return [
    col[0] + (rock[0] - col[0]) * t,
    col[1] + (rock[1] - col[1]) * t,
    col[2] + (rock[2] - col[2]) * t,
  ]
}
