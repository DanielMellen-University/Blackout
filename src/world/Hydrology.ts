import { fbm, getWorldSeed, smoothstep, valueNoise } from './noise'
import { regionalDrainageSteps } from './RegionalDrainage'
import { coastField } from './Coastline'
import { riverSurface, riverSurfaceHeightAt } from './RiverSurface'

export const CATCHMENT_SIZE = 32000
const BIN = 2000
const BINS = CATCHMENT_SIZE / BIN

export interface WaterBasin {
  x: number; z: number; radius: number; aspect: number; angle: number; phase: number
  level: number; sea: boolean; pond: boolean
  /** Conservative outer radius of the warped shoreline used by tile culling. */
  boundsRadius?: number
  id?: string
  outletId?: string
  shoreRadii?: Float32Array
  regionalSea?: boolean
  islands?: readonly { x: number; z: number; radius: number }[]
}

/**
 * Return the cached conservative radius for a warped basin. Older authored or
 * test basins may omit the field, so retain the exact historical fallback.
 */
export function waterBasinBoundsRadius(basin: Pick<WaterBasin, 'radius' | 'boundsRadius'>): number {
  const radius = Number.isFinite(basin.radius) && basin.radius > 0 ? basin.radius : 0
  const cached = basin.boundsRadius
  return typeof cached === 'number' && Number.isFinite(cached) && cached > 0 ? cached : radius * 1.75
}
/** Scalar hydrology output. Callers sampling many terrain points can reuse it. */
export interface HydrologySample {
  height: number
  waterLevel: number
  river: number
  lake: number
  pond: number
  stream: number
  coastal: number
}
type Basin = WaterBasin
/** A cached analytic river segment, shared by terrain carving and water rendering. */
export interface RiverReach {
  ax: number; az: number; bx: number; bz: number
  wa: number; wb: number; ya: number; yb: number
  /** Cached horizontal segment metrics used by repeated terrain samples. */
  dx: number; dz: number; lengthSq: number; length: number
  /** Chain-end markers let the renderer taper orphaned tributaries cleanly. */
  source?: boolean; terminal?: boolean
  /** True when this reach terminates at a lake or sea shoreline. */
  mouth?: boolean
  /** The shoreline point and width used to form a small, query-time delta. */
  mouthX?: number; mouthZ?: number; mouthWidth?: number
  id?: string; fromId?: string; toId?: string; discharge?: number; branch?: boolean
  /** Shared cross-section directions stitch curved ribbons without flat pads. */
  tangentAX?: number; tangentAZ?: number; tangentBX?: number; tangentBZ?: number
}
type Reach = RiverReach & { queryToken?: number }
interface Catchment { basins: Basin[]; landmarks: Basin[]; bins: Reach[][]; reaches: Reach[] }
export type HydrologyBuildPhase = 'samples' | 'routing' | 'basins' | 'grade' | 'channels'

let seed = Number.NaN
const cache = new Map<string, Catchment>()
let riverBoundsQueryToken = 0
function ensureCatchmentSeed(expected: number): void {
  if (getWorldSeed() !== expected) throw new Error('World seed changed during hydrology preparation')
  // A failed world search can temporarily visit another seed and restore this
  // one before a suspended builder resumes. Never reuse that other seed's cache.
  if (seed !== expected) { cache.clear(); seed = expected }
}

/**
 * Keep public shoreline queries fail-closed when a worker or debug payload
 * supplies malformed basin metadata. Invalid geometry is treated as being
 * outside the basin instead of allowing NaN to leak into terrain or water
 * clipping math.
 */
function validBasin(value: unknown): value is Basin {
  if (!value || typeof value !== 'object') return false
  const basin = value as Partial<Basin>
  const radius = basin.radius
  const aspect = basin.aspect
  return Number.isFinite(basin.x) && Number.isFinite(basin.z) &&
    Number.isFinite(radius) && radius! > 0 &&
    Number.isFinite(aspect) && aspect! > 0 &&
    Number.isFinite(basin.angle) && Number.isFinite(basin.phase) &&
    Number.isFinite(basin.level)
}

