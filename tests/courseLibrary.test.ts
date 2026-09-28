import { describe, expect, it } from 'vitest'
import {
  COURSE_LIBRARY,
  COURSE_SELECTION_STORAGE_KEY,
  courseDefinitionForId,
  courseRunId,
  courseSessionId,
  courseSeedForId,
  readSelectedCourseId,
  writeSelectedCourseId,
} from '../src/systems/CourseLibrary'
import { clearOpsPad, findPlayableSpawn, isUsableAirfield } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'

describe('course library', () => {
  it('keeps the random entry and fixed course contracts stable', () => {
    expect(COURSE_LIBRARY).toHaveLength(32)
    expect(courseDefinitionForId('missing').id).toBe('random')
    expect(courseSeedForId('random')).toBeUndefined()
    expect(courseSeedForId('free-flight')).toBeUndefined()
    expect(courseSeedForId('training-orbit')).toBe(1)
    expect(courseDefinitionForId('free-flight').profile).toBe('free')
    expect(courseRunId(courseDefinitionForId('free-flight'))).toBeNull()
    expect(courseDefinitionForId('precision-slalom').profile).toBe('slalom')
    expect(courseRunId(courseDefinitionForId('precision-slalom'))).toBe('seed:3:slalom')
    expect(courseDefinitionForId('ridge-run').profile).toBe('ridge')
    expect(courseRunId(courseDefinitionForId('ridge-run'))).toBe('seed:4:ridge')
    expect(courseDefinitionForId('canyon-run').profile).toBe('canyon')
    expect(courseRunId(courseDefinitionForId('canyon-run'))).toBe('seed:5:canyon')
    expect(courseDefinitionForId('coastal-run').profile).toBe('coast')
    expect(courseRunId(courseDefinitionForId('coastal-run'))).toBe('seed:6:coast')
    expect(courseDefinitionForId('fjord-run').profile).toBe('coast')
    expect(courseDefinitionForId('fjord-run').weather).toBe('fog')
    expect(courseRunId(courseDefinitionForId('fjord-run'))).toBe('seed:13:coast')
    expect(courseDefinitionForId('river-run').profile).toBe('river')
    expect(courseRunId(courseDefinitionForId('river-run'))).toBe('seed:7:river')
    expect(courseDefinitionForId('volcanic-run').profile).toBe('volcanic')
    expect(courseRunId(courseDefinitionForId('volcanic-run'))).toBe('seed:8:volcanic')
    expect(courseDefinitionForId('desert-dash').profile).toBe('desert')
    expect(courseRunId(courseDefinitionForId('desert-dash'))).toBe('seed:9:desert')
    expect(courseDefinitionForId('alpine-pass').profile).toBe('alpine')
    expect(courseRunId(courseDefinitionForId('alpine-pass'))).toBe('seed:12:alpine')
    expect(courseDefinitionForId('storm-run').profile).toBe('storm')
    expect(courseDefinitionForId('storm-run').weather).toBe('storm')
    expect(courseRunId(courseDefinitionForId('storm-run'))).toBe('seed:10:storm')
    expect(courseDefinitionForId('night-ops').profile).toBe('night')
    expect(courseDefinitionForId('night-ops').weather).toBe('fog')
    expect(courseDefinitionForId('night-ops').timeOfDay).toBeCloseTo(0.84)
    expect(courseRunId(courseDefinitionForId('night-ops'))).toBe('seed:11:night')
    expect(courseDefinitionForId('timberline-run').profile).toBe('timber')
    expect(courseRunId(courseDefinitionForId('timberline-run'))).toBe('seed:15:timber')
    expect(courseDefinitionForId('glacier-run').profile).toBe('glacier')
    expect(courseDefinitionForId('glacier-run').weather).toBe('snow')
    expect(courseRunId(courseDefinitionForId('glacier-run'))).toBe('seed:16:glacier')
    expect(courseDefinitionForId('rainforest-run').profile).toBe('rainforest')
    expect(courseDefinitionForId('rainforest-run').weather).toBe('rain')
    expect(courseDefinitionForId('mesa-run').profile).toBe('mesa')
    expect(courseRunId(courseDefinitionForId('mesa-run'))).toBe('seed:18:mesa')
    expect(courseDefinitionForId('badlands-run').profile).toBe('badlands')
    expect(courseRunId(courseDefinitionForId('badlands-run'))).toBe('seed:26:badlands')
    expect(courseDefinitionForId('saltflat-run').profile).toBe('saltflat')
    expect(courseRunId(courseDefinitionForId('saltflat-run'))).toBe('seed:21:saltflat')
    expect(courseDefinitionForId('savanna-run').profile).toBe('savanna')
    expect(courseRunId(courseDefinitionForId('savanna-run'))).toBe('seed:22:savanna')
    expect(courseDefinitionForId('tundra-run').profile).toBe('tundra')
    expect(courseDefinitionForId('tundra-run').weather).toBe('snow')
    expect(courseRunId(courseDefinitionForId('tundra-run'))).toBe('seed:23:tundra')
    expect(courseDefinitionForId('swamp-run').profile).toBe('swamp')
    expect(courseDefinitionForId('swamp-run').weather).toBe('rain')
    expect(courseRunId(courseDefinitionForId('swamp-run'))).toBe('seed:24:swamp')
    expect(courseDefinitionForId('archipelago-run').profile).toBe('archipelago')
    expect(courseDefinitionForId('archipelago-run').weather).toBe('fog')
    expect(courseRunId(courseDefinitionForId('archipelago-run'))).toBe('seed:25:archipelago')
    expect(courseDefinitionForId('thermal-run').profile).toBe('thermal')
    expect(courseDefinitionForId('thermal-run').weather).toBe('clear')
    expect(courseRunId(courseDefinitionForId('thermal-run'))).toBe('seed:27:thermal')
    expect(courseDefinitionForId('pattern-approach').profile).toBe('approach')
    expect(courseDefinitionForId('pattern-approach').weather).toBe('clear')
    expect(courseRunId(courseDefinitionForId('pattern-approach'))).toBe('seed:28:approach')
    expect(courseDefinitionForId('crosswind-approach').profile).toBe('approach')
    expect(courseDefinitionForId('crosswind-approach').weather).toBe('storm')
    expect(courseDefinitionForId('crosswind-approach').windSide).toBe('right')
    expect(courseRunId(courseDefinitionForId('crosswind-approach'))).toBe('seed:29:approach')
    expect(courseDefinitionForId('traffic-run').profile).toBe('sweep')
    expect(courseDefinitionForId('traffic-run').contractCatalog).toBe(true)
    expect(courseRunId(courseDefinitionForId('traffic-run'))).toBe('seed:348:sweep')
    expect(courseDefinitionForId('waterway-tour').profile).toBe('river')
    expect(courseDefinitionForId('waterway-tour').weather).toBe('rain')
    expect(courseDefinitionForId('waterway-tour').contractCatalog).toBe(true)
    expect(courseRunId(courseDefinitionForId('waterway-tour'))).toBe('seed:54:river')
    expect(courseDefinitionForId('thermal-surf').profile).toBe('thermal')
    expect(courseDefinitionForId('thermal-surf').weather).toBe('clear')
    expect(courseDefinitionForId('thermal-surf').contractCatalog).toBe(true)
    expect(courseRunId(courseDefinitionForId('thermal-surf'))).toBe('seed:80:thermal')
    expect(courseDefinitionForId('high-dive').profile).toBe('alpine')
    expect(courseDefinitionForId('high-dive').weather).toBe('clear')
    expect(courseDefinitionForId('high-dive').contractCatalog).toBe(true)
    expect(courseRunId(courseDefinitionForId('high-dive'))).toBe('seed:102:alpine')
    expect(courseRunId(courseDefinitionForId('rainforest-run'))).toBe('seed:17:rainforest')
    expect(courseRunId(courseDefinitionForId('random'))).toBeNull()
    expect(courseSessionId('random', 42, 'orbit')).toBe('random-world')
    expect(courseSessionId('free-flight', 42, 'free')).toBe('free-flight')
    expect(courseSessionId('training-orbit', 1, 'orbit')).toBe('seed:1:orbit')
    expect(courseSessionId('training-orbit', Number.NaN, 'orbit')).toBe('seed:0:orbit')
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
