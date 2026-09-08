import { fbm, getWorldSeed, hash2, smoothstep, valueNoise } from './noise'
import { sampleLandforms } from './Landforms'

export const CATCHMENT_SIZE = 32000
const BIN = 2000
const BINS = CATCHMENT_SIZE / BIN

// This grid only exists while a catchment cache entry is being built. Query
// time keeps the old compact basin + spatial-bin representation.
const FLOW_GRID = 18
const FLOW_STEP = CATCHMENT_SIZE / (FLOW_GRID - 1)
const MAX_CHANNEL_EDGES = 72
const MAX_RENDER_REACHES = 180

interface Basin { x: number; z: number; radius: number; aspect: number; angle: number; phase: number; level: number; sea: boolean }
interface Reach { ax: number; az: number; bx: number; bz: number; wa: number; wb: number; ya: number; yb: number }
interface Catchment { basins: Basin[]; bins: Reach[][] }
interface FlowGrid {
  height: Float64Array
  moisture: Float32Array
  highlands: Float32Array
  filled: Float64Array
  parent: Int32Array
  flow: Float64Array
}
interface FlowEdge { from: number; to: number; flow: number }

class MinHeap {
  private readonly entries: { id: number; level: number }[] = []

  get size(): number { return this.entries.length }

  push(id: number, level: number): void {
    const entry = { id, level }
    const values = this.entries
    values.push(entry)
    let child = values.length - 1
    while (child > 0) {
      const parent = (child - 1) >> 1
      if (values[parent]!.level <= entry.level) break
      values[child] = values[parent]!
      child = parent
    }
    values[child] = entry
  }

  pop(): { id: number; level: number } | undefined {
    const values = this.entries
    if (values.length === 0) return undefined
    const root = values[0]!
    const tail = values.pop()!
    if (values.length === 0) return root
    let parent = 0
    while (parent * 2 + 1 < values.length) {
      let child = parent * 2 + 1
      if (child + 1 < values.length && values[child + 1]!.level < values[child]!.level) child++
      if (values[child]!.level >= tail.level) break
      values[parent] = values[child]!
      parent = child
    }
    values[parent] = tail
    return root
  }
}

let seed = Number.NaN
const cache = new Map<string, Catchment>()

function gridId(ix: number, iz: number): number { return iz * FLOW_GRID + ix }
function gridX(ox: number, id: number): number { return ox + (id % FLOW_GRID) * FLOW_STEP }
function gridZ(oz: number, id: number): number { return oz + Math.floor(id / FLOW_GRID) * FLOW_STEP }

function insideGrid(id: number, inset = 0): boolean {
  const x = id % FLOW_GRID, z = Math.floor(id / FLOW_GRID)
  return x >= inset && z >= inset && x < FLOW_GRID - inset && z < FLOW_GRID - inset
}

function forEachNeighbor(id: number, visit: (neighbor: number) => void): void {
  const x = id % FLOW_GRID, z = Math.floor(id / FLOW_GRID)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (dx === 0 && dz === 0) continue
    const nx = x + dx, nz = z + dz
    if (nx >= 0 && nz >= 0 && nx < FLOW_GRID && nz < FLOW_GRID) visit(gridId(nx, nz))
  }
}

