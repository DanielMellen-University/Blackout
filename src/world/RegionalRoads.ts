import { hash2 } from './noise'
import { sampleClimateInto } from './terrainSample'
import { createClimateSample } from './Geography'
import { settlementForCell, SETTLEMENT_CELL_SIZE, type SettlementPlan, type SettlementRoad } from './SettlementPlan'
import type { Biome } from './terrainSample'
import { groundRoad, engineerRoadGrades } from './RoadSurface'
import { coastalRoadRoute, terrainRoadRoute, roundRoadRoute, refineRoadRoute, roadGradeValid, MAX_REGIONAL_ROAD_GRADE } from './RoadRouting'
import { RoadClearance } from './RoadClearance'

export interface SettlementAnchor {
  id: string
  kind: 'city' | 'village'
  x: number; y: number; z: number; radius: number
  roads: SettlementRoad[]
}

export interface RegionalRoadLink {
  key: string
  from: RegionalRoadEndpoint
  to: RegionalRoadEndpoint
}

export interface RegionalRoadEndpoint extends SettlementAnchor { biome: Biome }

/**
 * Settlement cells are deliberately wide, so this stays a small fixed search
 * instead of growing with render distance or the number of loaded meshes.
 */
export const REGIONAL_GRAPH_CELL_RING = 2
export const MAX_CITY_REGIONAL_LINKS = 2
export const MAX_VILLAGE_REGIONAL_LINKS = 1
/** Includes failed attachment/profile candidates, not only successful links. */
export const MAX_REGIONAL_LINK_ATTEMPTS = 4
/** Only these ranked street points may trigger extra endpoint terrain probes. */
export const MAX_ROAD_ATTACHMENT_CANDIDATES = 8
export const MAX_ROAD_CLEARANCE_CELLS = 49
const ATTACHMENT_CROSS_SECTION = [0, -1, 1, -1.55, 1.55] as const

/** Candidate road probes are sequential; one climate record serves all bends. */
const roadClimateScratch = createClimateSample()

function idNumbers(id: string): [number, number] {
  const [x = 0, z = 0] = id.split(',').map(Number)
  return [x, z]
}

export function regionalRoadKey(a: SettlementAnchor, b: SettlementAnchor): string {
  return a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
}

/**
 * Pick a sparse, deterministic set of nearest neighbours for one settlement.
 * The caller may discover the same edge from either endpoint; the canonical
 * key and ordered plans make that harmless without relying on load order.
 */
export function selectRegionalRoadLinks(plan: SettlementPlan, candidates: readonly SettlementPlan[],
  accepts?: (link: RegionalRoadLink) => boolean): RegionalRoadLink[] {
  const limit = plan.kind === 'city' ? MAX_CITY_REGIONAL_LINKS : MAX_VILLAGE_REGIONAL_LINKS
  const links: RegionalRoadLink[] = []
  const seen = new Set<string>()
  let firstNeighbour: SettlementPlan | null = null
  // Pick one winner per bounded slot instead of materializing and sorting the
  // entire candidate list. After the first accepted city spoke, prefer a
  // direction at least 60 degrees away before hub/distance/ID ranking. A
  // rejected route never defines the direction, and the attempt cap is fixed.
  const attempts = accepts ? MAX_REGIONAL_LINK_ATTEMPTS : limit
  for (let slot = 0; slot < attempts && links.length < limit; slot++) {
    let best: SettlementPlan | null = null
    let bestDirection = Infinity, bestHub = Infinity
    // Ranking only compares distances, so squared range keeps the same winner
    // without a square root per candidate probe.
    let bestDistanceSquared = Infinity
    for (const other of candidates) {
      if (other.id === plan.id || !shouldConnectSettlements(plan, other)) continue
      const key = regionalRoadKey(plan, other)
      if (seen.has(key)) continue
      const hub = other.kind !== plan.kind ? 0 : 1
      const dx = plan.x - other.x, dz = plan.z - other.z
      const distanceSquared = dx * dx + dz * dz
      let direction = 0
      if (firstNeighbour) {
        const fx = firstNeighbour.x - plan.x, fz = firstNeighbour.z - plan.z
        const dot = fx * -dx + fz * -dz
        // cos(angle) > .5, without square roots or per-candidate angles.
        if (dot > 0 && dot * dot > .25 * (fx * fx + fz * fz) * distanceSquared) direction = 1
      }
      const nearer = distanceSquared < bestDistanceSquared || (distanceSquared === bestDistanceSquared &&
        (best === null || other.id.localeCompare(best.id) < 0))
      const betterHub = hub < bestHub || (hub === bestHub && nearer)
      if (direction < bestDirection || (direction === bestDirection && betterHub)) {
        best = other
        bestDirection = direction
        bestHub = hub
        bestDistanceSquared = distanceSquared
      }
    }
    if (!best) break
    const key = regionalRoadKey(plan, best)
    seen.add(key)
    const link = plan.id < best.id ? { key, from: plan, to: best } : { key, from: best, to: plan }
    if (!accepts || accepts(link)) {
      links.push(link)
      if (plan.kind === 'city' && !firstNeighbour) firstNeighbour = best
    }
  }
  return links
}

