import type { SettlementRoad } from './SettlementPlan'

export const ROAD_GROUND_OFFSET = .45
export const ROAD_SURFACE_STEP = 24
export const ROAD_BRIDGE_CLEARANCE = 7
export const ROAD_APPROACH_GRADE = .1
export const MAX_ROAD_PROFILE_POINTS = 8192
export const MAX_ROAD_BRIDGE_SPAN = 1800
export const MAX_ROAD_STRUCTURE_HEIGHT = 96
export const ROAD_SUPPORT_SPACING = 120
export const MAX_ROAD_SUPPORTS = 192
export const MAX_DRY_ROAD_STRUCTURE_SPAN = 1200

type Position = { x: number; z: number }
type Point = SettlementRoad['points'][number]
export type RoadGroundSampler = (x: number, z: number) => { height: number; waterLevel?: number }

/** A small terrain-checked apron closes angled ribbon ends at a street join.
 * Thirteen probes and twelve triangles, never a new road or a floating disc. */
export function groundRoadJunction(point: Position, width: number, sample: RoadGroundSampler,
  offset = ROAD_GROUND_OFFSET): number[] | null {
  if (!Number.isFinite(width) || width <= 0 || width > 64 || !Number.isFinite(offset)) return null
  const center = sample(point.x, point.z), y = center.height + offset
  if (!Number.isFinite(y) || center.height <= (center.waterLevel ?? 0) + 1) return null
  const ring: { x: number; y: number; z: number }[] = []
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * Math.PI * 2
    const x = point.x + Math.cos(angle) * width * .6, z = point.z + Math.sin(angle) * width * .6
    const ground = sample(x, z)
    if (!Number.isFinite(ground.height) || ground.height <= (ground.waterLevel ?? 0) + 1) return null
    ring.push({ x, y: ground.height + offset, z })
  }
  const positions: number[] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!, b = ring[(i + 1) % ring.length]!
    positions.push(point.x, y, point.z, b.x, b.y, b.z, a.x, a.y, a.z)
  }
  return positions
}

/** Select a few deterministic supports so long wet crossings read as bridges. */
export function bridgeSupportPoints(road: SettlementRoad): SettlementRoad['points'] {
  const supports: SettlementRoad['points'] = []
  let last: SettlementRoad['points'][number] | null = null
  for (const point of road.points) {
    if (!point.bridge && point.structure !== 'viaduct') {
      last = null
      continue
    }
    if (!last || Math.hypot(point.x - last.x, point.z - last.z) >= ROAD_SUPPORT_SPACING) {
      supports.push(point)
      last = point
    }
    if (supports.length >= MAX_ROAD_SUPPORTS) break
  }
  return supports
}

/** Bridge short dry gullies with actual fills/piers instead of either following
 * a cliff face or lifting an entire regional road. Reject tall/long structures,
 * changed street joins before mutating the profile. Water decks remain level. */
