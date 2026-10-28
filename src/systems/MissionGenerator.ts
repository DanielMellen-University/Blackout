import { MAX_GENERATED_GATES, MIN_GENERATED_GATES, MAX_GATE_SPACING_M, MIN_GATE_SPACING_M } from './MissionGates'
import { flightConfig } from '../aircraft/flightConfig'
import { MISSION_THEMES, type MissionTheme, type TerrainProfile } from '../world/TerrainProfile'

export interface GeneratedPoint { x: number; y: number; z: number }
export interface GeneratedMissionSpec {
  seed: number
  theme: MissionTheme
  profile: 'generated-desert' | 'generated-valley' | 'generated-coastal' | 'generated-volcanic' | 'generated-waterway'
  terrain: TerrainProfile
  start: GeneratedPoint & { yaw: number }
  landingRunway: GeneratedPoint & { yaw: number; length: number; width: number }
  course: readonly GeneratedPoint[]
  goals: { gates: number }
}
/** Pure seeded recipe. No mutable world state, clock, random calls or terrain cache. */
export function generateMission(seed: number, requestedTheme?: MissionTheme, training = false): GeneratedMissionSpec {
  if (!Number.isFinite(seed) || !Number.isSafeInteger(Math.round(seed * 1e6))) throw new Error('Invalid mission seed')
  if (requestedTheme !== undefined && !MISSION_THEMES.includes(requestedTheme)) throw new Error('Invalid mission theme')
  const normalized = Math.round(seed * 1e6) / 1e6 || (seed < 0 ? -.001 : .001)
  let state = Math.round(normalized * 1e6) | 0
  const random = (): number => {
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b)
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b)
    return ((state ^= state >>> 16) >>> 0) / 4294967296
  }
  const pick = random()
  const theme = requestedTheme ?? MISSION_THEMES[Math.floor(pick * MISSION_THEMES.length)]!
  const terrain: TerrainProfile = {
    theme, landscapeRevision: 30, routeRevision: 33,
    originX: Math.round((random() - .5) * 10000), originZ: Math.round((random() - .5) * 10000),
    yaw: (random() - .5) * .7, baseHeight: 180 + random() * 100,
    relief: theme === 'desert-run' ? 850 : 7600,
    valleyHalfWidth: 2900 + random() * 350, phase: random() * Math.PI * 2, dry: true,
  }
  if (theme === 'desert-run' || theme === 'mountain-valley-run') {
    terrain.landscapeRevision = 33; terrain.routeRevision = 36
    terrain.yaw *= Math.PI * 2 / .7
  }
  if (theme === 'coastal-island-run') {
    terrain.baseHeight = 55; terrain.relief = 520
    terrain.landscapeRevision = 34; terrain.routeRevision = 37; terrain.yaw *= Math.PI * 2 / .7
  }
  if (theme === 'volcanic-run') {
    terrain.baseHeight = 240; terrain.relief = 2600
    terrain.landscapeRevision = 35; terrain.routeRevision = 38; terrain.yaw *= Math.PI * 2 / .7
  }
  if (theme === 'waterway-run') {
    terrain.landscapeRevision = 36; terrain.routeRevision = 39
    terrain.relief = 1250; terrain.dry = false; terrain.yaw *= Math.PI * 2 / .7
  }
  const start = { x: terrain.originX, y: terrain.baseHeight, z: terrain.originZ, yaw: terrain.yaw }
  const spread = 1350 + random() * 350, length = 3000 + random() * 600
  let offsets: readonly (readonly [number, number])[] = [[0, 1800], [spread, length], [spread, -300], [0, -2600], [0, -1400]]
  let heights = [145, 145, 145, 145, 145]
  if (theme === 'desert-run' || theme === 'mountain-valley-run') {
    // Mirror and reshape the circuit independently of the world's position.
    // The two final gates remain aligned with the same flat runway approach.
    const hand = random() < .5 ? -1 : 1
    const valley = theme === 'mountain-valley-run'
    const width = (valley ? 1450 : 1100) + random() * (valley ? 700 : 1050)
    const outbound = (valley ? 3000 : 2650) + random() * (valley ? 1450 : 1250)
    offsets = [[hand * (random() - .5) * 260, 1400 + random() * 650],
      [hand * width, outbound], [hand * width * (.45 + random() * .5), -100 + random() * 800],
      [0, -2700 - random() * 650], [0, -1400 - random() * 180]]
    heights = [140 + random() * 40, 145 + random() * 65, 125 + random() * 70,
      130 + random() * 30, 105 + random() * 30]
  }
  if (theme === 'coastal-island-run' || theme === 'volcanic-run') {
    // Stay in the existing sea channel or low cone corridor, with independently
    // varied outbound doglegs and a descending final aligned with the runway.
    const coastal = theme === 'coastal-island-run'
    const width = (coastal ? 1150 : 1100) + random() * (coastal ? 1000 : 650)
    offsets = [[(random() - .5) * 420, 1450 + random() * 600],
      [width, (coastal ? 2350 : 2600) + random() * (coastal ? 1200 : 700)],
      [width * (.65 + random() * .4), -350 + random() * 1000],
      [0, -2650 - random() * 650], [0, -1350 - random() * 230]]
    heights = [140 + random() * 40, 135 + random() * 85, 115 + random() * 75,
      130 + random() * 30, 105 + random() * 30]
  }
  if (theme === 'waterway-run') {
    offsets = [[1000, 1800], [2100, 3300], [1250, -200], [0, -2900], [0, -1450]]
    heights = [145, 160, 140, 145, 115].map(h => h + random() * 15)
  }
  // Daniel, Oct 27 2026: 8 to 20 gates spaced 0.8 to 2.5 km apart, keeping
  // the 75 degree turn limit. A seeded preference picks the count; the nearest
  // count that fits the loop wins. Narrow loops may widen past their seeded
  // bounds when no count fits (Waterway keeps its river and lake gates).
  const countRoll = random() // Keep the seeded stream unchanged for Training orbit.
  const preferredGates = training
    ? 11
    : MIN_GENERATED_GATES + Math.floor(countRoll * (MAX_GENERATED_GATES - MIN_GENERATED_GATES + 1))
  // Route-only revisions: +10 for b30, +10 more for the M0 spacing. Keep
  // landscape generation and b20 physics unchanged.
  terrain.routeRevision += 20
  const hand = offsets[1]![0] < 0 ? -1 : 1
  const seededRadius = Math.abs(offsets[1]![0]) / 2
  const departure = offsets[0]![1], top = offsets[1]![1]
  const bottom = offsets[3]![1], final = offsets[4]![1]
  const waterway = theme === 'waterway-run'
  const toWorld = ({ right, forward, height }: LocalPoint): GeneratedPoint => ({
    x: start.x + Math.cos(start.yaw) * right + Math.sin(start.yaw) * forward,
    y: start.y + height,
    z: start.z - Math.sin(start.yaw) * right + Math.cos(start.yaw) * forward,
  })
  let course: GeneratedPoint[] | null = null
  let fallback: LocalPoint[] | null = null
  for (const [radius, arcScale] of routeEnvelopes(seededRadius, waterway)) {
    const local = stadiumRoute(hand, radius, departure, top, bottom, final, heights, arcScale)
    // The last two gates stay on the runway axis: the end of the return arc
    // and the final, so the run still finishes over the clear approach line.
    const finalGate: LocalPoint = { right: 0, forward: final, height: heights[4]! }
    if (!fallback) fallback = [...placeGates(local, preferredGates - 1), finalGate]
    // Waterway pins one gate on the river crossing and one over the lake,
    // spacing the rest evenly between them.
    for (const pins of waterway ? waterwayPinSets(local, terrain.phase) : [[]]) {
      for (const count of gateCountOrder(preferredGates)) {
        const gates = [...placeGates(local, count - 1, pins), finalGate]
        if (!gatesFit(gates)) continue
        if (waterway && !(gates.some(gate => overWaterwayLake(gate)) && gates.some(gate => overWaterwayRiver(gate, terrain.phase)))) continue
        course = gates.map(toWorld)
        break
      }
      if (course) break
    }
    if (course) break
  }
  course ??= fallback!.map(toWorld)
  const gateCount = course.length
  return { seed: normalized, theme, profile: theme === 'desert-run' ? 'generated-desert' : theme === 'coastal-island-run' ? 'generated-coastal' : theme === 'volcanic-run' ? 'generated-volcanic' : theme === 'waterway-run' ? 'generated-waterway' : 'generated-valley', terrain, start: { ...start, x: start.x - Math.sin(start.yaw) * 45, y: start.y + flightConfig.gearHeight, z: start.z - Math.cos(start.yaw) * 45 },
    landingRunway: { ...start, length: 120, width: 18 }, course,
    goals: { gates: gateCount } }
}