/** Signed shore distance, warped in space and broken into coves and peninsulas. */
export function basinDistance(b: Basin, x: number, z: number): number {
  const scale = b.sea ? 2100 : 700
  const warp = b.sea ? 950 : 320
  const dx = x - b.x + (fbm(x / scale + 19, z / scale, 2) - .5) * warp
  const dz = z - b.z + (fbm(x / scale - 47, z / scale + 13, 2) - .5) * warp
  const u = (dx * Math.cos(b.angle) + dz * Math.sin(b.angle)) / b.radius
  const v = (-dx * Math.sin(b.angle) + dz * Math.cos(b.angle)) / (b.radius * b.aspect)
  const theta = Math.atan2(v, u)
  // Multiple low-frequency lobes make coves and peninsulas. A broad value
  // field breaks the last hint of a repeated ellipse without noisy shorelines.
  const shoreNoise = valueNoise(dx / (b.radius * .72) + b.phase * 1.7, dz / (b.radius * .72) - b.phase)
  const outline = 1 + .16 * Math.sin(theta * 2 + b.phase) +
    .12 * Math.sin(theta * 3 - b.phase * 1.7) +
    .09 * Math.cos(theta * 5 + b.phase) + (shoreNoise - .5) * .34
  return (Math.hypot(u, v) - outline) * b.radius * b.aspect
}

/** Sample broad terrain once before creating the cached drainage graph. */
function makeFlowGrid(ox: number, oz: number): FlowGrid {
  const count = FLOW_GRID * FLOW_GRID
  const height = new Float64Array(count)
  const moisture = new Float32Array(count)
  const highlands = new Float32Array(count)
  for (let z = 0; z < FLOW_GRID; z++) for (let x = 0; x < FLOW_GRID; x++) {
    const id = gridId(x, z)
    const land = sampleLandforms(ox + x * FLOW_STEP, oz + z * FLOW_STEP)
    height[id] = land.height
    moisture[id] = land.moisture
    highlands[id] = land.highlands
  }
  const filled = new Float64Array(count)
  filled.fill(Infinity)
  const parent = new Int32Array(count)
  parent.fill(-1)
  return { height, moisture, highlands, filled, parent, flow: new Float64Array(count) }
}

/** Pick an infrequent sea in naturally low country, never as a default background. */
function chooseSeaCell(grid: FlowGrid, cx: number, cz: number): number | null {
  if (hash2(cx - 91, cz + 101) <= .62) return null
  const candidates: { id: number; score: number }[] = []
  for (let z = 3; z < FLOW_GRID - 3; z++) for (let x = 3; x < FLOW_GRID - 3; x++) {
    const id = gridId(x, z)
    if (grid.highlands[id]! > .32 || grid.height[id]! > 950) continue
    const score = grid.height[id]! + hash2(cx * 61 + x * 17, cz * 73 + z * 29) * 280
    candidates.push({ id, score })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.score - b.score)
  const pool = Math.min(8, candidates.length)
  return candidates[Math.floor(hash2(cx + 41, cz - 61) * pool)]!.id
}

/** Priority-flood routing resolves local sinks once and gives every cell one downstream parent. */
function routeFlow(grid: FlowGrid, seaCell: number | null): void {
  const heap = new MinHeap()
  const closed = new Uint8Array(grid.height.length)
  const seedCell = (id: number, level: number) => {
    if (level >= grid.filled[id]!) return
    grid.filled[id] = level
    grid.parent[id] = -1
    heap.push(id, level)
  }
  for (let z = 0; z < FLOW_GRID; z++) for (let x = 0; x < FLOW_GRID; x++) {
    if (x === 0 || z === 0 || x === FLOW_GRID - 1 || z === FLOW_GRID - 1) {
      const id = gridId(x, z)
      // Boundary routes vanish into the existing edge fade. A small penalty
      // keeps the occasional inland sea attractive when there is one.
      seedCell(id, grid.height[id]! + 90)
    }
  }
  if (seaCell !== null) seedCell(seaCell, 0)

  while (heap.size > 0) {
    const next = heap.pop()!
    if (closed[next.id]) continue
    closed[next.id] = 1
    forEachNeighbor(next.id, neighbor => {
      if (closed[neighbor]) return
      const level = Math.max(grid.height[neighbor]!, next.level + .35)
      if (level >= grid.filled[neighbor]!) return
      grid.filled[neighbor] = level
      grid.parent[neighbor] = next.id
      heap.push(neighbor, level)
    })
  }

  const order = Array.from({ length: grid.height.length }, (_, id) => id)
  for (const id of order) {
    // Humid hills contribute more runoff while dry terrain only feeds the
    // largest channels. This changes which tributaries survive without a
    // texture, mesh, or per-frame simulation.
    grid.flow[id] = .08 + grid.moisture[id]! * .42 + grid.highlands[id]! * .1
  }
  order.sort((a, b) => grid.filled[b]! - grid.filled[a]!)
  for (const id of order) {
    const parent = grid.parent[id]!
    if (parent >= 0) grid.flow[parent] += grid.flow[id]!
  }
}