/**
 * Discover links from the deterministic world plan, not from whichever
 * settlements happened to fit the current building-instance budget. Planning
 * cross-sections run in the settlement worker. The two-cell neighbour ring
 * bounds discovery to 24 lookups, with caller-owned protected-site overrides.
 */
export function regionalLinksForSettlement(plan: SettlementPlan,
  resolve: (cx: number, cz: number) => SettlementPlan | null = settlementForCell,
  accepts?: (link: RegionalRoadLink) => boolean): RegionalRoadLink[] {
  const [cx, cz] = idNumbers(plan.id)
  const candidates: SettlementPlan[] = []
  for (let dx = -REGIONAL_GRAPH_CELL_RING; dx <= REGIONAL_GRAPH_CELL_RING; dx++) {
    for (let dz = -REGIONAL_GRAPH_CELL_RING; dz <= REGIONAL_GRAPH_CELL_RING; dz++) {
      if (!dx && !dz) continue
      const other = resolve(cx + dx, cz + dz)
      if (other) candidates.push(other)
    }
  }
  return selectRegionalRoadLinks(plan, candidates, accepts)
}

/** Select the first buildable spokes, not merely the nearest proposals. Both
 * worker and unsupported-worker fallback use this deterministic bounded choice.
 * A caller may reuse profiles without exposing them in the compact graph reply. */
export function buildableRegionalLinksForSettlement(plan: SettlementPlan,
  resolve: (cx: number, cz: number) => SettlementPlan | null = settlementForCell,
  protectedPlans: readonly SettlementPlan[] = [],
  profile: (link: RegionalRoadLink) => SettlementRoad | null = link =>
    roadBetweenSettlements(link.from, link.to, resolve, protectedPlans)): RegionalRoadLink[] {
  const compact = new Map<string, RegionalRoadLink>()
  const links = regionalLinksForSettlement(plan, resolve, candidate => {
    const link = compactRegionalRoadLink(candidate)
    if (!link || !profile(link)) return false
    compact.set(link.key, link)
    return true
  })
  return links.map(link => compact.get(link.key)!)
}

