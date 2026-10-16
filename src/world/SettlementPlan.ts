import { getWorldSeed, hash2 } from './noise'
import { getOpsPad, sampleClimate } from './terrainSample'
import { createClimateSample } from './Geography'
import type { Biome, Climate } from './terrainSample'
import { settlementLayout, type BuildingUse, type District } from './SettlementLayout'
import { settlementGroundPatch, MAX_SETTLEMENT_GROUND_PATCHES, MAX_SETTLEMENT_GROUND_VERTICES,
  type SettlementGroundPatch } from './SettlementGround'
import { groundRoad, bridgeSupportPoints, MAX_ROAD_SUPPORTS } from './RoadSurface'

export const SETTLEMENT_CELL_SIZE = 24000
export const MAX_LOCAL_ROAD_POINTS = 20_000

// Cells are deliberately large, so the candidate chance has to be generous
// enough that a player encounters villages inside the visible flight envelope.
// Site validation still rejects water, steep ground, and the active airfield.
const CITY_CHANCE = .04
const VILLAGE_CHANCE = .42
/** Guaranteed landmarks keep a smaller minimum than organic cities so rough
 * worlds still get a readable destination instead of an empty anchor cell. */
const ANCHOR_CITY_MIN_BUILDINGS = 420
// Keep the rescue threshold forgiving on rugged seeds; the protected village
// uses a larger profile below, while this floor prevents terrain validation
// from deleting the only nearby rural landmark.
const ANCHOR_VILLAGE_MIN_BUILDINGS = 6
/** Active airfields get one village beyond the circuit, not on the runway. */
const VILLAGE_ANCHOR_RING = 1
/** Cities stay rare, but every world gets one deterministic regional target. */
const CITY_ANCHOR_RING = 1
/** Nearest building ring must stay this far from the pad, metres. */
const CITY_PAD_CLEARANCE_M = 12_000
const VILLAGE_PAD_CLEARANCE_M = 6_000
/** Keep organic sites inside the readable core of each 24 km stream cell. */
const ORGANIC_SITE_CENTER_BIAS = .68

export interface SettlementBuilding {
  x: number; y: number; z: number
  width: number; depth: number; height: number; yaw: number
  shape: 'block' | 'slab' | 'tower' | 'stepped' | 'hangar'
  roof: 'pitched' | 'flat'; wallColor: number; roofColor: number
  use?: BuildingUse; district?: District
  /** Dry, slope-validated canopy pad; optional on service buildings. */
  service?: { x: number; y: number; z: number; yaw: number }
}
export interface SettlementRoad { points: { x: number; y: number; z: number; bridge?: boolean;
  structure?: 'ground' | 'bridge' | 'embankment' | 'viaduct';
  groundY?: number; leftGroundY?: number; rightGroundY?: number; shoulderLeftY?: number; shoulderRightY?: number;
  leftY?: number; rightY?: number;
  leftX?: number; leftZ?: number; rightX?: number; rightZ?: number }[]; width: number }
export interface SettlementPlan {
  id: string; x: number; y: number; z: number; radius: number
  kind: 'city' | 'village'; biome: Biome
  /** Stable player-facing landmark name; optional for lightweight test plans. */
  name?: string
  /** Spawn-priority landmark selected around the active airfield, when any. */
  anchor?: 'city' | 'village'
  buildings: SettlementBuilding[]; roads: SettlementRoad[]
  ground?: SettlementGroundPatch[]
}

const SETTLEMENT_NAME_ROOTS = [
  'Aster', 'Boreal', 'Cinder', 'Dawn', 'Ember', 'Fallow', 'Halcyon', 'Juniper',
  'Lumen', 'Northwind', 'Orchid', 'Pioneer', 'Silver', 'Solace', 'Verdant', 'Wayfarer',
] as const
const CITY_NAME_ENDINGS = ['Heights', 'Basin', 'Junction', 'Crown', 'Exchange', 'Harbor'] as const
const VILLAGE_NAME_ENDINGS = ['Hollow', 'Crossing', 'Glen', 'Reach', 'Meadow', 'Camp'] as const