interface LocalPoint { right: number; forward: number; height: number }

/** Generator turn budget, kept under the 75 degree flyability limit. */
const GENERATED_TURN_LIMIT_DEG = 70
/** Spacing margin so terrain clearance and rounding never cross the limits. */
const SPACING_MARGIN_M = 20

/** Seeded envelope first, then rounder outbound arcs, then gradual widening.
 * The arc scale is the outbound reach over the radius; null keeps the seed's. */
function routeEnvelopes(seededRadius: number, waterway: boolean): [number, number | null][] {
  const envelopes: [number, number | null][] = [[seededRadius, null]]
  for (const scale of [1, 1.1, 1.2, 1.3, 1.4]) envelopes.push([seededRadius, scale])
  // Waterway widens toward its fixed lake so one gate can sit near the centre.
  if (waterway) {
    for (let radius = seededRadius + 50; radius <= 1_500; radius += 50) {
      for (const scale of [1, 1.1, 1.2, 1.3, 1.4, 1.5]) envelopes.push([radius, scale])
    }
    return envelopes
  }
  for (let radius = Math.ceil(seededRadius / 50) * 50 + 50; radius <= 1_400; radius += 50) envelopes.push([radius, 1])
  return envelopes
}

/** A stadium: outbound arc, return straight, then a return arc onto the runway axis. */
function stadiumRoute(
  hand: number, radius: number, departure: number, top: number, bottom: number, final: number,
  heights: readonly number[], arcScale: number | null,
): LocalPoint[] {
  const arcHeight = arcScale !== null ? radius * arcScale : Math.max(radius, Math.min(top - departure, radius * 1.5))
  const returnForward = Math.min(bottom + radius, final - MIN_GATE_SPACING_M - 100)
  const local: LocalPoint[] = []
  for (let i = 0; i <= 64; i++) {
    const angle = Math.PI * i / 64
    local.push({ right: hand * radius * (1 - Math.cos(angle)),
      forward: departure + Math.sin(angle) * arcHeight,
      height: heights[0]! + (heights[2]! - heights[0]!) * i / 64 })
  }
  for (let i = 0; i <= 64; i++) {
    const angle = Math.PI * i / 64
    local.push({ right: hand * radius * (1 + Math.cos(angle)),
      forward: returnForward - Math.sin(angle) * radius,
      height: heights[3]! })
  }
  return local
}

