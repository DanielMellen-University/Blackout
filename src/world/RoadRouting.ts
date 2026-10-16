import type { SettlementRoad } from './SettlementPlan'

type Position = { x: number; z: number }
type Ground = { height: number; waterLevel?: number; landform?: { ridge?: number; alpineValley?: number } }
export type RouteSampler = (x: number, z: number) => Ground

export const MAX_REGIONAL_ROUTE_STATIONS = 64
export const REGIONAL_ROUTE_LANES = 11
export const MAX_REGIONAL_ROUTE_PROBES = 3000
export const MAX_REGIONAL_ROAD_GRADE = .24
export const MAX_ROUTE_REFINEMENT_PROBES = 5000
export const MAX_ROUTE_REFINEMENT_PATCHES = 4

/** Worker-side, monotone corridor search. Fixed station/lane/probe bounds keep
 * it independent of terrain render distance. Store sampled values immediately:
 * the caller may reuse one mutable climate record for every probe. */
export function terrainRoadRoute(a: Position, b: Position, sample: RouteSampler, guideBend = 0, fine = false): Position[] | null {
  const dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz)
  if (!Number.isFinite(distance) || distance < 500 || !Number.isFinite(guideBend)) return null
  const nx = -dz / distance, nz = dx / distance
  const stations = Math.min(MAX_REGIONAL_ROUTE_STATIONS, Math.max(12, Math.ceil(distance / (fine ? 120 : 700))))
  const lanes = REGIONAL_ROUTE_LANES, center = (lanes - 1) / 2, size = (stations + 1) * lanes
  const x = new Float64Array(size), z = new Float64Array(size), height = new Float64Array(size)
  const penalties = new Float64Array(size), cost = new Float64Array(size).fill(Infinity)
  const previous = new Int16Array(size).fill(-1)
  const span = Math.min(fine ? 600 : 6500, distance * (fine ? .35 : .16)), baseline = sample(a.x, a.z).height
  let probes = 1
  const penalty = (ground: Ground): number => {
    const wet = ground.height <= (ground.waterLevel ?? 0) + 1
    const ridge = ground.landform?.ridge ?? 0, valley = ground.landform?.alpineValley ?? 0
    return (wet ? 9 : 0) + Math.max(0, ridge * 1.6 - valley * .5)
      + Math.max(0, ground.height - baseline - 500) / 1200
  }
  const surface = (ground: Ground): number => ground.height <= (ground.waterLevel ?? 0) + 1
    ? (ground.waterLevel ?? 0) + 7 : ground.height
  for (let station = 0; station <= stations; station++) {
    const t = station / stations, taper = Math.sin(Math.PI * t)
    for (let lane = 0; lane < lanes; lane++) {
      if ((station === 0 || station === stations) && lane !== center) continue
      const index = station * lanes + lane
      const lateral = taper * (guideBend + (lane - center) / center * span)
      x[index] = station === stations ? b.x : a.x + dx * t + nx * lateral
      z[index] = station === stations ? b.z : a.z + dz * t + nz * lateral
      if (++probes > MAX_REGIONAL_ROUTE_PROBES) return null
      const ground = sample(x[index]!, z[index]!)
      height[index] = surface(ground); penalties[index] = penalty(ground)
      if (!Number.isFinite(height[index]) || !Number.isFinite(penalties[index])) return null
    }
  }
  cost[center] = 0
  for (let station = 1; station <= stations; station++) for (let lane = 0; lane < lanes; lane++) {
    if (station === stations && lane !== center) continue
    const index = station * lanes + lane
    const lo = station === stations || station === 1 ? 0 : Math.max(0, lane - 1)
    const hi = station === stations || station === 1 ? lanes - 1 : Math.min(lanes - 1, lane + 1)
    for (let parentLane = lo; parentLane <= hi; parentLane++) {
      const parent = (station - 1) * lanes + parentLane
      if (!Number.isFinite(cost[parent])) continue
      const ex = x[index]! - x[parent]!, ez = z[index]! - z[parent]!, length = Math.hypot(ex, ez)
      if (++probes > MAX_REGIONAL_ROUTE_PROBES) return null
      const middle = sample((x[index]! + x[parent]!) / 2, (z[index]! + z[parent]!) / 2)
      const middleHeight = surface(middle), middlePenalty = penalty(middle)
      if (!Number.isFinite(middleHeight) || !Number.isFinite(middlePenalty)) continue
      const grade = 2 * Math.max(Math.abs(middleHeight - height[parent]!), Math.abs(height[index]! - middleHeight)) / length
      let turn = 0
      const grandparent = previous[parent]!
      if (grandparent >= 0) {
        const px = x[parent]! - x[grandparent]!, pz = z[parent]! - z[grandparent]!
        turn = Math.max(0, 1 - (px * ex + pz * ez) / (Math.hypot(px, pz) * length)) * distance / stations * 2
      }
      const edge = length * (1 + Math.max(0, grade - .065) ** 2 * 800
        + (penalties[parent]! + penalties[index]! + middlePenalty * 2) / 4) + turn
      const total = cost[parent]! + edge
      if (total < cost[index]!) { cost[index] = total; previous[index] = parent }
    }
  }
  let index = stations * lanes + center
  if (!Number.isFinite(cost[index])) return null
  const route: Position[] = []
  while (index >= 0) { route.push({ x: x[index]!, z: z[index]! }); index = previous[index]! }
  route.reverse()
  return route
}