export function engineerRoadGrades(road: SettlementRoad, grade: number): SettlementRoad | null {
  if (!Number.isFinite(grade) || grade <= 0 || road.points.length > MAX_ROAD_PROFILE_POINTS) return null
  const points = road.points, heights = Float64Array.from(points, point => point.y)
  if (points.length < 2) return null
  const step = (i: number, j: number) => Math.hypot(points[i]!.x - points[j]!.x, points[i]!.z - points[j]!.z)
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < points.length; i++) heights[i] = Math.max(heights[i]!, heights[i - 1]! - step(i, i - 1) * grade)
    for (let i = points.length - 2; i >= 0; i--) heights[i] = Math.max(heights[i]!, heights[i + 1]! - step(i, i + 1) * grade)
    for (let i = 0; i < points.length; i++) if (heights[i]! > points[i]!.y + 1e-5) {
      heights[i] = Math.max(heights[i]!, points[i]!.leftY ?? points[i]!.y, points[i]!.rightY ?? points[i]!.y)
    }
    for (let i = 0; i < points.length; i++) {
      if (!points[i]!.bridge) continue
      const start = i
      let deck = heights[i]!
      while (i + 1 < points.length && points[i + 1]!.bridge) { i++; deck = Math.max(deck, heights[i]!) }
      for (let j = start; j <= i; j++) heights[j] = deck
    }
  }
  if (heights[0]! > points[0]!.y + 1e-5 || heights.at(-1)! > points.at(-1)!.y + 1e-5) return null
  let span = 0, supports = 0, lastSupport: Point | null = null
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!, raised = heights[i]! > point.y + 1e-5
    if (!Number.isFinite(heights[i])) return null
    if (raised && !point.bridge) {
      span += i ? step(i, i - 1) : 0
      if (span > MAX_DRY_ROAD_STRUCTURE_SPAN) return null
    } else span = 0
    const clearance = heights[i]! - Math.min(point.groundY ?? point.y, point.leftGroundY ?? point.y, point.rightGroundY ?? point.y)
    if (clearance > MAX_ROAD_STRUCTURE_HEIGHT) return null
    if (point.bridge || point.structure === 'viaduct' || (raised && clearance > 8)) {
      if (!lastSupport || Math.hypot(point.x - lastSupport.x, point.z - lastSupport.z) >= ROAD_SUPPORT_SPACING) {
        if (++supports > MAX_ROAD_SUPPORTS) return null
        lastSupport = point
      }
    } else lastSupport = null
    if (i && Math.abs(heights[i]! - heights[i - 1]!) > step(i, i - 1) * grade + 1e-6) return null
  }
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!
    if (heights[i]! <= point.y + 1e-5) continue
    point.y = point.leftY = point.rightY = heights[i]!
    const clearance = point.y - Math.min(point.groundY ?? point.y, point.leftGroundY ?? point.y, point.rightGroundY ?? point.y)
    point.structure = point.bridge ? 'bridge' : clearance <= 8 ? 'embankment' : 'viaduct'
  }
  return road
}

/** Worker-side cross-sections. Dry roads follow their own ground, never a
 * global raise-only grade envelope. Only explicit crossings get raised decks;
 * their dry approaches carry soil fills or supported viaducts. */
