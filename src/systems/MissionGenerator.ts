import { flightConfig } from '../aircraft/flightConfig'
import { MISSION_THEMES, type MissionTheme, type TerrainProfile } from '../world/TerrainProfile'

export interface GeneratedPoint { x: number; y: number; z: number }
export interface GeneratedMissionSpec {
  seed: number
  theme: MissionTheme
  profile: 'generated-desert' | 'generated-valley' | 'generated-coastal' | 'generated-volcanic'
  terrain: TerrainProfile
  start: GeneratedPoint & { yaw: number }
  landingRunway: GeneratedPoint & { yaw: number; length: number; width: number }
  course: readonly GeneratedPoint[]
  goals: { gates: number; landingRequired: true; scoring: 'existing-medals'; referenceSpeed: number }
}
/** Pure seeded recipe. No mutable world state, clock, random calls or terrain cache. */
export function generateMission(seed: number, requestedTheme?: MissionTheme): GeneratedMissionSpec {
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
  const course = offsets.map(([right, forward], index) => ({
    x: start.x + Math.cos(start.yaw) * right + Math.sin(start.yaw) * forward,
    y: start.y + heights[index]!,
    z: start.z - Math.sin(start.yaw) * right + Math.cos(start.yaw) * forward,
  }))
  return { seed: normalized, theme, profile: theme === 'desert-run' ? 'generated-desert' : theme === 'coastal-island-run' ? 'generated-coastal' : theme === 'volcanic-run' ? 'generated-volcanic' : 'generated-valley', terrain, start: { ...start, x: start.x - Math.sin(start.yaw) * 45, y: start.y + flightConfig.gearHeight, z: start.z - Math.cos(start.yaw) * 45 },
    landingRunway: { ...start, length: 120, width: 18 }, course,
    goals: { gates: 5, landingRequired: true, scoring: 'existing-medals', referenceSpeed: 150 } }
}