function nameEndingForBiome(biome: Biome, kind: 'city' | 'village'): readonly string[] {
  if (biome === 'desert' || biome === 'mesa' || biome === 'saltflat') {
    return kind === 'city' ? ['Mesa', 'Basin', 'Outpost', 'Heights'] : ['Dune', 'Dust', 'Oasis', 'Wash']
  }
  if (biome === 'rainforest' || biome === 'swamp') {
    return kind === 'city' ? ['Canopy', 'Delta', 'Landing', 'Harbor'] : ['Mire', 'Grove', 'Crossing', 'Reach']
  }
  if (biome === 'snow' || biome === 'tundra' || biome === 'mountain' || biome === 'volcanic') {
    return kind === 'city' ? ['Crown', 'Pass', 'Basin', 'Heights'] : ['Frost', 'Glen', 'Ridge', 'Camp']
  }
  return kind === 'city' ? CITY_NAME_ENDINGS : VILLAGE_NAME_ENDINGS
}

/** Generate one bounded, seed-stable name for a procedural landmark. */
export function settlementNameForCell(
  cx: number,
  cz: number,
  kind: 'city' | 'village',
  biome: Biome,
): string {
  const safeCx = Number.isFinite(cx) ? Math.trunc(cx) : 0
  const safeCz = Number.isFinite(cz) ? Math.trunc(cz) : 0
  const salt = kind === 'city' ? 9173 : 4819
  const rootRoll = hash2(safeCx * 173 + salt, safeCz * 257 - salt)
  const endingRoll = hash2(safeCx * 311 - salt, safeCz * 199 + salt)
  const root = SETTLEMENT_NAME_ROOTS[Math.floor(rootRoll * SETTLEMENT_NAME_ROOTS.length)]!
  const endings = nameEndingForBiome(biome, kind)
  const ending = endings[Math.floor(endingRoll * endings.length)]!
  return `${root} ${ending}`
}

const cache = new Map<string, SettlementPlan | null>()
let cacheContext = ''
const anchorCache = new Map<string, [number, number] | null>()
let anchorCacheContext = ''
type AnchorPad = { x: number; z: number; y?: number }
// Settlement planning runs serially per worker message. Reuse a tiny bounded
// set of climate records across candidate, survey, road, and lot probes
// instead of allocating a full biome-weight record for every sample.
const settlementClimateScratch = [
  createClimateSample(),
  createClimateSample(),
  createClimateSample(),
]

function sampleSettlementClimate(x: number, z: number, slot = 0): Climate {
  return sampleClimate(x, z, settlementClimateScratch[slot % settlementClimateScratch.length]!)
}
const cityBiomes = new Set<Biome>([
  'plains', 'forest', 'rainforest', 'desert', 'mesa', 'savanna', 'saltflat',
  'hills', 'tundra', 'snow', 'volcanic',
])

function dry(c: Climate): boolean {
  return c.biome !== 'water' && c.biome !== 'ocean' && c.height > (c.waterLevel ?? 0) + 2
}

/**
 * Pick one stable cell around the current airfield for each settlement tier.
 * This is deliberately disabled without an active pad so offline generation
 * and biome-distribution tests still describe the natural world rolls. The
 * anchor only promotes a normal cell into a candidate; all water, relief, and
 * building-fit checks below still have to pass.
 */
function anchorCandidates(kind: 'city' | 'village', pad: AnchorPad | null): [number, number][] {
  if (!pad) return []
  const padCellX = Math.floor(pad.x / SETTLEMENT_CELL_SIZE)
  const padCellZ = Math.floor(pad.z / SETTLEMENT_CELL_SIZE)
  const ring = kind === 'city' ? CITY_ANCHOR_RING : VILLAGE_ANCHOR_RING
  const salt = kind === 'city' ? 9173 : 4819
  const offsets: [number, number][] = []
  for (let ox = -ring; ox <= ring; ox++) for (let oz = -ring; oz <= ring; oz++) {
    if (ox === 0 && oz === 0) continue
    // Keep the city on the outer edge of its ring, separate from the village
    // anchor and far enough away to read as a destination rather than a pad.
    if (kind === 'city' && Math.max(Math.abs(ox), Math.abs(oz)) !== ring) continue
    offsets.push([ox, oz])
  }
  offsets.sort((a, b) => {
    const ar = hash2(padCellX * 173 + a[0] * 37 + salt, padCellZ * 257 + a[1] * 53 - salt)
    const br = hash2(padCellX * 173 + b[0] * 37 + salt, padCellZ * 257 + b[1] * 53 - salt)
    return ar - br
  })
  return offsets.map(([ox, oz]) => [padCellX + ox, padCellZ + oz])
}

