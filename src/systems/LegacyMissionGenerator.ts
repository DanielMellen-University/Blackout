import { generateMission, type GeneratedMissionSpec } from './MissionGenerator'
import type { CourseDefinition } from './CourseLibrary'
import type { MissionRouteModifier, MissionRouteProfile } from './Mission'
import type { MissionTheme } from '../world/TerrainProfile'
import { FLIGHT_REVISION_TAG } from '../core/FlightRevision'

/** Reuse approved terrain recipes without changing the mission's gameplay profile. */
export const LEGACY_TERRAIN_RECIPES: Partial<Record<MissionRouteProfile, MissionTheme>> = {
  orbit: 'desert-run', contour: 'mountain-valley-run', weather: 'mountain-valley-run',
  sweep: 'mountain-valley-run', slalom: 'mountain-valley-run', ridge: 'mountain-valley-run',
  canyon: 'mountain-valley-run', coast: 'coastal-island-run', fjord: 'coastal-island-run',
  river: 'coastal-island-run', volcanic: 'volcanic-run', desert: 'desert-run',
  alpine: 'mountain-valley-run', storm: 'mountain-valley-run', night: 'mountain-valley-run',
  timber: 'mountain-valley-run', glacier: 'mountain-valley-run', rainforest: 'mountain-valley-run',
  mesa: 'desert-run', badlands: 'desert-run', saltflat: 'desert-run', savanna: 'desert-run',
  tundra: 'mountain-valley-run', swamp: 'coastal-island-run', monsoon: 'coastal-island-run',
  archipelago: 'coastal-island-run', thermal: 'mountain-valley-run', approach: 'desert-run',
}

export const LEGACY_MIGRATION_EXCEPTIONS: Readonly<Record<string, string>> = {
  'waterway-tour': 'Requires two waterway types. Existing generated recipes disable inland hydrology and Coastal island supplies only ocean. Preserve the existing mission until separately approved work can support it.',
}

/** Snapshot of original fixed-seed modifiers, before moving the airfields. */
export const LEGACY_MISSION_MODIFIERS: Readonly<Record<string, MissionRouteModifier>> = {
  'training-orbit': 'steady',
  'contour-circuit': 'tempo',
  'weather-approach': 'altitude',
  'range-sweep': 'tempo',
  'precision-slalom': 'altitude',
  'ridge-run': 'steady',
  'canyon-run': 'steady',
  'coastal-run': 'tempo',
  'fjord-run': 'altitude',
  'river-run': 'tempo',
  'volcanic-run': 'tempo',
  'volcanic-ops': 'tempo',
  'rift-ops': 'tempo',
  'desert-dash': 'tempo',
  'alpine-pass': 'steady',
  'storm-run': 'altitude',
  'night-ops': 'tempo',
  'aurora-run': 'tempo',
  'timberline-run': 'steady',
  'glacier-run': 'tempo',
  'frostline-ops': 'altitude',
  'rainforest-run': 'tempo',
  'mesa-run': 'tempo',
  'badlands-run': 'altitude',
  'saltflat-run': 'altitude',
  'savanna-run': 'steady',
  'tundra-run': 'altitude',
  'tundra-ops': 'altitude',
  'swamp-run': 'steady',
  'monsoon-run': 'altitude',
  'archipelago-run': 'tempo',
  'thermal-run': 'altitude',
  'pattern-approach': 'steady',
  'crosswind-approach': 'steady',
  'traffic-run': 'steady',
  'waterway-tour': 'altitude',
  'thermal-surf': 'tempo',
  'high-dive': 'steady',
  'water-skim': 'tempo',
  'ridge-trial': 'tempo',
  'traffic-dodge': 'altitude',
  'precision-landing': 'tempo',
  'combo-run': 'tempo',
  'night-flight': 'tempo',
  'radar-run': 'tempo',
  'precision-chain': 'altitude',
  'butter-landing': 'tempo',
  'dry-run': 'tempo',
  'gust-rider': 'steady',
  'range-run': 'steady',
  'settlement-tour': 'steady',
  'airshow-run': 'altitude',
  'biome-tour': 'steady',
  'scout-run': 'tempo',
  'skyline-run': 'altitude',
  'speed-run': 'steady',
  'terrain-hugger': 'tempo',
  'fuel-saver': 'tempo',
  'energy-run': 'steady',
  'storm-contract': 'tempo',
  'crosswind-run': 'steady',
  'mach-run': 'tempo',
  'burn-run': 'tempo',
  'g-control-run': 'altitude',
  'deadstick-run': 'tempo',
  'clean-circuit-run': 'tempo',
  'level-flight-run': 'altitude',
  'water-run': 'tempo',
  'brake-check-run': 'tempo',
  'thermal-control-run': 'tempo',
  'front-chaser-run': 'steady',
  'shoreline-run': 'altitude',
}

export interface LegacyGeneratedMission {
  /** Original identity, objectives, weather and contract-selection seed. */
  mission: CourseDefinition
  spec: GeneratedMissionSpec
  modifier: MissionRouteModifier | undefined
  contractSeed: number
}

/** Pure adapter. Activation belongs to the later catalog migration parts. */
export function generateLegacyMission(course: CourseDefinition, flightSeed: number): LegacyGeneratedMission | null {
  if (LEGACY_MIGRATION_EXCEPTIONS[course.id] || !course.profile || course.seed === null) return null
  const theme = LEGACY_TERRAIN_RECIPES[course.profile]
  if (!theme) return null
  const base = generateMission(flightSeed, theme)
  // Separate every migrated route and landscape from both its old records and
  // the four existing theme records. Flight physics retains the b20 revision.
  const spec = { ...base, terrain: { ...base.terrain,
    landscapeRevision: base.terrain.landscapeRevision + 100,
    routeRevision: base.terrain.routeRevision + 100 } }
  return { mission: { ...course }, spec, modifier: LEGACY_MISSION_MODIFIERS[course.id], contractSeed: course.seed }
}

/** Use the existing bounded score/history/ghost record family. */
export function legacyGeneratedRecordId(course: CourseDefinition, flightSeed: number): string | null {
  const adapted = generateLegacyMission(course, flightSeed)
  if (!adapted) return null
  const { spec } = adapted
  return `seed:${spec.seed}:${spec.profile}:${FLIGHT_REVISION_TAG}:l${spec.terrain.landscapeRevision}:q${spec.terrain.routeRevision}:mission:${course.id}`
}
