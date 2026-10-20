import { flightConfig } from '../aircraft/flightConfig'
import { MISSION_THEMES, type MissionTheme, type TerrainProfile } from '../world/TerrainProfile'

export interface GeneratedPoint { x: number; y: number; z: number }
export interface GeneratedMissionSpec {
  seed: number
  theme: MissionTheme
  profile: 'generated-desert' | 'generated-valley' | 'generated-coastal'
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
  if (theme === 'coastal-island-run') {
    terrain.baseHeight = 55; terrain.relief = 520
    terrain.landscapeRevision = 31; terrain.routeRevision = 34
  }
  const start = { x: terrain.originX, y: terrain.baseHeight, z: terrain.originZ, yaw: terrain.yaw }
  const spread = 1350 + random() * 350, length = 3000 + random() * 600
  const offsets = [[0, 1800], [spread, length], [spread, -300], [0, -2600], [0, -1400]] as const
  const course = offsets.map(([right, forward]) => ({
    x: start.x + Math.cos(start.yaw) * right + Math.sin(start.yaw) * forward,
    y: start.y + 145,
    z: start.z - Math.sin(start.yaw) * right + Math.cos(start.yaw) * forward,
  }))
  return { seed: normalized, theme, profile: theme === 'desert-run' ? 'generated-desert' : theme === 'coastal-island-run' ? 'generated-coastal' : 'generated-valley', terrain, start: { ...start, x: start.x - Math.sin(start.yaw) * 45, y: start.y + flightConfig.gearHeight, z: start.z - Math.cos(start.yaw) * 45 },
    landingRunway: { ...start, length: 120, width: 18 }, course,
    goals: { gates: 5, landingRequired: true, scoring: 'existing-medals', referenceSpeed: 150 } }
}