export function groundRoad(points: readonly Position[], width: number, sample: RoadGroundSampler): SettlementRoad | null {
  if (points.length < 2 || !Number.isFinite(width) || width <= 0) return null
  const profile: Point[] = []
  const water: number[] = []
  for (let segment = 1; segment < points.length; segment++) {
    const a = points[segment - 1]!, b = points[segment]!
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz)
    if (!Number.isFinite(length)) return null
    if (length < 1e-6) continue
    const steps = Math.ceil(length / ROAD_SURFACE_STEP)
    if (profile.length + steps + 1 > MAX_ROAD_PROFILE_POINTS) return null
    const nx = -dz / length * width / 2, nz = dx / length * width / 2
    for (let i = profile.length ? 1 : 0; i <= steps; i++) {
      const x = a.x + dx * i / steps, z = a.z + dz * i / steps
      const center = sample(x, z), groundY = center.height
      let level = groundY < (center.waterLevel ?? 0) + 1 ? center.waterLevel ?? 0 : -Infinity
      const left = sample(x + nx, z + nz), leftGroundY = left.height
      if (leftGroundY < (left.waterLevel ?? 0) + 1) level = Math.max(level, left.waterLevel ?? 0)
      const right = sample(x - nx, z - nz), rightGroundY = right.height
      if (rightGroundY < (right.waterLevel ?? 0) + 1) level = Math.max(level, right.waterLevel ?? 0)
      const shoulderLeftY = sample(x + nx * 1.55, z + nz * 1.55).height + .3
      const shoulderRightY = sample(x - nx * 1.55, z - nz * 1.55).height + .3
      if (![groundY, leftGroundY, rightGroundY, shoulderLeftY, shoulderRightY].every(Number.isFinite)) return null
      profile.push({ x, z, y: groundY + ROAD_GROUND_OFFSET, groundY, leftGroundY, rightGroundY,
        shoulderLeftY, shoulderRightY,
        leftX: x + nx, leftZ: z + nz, rightX: x - nx, rightZ: z - nz,
        leftY: leftGroundY + ROAD_GROUND_OFFSET, rightY: rightGroundY + ROAD_GROUND_OFFSET,
        bridge: Number.isFinite(level), structure: Number.isFinite(level) ? 'bridge' : 'ground' })
      water.push(level)
    }
  }
  if (profile.length < 2) return null
  // A bridge must connect dry banks. Never leave a local street terminating
  // on an unsupported deck in the middle of a river/lake.
  if (profile[0]!.bridge || profile.at(-1)!.bridge) return null

  const crossings: { start: number; end: number; deck: number }[] = []
  for (let i = 0; i < profile.length; i++) {
    if (!profile[i]!.bridge) continue
    const start = i
    let deck = water[i]! + ROAD_BRIDGE_CLEARANCE
    while (i + 1 < profile.length && profile[i + 1]!.bridge) {
      i++; deck = Math.max(deck, water[i]! + ROAD_BRIDGE_CLEARANCE)
    }
    const end = i
    let spanLength = 0
    for (let j = start + 1; j <= end; j++) spanLength += Math.hypot(profile[j]!.x - profile[j - 1]!.x, profile[j]!.z - profile[j - 1]!.z)
    if (spanLength > MAX_ROAD_BRIDGE_SPAN) return null
    // Start/end banks anchor the bridge deck. The outer route remains on its
    // own ground; we do not propagate every mountain peak across the link.
    for (let j = Math.max(0, start - 1); j <= Math.min(profile.length - 1, end + 1); j++) {
      const point = profile[j]!
      deck = Math.max(deck, point.groundY! + ROAD_GROUND_OFFSET,
        point.leftGroundY! + ROAD_GROUND_OFFSET, point.rightGroundY! + ROAD_GROUND_OFFSET)
    }
    for (let j = start; j <= end; j++) {
      const point = profile[j]!
      point.y = point.leftY = point.rightY = deck
    }
    crossings.push({ start, end, deck })
  }
  for (const crossing of crossings) for (const direction of [-1, 1]) {
    const edge = direction < 0 ? crossing.start : crossing.end
    let distance = 0, previous = profile[edge]!
    for (let i = edge + direction; i >= 0 && i < profile.length; i += direction) {
      const point = profile[i]!
      if (point.bridge) break
      distance += Math.hypot(point.x - previous.x, point.z - previous.z)
      const ramp = crossing.deck - distance * ROAD_APPROACH_GRADE
      const groundTop = Math.max(point.groundY!, point.leftGroundY!, point.rightGroundY!) + ROAD_GROUND_OFFSET
      if (ramp <= groundTop) break
      point.y = point.leftY = point.rightY = Math.max(ramp, point.y, point.leftY!, point.rightY!)
      const clearance = point.y - Math.min(point.groundY!, point.leftGroundY!, point.rightGroundY!)
      point.structure = clearance <= 8 ? 'embankment' : 'viaduct'
      previous = point
    }
  }
  // Reject an impossible crossing rather than inventing a sky-high road.
  for (const point of profile) if (point.structure !== 'ground' &&
    point.y - Math.min(point.groundY!, point.leftGroundY!, point.rightGroundY!) > MAX_ROAD_STRUCTURE_HEIGHT) return null
  if (profile[0]!.structure !== 'ground' || profile.at(-1)!.structure !== 'ground') return null
  let supports = 0, lastSupport: Point | null = null
  for (const point of profile) {
    if (!point.bridge && point.structure !== 'viaduct') { lastSupport = null; continue }
    if (!lastSupport || Math.hypot(point.x - lastSupport.x, point.z - lastSupport.z) >= ROAD_SUPPORT_SPACING) {
      if (++supports > MAX_ROAD_SUPPORTS) return null
      lastSupport = point
    }
  }
  return { width, points: profile }
}