function anchorCell(kind: 'city' | 'village', pad: AnchorPad | null): [number, number] | null {
  // Worker replies carry the pad snapshot used for that job. Avoid reading
  // the mutable global pad again: that allocates and can key the cache to a
  // different reseed when a replacement starts before the reply is handled.
  const padHeight = pad && Number.isFinite(pad.y) ? pad.y : undefined
  const context = `${getWorldSeed()}:${pad?.x}:${pad?.z}:${padHeight}`
  if (context !== anchorCacheContext) {
    anchorCache.clear()
    anchorCacheContext = context
  }
  const key = `${kind}:${pad?.x}:${pad?.z}`
  if (anchorCache.has(key)) return anchorCache.get(key) ?? null
  const candidates = anchorCandidates(kind, pad)
  if (!candidates.length) {
    anchorCache.set(key, null)
    return null
  }
  const padCellX = Math.floor(pad!.x / SETTLEMENT_CELL_SIZE)
  const padCellZ = Math.floor(pad!.z / SETTLEMENT_CELL_SIZE)
  if (kind === 'village') {
    const village = candidates[0]!
    anchorCache.set(key, village)
    return village
  }
  const salt = 9173
  // Never spend the only anchor cell on the city tier. A coincident city and
  // village anchor used to make the city branch win and silently delete the
  // guaranteed village from that world.
  const villageAnchor = anchorCell('village', pad)
  // Prefer a dry, low-relief center cell. This keeps a guaranteed city from
  // landing on a dramatic snow peak when a nearby shelf is available.
  let best: [number, number] | null = null, bestScore = -Infinity
  for (const [cx, cz] of candidates) {
    if (villageAnchor && cx === villageAnchor[0] && cz === villageAnchor[1]) continue
    const climate = sampleSettlementClimate((cx + .5) * SETTLEMENT_CELL_SIZE,
      (cz + .5) * SETTLEMENT_CELL_SIZE)
    if (!dry(climate)) continue
    const score = (cityBiomes.has(climate.biome) ? 6000 : 0)
      + Math.max(0, 2500 - Math.max(0, climate.height - 200) * .4)
      - climate.landform.ridge * 3500
      + hash2(padCellX * 311 + (cx - padCellX) * 71 + salt, padCellZ * 199 + (cz - padCellZ) * 97 - salt)
    if (score > bestScore) { bestScore = score; best = [cx, cz] }
  }
  if (best) {
    anchorCache.set(key, best)
    return best
  }
  const fallback = candidates.find(([cx, cz]) =>
    !villageAnchor || cx !== villageAnchor[0] || cz !== villageAnchor[1],
  ) ?? candidates[0]!
  anchorCache.set(key, fallback)
  return fallback
}

/** Ordered fallback cells used when the first protected landmark site fails validation. */
export function settlementAnchorCells(
  kind: 'city' | 'village', pad: AnchorPad | null,
): [number, number][] {
  const candidates = anchorCandidates(kind, pad)
  if (kind !== 'city' || !pad) return candidates
  const village = anchorCell('village', pad)
  return candidates.filter(([cx, cz]) => !village || cx !== village[0] || cz !== village[1])
}

/** Queue metadata for the streaming layer; null means a normal cell. */
export function settlementAnchorForCell(
  cx: number, cz: number, pad: AnchorPad | null,
): 'city' | 'village' | null {
  if (isAnchorCell(cx, cz, 'city', pad)) return 'city'
  if (isAnchorCell(cx, cz, 'village', pad)) return 'village'
  return null
}

/**
 * Anchor landmarks by distance from the pad, not by the centre of a 24 km
 * settlement cell. The city sits far enough out that its disk cannot cover
 * the airfield, even when its owning cell is the one beside the pad.
 */
