import { getWorldSeed, hash2, smoothstep, valueNoise } from './noise'
import { sampleLandforms } from './Landforms'
import { coastField } from './Coastline'
import { basinDistance, type HydrologyBuildPhase, type RiverReach, type WaterBasin } from './Hydrology'

const STEP = 2000
const CELLS = 16
const HALO = 4
const REACH_STEPS = 16
interface Node {
  gx: number; gz: number; x: number; z: number; height: number; moisture: number; coast: number
  parent?: readonly [number, number] | null; runoff: Float64Array; basin?: WaterBasin | null; reaches?: RiverReach[]
  channel?: boolean; wetOutlet?: boolean; lake?: LakeCandidate | null; discharge?: number
  longRoute?: boolean; primary?: boolean; dominant?: readonly [number, number] | null
}
interface LakeCandidate { radius: number; roll: number; pond: boolean; large: boolean; riverSink: boolean }
let seed = NaN
const nodes = new Map<string, Node>()
function node(gx: number, gz: number): Node {
  if (seed !== getWorldSeed()) { nodes.clear(); seed = getWorldSeed() }
  const key = `${gx},${gz}`
  let n = nodes.get(key)
  if (n) return n
  const x = gx * STEP + (hash2(gx + 117, gz - 61) - .5) * 380
  const z = gz * STEP + (hash2(gx - 73, gz + 217) - .5) * 380
  const land = sampleLandforms(x, z)
  n = { gx, gz, x, z, height: land.height, moisture: land.moisture, coast: land.coast!, runoff: new Float64Array(6).fill(-1) }
  if (nodes.size >= 16384) nodes.delete(nodes.keys().next().value!)
  nodes.set(key, n)
  return n
}
function parent(n: Node): Node | null {
  if (n.parent !== undefined) return n.parent ? node(n.parent[0], n.parent[1]) : null
  let best: Node | null = null
  let slope = 0
  if (n.height > 0) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue
    const next = node(n.gx + dx, n.gz + dz)
    const gradient = (n.height - next.height) / Math.hypot(n.x - next.x, n.z - next.z)
    if (gradient > slope + .00001) { best = next; slope = gradient }
  }
  // Cache coordinates, not object chains: FIFO eviction must release nodes.
  n.parent = best ? [best.gx, best.gz] : null
  return best
}
/** Bounded upstream accumulation; world-node identity, never tile build order. */
function runoff(n: Node, depth = 5): number {
  if (n.runoff[depth]! >= 0) return n.runoff[depth]!
  let flow = .18 + n.moisture * .82
  if (depth > 0) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue
    const upstream = node(n.gx + dx, n.gz + dz)
    const p = parent(upstream)
    if (p?.gx === n.gx && p.gz === n.gz) flow += runoff(upstream, depth - 1)
  }
  n.runoff[depth] = flow
  return flow
}

function channelThreshold(n: Node): number { return n.moisture > .59 ? 7.5 : 8.5 }

function dominantUpstream(n: Node): Node | null {
  if (n.dominant !== undefined) return n.dominant ? node(n.dominant[0], n.dominant[1]) : null
  let best: Node | null = null, amount = 0
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue
    const candidate = node(n.gx + dx, n.gz + dz), target = parent(candidate)
    if (target?.gx !== n.gx || target.gz !== n.gz) continue
    const flow = runoff(candidate)
    if (flow > amount) { best = candidate; amount = flow }
  }
  n.dominant = best ? [best.gx, best.gz] : null
  return best
}

/** Select whole watersheds, not individual spans. Short terminal wedges are
 * not rivers: retain systems with a substantial descending main stem, then
 * expose that stem up to its narrow source instead of inflating a single
 * two-kilometre reach into a receiving pond. */