function localDepression(grid: FlowGrid, id: number): number {
  let sum = 0, count = 0
  forEachNeighbor(id, neighbor => { sum += grid.height[neighbor]!; count++ })
  return Math.max(0, sum / Math.max(1, count) - grid.height[id]!)
}

function chooseLakeCells(grid: FlowGrid, seaCell: number | null, cx: number, cz: number): number[] {
  const requested = 1 + Math.floor(hash2(cx - 17, cz + 73) * 3)
  const candidates: { id: number; score: number }[] = []
  for (let z = 3; z < FLOW_GRID - 3; z++) for (let x = 3; x < FLOW_GRID - 3; x++) {
    const id = gridId(x, z)
    if (id === seaCell || grid.highlands[id]! > .82) continue
    const depression = localDepression(grid, id)
    const spill = Math.max(0, grid.filled[id]! - grid.height[id]!)
    const altitude = grid.height[id]!
    // A broad local low is more important than random placement. The small
    // province term still mixes lowland, foothill, and occasional alpine lakes.
    const score = depression * 3.2 + spill * 1.8 + grid.moisture[id]! * 52 +
      Math.min(65, altitude * .025) + hash2(cx * 113 + x * 31, cz * 127 + z * 47) * 28
    candidates.push({ id, score })
  }
  candidates.sort((a, b) => b.score - a.score)
  const selected: number[] = []
  for (const candidate of candidates) {
    const x = candidate.id % FLOW_GRID, z = Math.floor(candidate.id / FLOW_GRID)
    const separated = selected.every(other => {
      const ox = other % FLOW_GRID, oz = Math.floor(other / FLOW_GRID)
      return Math.hypot(x - ox, z - oz) > 3.4
    })
    if (!separated) continue
    selected.push(candidate.id)
    if (selected.length >= requested) break
  }
  // A catchment always keeps at least one inland landmark, even in unusually
  // flat or dry provinces where no cell has a strong numerical depression.
  if (selected.length === 0 && candidates[0]) selected.push(candidates[0].id)
  return selected
}

function makeSea(ox: number, oz: number, cell: number, cx: number, cz: number, phase: number): Basin {
  const jitter = FLOW_STEP * .18
  return {
    x: gridX(ox, cell) + (hash2(cx + 113, cz - 29) - .5) * jitter,
    z: gridZ(oz, cell) + (hash2(cx - 47, cz + 89) - .5) * jitter,
    radius: 3300 + hash2(cx - 23, cz + 61) * 1900,
    aspect: .62 + hash2(cx + 31, cz - 41) * .3,
    angle: phase,
    phase,
    level: 0,
    sea: true,
  }
}