function anchorLocation(
  kind: 'city' | 'village', pad: { x: number; z: number; yaw?: number }, attempt: number,
): { x: number; z: number } {
  const cellX = Math.floor(pad.x / SETTLEMENT_CELL_SIZE)
  const cellZ = Math.floor(pad.z / SETTLEMENT_CELL_SIZE)
  const salt = kind === 'city' ? 17311 : 12971
  const randomAngle = hash2(cellX * 157 + cellZ * 193 + attempt * 37 + salt,
    cellZ * 211 - cellX * 227 - attempt * 53 - salt) * Math.PI * 2
  // Scatter around the field. Keep the protected village inside a useful
  // discovery envelope, while the city remains a distant regional landmark
  // whose large footprint cannot swallow the airfield.
  const angle = randomAngle
  const base = kind === 'city' ? 21_500 : 10_500
  const span = kind === 'city' ? 3_500 : 3_500
  const distance = base + hash2(cellX * 271 + attempt * 67 + salt,
    cellZ * 313 - attempt * 89 - salt) * span
  return { x: pad.x + Math.cos(angle) * distance, z: pad.z + Math.sin(angle) * distance }
}

/**
 * Structured fallback positions cover the full landmark ring instead of
 * relying on a handful of lucky random samples. The existing scatter remains
 * first for organic placement; this pass is the deterministic rescue that
 * keeps rough worlds from deleting their only city or village.
 */
function anchorGridLocation(
  kind: 'city' | 'village', pad: { x: number; z: number }, attempt: number,
): { x: number; z: number } {
  const cellX = Math.floor(pad.x / SETTLEMENT_CELL_SIZE)
  const cellZ = Math.floor(pad.z / SETTLEMENT_CELL_SIZE)
  const sectors = 24
  const ring = Math.floor(attempt / sectors)
  const sector = attempt % sectors
  const salt = kind === 'city' ? 24131 : 18791
  const phase = hash2(cellX * 197 + cellZ * 233 + salt, cellZ * 271 - cellX * 307 - salt) * Math.PI * 2
  const angle = phase + sector / sectors * Math.PI * 2
  const ringStep = 500
  const base = kind === 'city' ? 21_500 : 10_500
  const distance = base + ring * ringStep
  return { x: pad.x + Math.cos(angle) * distance, z: pad.z + Math.sin(angle) * distance }
}

function isAnchorCell(cx: number, cz: number, kind: 'city' | 'village', pad: { x: number; z: number } | null): boolean {
  const anchor = anchorCell(kind, pad)
  return !!anchor && anchor[0] === cx && anchor[1] === cz
}

function palette(biome: Biome): { walls: number[]; roofs: number[]; roof: 'flat' | 'pitched' } {
  if (['desert', 'mesa', 'savanna', 'saltflat'].includes(biome)) {
    return {
      walls: [0xc9b592, 0xe0cbb1, 0xb79372, 0xd3b78d, 0xa98970],
      roofs: [0x997659, 0xb9a186, 0x76584b, 0xc08b63], roof: 'flat',
    }
  }
  if (['tundra', 'snow', 'mountain', 'volcanic'].includes(biome)) {
    return {
      walls: [0x929793, 0xb7b4a9, 0x726e65, 0x82949a, 0xc2b8a5],
      roofs: [0x465461, 0x624641, 0x34404a, 0x8a6559], roof: 'pitched',
    }
  }
  if (['rainforest', 'swamp'].includes(biome)) {
    return {
      walls: [0xb5a784, 0x93866e, 0xc7bea1, 0x7f9c8e, 0xd0c39a],
      roofs: [0x6d786b, 0x897654, 0x4f6258, 0x9d6f50], roof: 'pitched',
    }
  }
  return {
    walls: [0xc5c3b3, 0xb0aba2, 0xd1c4ad, 0x8e9ba2, 0xb8c7c4, 0x9d8f86],
    roofs: [0x8b5343, 0x545f64, 0x705d51, 0x3e5668, 0xa35d45], roof: 'pitched',
  }
}

