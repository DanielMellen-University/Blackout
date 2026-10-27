import { MIN_MISSION_GATES } from './MissionGates'
import { generateLegacyMission, legacyGeneratedRecordId, legacyTerrainTheme } from './LegacyMissionGenerator'
import type { MissionTheme } from '../world/TerrainProfile'
import type { MissionRouteModifier } from './Mission'
import { normalizeWorldSeed } from '../core/WorldSeed'
import { generatedThemeForProfile } from '../world/TerrainProfile'
import { generateMission } from './MissionGenerator'
import { FLIGHT_REVISION_TAG, flightRecordId } from '../core/FlightRevision'
import type { MissionRouteProfile } from './Mission'
import type { WeatherId, WindSide } from '../world/WeatherDirector'

export const COURSE_SELECTION_STORAGE_KEY = 'blackout.course-selection'
export const RANDOM_COURSE_RUN_ID = flightRecordId('random-world')

interface CourseDefinitionShape {
  id: string
  label: string
  detail: string
  seed: number | null
  profile: MissionRouteProfile | null
  /** Existing terrain recipe, separate from the gameplay profile. */
  terrainTheme?: MissionTheme
  /** Original fixed-seed scoring modifier retained when the world moves. */
  missionModifier?: MissionRouteModifier
  /** Objective-selection seed retained independently of the flight seed. */
  contractSeed?: number
  /** Optional deterministic weather override for authored challenge worlds. */
  weather?: WeatherId
  /** Optional deterministic weather target that begins a visible front transition. */
  weatherShift?: WeatherId
  /** Optional normalized time-of-day override, where 0 and 1 are midnight. */
  timeOfDay?: number
  /** Optional runway-relative wind side for authored approach pressure. */
  windSide?: WindSide
  /** Use the expanded catalog contract pool for a deliberately themed course. */
  contractCatalog?: boolean
  /** Run the gates without a sortie contract. */
  gatesOnly?: boolean
  /** Resolve this entry from the UTC day instead of keeping one fixed seed. */
  daily?: boolean
  /** Resolve this entry from the current UTC week instead of keeping one fixed seed. */
  weekly?: boolean
  /** Resolve this entry from the current UTC month instead of keeping one fixed seed. */
  monthly?: boolean
}

export const DAILY_OPS_COURSE_ID = 'daily-ops' as const
export const WEEKLY_OPS_COURSE_ID = 'weekly-ops' as const
export const MONTHLY_OPS_COURSE_ID = 'monthly-ops' as const
const DAILY_OPS_DAY_MS = 86_400_000
const DAILY_OPS_EPOCH_MS = Date.UTC(2025, 0, 1)
const WEEKLY_OPS_WEEK_MS = 7 * DAILY_OPS_DAY_MS
const WEEKLY_OPS_EPOCH_MS = Date.UTC(2025, 0, 6)
const MONTHLY_OPS_EPOCH_MS = Date.UTC(2025, 0, 1)
const MONTHLY_OPS_MAX_DATE_MS = 8.64e15
const DAILY_OPS_PROFILES: readonly MissionRouteProfile[] = [
  'sweep',
  'slalom',
  'ridge',
  'canyon',
  'coast',
  'river',
  'alpine',
  'storm',
  'night',
  'timber',
  'mesa',
  'swamp',
  'archipelago',
  'thermal',
] as const
const DAILY_OPS_WEATHER: readonly WeatherId[] = [
  'clear',
  'cloudy',
  'fog',
  'rain',
  'storm',
  'snow',
] as const
const WEEKLY_OPS_PROFILES: readonly MissionRouteProfile[] = [
  'sweep',
  'ridge',
  'coast',
  'fjord',
  'volcanic',
  'alpine',
  'canyon',
  'mesa',
  'badlands',
  'tundra',
  'archipelago',
  'thermal',
] as const
const WEEKLY_OPS_WEATHER: readonly WeatherId[] = [
  'clear',
  'cloudy',
  'fog',
  'rain',
  'storm',
  'snow',
] as const
const MONTHLY_OPS_PROFILES: readonly MissionRouteProfile[] = [
  'ridge', 'fjord', 'volcanic', 'alpine', 'canyon', 'mesa', 'badlands', 'archipelago', 'thermal', 'storm',
] as const
const MONTHLY_OPS_WEATHER: readonly WeatherId[] = [
  'clear', 'cloudy', 'fog', 'rain', 'storm', 'snow',
] as const

