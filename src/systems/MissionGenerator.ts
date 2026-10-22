import { distributeMissionGates } from './MissionGates'
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
  goals: { gates: number; landingRequired: true; scoring: 'existing-medals'; referenceSpeed: number }
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
  // Theme length bands, inclusive, with a separate short training band.
  const band = training ? [15, 24] : theme === 'desert-run' ? [15, 40]
    : theme === 'volcanic-run' ? [25, 60] : theme === 'coastal-island-run' ? [35, 75]
      : theme === 'mountain-valley-run' ? [45, 100] : [55, 100]
  const gateCount = band[0]! + Math.floor(random() * (band[1]! - band[0]! + 1))
  // Route-only revision. Keep landscape generation and b20 physics unchanged.
  terrain.routeRevision += 10
  // A stadium corridor replaces the two sharp reversals of the old circuit.
  // Its envelope still comes from each theme's seeded width/reach recipe.
  const hand = offsets[1]![0] < 0 ? -1 : 1
  const width = Math.abs(offsets[1]![0]), radius = width / 2
  const departure = offsets[0]![1], top = offsets[1]![1]
  const bottom = offsets[3]![1], final = offsets[4]![1]
  const arcHeight = Math.max(radius, Math.min(top - departure, radius * 1.5))
  const returnForward = Math.min(bottom + radius, final - 600)
  const local: { right: number; forward: number; height: number }[] = []
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
  const anchors = local.map(({ right, forward, height }) => ({
    x: start.x + Math.cos(start.yaw) * right + Math.sin(start.yaw) * forward,
    y: start.y + height,
    z: start.z - Math.sin(start.yaw) * right + Math.cos(start.yaw) * forward,
  }))
  const course = distributeMissionGates(anchors, gateCount - 1, false)
  // Reserve the final two aligned gates even at the sparsest count.
  course.push({ x: start.x + Math.sin(start.yaw) * final,
    y: start.y + heights[4]!, z: start.z + Math.cos(start.yaw) * final })
  return { seed: normalized, theme, profile: theme === 'desert-run' ? 'generated-desert' : theme === 'coastal-island-run' ? 'generated-coastal' : theme === 'volcanic-run' ? 'generated-volcanic' : theme === 'waterway-run' ? 'generated-waterway' : 'generated-valley', terrain, start: { ...start, x: start.x - Math.sin(start.yaw) * 45, y: start.y + flightConfig.gearHeight, z: start.z - Math.cos(start.yaw) * 45 },
    landingRunway: { ...start, length: 120, width: 18 }, course,
    goals: { gates: gateCount, landingRequired: true, scoring: 'existing-medals', referenceSpeed: 150 } }
}