function makeLake(ox: number, oz: number, cell: number, index: number, cx: number, cz: number, grid: FlowGrid, phase: number): Basin {
  const jitter = FLOW_STEP * .24
  const x = gridX(ox, cell) + (hash2(cx + index * 17, cz - index * 31) - .5) * jitter
  const z = gridZ(oz, cell) + (hash2(cx - index * 29, cz + index * 13) - .5) * jitter
  const radius = 620 + hash2(cx + index * 21, cz - 82) * 1150
  const land = sampleLandforms(x, z)
  let rim = land.height
  for (let j = 0; j < 12; j++) {
    const angle = j * Math.PI / 6
    rim = Math.min(rim, sampleLandforms(x + Math.cos(angle) * radius * 1.6,
      z + Math.sin(angle) * radius * 1.6).height)
  }
  // The filled field identifies a real local bowl, but it can sit above the
  // raw terrain at a spill saddle. Clamp the water below the sampled rim so a
  // lake never turns that hidden routing value into an elevated landform.
  const level = Math.max(45, Math.min(rim - 12,
    Math.max(land.height - 12, Math.min(land.height + 95, grid.filled[cell]! - 9))))
  return {
    x,
    z,
    radius,
    aspect: .46 + hash2(cx - 82, cz + index * 21) * .46,
    angle: phase + index * 1.71 + (hash2(cx + index * 13, cz - 17) - .5) * .8,
    phase: phase + index * 1.71 + hash2(cx - index * 31, cz + 17) * 1.6,
    level,
    sea: false,
  }
}

function insideBasin(basins: readonly Basin[], x: number, z: number): boolean {
  return basins.some(basin => basinDistance(basin, x, z) < 0)
}

/** Turn a coarse drainage edge into two gently meandering, terrain-carving reaches. */
function emitDrainageEdge(
  addReach: (reach: Reach) => void,
  basins: readonly Basin[],
  ox: number,
  oz: number,
  edge: FlowEdge,
  levels: Float64Array,
  flow: Float64Array,
  salt: number,
  canAdd: () => boolean,
): void {
  const ax = gridX(ox, edge.from), az = gridZ(oz, edge.from)
  const bx = gridX(ox, edge.to), bz = gridZ(oz, edge.to)
  const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz)
  if (length < 1) return
  const bend = (hash2(edge.from * 53 + salt * 17, edge.to * 71 - salt * 31) - .5) * Math.min(260, length * .22)
  const mx = (ax + bx) / 2 - dz / length * bend
  const mz = (az + bz) / 2 + dx / length * bend
  const width = (value: number) => Math.max(14, Math.min(230, 8 + Math.pow(value, .58) * 12))
  const wa = width(edge.flow)
  const wb = width(Math.max(edge.flow, flow[edge.to]!))
  const ya = levels[edge.from]!
  const yb = Math.min(ya - .25, levels[edge.to]!)
  const point = (t: number) => {
    const inv = 1 - t
    return {
      x: inv * inv * ax + 2 * inv * t * mx + t * t * bx,
      z: inv * inv * az + 2 * inv * t * mz + t * t * bz,
    }
  }
  let a = point(0)
  for (let step = 1; step <= 2; step++) {
    if (!canAdd()) return
    const t = step / 2, b = point(t)
    const midX = (a.x + b.x) / 2, midZ = (a.z + b.z) / 2
    // Rivers stop at a shore instead of cutting through a lake or sea and
    // fighting its fixed water level in the query-time resolver.
    if (!insideBasin(basins, midX, midZ)) {
      const ta = (step - 1) / 2
      addReach({
        ax: a.x, az: a.z, bx: b.x, bz: b.z,
        wa: wa + (wb - wa) * ta, wb: wa + (wb - wa) * t,
        ya: ya + (yb - ya) * ta, yb: ya + (yb - ya) * t,
      })
    }
    a = b
  }
}