/** Cumulative horizontal arc length at each route sample. */
function arcLengths(local: readonly LocalPoint[]): number[] {
  const lengths = [0]
  for (let i = 1; i < local.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(
    local[i]!.right - local[i - 1]!.right, local[i]!.forward - local[i - 1]!.forward))
  return lengths
}

function pointAtLength(local: readonly LocalPoint[], lengths: readonly number[], distance: number): LocalPoint {
  let i = 1
  while (i < local.length - 1 && lengths[i]! < distance) i++
  const a = local[i - 1]!, b = local[i]!
  const t = Math.max(0, Math.min(1, (distance - lengths[i - 1]!) / Math.max(1e-9, lengths[i]! - lengths[i - 1]!)))
  return { right: a.right + (b.right - a.right) * t, forward: a.forward + (b.forward - a.forward) * t,
    height: a.height + (b.height - a.height) * t }
}

/** Spread gates by travelled distance from the first to the last route sample.
 * Pinned arc lengths split the route; each part gets a share of the legs. */
function placeGates(local: readonly LocalPoint[], count: number, pins: readonly number[] = []): LocalPoint[] {
  const lengths = arcLengths(local)
  const total = lengths[lengths.length - 1]!
  const stops = [0, ...pins.filter(pin => pin > 0 && pin < total), total].sort((a, b) => a - b)
  const legs = count - 1
  const parts = stops.length - 1
  if (legs < parts) return []
  const shares = stops.slice(1).map((stop, i) => Math.max(1, Math.floor((stop - stops[i]!) / total * legs)))
  while (shares.reduce((sum, share) => sum + share, 0) < legs) {
    let best = 0
    for (let i = 1; i < parts; i++) if ((stops[i + 1]! - stops[i]!) / shares[i]! > (stops[best + 1]! - stops[best]!) / shares[best]!) best = i
    shares[best]!++
  }
  while (shares.reduce((sum, share) => sum + share, 0) > legs) {
    let best = -1
    for (let i = 0; i < parts; i++) if (shares[i]! > 1 && (best < 0 || (stops[i + 1]! - stops[i]!) / shares[i]! < (stops[best + 1]! - stops[best]!) / shares[best]!)) best = i
    if (best < 0) return []
    shares[best]!--
  }
  const gates: LocalPoint[] = [pointAtLength(local, lengths, 0)]
  for (let part = 0; part < parts; part++) {
    for (let leg = 1; leg <= shares[part]!; leg++) {
      gates.push(pointAtLength(local, lengths, stops[part]! + (stops[part + 1]! - stops[part]!) * leg / shares[part]!))
    }
  }
  return gates
}

