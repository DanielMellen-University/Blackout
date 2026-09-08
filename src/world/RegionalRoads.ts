import { hash2 } from './noise'
import { sampleClimate } from './terrainSample'
import { settlementForCell, type SettlementPlan, type SettlementRoad } from './SettlementPlan'

export interface SettlementAnchor {
  id: string
  kind: 'city' | 'village'
  x: number; y: number; z: number; radius: number
  roads: SettlementRoad[]
}

export interface RegionalRoadLink {
  key: string
  from: SettlementPlan
  to: SettlementPlan
}

/**
 * Settlement cells are deliberately wide, so this stays a small fixed search
 * instead of growing with render distance or the number of loaded meshes.
 */
export const REGIONAL_GRAPH_CELL_RING = 2
export const MAX_CITY_REGIONAL_LINKS = 2
export const MAX_VILLAGE_REGIONAL_LINKS = 1

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
export function selectRegionalRoadLinks(plan: SettlementPlan, candidates: readonly SettlementPlan[]): RegionalRoadLink[] {
  const limit = plan.kind === 'city' ? MAX_CITY_REGIONAL_LINKS : MAX_VILLAGE_REGIONAL_LINKS
  const selected = candidates
    .filter(other => other.id !== plan.id && shouldConnectSettlements(plan, other))
    .sort((a, b) => {
      const distanceA = Math.hypot(plan.x - a.x, plan.z - a.z)
      const distanceB = Math.hypot(plan.x - b.x, plan.z - b.z)
      return distanceA - distanceB || a.id.localeCompare(b.id)
    })

  const links: RegionalRoadLink[] = []
  const seen = new Set<string>()
  for (const other of selected) {
    const key = regionalRoadKey(plan, other)
    if (seen.has(key)) continue
    seen.add(key)
    links.push(plan.id < other.id ? { key, from: plan, to: other } : { key, from: other, to: plan })
    if (links.length >= limit) break
  }
  return links
}

/**
 * Discover links from the deterministic world plan, not from whichever
 * settlements happened to fit the current building-instance budget. Planning
 * runs in the settlement worker, and the two-cell ring bounds it to 24 probes.
 */
export function regionalLinksForSettlement(plan: SettlementPlan): RegionalRoadLink[] {
  const [cx, cz] = idNumbers(plan.id)
  const candidates: SettlementPlan[] = []
  for (let dx = -REGIONAL_GRAPH_CELL_RING; dx <= REGIONAL_GRAPH_CELL_RING; dx++) {
    for (let dz = -REGIONAL_GRAPH_CELL_RING; dz <= REGIONAL_GRAPH_CELL_RING; dz++) {
      if (!dx && !dz) continue
      const other = settlementForCell(cx + dx, cz + dz)
      if (other) candidates.push(other)
    }
  }
  return selectRegionalRoadLinks(plan, candidates)
}

/** Sparse seeded graph: cities are strong hubs, villages form occasional links. */
export function shouldConnectSettlements(a: SettlementAnchor, b: SettlementAnchor): boolean {
  const distance = Math.hypot(a.x - b.x, a.z - b.z)
  if (distance < Math.max(a.radius, b.radius) * .65 || distance > 62000) return false
  // Rare settlements should not sit side by side without a route. Longer
  // links remain sparse so the world never turns into a uniform road web.
  if (distance <= 42000) return true
  const [ax, az] = idNumbers(a.id), [bx, bz] = idNumbers(b.id)
  const loX = Math.min(ax, bx), loZ = Math.min(az, bz)
  const hiX = Math.max(ax, bx), hiZ = Math.max(az, bz)
  const roll = hash2(loX * 211 + hiX * 461 + 1907, loZ * 283 + hiZ * 607 - 3911)
  return roll < (a.kind === 'city' || b.kind === 'city' ? .72 : .25)
}