/** Signed shore distance, warped in space and broken into coves and peninsulas. */
export function basinDistance(b: Basin, x: number, z: number): number {
  if (!validBasin(b) || !Number.isFinite(x) || !Number.isFinite(z)) return Number.POSITIVE_INFINITY
  if (b.regionalSea) return coastField(x, z) * 18000
  if (b.shoreRadii) {
    const dx = x - b.x, dz = z - b.z
    const sector = ((Math.atan2(dz, dx) / (Math.PI * 2) + 1) % 1) * b.shoreRadii.length
    const index = Math.floor(sector), t = sector - index
    const a = b.shoreRadii[index]!, c = b.shoreRadii[(index + 1) % b.shoreRadii.length]!
    // Intersect this ray with the same cached shoreline chord that water
    // rendering draws. Angular easing described a different curve and left
    // some small coves with water triangles outside the collision shoreline.
    const angle = Math.PI * 2 / b.shoreRadii.length
    const radius = a * c * Math.sin(angle) /
      (c * Math.sin((1 - t) * angle) + a * Math.sin(t * angle))
    let distance = Math.hypot(dx, dz) - radius
    for (const island of b.islands ?? []) {
      const ix = x - island.x, iz = z - island.z, angle = Math.PI * 2 / 32
      const theta = ((Math.atan2(iz, ix) % angle) + angle) % angle
      const radius = island.radius * Math.cos(angle * .5) / Math.cos(theta - angle * .5)
      distance = Math.max(distance, radius - Math.hypot(ix, iz))
    }
    return distance
  }
  const scale = b.sea ? 2100 : b.pond ? 260 : 700
  const warp = b.sea ? 950 : b.pond ? 90 : 320
  const dx = x - b.x + (fbm(x / scale + 19, z / scale, 2) - .5) * warp
  const dz = z - b.z + (fbm(x / scale - 47, z / scale + 13, 2) - .5) * warp
  const u = (dx * Math.cos(b.angle) + dz * Math.sin(b.angle)) / b.radius
  const v = (-dx * Math.sin(b.angle) + dz * Math.cos(b.angle)) / (b.radius * b.aspect)
  const theta = Math.atan2(v, u)
  // Multiple low-frequency lobes make coves and peninsulas. A broad value
  // field breaks the last hint of a repeated ellipse without noisy shorelines.
  const shoreNoise = valueNoise(dx / (b.radius * .72) + b.phase * 1.7, dz / (b.radius * .72) - b.phase)
  // A broad directional lobe gives each basin a distinct headland and
  // shoreline shoulder. The second field breaks that lobe into coves without
  // introducing high-frequency noise or a new shoreline mesh.
  const broadShore = valueNoise(dx / (b.radius * 1.45) - b.phase, dz / (b.radius * 1.45) + b.phase * 1.3)
  const coveShore = valueNoise(dx / (b.radius * .42) + b.phase * 2.1, dz / (b.radius * .42) - b.phase * .8)
  const outline = 1 + .1 * Math.sin(theta - b.phase * .8) +
    .16 * Math.sin(theta * 2 + b.phase) +
    .12 * Math.sin(theta * 3 - b.phase * 1.7) +
    .09 * Math.cos(theta * 5 + b.phase) +
    (shoreNoise - .5) * .26 + (broadShore - .5) * .2 + (coveShore - .5) * .1
  return (Math.hypot(u, v) - outline) * b.radius * b.aspect
}

function catchment(cx: number, cz: number): Catchment {
  cx = Number.isFinite(cx) ? Math.trunc(cx) : 0
  cz = Number.isFinite(cz) ? Math.trunc(cz) : 0
  if (seed !== getWorldSeed()) { cache.clear(); seed = getWorldSeed() }
  const key = `${cx},${cz}`
  const previous = cache.get(key)
  if (previous) return previous

  // Cached point queries keep their iterator-free fast path. Only misses
  // create an iterator; workers and analytic collision queries drain it.
  const steps = buildCatchmentSteps(cx, cz)
  let result = steps.next()
  while (!result.done) result = steps.next()
  return result.value
}