/** Small curated set of repeatable seeds, plus the normal infinite random mode. */
export const COURSE_LIBRARY = [
  {
    id: 'random',
    label: 'Random world',
    detail: 'New terrain and route every time',
    seed: null,
    profile: null,
  },
  {
    id: 'desert-run', label: 'Desert run',
    detail: 'A new seeded desert world. Race 15 to 100 low gates through dunes and dry washes, finishing at the final gate.',
    seed: null, profile: 'generated-desert', weather: 'clear', timeOfDay: .46,
  },
  {
    id: 'mountain-valley-run', label: 'Mountain valley run',
    detail: 'A new seeded giant valley between immense mountains. Thread 15 to 100 gates along the wide valley floor, finishing at the final gate.',
    seed: null, profile: 'generated-valley', weather: 'clear', timeOfDay: .5,
  },
  {
    id: 'coastal-island-run', label: 'Coastal island run',
    detail: 'Follow 15 to 100 gates along beaches and sea cliffs, cross open island channels, finishing at the final gate.',
    seed: null, profile: 'generated-coastal', weather: 'clear', timeOfDay: .48,
  },
  {
    id: 'generated-volcanic-run', label: 'Volcanic run (generated)',
    detail: 'Thread 15 to 100 gates between giant volcanic cones, dark lava fields and calderas, finishing at the final gate.',
    seed: null, profile: 'generated-volcanic', weather: 'clear', timeOfDay: .44,
  },
  {
    id: 'waterway-run', label: 'Waterway',
    detail: 'Fly 15 to 100 gates along inland river valleys and lake channels, finishing at the final gate.',
    seed: null, profile: 'generated-waterway', weather: 'clear', timeOfDay: .48,
  },
  {
    id: 'free-flight',
    label: 'Free flight',
    detail: 'Explore freely. Land and take off again whenever you like.',
    seed: null,
    profile: 'free',
  },
  {
    id: DAILY_OPS_COURSE_ID,
    label: 'Daily challenge',
    detail: 'A shared daily mission',
    seed: null,
    profile: null,
    contractCatalog: true,
    daily: true,
  },
  {
    id: WEEKLY_OPS_COURSE_ID,
    label: 'Weekly ops',
    detail: 'One shared route, refreshed every Monday',
    seed: null,
    profile: null,
    contractCatalog: true,
    weekly: true,
  },
  {
    id: MONTHLY_OPS_COURSE_ID,
    label: 'Monthly ops',
    detail: 'One shared route, refreshed on the first of each month',
    seed: null,
    profile: null,
    contractCatalog: true,
    monthly: true,
  },
  {
    id: 'training-orbit',
    label: 'Training orbit',
    detail: 'Gentle circuit and approach practice',
    seed: 1,
    profile: 'orbit',
    weather: 'clear',
    timeOfDay: 0.5,
  },
  {
    id: 'contour-circuit',
    label: 'Contour circuit',
    detail: 'Follow 15 to 100 terrain-shaped gates, beat the clock, and finish at the final gate. Replay a seed to race your best.',
    seed: 42,
    profile: 'contour',
    weather: 'clear',
    timeOfDay: 0.5,
  },
  {
    id: 'weather-approach',
    gatesOnly: true,
    label: 'Weather circuit',
    detail: 'Fly a seeded gate circuit through cloud or rain. Replay your seed to beat your medal and time.',
    seed: 619,
    profile: 'weather',
    timeOfDay: 0.48,
  },
  {
    id: 'range-sweep',
    label: 'Range sweep',
    detail: 'Wide route with long turns',
    seed: 2,
    profile: 'sweep',
  },
  {
    id: 'precision-slalom',
    label: 'Precision slalom',
    detail: 'Small gates and demanding lines along a mountain valley circuit',
    seed: 3,
    profile: 'slalom',
  },
  {
    id: 'ridge-run',
    label: 'Ridge run',
    detail: 'Valley-floor circuit beneath high mountain shoulders',
    seed: 4,
    profile: 'ridge',
  },
  {
    id: 'canyon-run',
    label: 'Canyon run',
    detail: 'Low circuit along the wide mountain valley floor',
    seed: 5,
    profile: 'canyon',
  },
  {
    id: 'coastal-run',
    label: 'Coastal run',
    detail: 'Low sweeping line along changing shores',
    seed: 6,
    profile: 'coast',
  },
  {
    id: 'fjord-run',
    label: 'Coastal channel run',
    detail: 'Fog-lined island circuit over coastal channels',
    seed: 13,
    profile: 'fjord',
    weather: 'fog',
  },
  {
    id: 'river-run',
    label: 'River run',
    detail: 'Meandering low line through inland water country',
    seed: 7,
    profile: 'river',
  },
  {
    id: 'volcanic-run',
    label: 'Volcanic run',
    detail: 'Circuit of 15 to 100 gates between volcanic cones and dark lava fields',
    seed: 8,
    profile: 'volcanic',
  },
  {
    id: 'volcanic-ops',
    label: 'Volcanic ops',
    detail: 'Storm-locked volcanic circuit with a live contract',
    seed: 83,
    profile: 'volcanic',
    weather: 'storm',
    contractCatalog: true,
  },
  {
    id: 'rift-ops',
    label: 'Rift ops',
    detail: 'Fog-bound mountain valley circuit with a live contract',
    seed: 611,
    profile: 'canyon',
    weather: 'fog',
    contractCatalog: true,
  },
  {
    id: 'desert-dash',
    label: 'Desert dash',
    detail: 'Fast low-level line across wide dry basins',
    seed: 9,
    profile: 'desert',
  },
  {
    id: 'alpine-pass',
    label: 'Alpine pass',
    detail: 'Valley-floor circuit beneath alpine mountain shoulders',
    seed: 12,
    profile: 'alpine',
  },
  {
    id: 'storm-run',
    label: 'Storm run',
    detail: 'Low-visibility thunderstorm circuit through the mountain valley',
    seed: 10,
    profile: 'storm',
    weather: 'storm',
  },
  {
    id: 'night-ops',
    label: 'Night ops',
    detail: 'Low-level fog circuit under a repeatable night sky',
    seed: 11,
    profile: 'night',
    weather: 'fog',
    timeOfDay: 0.84,
  },
  {
    id: 'aurora-run',
    label: 'Aurora run',
    detail: 'Clear night circuit with green and violet aurora where sky conditions allow',
    seed: 512,
    profile: 'night',
    weather: 'clear',
    timeOfDay: 0.84,
    contractCatalog: true,
  },
  {
    id: 'timberline-run',
    label: 'Valley floor run',
    detail: 'Mountain valley circuit beneath rocky and snow-capped shoulders',
    seed: 15,
    profile: 'timber',
  },
  {
    id: 'glacier-run',
    label: 'Snow valley run',
    detail: 'Snowy circuit along the mountain valley floor',
    seed: 16,
    profile: 'glacier',
    weather: 'snow',
  },
  {
    id: 'frostline-ops',
    label: 'Snow valley ops',
    detail: 'Snowy mountain valley circuit with a live contract',
    seed: 902,
    profile: 'glacier',
    weather: 'snow',
    contractCatalog: true,
  },
  {
    id: 'rainforest-run',
    label: 'Rainy valley run',
    detail: 'Rainy circuit along the mountain valley floor',
    seed: 17,
    profile: 'rainforest',
    weather: 'rain',
  },
  {
    id: 'mesa-run',
    label: 'Mesa run',
    detail: 'Desert circuit between dunes and eroded mesa shelves',
    seed: 18,
    profile: 'mesa',
  },
  {
    id: 'badlands-run',
    label: 'Badlands run',
    detail: 'Desert circuit past eroded shelves and dry washes',
    seed: 26,
    profile: 'badlands',
  },
  {
    id: 'saltflat-run',
    label: 'Desert basin run',
    detail: 'Circuit of 15 to 100 gates over a dry desert basin',
    seed: 21,
    profile: 'saltflat',
  },
  {
    id: 'savanna-run',
    label: 'Desert sweep',
    detail: 'Low circuit through desert dunes and dry washes',
    seed: 22,
    profile: 'savanna',
  },
  {
    id: 'tundra-run',
    label: 'Snow valley circuit',
    detail: 'Snowy low-level circuit beneath mountain shoulders',
    seed: 23,
    profile: 'tundra',
    weather: 'snow',
  },
  {
    id: 'tundra-ops',
    label: 'Snow valley contract',
    detail: 'Snowy valley circuit with a live cold-weather contract',
    seed: 931,
    profile: 'tundra',
    weather: 'snow',
    contractCatalog: true,
  },
  {
    id: 'swamp-run',
    label: 'Coastal rain run',
    detail: 'Rainy circuit across island channels and low coastal shores',
    seed: 24,
    profile: 'swamp',
    weather: 'rain',
  },
  {
    id: 'monsoon-run',
    label: 'Monsoon run',
    detail: 'Rainy floodplain circuit crossing an inland river and lake',
    seed: 54,
    profile: 'monsoon',
    weather: 'rain',
    contractCatalog: true,
  },
  {
    id: 'archipelago-run',
    label: 'Archipelago run',
    detail: 'Island-hopping route over broken seas and low shores',
    seed: 25,
    profile: 'archipelago',
    weather: 'fog',
  },
  {
    id: 'thermal-run',
    label: 'Thermal run',
    detail: 'Sunlit circuit along the mountain valley floor',
    seed: 27,
    profile: 'thermal',
    weather: 'clear',
  },
  {
    id: 'pattern-approach',
    gatesOnly: true,
    label: 'Desert circuit',
    detail: 'Follow the gates around a clear desert circuit',
    seed: 28,
    profile: 'approach',
    weather: 'clear',
  },
  {
    id: 'crosswind-approach',
    gatesOnly: true,
    label: 'Crosswind circuit',
    detail: 'Follow the gates through a stormy desert circuit',
    seed: 29,
    profile: 'approach',
    weather: 'storm',
    windSide: 'right',
  },
  {
    id: 'traffic-run',
    label: 'Traffic run',
    detail: 'High-speed sweep with a live traffic contract',
    seed: 348,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'waterway-tour',
    label: 'Waterway tour',
    detail: 'Rainy river route with a multi-waterway contract',
    seed: 54,
    profile: 'river',
    weather: 'rain',
    contractCatalog: true,
  },
  {
    id: 'thermal-surf',
    label: 'Thermal surf',
    detail: 'Sunlit lift route with a sustained thermal contract',
    seed: 80,
    profile: 'thermal',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'high-dive',
    label: 'High dive',
    detail: 'Clear valley circuit with an altitude-and-recovery-dive contract',
    seed: 102,
    profile: 'alpine',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'water-skim',
    label: 'Water skim',
    detail: 'Coastal low pass with a precise water-skimming contract',
    seed: 121,
    profile: 'coast',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'ridge-trial',
    label: 'Ridge trial',
    detail: 'Controlled low pass through high-relief terrain with a ridge contract',
    seed: 115,
    profile: 'ridge',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'traffic-dodge',
    label: 'Traffic dodge',
    detail: 'Open high-speed sweep with a vertical-separation traffic contract',
    seed: 31,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'precision-landing',
    gatesOnly: true,
    label: 'Precision circuit',
    detail: 'Fly a clear desert gate circuit with precision',
    seed: 127,
    profile: 'approach',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'combo-run',
    label: 'Combo run',
    detail: 'Clear valley circuit with precision gates and a gate-and-stunt combo contract',
    seed: 394,
    profile: 'slalom',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'night-flight',
    label: 'Night flight',
    detail: 'Foggy night circuit with a sustained after-dark contract',
    seed: 463,
    profile: 'night',
    weather: 'fog',
    timeOfDay: 0.84,
    contractCatalog: true,
  },
  {
    id: 'radar-run',
    label: 'Radar run',
    detail: 'Open route with a locked settlement-arrival radar contract',
    seed: 113,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'precision-chain',
    label: 'Precision chain',
    detail: 'Clear valley circuit with three consecutive perfect precision gates',
    seed: 45,
    profile: 'slalom',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'butter-landing',
    gatesOnly: true,
    label: 'Smooth circuit',
    detail: 'Fly a smooth line through a clear desert gate circuit',
    seed: 222,
    profile: 'approach',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'dry-run',
    label: 'Dry run',
    detail: 'Clear high-speed sweep with a no-afterburner energy contract',
    seed: 63,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'gust-rider',
    label: 'Gust rider',
    detail: 'Storm route with a strong-wind handling contract',
    seed: 361,
    profile: 'storm',
    weather: 'storm',
    contractCatalog: true,
  },
  {
    id: 'range-run',
    label: 'Range run',
    detail: 'Long clear sweep with a sustained-distance contract',
    seed: 417,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'settlement-tour',
    label: 'Settlement tour',
    detail: 'Clear valley circuit with a city-and-village tour contract',
    seed: 76,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'airshow-run',
    label: 'Airshow run',
    detail: 'Clear valley circuit with precision gates and a barrel-roll stunt contract',
    seed: 19,
    profile: 'slalom',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'biome-tour',
    label: 'Biome tour',
    detail: 'Clear valley circuit with a four-biome exploration contract',
    seed: 42,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'scout-run',
    label: 'Scout run',
    detail: 'Clear valley circuit with a multiple-settlement exploration contract',
    seed: 32,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'skyline-run',
    label: 'Skyline run',
    detail: 'Clear valley circuit with a high-altitude contract',
    seed: 33,
    profile: 'alpine',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'speed-run',
    label: 'Speed run',
    detail: 'Clear high-speed sweep with a speed-run contract',
    seed: 20,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'terrain-hugger',
    label: 'Terrain hugger',
    detail: 'Clear valley circuit with a low-radio-altitude contract',
    seed: 46,
    profile: 'canyon',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'fuel-saver',
    label: 'Fuel saver',
    detail: 'Clear sweep with a reserve-fuel contract',
    seed: 38,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'energy-run',
    label: 'Energy run',
    detail: 'Clear sweep with an efficient cruise-speed contract',
    seed: 51,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'storm-contract',
    label: 'Storm contract',
    detail: 'Storm route with a sustained precipitation contract',
    seed: 69,
    profile: 'storm',
    weather: 'storm',
    contractCatalog: true,
  },
  {
    id: 'crosswind-run',
    label: 'Crosswind run',
    detail: 'Storm-locked pattern with a runway-relative crosswind contract',
    seed: 216,
    profile: 'approach',
    weather: 'storm',
    windSide: 'right',
    contractCatalog: true,
  },
  {
    id: 'mach-run',
    label: 'Mach run',
    detail: 'Clear high-speed sweep with a sustained supersonic contract',
    seed: 57,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'burn-run',
    label: 'Burn run',
    detail: 'Clear high-speed sweep with a sustained afterburner contract',
    seed: 30,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'g-control-run',
    label: 'G-control run',
    detail: 'Clear valley circuit with precision gates and a bounded high-G contract',
    seed: 247,
    profile: 'slalom',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'deadstick-run',
    label: 'Deadstick run',
    detail: 'Desert sweep with a fuel-out glide contract',
    seed: 99,
    profile: 'desert',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'clean-circuit-run',
    label: 'Clean circuit run',
    detail: 'Desert sweep with a no-miss gate contract',
    seed: 9,
    profile: 'desert',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'level-flight-run',
    label: 'Level flight run',
    detail: 'Clear sweep with a steady-altitude contract',
    seed: 320,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'water-run',
    label: 'Water run',
    detail: 'Rainy coastal circuit with a sustained water-flight contract',
    seed: 4,
    profile: 'river',
    weather: 'rain',
    contractCatalog: true,
  },
  {
    id: 'brake-check-run',
    label: 'Brake check run',
    detail: 'Clear high-speed sweep with a speed-brake contract',
    seed: 47,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'thermal-control-run',
    label: 'Thermal control run',
    detail: 'Clear alpine route with a cool-engine cruise contract',
    seed: 2,
    profile: 'alpine',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'front-chaser-run',
    label: 'Front chaser run',
    detail: 'Rain-to-storm sweep with a weather-front contract',
    seed: 259,
    profile: 'storm',
    weather: 'rain',
    weatherShift: 'storm',
    contractCatalog: true,
  },
  {
    id: 'shoreline-run',
    label: 'Shoreline run',
    detail: 'Fog-lined coastal sweep with a landmark contract',
    seed: 30,
    profile: 'coast',
    weather: 'fog',
    contractCatalog: true,
  },
] as const satisfies readonly CourseDefinitionShape[]