/** Sparse seeded graph: cities are strong hubs, villages form occasional links. */
export function shouldConnectSettlements(a: SettlementAnchor, b: SettlementAnchor): boolean {
  const dx = a.x - b.x, dz = a.z - b.z
  // Connection gates only compare range bands, so squared thresholds keep the
  // same accept/reject decisions without a square root per candidate pair.
  const distanceSquared = dx * dx + dz * dz
  const minDistance = Math.max(a.radius, b.radius) * .65
  if (distanceSquared < minDistance * minDistance || distanceSquared > 62000 * 62000) return false
  // Rare settlements should not sit side by side without a route. Longer
  // links remain sparse so the world never turns into a uniform road web.
  if (distanceSquared <= 42000 * 42000) return true
  const [ax, az] = idNumbers(a.id), [bx, bz] = idNumbers(b.id)
  const loX = Math.min(ax, bx), loZ = Math.min(az, bz)
  const hiX = Math.max(ax, bx), hiZ = Math.max(az, bz)
  const roll = hash2(loX * 211 + hiX * 461 + 1907, loZ * 283 + hiZ * 607 - 3911)
  return roll < (a.kind === 'city' || b.kind === 'city' ? .72 : .25)
}

/** Join an actual dry ground street, never a bridge, raised ramp or invented
 * centre point. Check the full new road/shoulder width at a bounded shortlist
 * so a narrow coastal street can still accept a wider highway safely. */
export function settlementRoadAttachment(plan: SettlementAnchor, target: SettlementAnchor, width: number): SettlementRoad['points'][number] | null {
  if (!Number.isFinite(width) || width <= 0) return null
  const dx = target.x - plan.x, dz = target.z - plan.z
  const length = Math.hypot(dx, dz) || 1
  const candidates: SettlementRoad['points'] = []
  const scores = new Float64Array(MAX_ROAD_ATTACHMENT_CANDIDATES).fill(-Infinity)
  for (const road of plan.roads) for (const point of road.points) {
    if (point.bridge || point.structure !== undefined && point.structure !== 'ground') continue
    const outward = ((point.x - plan.x) * dx + (point.z - plan.z) * dz) / length
    // A modest preference joins the village fuel-stop arterial when it faces
    // this neighbour. Keep the same eight candidates and dry cross-section probes.
    const projection = outward + (road.gateway && outward > 0 ? 300 : 0)
    if (!Number.isFinite(projection) || projection <= scores[MAX_ROAD_ATTACHMENT_CANDIDATES - 1]!) continue
    let duplicate = false
    for (const candidate of candidates) if (candidate.x === point.x && candidate.z === point.z) { duplicate = true; break }
    if (duplicate) continue
    let index = Math.min(candidates.length, MAX_ROAD_ATTACHMENT_CANDIDATES - 1)
    while (index > 0 && projection > scores[index - 1]!) {
      if (index < MAX_ROAD_ATTACHMENT_CANDIDATES) {
        candidates[index] = candidates[index - 1]!; scores[index] = scores[index - 1]!
      }
      index--
    }
    candidates[index] = point; scores[index] = projection
  }
  const nx = -dz / length * width / 2, nz = dx / length * width / 2
  for (const point of candidates) {
    let dry = true
    for (const scale of ATTACHMENT_CROSS_SECTION) {
      const climate = sampleClimateInto(roadClimateScratch, point.x + nx * scale, point.z + nz * scale)
      if (!Number.isFinite(climate.height) || climate.height <= (climate.waterLevel ?? 0) + 1) { dry = false; break }
    }
    if (dry) return point
  }
  return null
}

interface RoutePoint { x: number; z: number; surface: number; wet: boolean }