/** Candidate pins: each river crossing with the closest lake pass, then
 * either alone, then even spacing. */
function waterwayPinSets(local: readonly LocalPoint[], phase: number): number[][] {
  const lengths = arcLengths(local)
  const river = (p: LocalPoint) => p.right - (1_100 + Math.sin(p.forward / 1_600 + phase) * 130)
  const crossings: number[] = []
  for (let i = 1; i < local.length; i++) {
    const a = river(local[i - 1]!), b = river(local[i]!)
    if (a === 0 || a * b < 0) crossings.push(lengths[i - 1]! + (lengths[i]! - lengths[i - 1]!) * a / (a - b))
  }
  let lake = 0, nearest = Infinity
  for (let i = 0; i < local.length; i++) {
    const distance = Math.hypot(local[i]!.right - 2_100, local[i]!.forward - 3_300)
    if (distance < nearest) { nearest = distance; lake = lengths[i]! }
  }
  return [...crossings.map(crossing => [crossing, lake]), ...crossings.map(crossing => [crossing]), [lake], []]
}

/** Preferred count first, then the nearest counts, fewer before more. */
function gateCountOrder(preferred: number): number[] {
  const order: number[] = []
  for (let step = 0; order.length < MAX_GENERATED_GATES - MIN_GENERATED_GATES + 1; step++) {
    for (const count of step === 0 ? [preferred] : [preferred - step, preferred + step]) {
      if (count >= MIN_GENERATED_GATES && count <= MAX_GENERATED_GATES) order.push(count)
    }
  }
  return order
}

/** Gate spacing and the turn at every gate, starting from the runway heading. */
function gatesFit(gates: readonly LocalPoint[]): boolean {
  let previousRight = 0, previousForward = 0, headingRight = 0, headingForward = 1
  for (let i = 0; i < gates.length; i++) {
    const dr = gates[i]!.right - previousRight, df = gates[i]!.forward - previousForward
    const length = Math.hypot(dr, df)
    if (i > 0 && (length < MIN_GATE_SPACING_M + SPACING_MARGIN_M || length > MAX_GATE_SPACING_M - SPACING_MARGIN_M)) return false
    if (length < 1) return false
    const cos = (dr * headingRight + df * headingForward) / length
    if (Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI > GENERATED_TURN_LIMIT_DEG) return false
    headingRight = dr / length; headingForward = df / length
    previousRight = gates[i]!.right; previousForward = gates[i]!.forward
  }
  return true
}

/** Matches WaterwayTerrain: lake at 2,100 right / 3,300 forward, radius 1,050.
 * Its shoreline is irregular, so the gate must sit well inside. */
function overWaterwayLake(gate: LocalPoint): boolean {
  return Math.hypot(gate.right - 2_100, gate.forward - 3_300) < 1_050 * .3
}

/** Matches WaterwayTerrain: a 250 m channel meandering around 1,100 m right. */
function overWaterwayRiver(gate: LocalPoint, phase: number): boolean {
  return Math.abs(gate.right - (1_100 + Math.sin(gate.forward / 1_600 + phase) * 130)) < 40
}