function* buildCatchmentSteps(cx: number, cz: number): Generator<HydrologyBuildPhase, Catchment, void> {
  const buildSeed = getWorldSeed()
  const data = yield* regionalDrainageSteps(cx, cz)
  ensureCatchmentSeed(buildSeed)
  const bins: Reach[][] = Array.from({ length: BINS * BINS }, () => [])
  const ox = cx * CATCHMENT_SIZE, oz = cz * CATCHMENT_SIZE
  for (const r of data.queryReaches) {
    const margin = 1800 + Math.max(r.wa, r.wb)
    const minX = Math.max(0, Math.floor((Math.min(r.ax, r.bx) - margin - ox) / BIN))
    const maxX = Math.min(BINS - 1, Math.floor((Math.max(r.ax, r.bx) + margin - ox) / BIN))
    const minZ = Math.max(0, Math.floor((Math.min(r.az, r.bz) - margin - oz) / BIN))
    const maxZ = Math.min(BINS - 1, Math.floor((Math.max(r.az, r.bz) + margin - oz) / BIN))
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) bins[z * BINS + x]!.push(r)
  }
  const key = `${cx},${cz}`
  const existing = cache.get(key)
  if (existing) return existing
  const result: Catchment = { basins: data.basins, landmarks: data.landmarks, bins, reaches: data.reaches }
  if (cache.size >= 128) cache.delete(cache.keys().next().value!)
  cache.set(key, result)
  return result
}

/**
 * Prepare only the regions needed by one tile before climate/edge/water
 * sampling. Partial drainage is private until complete; return() abandons it.
 * No worker, timer, or additional persistent cache is created.
 */
export function* prepareHydrologyInBoundsSteps(minX: number, minZ: number, maxX: number, maxZ: number):
  Generator<HydrologyBuildPhase, void, void> {
  if (!Number.isFinite(minX) || !Number.isFinite(minZ) || !Number.isFinite(maxX) || !Number.isFinite(maxZ) ||
    maxX < minX || maxZ < minZ || maxX - minX > CATCHMENT_SIZE * 4 || maxZ - minZ > CATCHMENT_SIZE * 4) return
  const startCx = Math.floor(minX / CATCHMENT_SIZE), endCx = Math.floor(maxX / CATCHMENT_SIZE)
  const startCz = Math.floor(minZ / CATCHMENT_SIZE), endCz = Math.floor(maxZ / CATCHMENT_SIZE)
  // Beyond safe integer cells, ++ can stop advancing and freeze the iterator.
  if (!Number.isSafeInteger(startCx) || !Number.isSafeInteger(endCx) ||
    !Number.isSafeInteger(startCz) || !Number.isSafeInteger(endCz)) return
  const buildSeed = getWorldSeed()
  ensureCatchmentSeed(buildSeed)
  for (let cz = startCz; cz <= endCz; cz++) {
    for (let cx = startCx; cx <= endCx; cx++) {
      ensureCatchmentSeed(buildSeed)
      if (cache.has(`${cx},${cz}`)) continue
      const steps = buildCatchmentSteps(cx, cz)
      try {
        let result = steps.next()
        while (!result.done) {
          yield result.value
          ensureCatchmentSeed(buildSeed)
          result = steps.next()
        }
      } finally {
        steps.return(undefined as never)
      }
    }
  }
}

/** Lakes/seas have fixed levels. River reaches grade continuously downstream. */
export function sampleHydrology(x: number, z: number, ground: number): HydrologySample {
  return sampleHydrologyInto({
    height: ground, waterLevel: 0, river: 0, lake: 0, pond: 0, stream: 0, coastal: 0,
  }, x, z, ground)
}