function candidateRoute(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  bend: number,
): { points: RoutePoint[]; score: number } {
  const dx = b.x - a.x, dz = b.z - a.z
  const distance = Math.hypot(dx, dz)
  const nx = -dz / distance, nz = dx / distance
  const count = Math.max(2, Math.ceil(distance / 110))
  const points: RoutePoint[] = []
  let wet = 0, roughness = 0, steepness = 0, ridgeExposure = 0, valleySupport = 0, climb = 0
  let previous = a.y
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const curve = Math.sin(Math.PI * t) * bend + Math.sin(Math.PI * t * 2) * bend * .16
    const x = a.x + dx * t + nx * curve
    const z = a.z + dz * t + nz * curve
    const climate = sampleClimateInto(roadClimateScratch, x, z)
    const isWet = climate.height < (climate.waterLevel ?? 0) + 1
    const surface = isWet ? (climate.waterLevel ?? 0) + 6 : climate.height + .55
    if (isWet) wet++
    // Prefer broad alpine valleys over ridge spines when two bends have
    // comparable wetness. These continuous landform signals are already
    // sampled for the terrain, so route planning gets better geography
    // without another noise field or a road mesh cost.
    ridgeExposure += Math.max(0, climate.landform.ridge -
      (climate.landform.alpineValley ?? 0) * .72)
    valleySupport += climate.landform.alpineValley ?? 0
    if (i) {
      const grade = Math.abs(surface - previous) / (distance / count)
      roughness += Math.max(0, grade - .14) ** 2
      steepness += Math.max(0, grade - .08) ** 2
      climb = Math.max(climb, surface - Math.max(a.y, b.y))
    }
    previous = surface
    points.push({ x, z, surface, wet: isWet })
  }
  const samples = Math.max(1, points.length)
  return {
    points,
    score: wet / samples * 2.5
      + roughness * 8
      + steepness / samples * 1.6
      + ridgeExposure / samples * 1.5
      - valleySupport / samples * .28
      + Math.max(0, climb - 700) / 700,
  }
}

