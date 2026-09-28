import type { MissionRouteProfile } from './Mission'
import type { WeatherId, WindSide } from '../world/WeatherDirector'

export type CourseId = 'random' | 'free-flight' | 'training-orbit' | 'range-sweep' | 'precision-slalom' | 'ridge-run' | 'canyon-run' | 'coastal-run' | 'fjord-run' | 'river-run' | 'volcanic-run' | 'desert-dash' | 'alpine-pass' | 'storm-run' | 'night-ops' | 'timberline-run' | 'glacier-run' | 'rainforest-run' | 'mesa-run' | 'badlands-run' | 'saltflat-run' | 'savanna-run' | 'tundra-run' | 'swamp-run' | 'archipelago-run' | 'thermal-run' | 'pattern-approach' | 'crosswind-approach' | 'traffic-run' | 'waterway-tour' | 'thermal-surf' | 'high-dive' | 'water-skim' | 'ridge-trial' | 'traffic-dodge' | 'precision-landing' | 'combo-run' | 'night-flight' | 'radar-run' | 'precision-chain' | 'butter-landing' | 'dry-run' | 'gust-rider' | 'range-run' | 'settlement-tour' | 'airshow-run'

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
  /** Optional normalized time-of-day override, where 0 and 1 are midnight. */
  timeOfDay?: number
  /** Optional runway-relative wind side for authored approach pressure. */
  windSide?: WindSide
  /** Use the expanded catalog contract pool for a deliberately themed course. */
  contractCatalog?: boolean
}

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
    profile: 'coast',
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
]

export function courseDefinitionForId(id: string | null | undefined): CourseDefinition {
  return COURSE_LIBRARY.find((course) => course.id === id) ?? COURSE_LIBRARY[0]!
}

export function courseSeedForId(id: string | null | undefined): number | undefined {
  const seed = courseDefinitionForId(id).seed
  return seed === null ? undefined : seed
}

/** Storage identity shared by the score, trace, and completion-history records. */
export function courseRunId(course: CourseDefinition): string | null {
  if (course.seed === null || course.profile === null) return null
  return `seed:${course.seed}:${course.profile}`
}

/** Keep random sorties in one bounded record bucket instead of one key per seed. */
export function courseSessionId(
  selectedCourseId: CourseId,
  worldSeed: number,
  profile: MissionRouteProfile,
): string {
  if (selectedCourseId === 'random') return RANDOM_COURSE_RUN_ID
  if (profile === 'free') return 'free-flight'
  const safeSeed = Number.isFinite(worldSeed) ? Math.trunc(worldSeed) : 0
  return `seed:${safeSeed}:${profile}`
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
