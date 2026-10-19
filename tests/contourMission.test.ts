import { Scene } from 'three'
import { describe, expect, it } from 'vitest'
import { buildMissionRoute, MissionSystem, summarizeMissionRoute, validateMissionRoute } from '../src/systems/Mission'
import { clearOpsPad, findPlayableSpawn, setOpsPad } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'
import { courseDefinitionForId, courseSessionId, courseRunId, resolveCourseReplaySeed } from '../src/systems/CourseLibrary'
import { CourseSession } from '../src/core/CourseSession'
import { FEATURED_MISSION_IDS } from '../src/ui/MissionPickerLayout'

// Use the actual generated runway pad and ground, rather than a flat fixture.
describe('Contour circuit', () => {
  it.each([42, 73, 808])('builds a deterministic five-gate corridor on seed %s and leaves existing routes unchanged', seed => {
    setWorldSeed(seed); clearOpsPad()
    const pad = findPlayableSpawn()!
    setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
    const x=pad.x-Math.sin(pad.yaw)*45, y=pad.y+1.4, z=pad.z-Math.cos(pad.yaw)*45
    try {
      const orbit = buildMissionRoute(x,y,z,pad.yaw,'orbit','steady')
      const route = buildMissionRoute(x,y,z,pad.yaw,'contour','steady')
      expect(route).toHaveLength(5)
      expect(buildMissionRoute(x,y,z,pad.yaw,'contour','steady')).toEqual(route)
      expect(buildMissionRoute(x,y,z,pad.yaw,'orbit','steady')).toEqual(orbit)
      expect(route).not.toEqual(orbit)
      // The final two gates align with the actual runway inbound axis.
      for(const point of route.slice(-2)) {
        const lateral=(point.x-x)*Math.cos(pad.yaw)-(point.z-z)*Math.sin(pad.yaw)
        expect(lateral).toBeCloseTo(0,6)
      }
      const last=route.at(-1)!
      expect(last.fwdX).toBeCloseTo(Math.sin(pad.yaw),6)
      expect(last.fwdZ).toBeCloseTo(Math.cos(pad.yaw),6)
      const summary=summarizeMissionRoute(x,y,z,route,'contour','steady',pad.yaw)
      expect(validateMissionRoute(route,summary.minClearanceMeters).valid).toBe(true)
      expect(summary.maxSlopeDegrees).toBeLessThan(25)
      const mission=new MissionSystem(new Scene())
      mission.start(x,y,z,pad.yaw,'contour','steady')
      expect(mission.routeProfile).toBe('contour')
      expect(mission.totalGates).toBe(5)
      expect(mission.routeFallbackUsed).toBe(false)
      expect(mission.timeAllowanceSec).toBeGreaterThan(45)
      mission.dispose()
    } finally {clearOpsPad()}
  },30_000)

  it('shows a replay seed record without replacing the featured default or another course', () => {
    const featured=courseDefinitionForId('contour-circuit')
    const replay=resolveCourseReplaySeed(featured,73)
    expect(courseRunId(replay)).toBe('seed:73:contour')
    expect(replay.detail).toContain('SEED 73')
    expect(featured.seed).toBe(42)
    expect(resolveCourseReplaySeed(featured,null)).toBe(featured)
    expect(resolveCourseReplaySeed(featured,Number.NaN)).toBe(featured)
    const training=courseDefinitionForId('training-orbit')
    expect(resolveCourseReplaySeed(training,73)).toBe(training)
    const active=new CourseSession(Date.now()).capture('contour-circuit',73,'contour')
    expect(active.course.seed).toBe(73)
    expect(active.recordId).toBe('seed:73:contour')
  })

  it('is featured and uses the existing per-seed course record identity',()=>{
    expect(FEATURED_MISSION_IDS).toContain('contour-circuit')
    expect(courseDefinitionForId('contour-circuit')).toMatchObject({profile:'contour',seed:42,weather:'clear'})
    expect(courseSessionId('contour-circuit',42,'contour')).toBe('seed:42:contour')
    expect(courseSessionId('contour-circuit',73,'contour')).toBe('seed:73:contour')
  })
})
