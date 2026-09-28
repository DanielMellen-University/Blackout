import type { MissionRouteProfile } from './Mission'
import type { WeatherId } from '../world/WeatherDirector'

export type CourseId = 'random' | 'free-flight' | 'training-orbit' | 'range-sweep' | 'precision-slalom' | 'ridge-run' | 'canyon-run' | 'coastal-run' | 'fjord-run' | 'river-run' | 'volcanic-run' | 'desert-dash' | 'alpine-pass' | 'storm-run' | 'night-ops' | 'timberline-run' | 'glacier-run' | 'rainforest-run' | 'mesa-run' | 'badlands-run' | 'saltflat-run' | 'savanna-run' | 'tundra-run' | 'swamp-run' | 'archipelago-run' | 'thermal-run'

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
