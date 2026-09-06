import { clamp01, hash2, smoothstep } from './noise'
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
let opsOn = false

/** Disable pad leveling while searching for a natural flat. */
export function clearOpsPad(): void {
  opsOn = false
}

/** Level only the immediate airfield to this surface height (not a corridor). */
export function setOpsPad(x: number, z: number, y: number): void {
  opsX = x
  opsZ = z
  opsY = y
  opsOn = true
}

function padBlend(x: number, z: number): number {
  if (!opsOn) return 0
  const d = Math.hypot(x - opsX, z - opsZ)
  if (d <= OPS_PAD_INNER) return 1
  if (d >= OPS_PAD_OUTER) return 0
  return 1 - smoothstep(OPS_PAD_INNER, OPS_PAD_OUTER, d)
}

export function getOpsPad(): { x: number; z: number; y: number } | null {
  if (!opsOn) return null
  return { x: opsX, z: opsZ, y: opsY }
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
  if (c.height > 38) return -1e5
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

  let score = 120 - c.height * 0.7 - slope * 22
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
      return [.16 + speck, .145 + speck, .14 + speck]
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
      const rock = 0.4 + n * 0.1
      return [rock, rock * .98, rock * .94]
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
  if (biome === 'ocean' || biome === 'water') {
    return biomeColorSolid(biome, height, moisture, n * .3, speck, land)
  }

  let col = biomeColorSolid(biome, height, moisture, n, speck, land)
  // Seamless cross-fade into neighboring biome color
  if (biomeMix > 0 && biomeB !== biome) {
    const colB = biomeColorSolid(biomeB, height, moisture, n, speck, land)
    const t = clamp01(biomeMix)
    col = [
      col[0] + (colB[0] - col[0]) * t,
      col[1] + (colB[1] - col[1]) * t,
      col[2] + (colB[2] - col[2]) * t,
    ]
  }

  const ravineShade = smoothstep(.25, .9, ravine) * .3
  const riverShade = smoothstep(.1, .9, river) * .12
  col = col.map(c => c * (1 - ravineShade - riverShade)) as [number, number, number]
  if (coastal > 0 && biome !== 'mesa') {
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
