import { describe, expect, it } from 'vitest'
import { Scene } from 'three'
import { buildMissionRoute, MissionSystem, summarizeMissionRoute, validateMissionRoute } from '../src/systems/Mission'
import { courseDefinitionForId, courseRunId, resolveCourseDefinition, resolveCourseReplaySeed } from '../src/systems/CourseLibrary'
import { CourseSession } from '../src/core/CourseSession'
import { FEATURED_MISSION_IDS } from '../src/ui/MissionPickerLayout'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, setOpsPad, findPlayableSpawn } from '../src/world/terrainSample'

describe('Weather approach', () => {
  it.each([619, 1598, 2469])('resolves seed %s through existing weather, route and record systems', seed => {
    const definition = courseDefinitionForId('weather-approach')
    const course = resolveCourseReplaySeed(resolveCourseDefinition(definition), seed)
    expect(course.seed).toBe(seed)
    expect(course.weather).toBe('rain')
    expect(course.windSide).toBe('right')
    expect(courseRunId(course)).toBe(`seed:${seed}:generated-valley:r32:l133:q156:mission:weather-approach:s1`)
    const active = new CourseSession(Date.now()).capture('weather-approach', seed, 'weather')
    expect(active.course).toEqual(course)
    expect(active.recordId).toBe(`seed:${seed}:generated-valley:r32:l133:q156:mission:weather-approach:s1`)
    setWorldSeed(seed); clearOpsPad()
    const pad = findPlayableSpawn()!
    setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
    const x = pad.x - Math.sin(pad.yaw) * 45, y = pad.y + 1.4, z = pad.z - Math.cos(pad.yaw) * 45
    try {
      const old = buildMissionRoute(x,y,z,pad.yaw,'contour','steady')
      const route = buildMissionRoute(x,y,z,pad.yaw,'weather','steady')
      expect(route).toHaveLength(15)
      expect(buildMissionRoute(x,y,z,pad.yaw,'weather','steady')).toEqual(route)
      expect(route).not.toEqual(old)
      expect(buildMissionRoute(x,y,z,pad.yaw,'contour','steady')).toEqual(old)
      for (const point of route.slice(-2)) expect((point.x-x)*Math.cos(pad.yaw)-(point.z-z)*Math.sin(pad.yaw)).toBeCloseTo(0,6)
      const last = route.at(-1)!
      expect((last.x-x)*Math.sin(pad.yaw)+(last.z-z)*Math.cos(pad.yaw)).toBeCloseTo(-1600,6)
      const summary = summarizeMissionRoute(x,y,z,route,'weather','steady',pad.yaw)
      expect(summary.challenge).toBe('approach')
      expect(validateMissionRoute(route, summary.minClearanceMeters).valid).toBe(true)
      const mission = new MissionSystem(new Scene())
      mission.start(x,y,z,pad.yaw,'weather','steady')
      expect(mission.routeFallbackUsed).toBe(false)
      expect(mission.routeProfile).toBe('weather')
      expect(mission.timeAllowanceSec).toBeGreaterThan(80)
      mission.dispose()
    } finally { clearOpsPad() }
  }, 30_000)

  it('uses the course list and rejects invalid seed pins without changing other courses', () => {
    expect(FEATURED_MISSION_IDS).not.toContain('weather-approach')
    const course = resolveCourseDefinition(courseDefinitionForId('weather-approach'))
    expect(course.weather).toBe('rain')
    expect(resolveCourseReplaySeed(course, NaN)).toBe(course)
    expect(resolveCourseReplaySeed(course, null)).toBe(course)
    const negative = resolveCourseReplaySeed(course, -2)
    expect(negative.weather).toBe('rain')
    expect(negative.windSide).toBe('right')
  })
})