function catchment(cx: number, cz: number): Catchment {
  if (seed !== getWorldSeed()) { cache.clear(); seed = getWorldSeed() }
  const key = `${cx},${cz}`
  const previous = cache.get(key)
  if (previous) return previous

  const ox = cx * CATCHMENT_SIZE, oz = cz * CATCHMENT_SIZE
  const phase = hash2(cx + 79, cz - 41) * Math.PI * 2
  const grid = makeFlowGrid(ox, oz)
  const seaCell = chooseSeaCell(grid, cx, cz)
  routeFlow(grid, seaCell)

  const basins: Basin[] = []
  if (seaCell !== null) basins.push(makeSea(ox, oz, seaCell, cx, cz, phase))
  const lakeCells = chooseLakeCells(grid, seaCell, cx, cz)
  for (let i = 0; i < lakeCells.length; i++) {
    const lake = makeLake(ox, oz, lakeCells[i]!, i, cx, cz, grid, phase)
    // Avoid a rare overlap between an organically shaped lake and sea.
    if (!basins.some(basin => Math.hypot(lake.x - basin.x, lake.z - basin.z) < lake.radius + basin.radius * .7)) {
      basins.push(lake)
    }
  }

  const bins: Reach[][] = Array.from({ length: BINS * BINS }, () => [])
  let renderedReaches = 0
  function addReach(r: Reach): void {
    if (renderedReaches >= MAX_RENDER_REACHES) return
    renderedReaches++
    const margin = 1250 + Math.max(r.wa, r.wb)
    const minX = Math.max(0, Math.floor((Math.min(r.ax, r.bx) - margin - ox) / BIN))
    const maxX = Math.min(BINS - 1, Math.floor((Math.max(r.ax, r.bx) + margin - ox) / BIN))
    const minZ = Math.max(0, Math.floor((Math.min(r.az, r.bz) - margin - oz) / BIN))
    const maxZ = Math.min(BINS - 1, Math.floor((Math.max(r.az, r.bz) + margin - oz) / BIN))
    for (let ix = minX; ix <= maxX; ix++) for (let iz = minZ; iz <= maxZ; iz++) bins[iz * BINS + ix]!.push(r)
  }

  const levels = new Float64Array(grid.height.length)
  const drainageOrder = Array.from({ length: levels.length }, (_, id) => id)
  drainageOrder.sort((a, b) => grid.filled[b]! - grid.filled[a]!)
  for (let id = 0; id < levels.length; id++) {
    // `filled` is a routing aid, not a water surface. Limiting levels to the
    // sampled ground keeps drainage channels carving down into valleys instead
    // of ever lifting terrain across a hidden saddle.
    levels[id] = Math.min(grid.height[id]! - 6, grid.filled[id]! - Math.min(26, 8 + Math.sqrt(grid.flow[id]!) * 1.25))
  }
  for (const id of drainageOrder) {
    const parent = grid.parent[id]!
    if (parent >= 0) levels[parent] = Math.min(levels[parent]!, levels[id]! - .25)
  }
  if (seaCell !== null) levels[seaCell] = 0

  const edges: FlowEdge[] = []
  for (let id = 0; id < grid.parent.length; id++) {
    const parent = grid.parent[id]!
    if (parent < 0 || !insideGrid(id, 1) || !insideGrid(parent, 1)) continue
    if (grid.flow[id]! < 2.8) continue
    const midX = (gridX(ox, id) + gridX(ox, parent)) / 2
    const midZ = (gridZ(oz, id) + gridZ(oz, parent)) / 2
    if (insideBasin(basins, midX, midZ)) continue
    edges.push({ from: id, to: parent, flow: grid.flow[id]! })
  }
  // Flow is monotonic downstream, so retaining the strongest bounded set also
  // retains every trunk needed to keep those tributaries connected.
  edges.sort((a, b) => b.flow - a.flow)
  for (let i = 0; i < Math.min(MAX_CHANNEL_EDGES, edges.length); i++) {
    emitDrainageEdge(addReach, basins, ox, oz, edges[i]!, levels, grid.flow, i,
      () => renderedReaches < MAX_RENDER_REACHES)
  }

  const result = { basins, bins }
  if (cache.size >= 128) cache.delete(cache.keys().next().value!)
  cache.set(key, result)
  return result
}