/** Keep the public ID type tied to the authored runtime catalog. */
export type CourseId = typeof COURSE_LIBRARY[number]['id']
export type CourseDefinition = CourseDefinitionShape & { id: CourseId }
const COURSE_ID_SET = new Set<string>(COURSE_LIBRARY.map(course => course.id))

/** Normalize persisted or external course IDs before they enter launch state. */
export function normalizeCourseId(value: unknown, fallback: CourseId = 'random'): CourseId {
  const candidate = typeof value === 'string' && COURSE_ID_SET.has(value)
    ? value
    : fallback
  return typeof candidate === 'string' && COURSE_ID_SET.has(candidate)
    ? candidate as CourseId
    : 'random'
}

export function courseDefinitionForId(id: string | null | undefined): CourseDefinition {
  return COURSE_LIBRARY.find((course) => course.id === id) ?? COURSE_LIBRARY[0]!
}

/** Stable UTC key used by Daily Ops records and the launch card. */
export function dailyOpsDayKey(nowMs = Date.now()): string {
  const safeNow = Number.isFinite(nowMs) ? nowMs : DAILY_OPS_EPOCH_MS
  const dayIndex = Math.floor((safeNow - DAILY_OPS_EPOCH_MS) / DAILY_OPS_DAY_MS)
  const day = new Date(DAILY_OPS_EPOCH_MS + dayIndex * DAILY_OPS_DAY_MS)
  return day.toISOString().slice(0, 10)
}