export function roadGradeValid(road: SettlementRoad): boolean {
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1]!, b = road.points[i]!
    if (Math.abs(b.y - a.y) > Math.hypot(b.x - a.x, b.z - a.z) * MAX_REGIONAL_ROAD_GRADE) return false
  }
  return true
}

/** Coarse routes can miss a small ridge or eroded river bank. Refine only
 * clustered bad sections found by the complete surface profile, not the whole
 * regional corridor. At most four local searches and 5,000 further probes. */
export function refineRoadRoute(road: SettlementRoad, sample: RouteSampler): Position[] | null {
  const points = road.points
  const bad = (i: number): boolean => {
    const a = points[i - 1]!, b = points[i]!
    return Math.abs(b.y - a.y) > Math.hypot(b.x - a.x, b.z - a.z) * MAX_REGIONAL_ROAD_GRADE
  }
  let probes = 0, patches = 0, copied = 0
  const invalid = { height: Number.NaN }
  const boundedSample: RouteSampler = (x, z) => probes >= MAX_ROUTE_REFINEMENT_PROBES
    ? invalid : (probes++, sample(x, z))
  const route: Position[] = []
  for (let i = 1; i < points.length; i++) {
    if (!bad(i)) continue
    if (++patches > MAX_ROUTE_REFINEMENT_PATCHES) return null
    const start = Math.max(copied, i - 20)
    let lastBad = i
    for (let j = i + 1; j < points.length && j < i + 80; j++) {
      if (j - lastBad > 16) break
      if (bad(j)) lastBad = j
    }
    const end = Math.min(points.length - 1, lastBad + 20)
    const local = terrainRoadRoute(points[start]!, points[end]!, boundedSample, 0, true)
    if (!local) return null
    for (; copied < start; copied++) route.push(points[copied]!)
    route.push(...roundRoadRoute(local)); copied = end + 1; i = end
  }
  if (!patches) return null
  for (; copied < points.length; copied++) route.push(points[copied]!)
  return route
}

/** Round local direction changes while preserving both exact street joins.
 * Complete 24 m profiles still validate the result; never trust coarse probes
 * as proof that a rounded route can cross a cliff or lake. */
export function roundRoadRoute(points: readonly Position[]): Position[] {
  let route = [...points]
  for (let pass = 0; pass < 2 && route.length > 2; pass++) {
    const next: Position[] = [route[0]!]
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1]!, b = route[i]!
      next.push({ x: a.x * .75 + b.x * .25, z: a.z * .75 + b.z * .25 },
        { x: a.x * .25 + b.x * .75, z: a.z * .25 + b.z * .75 })
    }
    next.push(route.at(-1)!); route = next
  }
  return route
}