/** Write one hydrology sample into caller-owned storage to avoid hot-path churn. */
export function sampleHydrologyInto(out: HydrologySample, x: number, z: number, ground: number, coast?: number): HydrologySample {
  const safeX = Number.isFinite(x) ? x : 0
  const safeZ = Number.isFinite(z) ? z : 0
  const safeGround = Number.isFinite(ground) ? ground : 0
  const cx = Math.floor(safeX / CATCHMENT_SIZE), cz = Math.floor(safeZ / CATCHMENT_SIZE)
  const region = catchment(cx, cz)
  const localX = safeX - cx * CATCHMENT_SIZE, localZ = safeZ - cz * CATCHMENT_SIZE
  const edgeFade = 1 // Global drainage and halo queries agree across region boundaries.
  let height = safeGround, waterLevel = 0, river = 0, lake = 0, pond = 0, stream = 0
  const coastValue = Number.isFinite(coast) ? coast! : coastField(safeX, safeZ)
  let coastal = 1 - smoothstep(0, .025, Math.abs(coastValue))
  // Tiny negative coordinates can round their local remainder up to 32000.
  const binX = Math.max(0, Math.min(BINS - 1, Math.floor(localX / BIN)))
  const binZ = Math.max(0, Math.min(BINS - 1, Math.floor(localZ / BIN)))
  const reaches = region.bins[binZ * BINS + binX]!
  let nearest = Infinity, level = 0, width = 1, coveredRiverLevel = -Infinity
  let nearestReach: Reach | null = null
  for (const r of reaches) {
    coveredRiverLevel = Math.max(coveredRiverLevel,
      riverSurfaceHeightAt(riverSurface(r, region.basins), safeX, safeZ))
    const projection = ((safeX - r.ax) * r.dx + (safeZ - r.az) * r.dz) / r.lengthSq
    const t = Math.max(0, Math.min(1, projection))
    const w = r.wa + (r.wb - r.wa) * t
    const dx = safeX - r.ax - r.dx * t, dz = safeZ - r.az - r.dz * t
    const radius = Math.max(w, nearest + w)
    if (radius < 0 || dx * dx + dz * dz >= radius * radius) continue
    const d = Math.sqrt(dx * dx + dz * dz) - w
    if (d < nearest) {
      nearest = d
      nearestReach = r
      level = r.ya + (r.yb - r.ya) * t
      width = w
    }
  }
  const valleyRange = Math.max(650, Math.min(1250, width * 5 + 160))
  // On an inside bend, the closest reach can switch between different river
  // elevations. Blend the dry valley shoulders to avoid a step at that switch.
  if (nearest > 0 && nearest < valleyRange) {
    let sum = 0, total = 0
    for (const r of reaches) {
      const t = Math.max(0, Math.min(1, ((safeX - r.ax) * r.dx + (safeZ - r.az) * r.dz) / r.lengthSq))
      const w = r.wa + (r.wb - r.wa) * t
      const dx = safeX - r.ax - r.dx * t, dz = safeZ - r.az - r.dz * t
      const radius = nearest + 320 + w
      if (radius < 0 || dx * dx + dz * dz >= radius * radius) continue
      const d = Math.sqrt(dx * dx + dz * dz) - w
      // Compact support keeps the blend identical on either side of a bin or
      // region boundary; remote channels must not add a nonzero tail.
      const weight = 1 - smoothstep(0, 320, Math.max(0, d - nearest))
      sum += (r.ya + (r.yb - r.ya) * t) * weight
      total += weight
    }
    level += (sum / total - level) * smoothstep(0, 240, nearest)
  }

  if (nearest < valleyRange) {
    const d = nearest
    const blend = (1 - smoothstep(0, valleyRange, Math.max(0, d))) * edgeFade
    const bank = d < 0 ? -(5 + width * .04) * smoothstep(0, width, -d) : d * .075 + d * d * .00007
    // A channel can cut a valley, not lift an unrelated low hillside into a
    // sharp embankment when a nearby reach has a higher water elevation.
    height += (Math.min(height, level + bank) - height) * blend
    // The broad valley blend shapes banks and floodplain relief, but only the
    // channel itself owns a water surface. Marking the whole valley wet left
    // a dark triangular bed wherever the analytic river ribbon was absent.
    // A valley shoulder is not water. In low terrain the old 1.35-width
    // margin marked dry banks as submerged even outside the visible ribbon,
    // producing blocky brown "water" patches and invisible water collisions.
    // Actual covered spans resolve their surface below.
    river = 1 - smoothstep(0, Math.max(90, Math.min(300, width * 1.2)), Math.max(0, d))
    stream = width < 48 ? river : 0
  }

  // Overlapping ribbons render their upper surface, not the elevation of
  // whichever bank happens to be closest. Do not let a projected endpoint
  // outside a span override an actual channel covering this point.
  if (coveredRiverLevel > -Infinity) {
    waterLevel = coveredRiverLevel
    height = Math.min(height, waterLevel - .1)
    river = Math.max(river, 1)
  }

  // A river should not stop at a mathematically exact shoreline and leave a
  // dry triangular peninsula between its channel and the receiving basin.
  // Fill a restrained, downstream delta corridor in the same query that
  // carves the river. WaterSystem receives the resulting levels and therefore
  // clips matching water geometry instead of relying on a renderer-only fan.
  for (const reach of reaches) {
    if (!reach.mouth || reach.mouthX === undefined || reach.mouthZ === undefined) continue
    const length = reach.length
    if (length < 1) continue
    const px = safeX - reach.mouthX, pz = safeZ - reach.mouthZ
    const along = (px * reach.dx + pz * reach.dz) / length
    const lateral = Math.abs(px * reach.dz - pz * reach.dx) / length
    const channelWidth = Math.max(24, reach.mouthWidth ?? reach.wb)
    const deltaLength = Math.max(260, Math.min(620, channelWidth * 3.6))
    const deltaWidth = Math.max(90, Math.min(260, channelWidth * 2.15))
    if (along < 0 || along > deltaLength || lateral > deltaWidth) continue
    const alongFade = 1 - smoothstep(-channelWidth * .55, deltaLength, along)
    const edgeWidth = deltaWidth * (1 - .28 * Math.max(0, along) / deltaLength)
    const lateralFade = 1 - smoothstep(edgeWidth * .55, edgeWidth, lateral)
    const blend = alongFade * lateralFade * edgeFade
    if (blend <= .08) continue
    // A broad mouth delta can overlap a nearby tributary after the coastline
    // is warped. Only the closest reach may own the local water level, or the
    // delta would flatten an upstream channel to sea level.
    if (nearest < valleyRange && nearestReach && nearestReach !== reach) continue
    const deltaLevel = reach.yb
    height += (deltaLevel - 1.5 - height) * Math.min(1, blend * 1.25)
    if (blend > .16 && coveredRiverLevel > -Infinity) {
      river = Math.max(river, blend)
    }
  }
  let basinWaterLevel = -Infinity
  for (const basin of region.basins) {
    const limit = basin.radius * 1.65 + 2000
    if (Math.abs(safeX - basin.x) > limit || Math.abs(safeZ - basin.z) > limit) continue
    const d = basinDistance(basin, safeX, safeZ)
    // Keep a readable shallow shelf, not a kilometre-wide exposed brown
    // wedge between dry terrain and the independent water surface.
    const margin = basin.sea ? 900 : basin.pond ? 360 : 780
    if (d >= margin) continue
    const blend = (1 - smoothstep(0, margin, Math.max(0, d))) * edgeFade
    const bed = d < 0
      ? -(basin.sea ? 150 : 32) * smoothstep(0, basin.sea ? 2300 : 500, -d) + d * .012
      : d * .065 + d * d * .000035
    const basinHeight = height + (basin.level + bed - height) * blend
    // Preserve an existing outlet through the bank instead of damming it shut.
    height = d > 0 ? basinHeight + (Math.min(height, basinHeight) - basinHeight) * river :
      nearest < 0 ? Math.min(height, basinHeight) : basinHeight
    if (d <= 0) basinWaterLevel = Math.max(basinWaterLevel, basin.level)
    if (basin.sea) {
      coastal = Math.max(coastal, 1 - smoothstep(0, 420, Math.max(0, d)))
    }
    else if (basin.pond) pond = 1 - smoothstep(0, 120, Math.max(0, d))
    else lake = 1 - smoothstep(0, 160, Math.max(0, d))
  }
  // The renderer clips river geometry out of lake-owned surfaces. Overlapping
  // lakes render their highest surface, regardless of region/list build order.
  if (basinWaterLevel > -Infinity) {
    waterLevel = Math.max(basinWaterLevel, coveredRiverLevel)
  }
  if (basinWaterLevel > -Infinity || coveredRiverLevel > -Infinity)
    height = Math.min(height, waterLevel - .1)
  // Valley carving is not a sea source. Keep dry inland shoulders above the
  // default datum instead of silently filling every negative carved bank with
  // raster ocean water beneath an adjacent analytic lake or river.
  else if (coastValue >= 0) height = Math.max(.1, height)
  out.height = height
  out.waterLevel = waterLevel
  out.river = river
  out.lake = lake
  out.pond = pond
  out.stream = stream
  out.coastal = coastal
  return out
}