/** Stable ISO week key used by Weekly Ops records and replay links. */
export function weeklyOpsWeekKey(nowMs = Date.now()): string {
  const safeNow = Number.isFinite(nowMs) ? nowMs : WEEKLY_OPS_EPOCH_MS
  const date = new Date(safeNow)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const year = date.getUTCFullYear()
  const yearStart = Date.UTC(year, 0, 1)
  const week = Math.ceil((((date.getTime() - yearStart) / DAILY_OPS_DAY_MS) + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Parse a replayed UTC day without allowing malformed dates to alter a launch. */
export function dailyOpsTimestampForDayKey(dayKey: string | null | undefined): number | null {
  if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null
  const timestamp = Date.parse(`${dayKey}T12:00:00.000Z`)
  if (!Number.isFinite(timestamp) || dailyOpsDayKey(timestamp) !== dayKey) return null
  return timestamp
}

/** Parse a replayed ISO week without allowing malformed dates to alter a launch. */
export function weeklyOpsTimestampForWeekKey(weekKey: string | null | undefined): number | null {
  const match = typeof weekKey === 'string' ? /^(\d{4})-W(\d{2})$/.exec(weekKey) : null
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) return null
  const janFourth = Date.UTC(year, 0, 4)
  const janFourthDay = new Date(janFourth).getUTCDay() || 7
  const monday = janFourth - (janFourthDay - 1) * DAILY_OPS_DAY_MS + (week - 1) * WEEKLY_OPS_WEEK_MS
  const timestamp = monday + 12 * 60 * 60 * 1000
  if (!Number.isFinite(timestamp) || weeklyOpsWeekKey(timestamp) !== weekKey) return null
  return timestamp
}

/** Stable UTC month key used by Monthly Ops records and replay links. */
export function monthlyOpsMonthKey(nowMs = Date.now()): string {
  const safeNow = monthlyOpsSafeTimestamp(nowMs)
  const date = new Date(safeNow)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Parse a replayed UTC month without allowing malformed dates to alter a launch. */
export function monthlyOpsTimestampForMonthKey(monthKey: string | null | undefined): number | null {
  if (typeof monthKey !== 'string' || !/^(\d{4})-(\d{2})$/.test(monthKey)) return null
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey)
  const year = Number(match?.[1])
  const month = Number(match?.[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  const timestamp = Date.UTC(year, month - 1, 15, 12)
  return Number.isFinite(timestamp) && monthlyOpsMonthKey(timestamp) === monthKey ? timestamp : null
}

/** Generate a bounded integer seed shared by everyone on the same UTC day. */
export function dailyOpsSeed(nowMs = Date.now()): number {
  const safeNow = Number.isFinite(nowMs) ? nowMs : DAILY_OPS_EPOCH_MS
  const dayIndex = Math.floor((safeNow - DAILY_OPS_EPOCH_MS) / DAILY_OPS_DAY_MS)
  const mixed = Math.imul((dayIndex ^ 0x9e3779b9) | 0, 1_664_525) + 1_013_904_223
  return 1_000 + ((mixed >>> 0) % 900_000)
}

/** Keep the daily route family deterministic while rotating through distinct handling shapes. */
export function dailyOpsProfile(nowMs = Date.now()): MissionRouteProfile {
  const safeNow = Number.isFinite(nowMs) ? nowMs : DAILY_OPS_EPOCH_MS
  const dayIndex = Math.floor((safeNow - DAILY_OPS_EPOCH_MS) / DAILY_OPS_DAY_MS)
  const mixed = Math.imul((dayIndex ^ 0x85ebca6b) | 0, 2_246_822_519) >>> 0
  return DAILY_OPS_PROFILES[mixed % DAILY_OPS_PROFILES.length]!
}

/** Generate a bounded integer seed shared by everyone in the same UTC week. */
export function weeklyOpsSeed(nowMs = Date.now()): number {
  const safeNow = Number.isFinite(nowMs) ? nowMs : WEEKLY_OPS_EPOCH_MS
  const weekIndex = Math.floor((safeNow - WEEKLY_OPS_EPOCH_MS) / WEEKLY_OPS_WEEK_MS)
  const mixed = Math.imul((weekIndex ^ 0x7f4a7c15) | 0, 1_103_515_245) + 12_345_679
  return 1_000 + ((mixed >>> 0) % 900_000)
}

/** Keep the weekly route family distinct from Daily Ops while rotating through the larger terrain envelope. */
export function weeklyOpsProfile(nowMs = Date.now()): MissionRouteProfile {
  const safeNow = Number.isFinite(nowMs) ? nowMs : WEEKLY_OPS_EPOCH_MS
  const weekIndex = Math.floor((safeNow - WEEKLY_OPS_EPOCH_MS) / WEEKLY_OPS_WEEK_MS)
  const mixed = Math.imul((weekIndex ^ 0x9e3779b9) | 0, 2_654_435_761) >>> 0
  return WEEKLY_OPS_PROFILES[mixed % WEEKLY_OPS_PROFILES.length]!
}

/** Generate a bounded integer seed shared by everyone in the same UTC month. */
export function monthlyOpsSeed(nowMs = Date.now()): number {
  const safeNow = monthlyOpsSafeTimestamp(nowMs)
  const date = new Date(safeNow)
  const monthIndex = (date.getUTCFullYear() - 2025) * 12 + date.getUTCMonth()
  const mixed = Math.imul((monthIndex ^ 0x243f6a88) | 0, 1_664_525) + 1_013_904_223
  return 1_000 + ((mixed >>> 0) % 900_000)
}

/** Keep Monthly Ops on the broader high-relief route pool. */
export function monthlyOpsProfile(nowMs = Date.now()): MissionRouteProfile {
  const safeNow = monthlyOpsSafeTimestamp(nowMs)
  const date = new Date(safeNow)
  const monthIndex = (date.getUTCFullYear() - 2025) * 12 + date.getUTCMonth()
  const mixed = Math.imul((monthIndex ^ 0x13198a2e) | 0, 2_246_822_519) >>> 0
  return MONTHLY_OPS_PROFILES[mixed % MONTHLY_OPS_PROFILES.length]!
}

function monthlyOpsSafeTimestamp(nowMs: number): number {
  return Number.isFinite(nowMs) && Math.abs(nowMs) <= MONTHLY_OPS_MAX_DATE_MS
    ? nowMs
    : MONTHLY_OPS_EPOCH_MS
}

/** Resolve a catalog entry for this launch, expanding the rotating Ops entries. */
function resolveOriginalCourseDefinition(
  course: CourseDefinition,
  nowMs = Date.now(),
): CourseDefinition {
  if (course.id === 'weather-approach') return resolveWeatherApproach(course)
  if (course.daily) {
    const seed = dailyOpsSeed(nowMs)
    const profile = dailyOpsProfile(nowMs)
    const weather = DAILY_OPS_WEATHER[seed % DAILY_OPS_WEATHER.length]!
    const timeOfDay = profile === 'night' ? 0.84 : undefined
    return {
      ...course,
      detail: `${course.detail} · ${dailyOpsDayKey(nowMs)}`,
      seed,
      profile,
      weather,
      timeOfDay,
    }
  }
  if (course.weekly) {
    const seed = weeklyOpsSeed(nowMs)
    const profile = weeklyOpsProfile(nowMs)
    const weather = WEEKLY_OPS_WEATHER[seed % WEEKLY_OPS_WEATHER.length]!
    const timeOfDay = profile === 'night' ? 0.84 : undefined
    return {
      ...course,
      detail: `${course.detail} · ${weeklyOpsWeekKey(nowMs)}`,
      seed,
      profile,
      weather,
      timeOfDay,
    }
  }
  if (!course.monthly) return course
  const seed = monthlyOpsSeed(nowMs)
  const profile = monthlyOpsProfile(nowMs)
  const weather = MONTHLY_OPS_WEATHER[seed % MONTHLY_OPS_WEATHER.length]!
  const timeOfDay = profile === 'night' ? 0.84 : undefined
  return {
    ...course,
    detail: `${course.detail} · ${monthlyOpsMonthKey(nowMs)}`,
    seed,
    profile,
    weather,
    timeOfDay,
  }
}

/** Approved existing-mission migration, excluding unsupported terrain objectives. */
export function isLegacyGeneratedCourse(course: CourseDefinition): boolean {
  if (course.id === 'random' || course.profile === 'free') return false
  return course.terrainTheme !== undefined ||
    legacyTerrainTheme({ ...course, profile: course.profile ?? 'sweep' }) !== null
}

/** A fresh world has no exact count until launch resolves its seed. */
export function courseGateCountPreview(course: CourseDefinition): number | null {
  if (course.profile === 'free') return 0
  if (course.seed === null || course.profile === null) return null
  const theme = course.terrainTheme ?? generatedThemeForProfile(course.profile) ?? legacyTerrainTheme(course)
  return theme ? generateMission(course.seed, theme, course.profile === 'orbit').goals.gates : MIN_MISSION_GATES
}

/** Keep catalog identity settings distinct from the per-flight world seed. */
export function resolveCourseDefinition(course: CourseDefinition, nowMs = Date.now()): CourseDefinition {
  if (course.terrainTheme) return course
  const original = resolveOriginalCourseDefinition(course, nowMs)
  if (!isLegacyGeneratedCourse(original)) return original
  const adapted = generateLegacyMission(original, original.seed!)!
  return { ...original, seed: original.daily || original.weekly || original.monthly ? original.seed : null,
    terrainTheme: adapted.spec.theme, missionModifier: adapted.modifier, contractSeed: adapted.contractSeed }
}

/** Existing weather fields and runway-relative wind, resolved once for a seeded sortie. */
function resolveWeatherApproach(course: CourseDefinition): CourseDefinition {
  const seed = course.seed ?? 619
  const variant = ((seed % 3) + 3) % 3
  const weather: WeatherId = variant === 0 ? 'cloudy' : variant === 1 ? 'rain' : 'fog'
  return { ...course, weather, windSide: seed % 2 === 0 ? 'left' : 'right' }
}

/** Keep explicit seed replay in the existing selection and bounded record family. */
export function resolveCourseReplaySeed(course: CourseDefinition, seed: number | null): CourseDefinition {
  const resolved = isLegacyGeneratedCourse(course) ? resolveCourseDefinition(course) : course
  if (seed === null || normalizeWorldSeed(seed) === null) return resolved
  if (resolved.terrainTheme) {
    if (resolved.daily || resolved.weekly || resolved.monthly) return resolved
    return { ...resolved, seed }
  }
  if ((course.id !== 'contour-circuit' && course.id !== 'weather-approach' && !generatedThemeForProfile(course.profile)) ||
    (!generatedThemeForProfile(course.profile) && !Number.isSafeInteger(seed))) return course
  const replay = { ...course, seed, detail: `${course.detail} · SEED ${seed}` }
  return course.id === 'weather-approach' ? resolveWeatherApproach(replay) : replay
}

export function courseSeedForId(id: string | null | undefined, nowMs = Date.now()): number | undefined {
  const seed = resolveCourseDefinition(courseDefinitionForId(id), nowMs).seed
  return seed === null ? undefined : seed
}

/** Storage identity shared by the score, trace, and completion-history records. */
export function courseRunId(course: CourseDefinition, nowMs = Date.now()): string | null {
  const resolved = resolveCourseDefinition(course, nowMs)
  if (resolved.seed === null || resolved.profile === null) return null
  const periodSuffix = course.daily
    ? `:daily:${dailyOpsDayKey(nowMs)}`
    : course.weekly
      ? `:weekly:${weeklyOpsWeekKey(nowMs)}`
      : course.monthly
        ? `:monthly:${monthlyOpsMonthKey(nowMs)}`
        : ''
  const migrated = resolved.terrainTheme ? legacyGeneratedRecordId({ ...resolved, seed: resolved.contractSeed! }, resolved.seed) : null
  return `${migrated ?? courseSessionBaseId(resolved.seed, resolved.profile)}${migrated ? '' : courseIdentitySuffix(resolved.id)}${periodSuffix}`
}

/** Keep random sorties bounded while giving explicitly replayed worlds stable identity. */
export function courseSessionId(
  selectedCourseId: CourseId,
  worldSeed: number,
  profile: MissionRouteProfile,
  periodKey?: string,
  seededRandom = false,
): string {
  if (selectedCourseId === 'random') {
    if (!seededRandom) return RANDOM_COURSE_RUN_ID
    const safeSeed = generatedThemeForProfile(profile) ? normalizeWorldSeed(worldSeed) ?? .001 : Number.isFinite(worldSeed) ? Math.trunc(worldSeed) : 0
    return `${courseSessionBaseId(safeSeed, profile)}:custom`
  }
  if (profile === 'free') return flightRecordId('free-flight')
  const safeSeed = generatedThemeForProfile(profile) ? normalizeWorldSeed(worldSeed) ?? .001 : Number.isFinite(worldSeed) ? Math.trunc(worldSeed) : 0
  const period = selectedCourseId === DAILY_OPS_COURSE_ID
    ? 'daily'
    : selectedCourseId === WEEKLY_OPS_COURSE_ID
      ? 'weekly'
      : selectedCourseId === MONTHLY_OPS_COURSE_ID
        ? 'monthly'
        : ''
  const periodSuffix = period && periodKey
    ? `:${period}:${periodKey}`
    : ''
  const definition = courseDefinitionForId(selectedCourseId)
  const migrated = isLegacyGeneratedCourse(definition)
    ? legacyGeneratedRecordId({ ...definition, seed: definition.seed ?? safeSeed, profile }, normalizeWorldSeed(worldSeed) ?? .001) : null
  return `${migrated ?? courseSessionBaseId(safeSeed, profile)}${migrated ? '' : courseIdentitySuffix(selectedCourseId)}${periodSuffix}`
}

/** Keep authored records stable while separating the one legacy key collision. */
function courseSessionBaseId(seed: number, profile: MissionRouteProfile): string {
  const theme = generatedThemeForProfile(profile)
  const spec = theme ? generateMission(seed, theme) : null
  const revision = spec ? `:l${spec.terrain.landscapeRevision}:q${spec.terrain.routeRevision}` : ''
  return (spec ? `seed:${spec.seed}:${profile}:${FLIGHT_REVISION_TAG}` : flightRecordId(`seed:${seed}:${profile}`)) + revision
}

function courseIdentitySuffix(id: CourseId): string {
  // Clean Circuit originally reused Desert Dash's seed/profile pair. Its
  // contract and route are distinct, so scores, history, and ghosts must not
  // bleed between the two entries. Leave every other historical key intact.
  return id === 'clean-circuit-run' ? ':clean-circuit' : ''
}

export function readSelectedCourseId(
  storage: Pick<Storage, 'getItem'> | null,
  fallback: CourseId = 'random',
): CourseId {
  const safeFallback = normalizeCourseId(fallback)
  try {
    const stored = storage?.getItem(COURSE_SELECTION_STORAGE_KEY)
    if (stored === null || stored === undefined) return safeFallback
    return normalizeCourseId(stored, safeFallback)
  } catch {
    return safeFallback
  }
}

export function writeSelectedCourseId(
  storage: Pick<Storage, 'setItem'> | null,
  id: CourseId,
): void {
  try {
    storage?.setItem(COURSE_SELECTION_STORAGE_KEY, normalizeCourseId(id))
  } catch {
    // Private browsing/storage denial should never block course selection.
  }
}

/** A selection update from another tab invalidates any in-memory seed identity. */
export function shouldResetSeededRandomWorldForStorageKey(key: string | null): boolean {
  return key === null || key === COURSE_SELECTION_STORAGE_KEY
}

/** Contract seed for a course, or undefined when its gates are the only objective. */
export function courseContractSeed(course: CourseDefinition, fallback?: number): number | undefined {
  return course.gatesOnly ? undefined : course.contractSeed ?? course.seed ?? fallback
}
