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

type Position = { x: number; z: number }
type Point = SettlementRoad['points'][number]
export type RoadGroundSampler = (x: number, z: number) => { height: number; waterLevel?: number }

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