/** Read-only landmarks for repeatable visual review and hydrology tests. */
export function waterLandmarks(cx: number, cz: number): ReadonlyArray<Readonly<Basin>> {
  return catchment(cx, cz).landmarks
}

export function riverReaches(cx: number, cz: number): ReadonlyArray<Readonly<Reach>> {
  return catchment(cx, cz).reaches
}

/** Region halos already include crossing lakes; never generate extra regions
 * just to find a basin whose centre lies across a tile/region boundary. */
export function waterBasinsInBounds(minX: number, minZ: number, maxX: number, maxZ: number,
  out: WaterBasin[] = []): WaterBasin[] {
  out.length = 0
  if (![minX, minZ, maxX, maxZ].every(Number.isFinite) || maxX < minX || maxZ < minZ ||
    maxX - minX > CATCHMENT_SIZE * 4 || maxZ - minZ > CATCHMENT_SIZE * 4) return out
  const x0 = Math.floor(minX / CATCHMENT_SIZE), x1 = Math.floor(maxX / CATCHMENT_SIZE)
  const z0 = Math.floor(minZ / CATCHMENT_SIZE), z1 = Math.floor(maxZ / CATCHMENT_SIZE)
  if (![x0, x1, z0, z1].every(Number.isSafeInteger)) return out
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      for (const b of catchment(cx, cz).basins) {
        const r = waterBasinBoundsRadius(b)
        if (b.x + r < minX || b.x - r > maxX || b.z + r < minZ || b.z - r > maxZ) continue
        if (!out.some(existing => existing.id === b.id)) out.push(b)
      }
    }
  }
  return out
}

