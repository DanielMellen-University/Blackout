import { describe, expect, it } from 'vitest'
import {
  COURSE_LIBRARY,
  courseDefinitionForId,
  courseRunId,
  courseSeedForId,
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