function hasLongRoute(n: Node): boolean {
  if (n.longRoute !== undefined) return n.longRoute
  const path: Node[] = []
  let current = n
  for (let i = 0; i < 256 && current.longRoute === undefined; i++) {
    path.push(current)
    const next = parent(current)
    if (!next) {
      let length = 0, source: Node | null = current
      for (let j = 0; source && j < 128 && length < 8000; j++) {
        const upstream = dominantUpstream(source)
        if (!upstream || runoff(upstream) < 1.6) break
        length += Math.hypot(source.x - upstream.x, source.z - upstream.z)
        source = upstream
      }
      current.longRoute = length >= 8000 && runoff(current) >= channelThreshold(current) &&
        hash2(current.gx + 519, current.gz - 823) < .65
      break
    }
    current = next
  }
  const valid = current.longRoute ?? false
  for (const q of path) q.longRoute = valid
  return valid
}

function isPrimary(n: Node): boolean {
  if (n.primary !== undefined) return n.primary
  const p = parent(n)
  if (!p) return (n.primary = true)
  const upstream = dominantUpstream(p)
  return (n.primary = upstream?.gx === n.gx && upstream.gz === n.gz && isPrimary(p))
}

/** Once runoff forms a river, keep it downstream even beyond the bounded
 * runoff window. Strictly descending parent heights make this an acyclic DAG. */
function carriesRiver(n: Node): boolean {
  if (n.channel !== undefined) return n.channel
  if (n.height <= 0) return (n.channel = false)
  if (!hasLongRoute(n)) return (n.channel = false)
  if (isPrimary(n) && runoff(n) >= 1.6) return (n.channel = true)
  if (runoff(n) >= channelThreshold(n)) return (n.channel = true)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue
    const upstream = node(n.gx + dx, n.gz + dz), target = parent(upstream)
    if (target?.gx === n.gx && target.gz === n.gz && carriesRiver(upstream)) return (n.channel = true)
  }
  return (n.channel = false)
}

/** Preserve established tributary flow beyond the local rainfall window.
 * Parent heights strictly descend; coordinates and cached scalars stay bounded
 * by the existing node cache rather than retaining upstream object trees. */
function discharge(n: Node): number {
  if (n.discharge !== undefined) return n.discharge
  let incoming = .18 + n.moisture * .82
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue
    const upstream = node(n.gx + dx, n.gz + dz), target = parent(upstream)
    if (target?.gx === n.gx && target.gz === n.gz && carriesRiver(upstream)) incoming += discharge(upstream)
  }
  return (n.discharge = Math.max(runoff(n), incoming))
}

/** A dry closed depression is not a valid river destination. Prune its whole
 * upstream network instead of drawing a channel that ends on bare ground. */
function drainsToWater(n: Node): boolean {
  const path: Node[] = []
  let current: Node | null = n
  while (current && current.wetOutlet === undefined && path.length < 256) {
    if (current.height <= 0 || basin(current)) { current.wetOutlet = true; break }
    path.push(current)
    current = parent(current)
  }
  const valid = current?.wetOutlet ?? false
  for (const q of path) q.wetOutlet = valid
  return valid
}

function lakeCandidate(n: Node): LakeCandidate | null {
  if (n.lake !== undefined) return n.lake
  n.lake = null
  if (n.height <= 0) return null
  const p = parent(n)
  const wet = n.moisture > .59 && n.height < 800
  const roll = hash2(n.gx + 371, n.gz - 719)
  const riverSink = !p && carriesRiver(n)
  // Every river-fed inland depression receives a compact terminal lake.
  // Optional lakes can be rare; a river's receiving surface cannot disappear.
  if (riverSink) return (n.lake = { radius: Math.min(1100, 350 + Math.sqrt(runoff(n)) * 120),
    roll, pond: wet, large: false, riverSink: true })
  if (n.height < 35 || n.coast < .045 || hash2(n.gx - 947, n.gz + 613) >= .125) return null
  // Closed depressions plus occasional low-gradient through-lakes. Wetlands
  // have a much denser pond distribution than dry or alpine watersheds.
  if (p && !(wet && roll > .58 && (n.height - p.height) < 50)) return null
  if (!p && roll < .3) return null
  const large = !p && roll > .82
  const pond = wet && roll < .8
  const radius = pond ? 330 + roll * 900 : large ? 2400 + roll * 1900 : 550 + roll * 1100
  return (n.lake = { radius, roll, pond, large, riverSink: false })
}