function lineIntersectsBounds(
  ax: number, az: number, bx: number, bz: number,
  minX: number, minZ: number, maxX: number, maxZ: number,
): boolean {
  const dx = bx - ax, dz = bz - az
  let low = 0, high = 1
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0
    const t = q / p
    if (p < 0) {
      if (t > high) return false
      if (t > low) low = t
    } else {
      if (t < low) return false
      if (t < high) high = t
    }
    return true
  }
  return clip(-dx, ax - minX) && clip(dx, maxX - ax) &&
    clip(-dz, az - minZ) && clip(dz, maxZ - az)
}

interface RiverBoundsQuery {
  startCx: number
  endCx: number
  startCz: number
  endCz: number
  expandedMinX: number
  expandedMinZ: number
  expandedMaxX: number
  expandedMaxZ: number
}

function normalizeRiverBounds(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  margin: number,
): RiverBoundsQuery | null {
  if (!Number.isFinite(minX) || !Number.isFinite(minZ) ||
    !Number.isFinite(maxX) || !Number.isFinite(maxZ) || !Number.isFinite(margin)) return null
  if (maxX < minX || maxZ < minZ) return null
  const safeMargin = Math.max(0, Math.min(CATCHMENT_SIZE * 2, margin))
  const expandedMinX = minX - safeMargin, expandedMinZ = minZ - safeMargin
  const expandedMaxX = maxX + safeMargin, expandedMaxZ = maxZ + safeMargin
  return {
    startCx: Math.floor(expandedMinX / CATCHMENT_SIZE),
    endCx: Math.floor(expandedMaxX / CATCHMENT_SIZE),
    startCz: Math.floor(expandedMinZ / CATCHMENT_SIZE),
    endCz: Math.floor(expandedMaxZ / CATCHMENT_SIZE),
    expandedMinX,
    expandedMinZ,
    expandedMaxX,
    expandedMaxZ,
  }
}

