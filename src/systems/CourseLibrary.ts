import type { MissionRouteProfile } from './Mission'

export type CourseId = 'random' | 'free-flight' | 'training-orbit' | 'range-sweep' | 'precision-slalom' | 'ridge-run'

export const COURSE_SELECTION_STORAGE_KEY = 'blackout.course-selection'
export const RANDOM_COURSE_RUN_ID = 'random-world'

export interface CourseDefinition {
  id: CourseId
  label: string
  detail: string
  seed: number | null
  profile: MissionRouteProfile | null
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