function basin(n: Node): WaterBasin | null {
  if (n.basin !== undefined) return n.basin
  n.basin = null
  const candidate = lakeCandidate(n)
  if (!candidate) return null
  const { radius, roll, pond, large, riverSink } = candidate
  const p = parent(n)
  // Resolve overlapping candidates by a world-stable owner, not by region
  // build order. Wetland ponds remain dense; large lakes reserve their basin.
  for (let dz = -4; !riverSink && dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    if (!dx && !dz) continue
    const other = node(n.gx + dx, n.gz + dz)
    const otherCandidate = lakeCandidate(other)
    if (!otherCandidate) continue
    const otherRadius = otherCandidate.radius
    const higherPriority = otherCandidate.riverSink || otherRadius > radius || (otherRadius === radius &&
      (other.gx < n.gx || (other.gx === n.gx && other.gz < n.gz)))
    if (higherPriority && Math.hypot(n.x - other.x, n.z - other.z) < (radius + otherRadius) * 1.5) return null
  }
  const level = Math.max(.01, n.height - 8)
  const radii = new Float32Array(64)
  // Follow the surrounding valley instead of putting a nearly circular pit
  // at every receiving node. Preserve approximately the same area while
  // opening longer arms along the lowest opposing terrain shoulders.
  let valleyAngle = 0, lowestShoulders = Infinity
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius
    const shoulders = sampleLandforms(n.x + x, n.z + z).height + sampleLandforms(n.x - x, n.z - z).height
    if (shoulders < lowestShoulders) { lowestShoulders = shoulders; valleyAngle = a }
  }
  const elongation = 1.25 + roll * .3
  for (let i = 0; i < radii.length; i++) {
    const a = i / radii.length * Math.PI * 2
    const along = Math.cos(a - valleyAngle), across = Math.sin(a - valleyAngle)
    const valleyShape = 1 / Math.hypot(along / elongation, across * elongation)
    // Read the surrounding relief: shoulders shorten the shore, valleys open
    // long arms. The same cached contour drives carving and water geometry.
    const probe = sampleLandforms(n.x + Math.cos(a) * radius, n.z + Math.sin(a) * radius)
    const relief = smoothstep(-120, 360, probe.height - level)
    // Coherent angular features, not one random radius per spoke. Independent
    // spokes made lakes look like pointed flowers rather than eroded basins.
    const inletAngle = valleyAngle + .75 + roll * 2.4
    const inlet = Math.exp((Math.cos(a - inletAngle) - 1) * 9) * .58 +
      Math.exp((Math.cos(a - inletAngle - 2.3) - 1) * 13) * .38
    const lobe = 1.02 + Math.sin(a - roll * 11) * .18 + Math.sin(a * 2 + roll * 9) * .2 +
      Math.sin(a * 3 - roll * 5) * .18 - inlet +
      (valueNoise(Math.cos(a) * 1.7 + n.gx, Math.sin(a) * 1.7 + n.gz) - .5) * .24
    radii[i] = Math.max(radius * .24, Math.min(radius * 1.7,
      radius * valleyShape * lobe * (1.22 - relief * .7)))
  }
  const smoothRadii = radii.slice()
  for (let pass = 0; pass < 4; pass++) {
    smoothRadii.set(radii)
    for (let i = 0; i < radii.length; i++) radii[i] =
      smoothRadii[(i + radii.length - 1) % radii.length]! * .25 + smoothRadii[i]! * .5 +
      smoothRadii[(i + 1) % radii.length]! * .25
  }
  const contour: WaterBasin = { x: n.x, z: n.z, radius, aspect: 1, angle: 0, phase: roll * 6.28,
    level, sea: false, pond, shoreRadii: radii, boundsRadius: radius * 1.75,
    islands: large && roll > .9 ? [{ x: n.x + radius * .28, z: n.z - radius * .13, radius: radius * .12 }] : undefined,
    id: `lake:${n.gx}:${n.gz}`, outletId: p ? `${p.gx}:${p.gz}` : undefined }
  // A wider shoreline may encompass a lower drainage node. Its surface must
  // not sit above that node's channel, otherwise incoming rivers climb at the
  // shore. Include the adjoining bank margin when resolving this spill cap.
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const q = node(n.gx + dx, n.gz + dz)
    if (basinDistance(contour, q.x, q.z) < 300) contour.level =
      Math.max(.01, Math.min(contour.level, q.height - 8))
  }
  n.basin = contour
  return n.basin
}