/**
 * Visit reaches intersecting a normalized bounds query. Passing a result set
 * collects every reach; passing null returns immediately on the first hit.
 * The latter is used by terrain culling so a boolean query never materializes
 * an intermediate array or performs work for distant catchments after a hit.
 */
function collectRiverReachesInBounds(
  query: RiverBoundsQuery,
  result: Reach[] | null,
): boolean {
  let found = false
  const queryToken = result ? nextRiverBoundsQueryToken() : 0
  const ids = result ? new Set<string>() : null
  for (let cz = query.startCz; cz <= query.endCz; cz++) for (let cx = query.startCx; cx <= query.endCx; cx++) {
    const ox = cx * CATCHMENT_SIZE, oz = cz * CATCHMENT_SIZE
    const region = catchment(cx, cz)
    const localMinX = Math.max(0, query.expandedMinX - ox)
    const localMaxX = Math.min(CATCHMENT_SIZE, query.expandedMaxX - ox)
    const localMinZ = Math.max(0, query.expandedMinZ - oz)
    const localMaxZ = Math.min(CATCHMENT_SIZE, query.expandedMaxZ - oz)
    if (localMinX > localMaxX || localMinZ > localMaxZ) continue
    const minBinX = Math.max(0, Math.floor(localMinX / BIN))
    const maxBinX = Math.min(BINS - 1, Math.floor(localMaxX / BIN))
    const minBinZ = Math.max(0, Math.floor(localMinZ / BIN))
    const maxBinZ = Math.min(BINS - 1, Math.floor(localMaxZ / BIN))
    for (let iz = minBinZ; iz <= maxBinZ; iz++) for (let ix = minBinX; ix <= maxBinX; ix++) {
      for (const reach of region.bins[iz * BINS + ix]!) {
        if (result && reach.queryToken === queryToken) continue
        const surface = riverSurface(reach, region.basins)
        if (surface.maxX < query.expandedMinX || surface.minX > query.expandedMaxX ||
          surface.maxZ < query.expandedMinZ || surface.minZ > query.expandedMaxZ) continue
        const width = Math.max(reach.wa, reach.wb) + (reach.source ? 140 : reach.mouth ? 80 : 0)
        if (!lineIntersectsBounds(
          reach.ax, reach.az, reach.bx, reach.bz,
          query.expandedMinX - width, query.expandedMinZ - width,
          query.expandedMaxX + width, query.expandedMaxZ + width,
        )) continue
        if (!result) return true
        reach.queryToken = queryToken
        // Region entries outlive the bounded node cache. After eviction a
        // neighbor can recreate the same reach as a different object, so an
        // object token alone drew it twice and caused water overlap artifacts.
        if (reach.id && ids!.has(reach.id)) continue
        if (reach.id) ids!.add(reach.id)
        result.push(reach)
        found = true
      }
    }
  }
  return found
}

function nextRiverBoundsQueryToken(): number {
  riverBoundsQueryToken = (riverBoundsQueryToken + 1) >>> 0
  if (riverBoundsQueryToken === 0) riverBoundsQueryToken = 1
  return riverBoundsQueryToken
}

/** Locate cached river reaches that touch an axis-aligned streamed tile. */
export function riverReachesInBounds(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  margin = 0,
  out?: RiverReach[],
): ReadonlyArray<Readonly<RiverReach>> {
  const result = out ?? []
  result.length = 0
  const query = normalizeRiverBounds(minX, minZ, maxX, maxZ, margin)
  if (!query) return result
  collectRiverReachesInBounds(query, result)
  return result
}

/**
 * Fast cached query for streaming LOD: reports whether a drainage reach could
 * touch an axis-aligned tile. It avoids missing a thin river merely because
 * every coarse terrain vertex happens to land on its dry bank. Broad basins
 * are intentionally left to normal vertex sampling to preserve the budget.
 */
export function hydrologyIntersectsBounds(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  margin = 0,
): boolean {
  const query = normalizeRiverBounds(minX, minZ, maxX, maxZ, margin)
  return query ? collectRiverReachesInBounds(query, null) : false
}