/** Lakes/seas have fixed levels. River reaches grade continuously downstream. */
export function sampleHydrology(x: number, z: number, ground: number) {
  const cx = Math.floor(x / CATCHMENT_SIZE), cz = Math.floor(z / CATCHMENT_SIZE)
  const region = catchment(cx, cz)
  const localX = x - cx * CATCHMENT_SIZE, localZ = z - cz * CATCHMENT_SIZE
  const edgeFade = smoothstep(0, 1600, Math.min(localX, localZ, CATCHMENT_SIZE - localX, CATCHMENT_SIZE - localZ))
  let height = ground, waterLevel = 0, river = 0, lake = 0, coastal = 0
  // Tiny negative coordinates can round their local remainder up to 32000.
  const binX = Math.max(0, Math.min(BINS - 1, Math.floor(localX / BIN)))
  const binZ = Math.max(0, Math.min(BINS - 1, Math.floor(localZ / BIN)))
  const reaches = region.bins[binZ * BINS + binX]!
  let nearest = Infinity, level = 0, width = 1
  for (const r of reaches) {
    const dx = r.bx - r.ax, dz = r.bz - r.az
    const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)))
    const w = r.wa + (r.wb - r.wa) * t
    const d = Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) - w
    if (d < nearest) { nearest = d; level = r.ya + (r.yb - r.ya) * t; width = w }
  }
  const valleyRange = Math.max(650, Math.min(1250, width * 5 + 160))
  // On an inside bend, the closest reach can switch between different river
  // elevations. Blend the dry valley shoulders to avoid a step at that switch.
  if (nearest > 0 && nearest < valleyRange) {
    let sum = 0, total = 0
    for (const r of reaches) {
      const dx = r.bx - r.ax, dz = r.bz - r.az
      const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)))
      const d = Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) - r.wa - (r.wb - r.wa) * t
      const weight = Math.exp(-Math.max(0, d - nearest) / 160)
      sum += (r.ya + (r.yb - r.ya) * t) * weight
      total += weight
    }
    level += (sum / total - level) * smoothstep(0, 240, nearest)
  }
  if (nearest < valleyRange) {
    const d = nearest
    const blend = (1 - smoothstep(0, valleyRange, Math.max(0, d))) * edgeFade
    const bank = d < 0 ? -(5 + width * .04) * smoothstep(0, width, -d) : d * .075 + d * d * .00007
    height += (level + bank - height) * blend
    if (blend > 0) waterLevel = level
    river = 1 - smoothstep(0, Math.max(90, Math.min(300, width * 1.2)), Math.max(0, d))
  }
  for (const basin of region.basins) {
    const limit = basin.radius * 1.65 + 2000
    if (Math.abs(x - basin.x) > limit || Math.abs(z - basin.z) > limit) continue
    const d = basinDistance(basin, x, z)
    const margin = basin.sea ? 2100 : 1400
    if (d >= margin) continue
    const blend = (1 - smoothstep(0, margin, Math.max(0, d))) * edgeFade
    const bed = d < 0
      ? -(basin.sea ? 150 : 32) * smoothstep(0, basin.sea ? 2300 : 500, -d) + d * .012
      : d * .065 + d * d * .000035
    const basinHeight = height + (basin.level + bed - height) * blend
    // Preserve an existing outlet through the bank instead of damming it shut.
    height = d > 0 ? basinHeight + (Math.min(height, basinHeight) - basinHeight) * river : basinHeight
    if (d <= 0 || nearest >= valleyRange) waterLevel = basin.level
    if (basin.sea) coastal = 1 - smoothstep(0, 180, Math.abs(d))
    else lake = 1 - smoothstep(0, 160, Math.max(0, d))
  }
  return { height, waterLevel, river, lake, coastal }
}

/** Read-only landmarks for repeatable visual review and hydrology tests. */
export function waterLandmarks(cx: number, cz: number): ReadonlyArray<Readonly<Basin>> {
  return catchment(cx, cz).basins
}

export function riverReaches(cx: number, cz: number): ReadonlyArray<Readonly<Reach>> {
  return [...new Set(catchment(cx, cz).bins.flat())]
}