function reaches(n: Node): RiverReach[] {
  if (n.reaches) return n.reaches
  const result: RiverReach[] = []
  n.reaches = result
  const p = parent(n)
  // Retain only connected routes to actual water, never random deleted spans.
  if (!p || !carriesRiver(n) || !drainsToWater(p)) return result
  const flow = discharge(n)
  const receiving = basin(p)
  const sourceBasin = basin(n)
  const nearby: WaterBasin[] = []
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const lake = basin(node(n.gx + dx, n.gz + dz))
    if (lake) nearby.push(lake)
  }
  const width = (q: Node, amount: number): number => {
    const downstream = parent(q)
    const gradient = downstream ? (q.height - downstream.height) /
      Math.hypot(q.x - downstream.x, q.z - downstream.z) : 0
    // Confined upland channels stay narrow. Low-gradient floodplains can
    // spread to four times the old width, coherently over kilometres rather
    // than changing randomly at every span. Runoff still sets their scale.
    const floodplain = (1 - smoothstep(.004, .045, gradient)) *
      (1 - smoothstep(600, 1800, q.height))
    const valley = smoothstep(.25, .7, valueNoise(q.x / 12000 + 41, q.z / 12000 - 73))
    return Math.max(8, Math.min(220, 5 + Math.pow(amount, .62) * 11)) * (1 + 3 * floodplain * valley)
  }
  // Interior junctions use the same node width on every incident edge.
  // A receiving water body has no downstream ribbon to match.
  const wb = width(p, Math.max(flow, discharge(p)))
  const length = Math.hypot(p.x - n.x, p.z - n.z)
  const dx = p.x - n.x, dz = p.z - n.z
  const bend = (hash2(n.gx + 811, n.gz - 337) - .5) * Math.min(760, length * .6)
  const wetLevel = (x: number, z: number): number | undefined => {
    if (coastField(x, z) < 0) return 0
    for (const lake of nearby) if (basinDistance(lake, x, z) < 0) return lake.level
    return undefined
  }
  const ya = Math.max(.01, wetLevel(n.x, n.z) ?? sourceBasin?.level ?? n.height - 8)
  const yb = Math.max(0, Math.min(ya, wetLevel(p.x, p.z) ?? receiving?.level ?? p.height - 8))
  const delta = p.height < 0 && flow > 12 && hash2(n.gx + 293, n.gz - 467) > .92
  let upstream: Node | null = null, upstreamFlow = 0, upstreamIsChannel = false
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue
    const candidate = node(n.gx + dx, n.gz + dz), target = parent(candidate)
    if (target?.gx !== n.gx || target.gz !== n.gz) continue
    const channel = carriesRiver(candidate)
    const amount = channel ? discharge(candidate) : runoff(candidate)
    if ((channel && !upstreamIsChannel) || (channel === upstreamIsChannel && amount > upstreamFlow)) {
      upstream = candidate; upstreamFlow = amount; upstreamIsChannel = channel
    }
  }
  const headwater = !upstreamIsChannel
  const wa = headwater && !sourceBasin ? 10 : width(n, flow)
  const next = parent(p)
  const tx0 = upstream ? (p.x - upstream.x) * .5 : dx
  const tz0 = upstream ? (p.z - upstream.z) * .5 : dz
  const tx1 = next ? (next.x - n.x) * .5 : dx
  const tz1 = next ? (next.z - n.z) * .5 : dz
  const point = (t: number, branch = 0, detour = 0) => {
    const t2 = t * t, t3 = t2 * t
    const h0 = 2 * t3 - 3 * t2 + 1, h1 = t3 - 2 * t2 + t
    const h2 = -2 * t3 + 3 * t2, h3 = t3 - t2
    const bow = Math.sin(t * Math.PI) ** 2 *
      (bend * Math.sin(t * Math.PI * 2) + detour + branch * Math.min(200, wb * 2.5)) +
      (delta ? branch * wb * 3.5 * t * t : 0)
    return { x: h0 * n.x + h1 * tx0 + h2 * p.x + h3 * tx1 - dz / length * bow,
      z: h0 * n.z + h1 * tz0 + h2 * p.z + h3 * tz1 + dx / length * bow }
  }
  const tangent = (t: number, branch: number, detour: number) => {
    const a = point(t - .0001, branch, detour), b = point(t + .0001, branch, detour)
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    return { x: (b.x - a.x) / length, z: (b.z - a.z) / length }
  }
  // Braid only broad, low-gradient rivers. Both arms share split/rejoin nodes.
  const braided = wb > 75 && (ya - yb) / length < .008 && hash2(n.gx - 83, n.gz + 127) > .985
  for (const branch of delta ? [-1, 0, 1] : braided ? [-1, 1] : [0]) {
    let detour = 0
    let points = Array.from({ length: REACH_STEPS + 1 }, (_, i) => point(i / REACH_STEPS, branch, detour))
    let wet = points.map(q => wetLevel(q.x, q.z))
    const downhill = (): boolean => {
      let previous = ya
      for (const level of wet) if (level !== undefined) {
        if (level > previous + .00001) return false
        previous = level
      }
      return yb <= previous + .00001
    }
    // An incidental lake beside the drainage edge must not pull a meander
    // uphill. Try a bounded set of alternative bows with identical endpoint
    // tangents before accepting a route through its receiving water.
    if (!downhill()) for (const alternative of [length * .25, -length * .25,
      length * .5, -length * .5, length, -length]) {
      detour = alternative
      points = Array.from({ length: REACH_STEPS + 1 }, (_, i) => point(i / REACH_STEPS, branch, detour))
      wet = points.map(q => wetLevel(q.x, q.z))
      if (downhill()) break
    }
    // A delta arm must actually enter water, not fan back onto a headland.
    if (delta && wet[REACH_STEPS] === undefined) continue
    // Grade dry spans between lake/sea anchors. This includes lakes owned by
    // neighbouring nodes, not only the two endpoints of a drainage edge.
    const grade = (t: number): number => {
      let before = 0, after = REACH_STEPS, low = ya, high = yb
      for (let j = 0; j <= REACH_STEPS; j++) if (wet[j] !== undefined) {
        if (j / REACH_STEPS <= t) { before = j; low = wet[j]! }
        else { after = j; high = wet[j]!; break }
      }
      return low + (high - low) * Math.max(0, Math.min(1, (t * REACH_STEPS - before) / Math.max(1, after - before)))
    }
    let a = point(0, branch, detour)
    for (let i = 1; i <= REACH_STEPS; i++) {
      const t0 = (i - 1) / REACH_STEPS, t1 = i / REACH_STEPS
      const b = point(t1, branch, detour)
      const wetA = wet[i - 1], wetB = wet[i]
      if (wetA !== undefined && wetB !== undefined) { a = b; continue }
      let startT = t0, endT = t1, start = a, end = b
      if ((wetA !== undefined) !== (wetB !== undefined)) {
        let lo = t0, hi = t1
        for (let pass = 0; pass < 12; pass++) {
          const mid = (lo + hi) * .5, q = point(mid, branch, detour)
          if ((wetLevel(q.x, q.z) !== undefined) === (wetA !== undefined)) lo = mid
          else hi = mid
        }
        const shoreT = (lo + hi) * .5
        if (wetA !== undefined) { startT = shoreT; start = point(shoreT, branch, detour) }
        else { endT = shoreT; end = point(shoreT, branch, detour) }
      }
      const rx = end.x - start.x, rz = end.z - start.z
      const factor = delta ? .52 : braided ? .68 : 1
      const startLevel = wetA ?? grade(startT)
      const endLevel = Math.min(startLevel, wetB ?? grade(endT))
      const endWidth = (wa + (wb - wa) * smoothstep(0, 1, endT)) * factor
      const startTangent = tangent(startT, branch, detour), endTangent = tangent(endT, branch, detour)
      result.push({ ax: start.x, az: start.z, bx: end.x, bz: end.z,
        wa: (wa + (wb - wa) * smoothstep(0, 1, startT)) * factor, wb: endWidth,
        ya: startLevel, yb: endLevel,
        dx: rx, dz: rz, length: Math.hypot(rx, rz), lengthSq: rx * rx + rz * rz,
        source: headwater && i === 1 && !sourceBasin, terminal: wetB !== undefined,
        mouth: wetB !== undefined, mouthX: wetB !== undefined ? end.x : undefined,
        mouthZ: wetB !== undefined ? end.z : undefined, mouthWidth: wetB !== undefined ? endWidth : undefined,
        id: `${n.gx}:${n.gz}:${branch}:${i}`, fromId: `${n.gx}:${n.gz}`, toId: `${p.gx}:${p.gz}`,
        discharge: flow, branch: braided || delta,
        tangentAX: startTangent.x, tangentAZ: startTangent.z,
        tangentBX: endTangent.x, tangentBZ: endTangent.z,
      })
      a = b
    }
  }
  return result
}

