import type { MissionRouteProfile } from './Mission'
import type { WeatherId, WindSide } from '../world/WeatherDirector'

export type CourseId = 'random' | 'free-flight' | 'daily-ops' | 'training-orbit' | 'range-sweep' | 'precision-slalom' | 'ridge-run' | 'canyon-run' | 'coastal-run' | 'fjord-run' | 'river-run' | 'volcanic-run' | 'desert-dash' | 'alpine-pass' | 'storm-run' | 'night-ops' | 'aurora-run' | 'timberline-run' | 'glacier-run' | 'rainforest-run' | 'mesa-run' | 'badlands-run' | 'saltflat-run' | 'savanna-run' | 'tundra-run' | 'swamp-run' | 'monsoon-run' | 'archipelago-run' | 'thermal-run' | 'pattern-approach' | 'crosswind-approach' | 'traffic-run' | 'waterway-tour' | 'thermal-surf' | 'high-dive' | 'water-skim' | 'ridge-trial' | 'traffic-dodge' | 'precision-landing' | 'combo-run' | 'night-flight' | 'radar-run' | 'precision-chain' | 'butter-landing' | 'dry-run' | 'gust-rider' | 'range-run' | 'settlement-tour' | 'airshow-run' | 'biome-tour' | 'scout-run' | 'skyline-run' | 'speed-run' | 'terrain-hugger' | 'fuel-saver' | 'energy-run' | 'storm-contract' | 'crosswind-run' | 'mach-run' | 'burn-run' | 'g-control-run' | 'deadstick-run' | 'clean-circuit-run' | 'level-flight-run' | 'water-run' | 'brake-check-run' | 'thermal-control-run' | 'front-chaser-run' | 'shoreline-run'

export const COURSE_SELECTION_STORAGE_KEY = 'blackout.course-selection'
export const RANDOM_COURSE_RUN_ID = 'random-world'

export interface CourseDefinition {
  id: CourseId
  label: string
  detail: string
  seed: number | null
  profile: MissionRouteProfile | null
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
  /** Resolve this entry from the UTC day instead of keeping one fixed seed. */
  daily?: boolean
}

export const DAILY_OPS_COURSE_ID: CourseId = 'daily-ops'
const DAILY_OPS_DAY_MS = 86_400_000
const DAILY_OPS_EPOCH_MS = Date.UTC(2025, 0, 1)
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