function outwardRoadPoint(plan: SettlementAnchor, target: SettlementAnchor): { x: number; y: number; z: number } {
  const dx = target.x - plan.x, dz = target.z - plan.z
  const length = Math.hypot(dx, dz) || 1
  let best = { x: plan.x, y: plan.y, z: plan.z }, score = -Infinity
  for (const road of plan.roads) for (const point of road.points) {
    const projection = ((point.x - plan.x) * dx + (point.z - plan.z) * dz) / length
    if (projection > score) { score = projection; best = point }
  }
  return best
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
  let wet = 0, roughness = 0, climb = 0
  let previous = a.y
  for (let i = 0; i <= count; i++) {
    const t = i / count
    const curve = Math.sin(Math.PI * t) * bend + Math.sin(Math.PI * t * 2) * bend * .16
    const x = a.x + dx * t + nx * curve
    const z = a.z + dz * t + nz * curve
    const climate = sampleClimate(x, z)
    const isWet = climate.height < (climate.waterLevel ?? 0) + 1
    const surface = isWet ? (climate.waterLevel ?? 0) + 6 : climate.height + .55
    if (isWet) wet++
    if (i) {
      const grade = Math.abs(surface - previous) / (distance / count)
      roughness += Math.max(0, grade - .14) ** 2
      climb = Math.max(climb, surface - Math.max(a.y, b.y))
    }
    previous = surface
    points.push({ x, z, surface, wet: isWet })
  }
  return { points, score: wet / points.length * 2.5 + roughness * 8 + Math.max(0, climb - 700) / 700 }
}

/** Terrain-following road with grade-limited bridge and viaduct approaches. */
export function roadBetweenSettlements(a: SettlementPlan, b: SettlementPlan): SettlementRoad | null {
  if (!shouldConnectSettlements(a, b)) return null
  const start = outwardRoadPoint(a, b), end = outwardRoadPoint(b, a)
  const distance = Math.hypot(end.x - start.x, end.z - start.z)
  if (distance < 500) return null
  const [ax, az] = idNumbers(a.id), [bx, bz] = idNumbers(b.id)
  const direction = hash2(ax * 433 + bx * 811, az * 659 + bz * 977) < .5 ? -1 : 1
  const bends = [direction * distance * .045, direction * distance * .09,
    -direction * distance * .14, direction * distance * .2]
  let best = candidateRoute(start, end, bends[0]!)
  for (let i = 1; i < bends.length; i++) {
    const candidate = candidateRoute(start, end, bends[i]!)
    if (candidate.score < best.score) best = candidate
  }

  // Raise neighbouring samples into gentle approaches instead of producing
  // vertical kinks at rivers or deep terrain folds.
  const maxGrade = .12
  const elevations = best.points.map(point => point.surface)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < elevations.length; i++) {
      const distance = Math.hypot(best.points[i]!.x - best.points[i - 1]!.x, best.points[i]!.z - best.points[i - 1]!.z)
      elevations[i] = Math.max(elevations[i]!, elevations[i - 1]! - distance * maxGrade)
    }
    for (let i = elevations.length - 2; i >= 0; i--) {
      const distance = Math.hypot(best.points[i + 1]!.x - best.points[i]!.x, best.points[i + 1]!.z - best.points[i]!.z)
      elevations[i] = Math.max(elevations[i]!, elevations[i + 1]! - distance * maxGrade)
    }
  }

  const width = a.kind === 'city' || b.kind === 'city' ? 42 : 26
  const points: SettlementRoad['points'] = best.points.map((point, i) => {
    const before = best.points[Math.max(0, i - 1)]!, after = best.points[Math.min(best.points.length - 1, i + 1)]!
    const dx = after.x - before.x, dz = after.z - before.z
    const length = Math.hypot(dx, dz) || 1
    const nx = -dz / length * width / 2, nz = dx / length * width / 2
    const y = elevations[i]!
    return { x: point.x, y, z: point.z, bridge: point.wet, leftX: point.x + nx, leftY: y, leftZ: point.z + nz,
      rightX: point.x - nx, rightY: y, rightZ: point.z - nz }
  })
  return { width, points }
}