export function* regionalDrainageSteps(cx: number, cz: number): Generator<HydrologyBuildPhase, {
  basins: WaterBasin[]; landmarks: WaterBasin[]; reaches: RiverReach[]; queryReaches: RiverReach[]
}, void> {
  const basins: WaterBasin[] = [], landmarks: WaterBasin[] = [], owned: RiverReach[] = [], queryReaches: RiverReach[] = []
  const local: Node[] = []
  for (let iz = -HALO; iz < CELLS + HALO; iz++) for (let ix = -HALO; ix < CELLS + HALO; ix++) {
    local.push(node(cx * CELLS + ix, cz * CELLS + iz))
    if (local.length % 8 === 0) yield 'samples'
  }
  for (let i = 0; i < local.length; i++) {
    parent(local[i]!)
    if (i % 8 === 7) yield 'routing'
  }
  for (let i = 0; i < local.length; i++) {
    basin(local[i]!)
    if (i % 4 === 3) yield 'basins'
  }
  yield 'grade'
  let index = 0
  for (let iz = -HALO; iz < CELLS + HALO; iz++) for (let ix = -HALO; ix < CELLS + HALO; ix++) {
    const n = local[index++]!
    const ownedNode = ix >= 0 && iz >= 0 && ix < CELLS && iz < CELLS
    const b = basin(n)
    if (b) { basins.push(b); if (ownedNode) landmarks.push(b) }
    const r = reaches(n)
    queryReaches.push(...r)
    if (ownedNode) owned.push(...r)
    if ((ix + HALO) % 4 === 3) yield 'channels'
  }
  // Sea landmarks are navigation/review anchors only. Their shape comes from
  // the continuous global coastline, never from an analytic circular fan.
  for (let z = 1; z < CELLS; z += 3) for (let x = 1; x < CELLS; x += 3) {
    const n = node(cx * CELLS + x, cz * CELLS + z)
    if (n.height < -20) {
      landmarks.push({ x: n.x, z: n.z, radius: 3500, aspect: 1, angle: 0, phase: 0,
        boundsRadius: 6125, level: 0, sea: true, pond: false, regionalSea: true })
      z = CELLS; break
    }
  }
  return { basins, landmarks, reaches: owned, queryReaches }
}