/** Small curated set of repeatable seeds, plus the normal infinite random mode. */
export const COURSE_LIBRARY: readonly CourseDefinition[] = [
  {
    id: 'random',
    label: 'Random world',
    detail: 'New terrain and route every time',
    seed: null,
    profile: null,
  },
  {
    id: 'free-flight',
    label: 'Free flight',
    detail: 'Explore the terrain with no checkpoint clock',
    seed: null,
    profile: 'free',
  },
  {
    id: DAILY_OPS_COURSE_ID,
    label: 'Daily ops',
    detail: 'One shared route, refreshed at UTC midnight',
    seed: null,
    profile: null,
    contractCatalog: true,
    daily: true,
  },
  {
    id: 'training-orbit',
    label: 'Training orbit',
    detail: 'Gentle circuit and approach practice',
    seed: 1,
    profile: 'orbit',
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
    detail: 'Tight gates and demanding lines',
    seed: 3,
    profile: 'slalom',
  },
  {
    id: 'ridge-run',
    label: 'Ridge run',
    detail: 'High-altitude line over mountain shoulders',
    seed: 4,
    profile: 'ridge',
  },
  {
    id: 'canyon-run',
    label: 'Canyon run',
    detail: 'Low weave through mountain valleys',
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
    label: 'Fjord run',
    detail: 'Fog-lined coastal route between steep shoulders',
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
    detail: 'Spiral climb around dramatic volcanic relief',
    seed: 8,
    profile: 'volcanic',
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
    detail: 'High-altitude climb through changing mountain shoulders',
    seed: 12,
    profile: 'alpine',
  },
  {
    id: 'storm-run',
    label: 'Storm run',
    detail: 'Low-visibility thunderstorm route through hard crosswinds',
    seed: 10,
    profile: 'storm',
    weather: 'storm',
  },
  {
    id: 'night-ops',
    label: 'Night ops',
    detail: 'Low-level fog run under a repeatable midnight sky',
    seed: 11,
    profile: 'night',
    weather: 'fog',
    timeOfDay: 0.84,
  },
  {
    id: 'aurora-run',
    label: 'Aurora run',
    detail: 'Clear midnight sweep beneath moving green and violet curtains',
    seed: 512,
    profile: 'night',
    weather: 'clear',
    timeOfDay: 0.84,
    contractCatalog: true,
  },
  {
    id: 'timberline-run',
    label: 'Timberline run',
    detail: 'Fast rolling route through forested hill country',
    seed: 15,
    profile: 'timber',
  },
  {
    id: 'glacier-run',
    label: 'Glacier run',
    detail: 'High alpine pass through snowbound shoulders',
    seed: 16,
    profile: 'glacier',
    weather: 'snow',
  },
  {
    id: 'rainforest-run',
    label: 'Rainforest run',
    detail: 'Low winding route through wet jungle country',
    seed: 17,
    profile: 'rainforest',
    weather: 'rain',
  },
  {
    id: 'mesa-run',
    label: 'Mesa run',
    detail: 'Wide tableland passes above red-rock shelves',
    seed: 18,
    profile: 'mesa',
  },
  {
    id: 'badlands-run',
    label: 'Badlands run',
    detail: 'Tight shelf-to-shelf route through eroded red-rock cuts',
    seed: 26,
    profile: 'badlands',
  },
  {
    id: 'saltflat-run',
    label: 'Saltflat run',
    detail: 'High-speed line across reflective mineral flats',
    seed: 21,
    profile: 'saltflat',
  },
  {
    id: 'savanna-run',
    label: 'Savanna run',
    detail: 'Long low sweep across open grassland and acacia country',
    seed: 22,
    profile: 'savanna',
  },
  {
    id: 'tundra-run',
    label: 'Tundra run',
    detail: 'Snowy low-level sweep over frozen lakes and rolling ground',
    seed: 23,
    profile: 'tundra',
    weather: 'snow',
  },
  {
    id: 'swamp-run',
    label: 'Swamp run',
    detail: 'Rainy low-level weave through wetlands and winding channels',
    seed: 24,
    profile: 'swamp',
    weather: 'rain',
  },
  {
    id: 'monsoon-run',
    label: 'Monsoon run',
    detail: 'Heavy rain through dense green lowlands and flooded channels',
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
    detail: 'Spiraling altitude route through sunlit lift pockets',
    seed: 27,
    profile: 'thermal',
    weather: 'clear',
  },
  {
    id: 'pattern-approach',
    label: 'Pattern approach',
    detail: 'Short base-to-final pattern that grades the landing',
    seed: 28,
    profile: 'approach',
    weather: 'clear',
  },
  {
    id: 'crosswind-approach',
    label: 'Crosswind approach',
    detail: 'Storm-locked pattern that tests the final landing',
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
    detail: 'Alpine climb followed by a committed recovery dive',
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
    label: 'Precision landing',
    detail: 'Short clear pattern with a centered-touchdown contract',
    seed: 127,
    profile: 'approach',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'combo-run',
    label: 'Combo run',
    detail: 'Clear slalom route built around a gate-and-stunt combo contract',
    seed: 394,
    profile: 'slalom',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'night-flight',
    label: 'Night flight',
    detail: 'Foggy midnight route with a sustained after-dark contract',
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
    detail: 'Tight clear slalom with three consecutive perfect gates',
    seed: 45,
    profile: 'slalom',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'butter-landing',
    label: 'Butter landing',
    detail: 'Short clear pattern with a smooth-touchdown contract',
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
    detail: 'Clear route to a city and village with a guided tour contract',
    seed: 76,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'airshow-run',
    label: 'Airshow run',
    detail: 'Clear slalom with a barrel-roll stunt contract',
    seed: 19,
    profile: 'slalom',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'biome-tour',
    label: 'Biome tour',
    detail: 'Clear sweep across four distinct terrain biomes',
    seed: 42,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'scout-run',
    label: 'Scout run',
    detail: 'Clear sweep to multiple settlement landmarks',
    seed: 32,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'skyline-run',
    label: 'Skyline run',
    detail: 'Clear alpine climb with a high-altitude contract',
    seed: 33,
    profile: 'alpine',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'speed-run',
    label: 'Speed run',
    detail: 'Clear high-speed sweep with a fast-landing contract',
    seed: 20,
    profile: 'sweep',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'terrain-hugger',
    label: 'Terrain hugger',
    detail: 'Clear canyon route with a low-radio-altitude contract',
    seed: 46,
    profile: 'canyon',
    weather: 'clear',
    contractCatalog: true,
  },
  {
    id: 'fuel-saver',
    label: 'Fuel saver',
    detail: 'Clear sweep with a reserve-fuel landing contract',
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
    detail: 'Clear slalom with a bounded high-G handling contract',
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
    detail: 'Rainy river route with a sustained water-flight contract',
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
]

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

/** Parse a replayed UTC day without allowing malformed dates to alter a launch. */
export function dailyOpsTimestampForDayKey(dayKey: string | null | undefined): number | null {
  if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null
  const timestamp = Date.parse(`${dayKey}T12:00:00.000Z`)
  if (!Number.isFinite(timestamp) || dailyOpsDayKey(timestamp) !== dayKey) return null
  return timestamp
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

/** Resolve a catalog entry for this launch, expanding the single rotating Daily Ops entry. */
export function resolveCourseDefinition(
  course: CourseDefinition,
  nowMs = Date.now(),
): CourseDefinition {
  if (!course.daily) return course
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

export function courseSeedForId(id: string | null | undefined, nowMs = Date.now()): number | undefined {
  const seed = resolveCourseDefinition(courseDefinitionForId(id), nowMs).seed
  return seed === null ? undefined : seed
}

/** Storage identity shared by the score, trace, and completion-history records. */
export function courseRunId(course: CourseDefinition, nowMs = Date.now()): string | null {
  const resolved = resolveCourseDefinition(course, nowMs)
  if (resolved.seed === null || resolved.profile === null) return null
  const dailySuffix = course.daily ? `:daily:${dailyOpsDayKey(nowMs)}` : ''
  return `${courseSessionBaseId(resolved.seed, resolved.profile)}${courseIdentitySuffix(resolved.id)}${dailySuffix}`
}

/** Keep random sorties in one bounded record bucket instead of one key per seed. */
export function courseSessionId(
  selectedCourseId: CourseId,
  worldSeed: number,
  profile: MissionRouteProfile,
  dailyDayKey?: string,
): string {
  if (selectedCourseId === 'random') return RANDOM_COURSE_RUN_ID
  if (profile === 'free') return 'free-flight'
  const safeSeed = Number.isFinite(worldSeed) ? Math.trunc(worldSeed) : 0
  const dailySuffix = selectedCourseId === DAILY_OPS_COURSE_ID && dailyDayKey
    ? `:daily:${dailyDayKey}`
    : ''
  return `${courseSessionBaseId(safeSeed, profile)}${courseIdentitySuffix(selectedCourseId)}${dailySuffix}`
}

/** Keep authored records stable while separating the one legacy key collision. */
function courseSessionBaseId(seed: number, profile: MissionRouteProfile): string {
  return `seed:${seed}:${profile}`
}

function courseIdentitySuffix(id: CourseId): string {
  // Clean Circuit originally reused Desert Dash's seed/profile pair. Its
  // contract and route are distinct, so scores, history, and ghosts must not
  // bleed between the two entries. Leave every other historical key intact.
  return id === 'clean-circuit-run' ? ':clean-circuit' : ''
}

export function readSelectedCourseId(
  storage: Pick<Storage, 'getItem'> | null,
): CourseId {
  try {
    return courseDefinitionForId(storage?.getItem(COURSE_SELECTION_STORAGE_KEY)).id
  } catch {
    return 'random'
  }
}

export function writeSelectedCourseId(
  storage: Pick<Storage, 'setItem'> | null,
  id: CourseId,
): void {
  try {
    storage?.setItem(COURSE_SELECTION_STORAGE_KEY, id)
  } catch {
    // Private browsing/storage denial should never block course selection.
  }
}