/** One stable candidate per large cell; no world flattening or water filling. */
export function settlementForCell(cx: number, cz: number, forcedAnchor?: 'city' | 'village'): SettlementPlan | null {
  const pad = getOpsPad()
  const context = `${getWorldSeed()}:${pad?.x}:${pad?.z}:${pad?.y}`
  if (context !== cacheContext) { cache.clear(); cacheContext = context }
  const id = `${cx},${cz}`
  const cacheKey = `${id}:${forcedAnchor ?? 'normal'}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)!
  const roll = hash2(cx * 131 + 8129, cz * 139 - 4513)
  const cityAnchor = forcedAnchor === 'city' || (forcedAnchor !== 'village' && isAnchorCell(cx, cz, 'city', pad))
  const villageAnchor = forcedAnchor === 'village' || (forcedAnchor !== 'city' && isAnchorCell(cx, cz, 'village', pad))
  // Cities stay exceptional. Villages have a much higher candidate rate than
  // cities because a 24 km cell plus terrain validation otherwise turns them
  // into once-per-session accidents instead of landmarks to fly toward.
  const kind = cityAnchor ? 'city' : villageAnchor ? 'village' : roll < CITY_CHANCE ? 'city' : 'village'
  let result: SettlementPlan | null = null
  if (roll < VILLAGE_CHANCE || villageAnchor || cityAnchor) {
    const rand = (n: number) => hash2(cx * 673 + n * 97 + 2843, cz * 701 - n * 131 - 9571)
    const radius = kind === 'city' ? 8500 + rand(1) * 1500
      : villageAnchor ? 1500 + rand(1) ** .72 * 2200 : 1050 + rand(1) ** .72 * 3950
    // Cities are allowed to straddle cell boundaries. Restricting their
    // center to radius+300 from every edge left a 9 km city with only a tiny
    // 3 km-wide search strip inside a 24 km cell, so most otherwise excellent
    // city shelves were discarded before population even ran. Villages keep
    // their padded footprint because their smaller lots should stay local.
    const margin = kind === 'city' ? 1800 : radius + 300
    // Huge city footprints need a broader site search now that mountain and
    // foothill provinces have stronger relief. Village surveys stay compact so
    // a creek on the far side of a wide rural footprint does not erase it.
    // Site validation is deterministic and off-thread, so spend a little more
    // search budget finding a real dry shelf instead of silently deleting the
    // whole landmark when the first random probes land on a river or ridge.
    const siteAttempts = kind === 'city' ? (cityAnchor ? 384 : 56) : (villageAnchor ? 384 : 48)
    for (let attempt = 0; attempt < siteAttempts; attempt++) {
      const anchored = pad && (cityAnchor || villageAnchor)
        ? attempt < 96 ? anchorLocation(kind, pad, attempt) : anchorGridLocation(kind, pad, attempt - 96)
        : null
      const organicCoordinate = (cell: number, random: number): number => {
        // Uniform placement regularly put an otherwise valid settlement in a
        // cell corner, where the player could fly past without ever seeing it.
        // Contracting the random span toward the cell centre keeps the same
        // density and deterministic seed while making generated landmarks
        // discoverable inside the fog envelope.
        const centered = .5 + (random - .5) * ORGANIC_SITE_CENTER_BIAS
        return cell * SETTLEMENT_CELL_SIZE + margin + centered * (SETTLEMENT_CELL_SIZE - margin * 2)
      }
      const x = anchored ? anchored.x : organicCoordinate(cx, rand(10 + attempt * 2))
      const z = anchored ? anchored.z : organicCoordinate(cz, rand(11 + attempt * 2))
      const padClearance = kind === 'city' ? CITY_PAD_CLEARANCE_M : VILLAGE_PAD_CLEARANCE_M
      if (pad) {
        const padDx = x - pad.x
        const padDz = z - pad.z
        const padExclusion = radius + padClearance
        if (padDx * padDx + padDz * padDz < padExclusion * padExclusion) continue
      }
      const c = sampleSettlementClimate(x, z)
      if (!dry(c) || (kind === 'city' && !cityBiomes.has(c.biome))) continue
      let min = c.height, max = c.height, suitable = true, drySamples = 1
      const surveySamples = kind === 'city' ? 8 : 6
      const surveyRadius = radius * (kind === 'city' ? (cityAnchor ? .58 : .8) : (villageAnchor ? .48 : .56))
      for (let i = 0; i < surveySamples; i++) {
        const angle = i * Math.PI * 2 / surveySamples
        const s = sampleSettlementClimate(x + Math.cos(angle) * surveyRadius, z + Math.sin(angle) * surveyRadius, 1)
        if (!dry(s)) {
          // A village can border a creek, marsh, or lake. Rejecting one wet
          // perimeter probe used to erase otherwise excellent landmarks;
          // individual lots and road shoulders still perform strict dry-site
          // checks during population.
          continue
        }
        drySamples++
        min = Math.min(min, s.height); max = Math.max(max, s.height)
        const reliefLimit = kind === 'city' && cityAnchor ? 1600
          : kind === 'city' ? 350 : villageAnchor ? 650 : 420
        if (max - min > reliefLimit) { suitable = false; break }
      }
      if (drySamples < (kind === 'city' ? (cityAnchor ? 3 : 4) : 3)) suitable = false
      if (!suitable) continue
      const plan: SettlementPlan = { id, x, z, y: c.height, radius, kind, biome: c.biome,
        name: settlementNameForCell(cx, cz, kind, c.biome),
        anchor: cityAnchor ? 'city' : villageAnchor ? 'village' : undefined, buildings: [], roads: [] }
      populate(plan, rand)
      const minimumBuildings = kind === 'city'
        ? cityAnchor ? ANCHOR_CITY_MIN_BUILDINGS : 650
        : villageAnchor ? ANCHOR_VILLAGE_MIN_BUILDINGS : 8
      if (plan.buildings.length < minimumBuildings) continue
      result = plan
      break
    }
  }
  // Bounded including empty cells; revisiting reconstructs exactly the same plan.
  if (cache.size >= 192) cache.delete(cache.keys().next().value!)
  cache.set(cacheKey, result)
  return result
}

function populate(plan: SettlementPlan, rand: (n: number) => number): void {
  const angle = rand(30) * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle)
  const style = palette(plan.biome)
  const world = (x: number, z: number) => ({ x: plan.x + cos * x + sin * z, z: plan.z - sin * x + cos * z })
  const occupied = new Map<string, {
    x: number
    z: number
    hx: number
    hz: number
    yaw: number
    cosYaw: number
    sinYaw: number
    width: number
    depth: number
  }[]>()
  const streets: { a: { x: number; z: number }; b: { x: number; z: number }; width: number }[] = []
  const streetBuckets = new Map<string, typeof streets>()
  let serial = 100
  const layout = settlementLayout(plan, rand)
  const building = (lx: number, lz: number, width: number, depth: number, height: number,
    yaw = angle, use: BuildingUse = 'house', district: District = 'residential', forcedShape?: SettlementBuilding['shape']) => {
    const { x, z } = world(lx, lz)
    const localRadius = Math.hypot(lx, lz)
    const halfDiagonal = Math.hypot(width, depth) / 2
    const bc = Math.cos(yaw), bs = Math.sin(yaw)
    const hx = (Math.abs(bc) * width + Math.abs(bs) * depth) / 2 + 5
    const hz = (Math.abs(bs) * width + Math.abs(bc) * depth) / 2 + 5
    if (localRadius + halfDiagonal > plan.radius * .97) return
    // Reserve planned parks, farm fields and service forecourts before lots.
    for (const space of layout.spaces) {
      const dx = lx - space.x, dz = lz - space.z
      const c = Math.cos(space.yaw), s = Math.sin(space.yaw)
      const relative = yaw - angle - space.yaw
      const hx = Math.abs(Math.cos(relative)) * width / 2 + Math.abs(Math.sin(relative)) * depth / 2
      const hz = Math.abs(Math.sin(relative)) * width / 2 + Math.abs(Math.cos(relative)) * depth / 2
      if (Math.abs(dx * c - dz * s) < space.width / 2 + hx + 2 &&
        Math.abs(dx * s + dz * c) < space.depth / 2 + hz + 2) return
    }
    // Reject road intersections, including another street crossing this lot's
    // frontage. The test uses the rendered (dry/grade-accepted) street runs.
    let roadDistance = Infinity
    for (const street of streetBuckets.get(`${Math.floor(lx / 128)},${Math.floor(lz / 128)}`) ?? []) {
      const dx = street.b.x - street.a.x, dz = street.b.z - street.a.z
      const t = Math.max(0, Math.min(1, ((lx - street.a.x) * dx + (lz - street.a.z) * dz) / (dx * dx + dz * dz)))
      const distance = Math.hypot(lx - street.a.x - dx * t, lz - street.a.z - dz * t)
      if (distance < halfDiagonal + street.width / 2 + 4) return
      roadDistance = Math.min(roadDistance, distance)
    }
    if (roadDistance > Math.max(width, depth) + 65) return
    const keys: string[] = []
    for (let bx = Math.floor((x - hx) / 400); bx <= Math.floor((x + hx) / 400); bx++) {
      for (let bz = Math.floor((z - hz) / 400); bz <= Math.floor((z + hz) / 400); bz++) {
        const key = `${bx},${bz}`
        // Empty buckets are the common case while a settlement is being
        // populated. Avoid allocating a throwaway [] for every empty probe.
        const occupiedBucket = occupied.get(key)
        if (!occupiedBucket) {
          keys.push(key)
          continue
        }
        for (const other of occupiedBucket) {
          if (Math.abs(x - other.x) >= hx + other.hx || Math.abs(z - other.z) >= hz + other.hz) continue
          // Probe the four separating axes inline. This hot loop used to
          // allocate an angle array plus two closures for every occupied
          // candidate, even though the result is only a short boolean scan.
          const deltaX = x - other.x
          const deltaZ = z - other.z
          const otherCos = other.cosYaw
          const otherSin = other.sinYaw
          let separate = false
          for (let axis = 0; axis < 4; axis++) {
            const rotation = axis < 2
              ? yaw + axis * Math.PI / 2
              : other.yaw + (axis - 2) * Math.PI / 2
            const ux = Math.cos(rotation), uz = -Math.sin(rotation)
            const currentExtent =
              Math.abs(ux * bc - uz * bs) * width / 2 +
              Math.abs(ux * bs + uz * bc) * depth / 2
            const otherExtent =
              Math.abs(ux * otherCos - uz * otherSin) * other.width / 2 +
              Math.abs(ux * otherSin + uz * otherCos) * other.depth / 2
            if (Math.abs(deltaX * ux + deltaZ * uz) >= currentExtent + otherExtent + 10) {
              separate = true
              break
            }
          }
          if (!separate) return
        }
        keys.push(key)
      }
    }
    let min = Infinity, max = -Infinity
    // Corners, edge midpoints and center reject water or steep individual lots.
    for (const dx of [-width / 2, 0, width / 2]) for (const dz of [-depth / 2, 0, depth / 2]) {
      const c = sampleSettlementClimate(x + bc * dx + bs * dz, z - bs * dx + bc * dz)
      if (!dry(c)) return
      min = Math.min(min, c.height); max = Math.max(max, c.height)
    }
    const anchorCity = plan.kind === 'city' && plan.anchor === 'city'
    const anchorVillage = plan.kind === 'village' && plan.anchor === 'village'
    const reliefLimit = plan.kind === 'city'
      ? Math.min(anchorCity ? 260 : 60, Math.min(width, depth) * (anchorCity ? .98 : .22))
      : Math.min(anchorVillage ? 78 : 35, Math.min(width, depth) * (anchorVillage ? .32 : .15))
    if (max - min > reliefLimit) return
    for (const key of keys) {
      const bucket = occupied.get(key) ?? []
      bucket.push({ x, z, hx, hz, yaw, cosYaw: bc, sinYaw: bs, width, depth }); occupied.set(key, bucket)
    }
    const n = serial++
    const shape = forcedShape ?? 'block'
    const finalHeight = height
    const flatRoof = use !== 'house' && use !== 'barn' && use !== 'civic'
      || shape === 'tower' || shape === 'stepped'
    let service: SettlementBuilding['service']
    if (use === 'gas-station') {
      const sx = x - Math.sin(yaw) * (depth / 2 + 15), sz = z - Math.cos(yaw) * (depth / 2 + 15)
      let low = Infinity, high = -Infinity, valid = true
      for (const dx of [-12, 12]) for (const dz of [-8, 8]) {
        const ground = sampleSettlementClimate(sx + bc * dx + bs * dz, sz - bs * dx + bc * dz)
        if (!dry(ground)) valid = false
        low = Math.min(low, ground.height); high = Math.max(high, ground.height)
      }
      if (valid && high - low < 2) service = { x: sx, z: sz, y: high + .2, yaw }
    }
    plan.buildings.push({ x, z, y: min - 1, width, depth, height: finalHeight + max - min + 1,
      shape, use, district, service,
      yaw, roof: flatRoof ? 'flat' : style.roof,
      wallColor: use === 'barn' ? 0x8d5141 : use === 'gas-station' ? 0xd6cbb3
        : use === 'office' ? [0x70838a, 0x566d80, 0x8a999b][n % 3]!
          : use === 'warehouse' ? [0x95998f, 0x89958e, 0xa3a095][n % 3]!
        : style.walls[Math.floor(rand(n) * style.walls.length)]!,
      roofColor: style.roofs[Math.floor(rand(n + 1000) * style.roofs.length)]! })
  }
  let roadPoints = 0
  let roadSupports = 0
  const road = (local: { x: number; z: number }[], width: number) => {
    const profile = groundRoad(local.map(p => world(p.x, p.z)), width, sampleSettlementClimate)
    if (!profile || roadPoints + profile.points.length > MAX_LOCAL_ROAD_POINTS) return
    const supports = bridgeSupportPoints(profile).length
    if (roadSupports + supports > MAX_ROAD_SUPPORTS) return
    roadSupports += supports
    roadPoints += profile.points.length
    plan.roads.push(profile)
    for (let i = 1; i < profile.points.length; i++) {
      const a = profile.points[i - 1]!, b = profile.points[i]!
      // Frontage buildings attach only to ground-level streets, not decks.
      if (a.structure !== 'ground' || b.structure !== 'ground') continue
      streets.push({ a: { x: cos * (a.x - plan.x) - sin * (a.z - plan.z),
        z: sin * (a.x - plan.x) + cos * (a.z - plan.z) },
      b: { x: cos * (b.x - plan.x) - sin * (b.z - plan.z),
        z: sin * (b.x - plan.x) + cos * (b.z - plan.z) }, width })
    }
  }
  for (const proposed of layout.roads) road(proposed.points, proposed.width)
  for (const street of streets) {
    for (let x = Math.floor((Math.min(street.a.x, street.b.x) - 150) / 128);
      x <= Math.floor((Math.max(street.a.x, street.b.x) + 150) / 128); x++) {
      for (let z = Math.floor((Math.min(street.a.z, street.b.z) - 150) / 128);
        z <= Math.floor((Math.max(street.a.z, street.b.z) + 150) / 128); z++) {
        const key = `${x},${z}`, bucket = streetBuckets.get(key) ?? []
        bucket.push(street); streetBuckets.set(key, bucket)
      }
    }
  }
  for (const lot of layout.lots) {
    if (plan.buildings.length >= layout.target) break
    building(lot.x, lot.z, lot.width, lot.depth, lot.height, angle + lot.yaw,
      lot.use, lot.district, lot.shape)
  }
  // Ground patches are generated only after building placement. They share
  // terrain/water probes with roads and contain no foliage or gameplay objects.
  plan.ground = []
  let groundVertices = 0
  for (const space of layout.spaces.slice(0, MAX_SETTLEMENT_GROUND_PATCHES)) {
    const patch = settlementGroundPatch(space, plan.x, plan.z, angle, sampleSettlementClimate)
    if (!patch || groundVertices + patch.positions.length / 3 > MAX_SETTLEMENT_GROUND_VERTICES) continue
    plan.ground.push(patch); groundVertices += patch.positions.length / 3
    if (space.use === 'park') {
      for (const cross of [false, true]) {
        const path = settlementGroundPatch({ ...space, use: 'path', color: 0xb2a083,
          width: cross ? space.width : 2.5, depth: cross ? 2.5 : space.depth },
          plan.x, plan.z, angle, sampleSettlementClimate)
        if (!path || groundVertices + path.positions.length / 3 > MAX_SETTLEMENT_GROUND_VERTICES ||
          plan.ground.length >= MAX_SETTLEMENT_GROUND_PATCHES) continue
        // A small independent lift separates paths from the park's own mesh.
        for (let i = 1; i < path.positions.length; i += 3) path.positions[i]! += .04
        plan.ground.push(path); groundVertices += path.positions.length / 3
      }
    }
  }
}
