import { describe, expect, it } from 'vitest'
import {
  COURSE_LIBRARY,
  COURSE_SELECTION_STORAGE_KEY,
  courseDefinitionForId,
  courseRunId,
  courseSeedForId,
  readSelectedCourseId,
  writeSelectedCourseId,
} from '../src/systems/CourseLibrary'
import { clearOpsPad, findPlayableSpawn, isUsableAirfield } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'

describe('course library', () => {
  it('keeps the random entry and fixed course contracts stable', () => {
    expect(COURSE_LIBRARY).toHaveLength(4)
    expect(courseDefinitionForId('missing').id).toBe('random')
    expect(courseSeedForId('random')).toBeUndefined()
    expect(courseSeedForId('training-orbit')).toBe(1)
    expect(courseDefinitionForId('precision-slalom').profile).toBe('slalom')
    expect(courseRunId(courseDefinitionForId('precision-slalom'))).toBe('seed:3:slalom')
    expect(courseRunId(courseDefinitionForId('random'))).toBeNull()
  })

  it('persists only valid course ids and fails closed on storage denial', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(readSelectedCourseId(storage)).toBe('random')
    writeSelectedCourseId(storage, 'range-sweep')
    expect(readSelectedCourseId(storage)).toBe('range-sweep')
    values.set(COURSE_SELECTION_STORAGE_KEY, 'not-a-course')
    expect(readSelectedCourseId(storage)).toBe('random')
    expect(() => writeSelectedCourseId(null, 'training-orbit')).not.toThrow()
  })

  it('validates every curated seed to a usable dry airfield', () => {
    for (const course of COURSE_LIBRARY) {
      if (course.seed === null) continue
      setWorldSeed(course.seed)
      clearOpsPad()
      const pad = findPlayableSpawn()
      expect(pad, `${course.id} should resolve a spawn`).not.toBeNull()
      expect(isUsableAirfield(pad!)).toBe(true)
    }
  }, 60_000)
})