/** Terrain-following road with grade-limited bridge and viaduct approaches. */
export function roadBetweenSettlements(a: SettlementAnchor, b: SettlementAnchor,
  resolve?: (cx: number, cz: number) => SettlementPlan | null,
  protectedPlans: readonly SettlementPlan[] = []): SettlementRoad | null {
  if (!shouldConnectSettlements(a, b)) return null
  // The graph already orders its requests, but direct/review callers must get
  // the same route too. Query order cannot choose different river crossings.
  if (a.id > b.id) [a, b] = [b, a]
  const width = a.kind === 'city' || b.kind === 'city' ? 18 : 10
  const start = settlementRoadAttachment(a, b, width), end = settlementRoadAttachment(b, a, width)
  if (!start || !end) return null
  const distance = Math.hypot(end.x - start.x, end.z - start.z)
  if (distance < 500) return null
  const plans = new Map<string, SettlementPlan>()
  // A protected fallback may have moved outside its nominal stream cell.
  // Include both selected landmarks even when that cell is outside the corridor.
  for (const plan of protectedPlans) plans.set(plan.id, plan)
  for (const endpoint of [a, b]) {
    const [cx, cz] = idNumbers(endpoint.id)
    const plan = resolve ? resolve(cx, cz) : 'buildings' in endpoint ? endpoint as SettlementPlan : null
    if (resolve && (!plan || plan.kind !== endpoint.kind || plan.x !== endpoint.x || plan.y !== endpoint.y ||
      plan.z !== endpoint.z || plan.radius !== endpoint.radius)) return null
    if (plan) plans.set(plan.id, plan)
  }
  if (resolve) {
    // Every supported route lies in this corridor: coarse lanes/guide, broad
    // fallbacks, local refinement, plus maximum settlement radius and service
    // pads. Resolve blueprints independently of streamed/admitted meshes.
    const margin = 10080 + 600 + Math.max(6500 + distance * .025, distance * .14 * 1.16)
    const minX = Math.floor((Math.min(start.x, end.x) - margin) / SETTLEMENT_CELL_SIZE)
    const maxX = Math.floor((Math.max(start.x, end.x) + margin) / SETTLEMENT_CELL_SIZE)
    const minZ = Math.floor((Math.min(start.z, end.z) - margin) / SETTLEMENT_CELL_SIZE)
    const maxZ = Math.floor((Math.max(start.z, end.z) + margin) / SETTLEMENT_CELL_SIZE)
    if ((maxX - minX + 1) * (maxZ - minZ + 1) > MAX_ROAD_CLEARANCE_CELLS) return null
    for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++) {
      if (plans.has(`${cx},${cz}`)) continue
      const plan = resolve(cx, cz)
      if (plan) plans.set(plan.id, plan)
    }
  }
  const clearance = new RoadClearance([...plans.values()], width)
  const [ax, az] = idNumbers(a.id), [bx, bz] = idNumbers(b.id)
  const direction = hash2(ax * 433 + bx * 811, az * 659 + bz * 977) < .5 ? -1 : 1
  const sample = (x: number, z: number) => sampleClimateInto(roadClimateScratch, x, z)
  const corridor = terrainRoadRoute(start, end, sample, direction * distance * .025, false, clearance.allows)
  // Leave a numerical margin below the public ceiling after profile arithmetic.
  const engineeringGrade = MAX_REGIONAL_ROAD_GRADE * .98
  // A coastal village can attach on an uphill street above the shoreline band.
  // Keep its bounded two-way detour even when both chosen joins exceed 25 m.
  const coastal = Math.min(start.y, end.y) < 25 || Math.min(a.y, b.y) < 25
  const validate = (points: readonly { x: number; z: number }[]): SettlementRoad | null => {
    if (!clearance.routeAllows(points)) return null
    const road = groundRoad(points, width, sample)
    return road && (roadGradeValid(road) || engineerRoadGrades(road, engineeringGrade)) ? road : null
  }
  // At most four full profiles, as before. The corridor can change direction
  // locally; two broad alternatives remain a bounded fallback at coastlines.
  if (corridor) {
    const smooth = roundRoadRoute(corridor)
    // Rounding may cut a corner beside a building. Keep the safe corridor in
    // that case; neither smoothing nor engineering can waive clearance.
    const rounded = groundRoad(clearance.routeAllows(smooth) ? smooth : corridor, width, sample)
    if (rounded && roadGradeValid(rounded)) return rounded
    if (rounded && engineerRoadGrades(rounded, engineeringGrade)) return rounded
    const refinement = !coastal && rounded && refineRoadRoute(rounded, sample, clearance.allows)
    const refined = refinement && validate(refinement)
    if (refined) return refined
  }
  if (coastal) {
    // Spend the existing refinement allowance on a two-way coastal detour.
    // Keep the same four full-profile attempts and every physical rejection.
    const detour = coastalRoadRoute(start, end, sample, clearance.allows)
    if (detour) {
      const smooth = roundRoadRoute(detour)
      const road = validate(clearance.routeAllows(smooth) ? smooth : detour)
      if (road) return road
    }
  }
  const bends = [direction * distance * .09, -direction * distance * .14]
  const candidates = bends.map(bend => candidateRoute(start, end, bend))
  candidates.sort((a, b) => a.score - b.score)
  for (const candidate of candidates) {
    const road = validate(candidate.points)
    if (road) return road
  }
  return null
}

/** Resolve attachment points in the worker and transfer only those points.
 * Buildings, parks and full street profiles are not needed by a road job. */
export function compactRegionalRoadLink(link: RegionalRoadLink): RegionalRoadLink | null {
  const width = link.from.kind === 'city' || link.to.kind === 'city' ? 18 : 10
  const a = settlementRoadAttachment(link.from, link.to, width)
  const b = settlementRoadAttachment(link.to, link.from, width)
  if (!a || !b) return null
  const endpoint = (plan: RegionalRoadEndpoint, point: SettlementRoad['points'][number]): RegionalRoadEndpoint => ({
    id: plan.id, kind: plan.kind, biome: plan.biome, x: plan.x, y: plan.y, z: plan.z, radius: plan.radius,
    roads: [{ width, points: [{ x: point.x, y: point.y, z: point.z, structure: 'ground' }] }],
  })
  return { key: link.key, from: endpoint(link.from, a), to: endpoint(link.to, b) }
}
