import { sortieContractDetailForSeed } from '../src/systems/SortieContract'
import { afterEach, expect, it } from 'vitest'
import { Scene, type Line } from 'three'
import { generateMission } from '../src/systems/MissionGenerator'
import { MISSION_THEMES, setTerrainProfile } from '../src/world/TerrainProfile'
import { MissionSystem, buildMissionRoute, summarizeMissionRoute, validateMissionRoute } from '../src/systems/Mission'
import { setWorldSeed } from '../src/world/noise'
import { setOpsPad, clearOpsPad } from '../src/world/terrainSample'
import { createNitroState, refillNitroAtGate } from '../src/aircraft/NitroSystem'
import { ChallengeRun } from '../src/systems/ChallengeRun'
import { legacyFlightRecordLabel } from '../src/core/FlightRevision'
import { COURSE_LIBRARY, resolveCourseDefinition, courseDefinitionForId, courseGateCountPreview, resolveCourseReplaySeed } from '../src/systems/CourseLibrary'
import { auditMissionGeometry } from '../scripts/lib/mission-polish'

afterEach(() => { setTerrainProfile(null); clearOpsPad() })
for (const theme of MISSION_THEMES) it.each([6, 20, 42, 67, 1337, 9001])(`${theme} seed %s has deterministic bounded gates and a flyable corridor`, seed => {
  const spec = generateMission(seed, theme), p = spec.start, pad = spec.landingRunway
  expect(generateMission(seed, theme)).toEqual(spec)
  expect(spec.goals.gates).toBeGreaterThanOrEqual(8)
  expect(spec.goals.gates).toBeLessThanOrEqual(20)
  setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  const route = buildMissionRoute(p.x, p.y, p.z, p.yaw, spec.profile)
  const summary = summarizeMissionRoute(p.x, p.y, p.z, route, spec.profile, 'steady', p.yaw)
  expect(validateMissionRoute(route, summary.minClearanceMeters).valid).toBe(true)
  expect(summary.maxTurnDegrees).toBeLessThan(75)
  expect(summary.maxSlopeDegrees).toBeLessThan(20)
  let previous = p
  for (const [index, point] of route.entries()) {
    const leg = Math.hypot(point.x - previous.x, point.z - previous.z)
    if (index > 0) {
      expect(leg).toBeGreaterThanOrEqual(800)
      expect(leg).toBeLessThanOrEqual(2500)
    }
    previous = { ...point, yaw: p.yaw }
  }
  const mission = new MissionSystem(new Scene())
  try {
    mission.start(p.x, p.y, p.z, p.yaw, spec.profile)
    expect(mission.totalGates).toBe(spec.goals.gates)
    expect(mission.routeFallbackUsed).toBe(false)
    // 11.024: the allowance is gate 1 to the last gate at 160 m/s.
    let gateLine = 0
    for (let i = 1; i < route.length; i++) gateLine += Math.hypot(route[i]!.x - route[i-1]!.x, route[i]!.y - route[i-1]!.y, route[i]!.z - route[i-1]!.z)
    expect(mission.timeAllowanceSec).toBeCloseTo(gateLine / 160, 0)
  } finally { mission.dispose() }
})
it('places 8 to 20 gates 0.8 to 2.5 km apart under the 75 degree turn limit on 500 theme and seed cases', () => {
  for (const theme of MISSION_THEMES) for (let seed = 0; seed < 100; seed++) {
    for (const training of theme === 'desert-run' ? [false, true] : [false]) {
      const spec = generateMission(seed * 37 + 3, theme, training), p = spec.start
      expect(spec.course.length).toBeGreaterThanOrEqual(8)
      expect(spec.course.length).toBeLessThanOrEqual(20)
      let x = p.x, z = p.z, hx = Math.sin(p.yaw), hz = Math.cos(p.yaw)
      for (const [index, gate] of spec.course.entries()) {
        const dx = gate.x - x, dz = gate.z - z, leg = Math.hypot(dx, dz)
        if (index > 0) {
          expect(leg).toBeGreaterThanOrEqual(800)
          expect(leg).toBeLessThanOrEqual(2500)
        }
        expect(Math.acos(Math.min(1, (dx * hx + dz * hz) / leg)) * 180 / Math.PI).toBeLessThan(75)
        hx = dx / leg; hz = dz / leg; x = gate.x; z = gate.z
      }
    }
  }
})
it.each([15, 24, 55, 100])('preserves score and 125 percent uncapped nitro awards across %s gates, including stored splits', count => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  const finish = (gates: number) => {
    const run = new ChallengeRun(storage)
    run.reset(`seed:gates:${gates}`, gates)
    for (let i = 0; i < gates; i++) run.recordGate(.8)
    return run.finishAirborne(1)!
  }
  const baseline = finish(5), result = finish(count)
  expect(result.gateScore).toBe(baseline.gateScore)
  expect(result.totalScore).toBe(baseline.totalScore)
  expect(result.medal).toBe(baseline.medal)
  expect(result.gateSplits).toHaveLength(count)
  const replay = new ChallengeRun(storage); replay.reset(`seed:gates:${count}`, count)
  for (let i=0;i<count;i++) replay.recordGate(.8)
  expect(replay.finishAirborne(1)!.bestGateSplits).toHaveLength(count)
  const nitro = createNitroState(); let refill = 0
  for (let i = 0; i < count; i++) { nitro.fraction = 0; refillNitroAtGate(nitro, count); refill += nitro.fraction }
  expect(refill).toBeCloseTo(1.25)
  expect(nitro.gateRefills).toBe(count)
})
it('keeps pre-b30 records read-only and separate in the existing historical display', () => {
  const current = 'seed:42:generated-valley:r32:l133:q146:mission:contour-circuit'
  const old = current.replace(':q146:', ':q136:')
  const values = new Map([[`blackout.best.${old}`, '90000'], [`blackout.ghost.${old}`, 'saved']])
  expect(legacyFlightRecordLabel({ getItem: key => values.get(key) ?? null }, current)).toContain('PRE-B30 BEST 90000 / GHOST SAVED')
  expect(values.has(`blackout.best.${current}`)).toBe(false)
  const spaced = current.replace(':q146:', ':q156:')
  expect(legacyFlightRecordLabel({ getItem: key => values.get(key) ?? null }, spaced)).toContain('PRE-B30 BEST 90000 / GHOST SAVED')
})
it('validates Daily, Weekly and Monthly Ops periods through ordinary gate triggers', () => {
  for (const def of COURSE_LIBRARY.filter(c => 'daily' in c || 'weekly' in c || 'monthly' in c)) {
    for (const day of [1, 22, 120]) {
      const course = resolveCourseDefinition(def, Date.UTC(2026,9,day))
      const row = auditMissionGeometry(course, course.seed!)
      expect(row.gates).toBeGreaterThanOrEqual(8)
      expect(row.gates).toBeLessThanOrEqual(20)
    }
  }
}, 30000)

it('reuses the pooled gate objects and the populated trace buffer through retries and Free flight', () => {
  const spec = generateMission(6, 'mountain-valley-run'), p = spec.start, pad = spec.landingRunway
  setWorldSeed(6); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  const mission = new MissionSystem(new Scene())
  try {
    mission.start(p.x, p.y, p.z, p.yaw, spec.profile)
    const count = spec.goals.gates
    const gate = mission.root.getObjectByName(`gate_${count - 1}`)!
    const trace = mission.root.getObjectByName('RouteTrace') as Line
    const attribute = trace.geometry.getAttribute('position')
    const buffer = attribute.array
    expect(trace.geometry.drawRange.count).toBe(count)
    const route = buildMissionRoute(p.x, p.y, p.z, p.yaw, spec.profile)
    for (let i=0;i<count;i++) {
      expect(attribute.getX(i)).toBeCloseTo(route[i]!.x, 2)
      expect(attribute.getY(i)).toBeCloseTo(route[i]!.y, 2)
      expect(attribute.getZ(i)).toBeCloseTo(route[i]!.z, 2)
    }
    mission.start(p.x, p.y, p.z, p.yaw, 'orbit')
    expect(mission.totalGates).toBeLessThanOrEqual(24)
    expect(gate.parent!.visible).toBe(count - 1 < mission.totalGates)
    expect(trace.geometry.getAttribute('position').array).toBe(buffer)
    expect(mission.root.getObjectByName(`gate_${count - 1}`)).toBe(gate)
    mission.start(p.x, p.y, p.z, p.yaw, 'free')
    expect(mission.totalGates).toBe(0)
    expect(gate.parent!.visible).toBe(false)
    expect(trace.visible).toBe(false)
  } finally { mission.dispose() }
})

it('previews the actual replay/period count and avoids a five-gate time target for unresolved worlds', () => {
  const fresh = resolveCourseDefinition(courseDefinitionForId('speed-run'))
  expect(courseGateCountPreview(fresh)).toBeNull()
  expect(sortieContractDetailForSeed(fresh.contractSeed, courseGateCountPreview(fresh), true)).toBe('TIME TARGET SET AT LAUNCH')
  const replay = resolveCourseReplaySeed(fresh, 67)
  const count = courseGateCountPreview(replay)!
  expect(count).toBe(generateMission(67, replay.terrainTheme!).goals.gates)
  expect(sortieContractDetailForSeed(replay.contractSeed, count, true)).toBe(`FINISH UNDER ${Math.max(48, Math.round(count * 5.5))}S`)
  expect(courseGateCountPreview(resolveCourseReplaySeed(courseDefinitionForId('mountain-valley-run'), 6))).toBe(generateMission(6, 'mountain-valley-run').goals.gates)
  const training = resolveCourseReplaySeed(courseDefinitionForId('training-orbit'), 67)
  expect(courseGateCountPreview(training)).toBe(generateMission(67, training.terrainTheme!, true).goals.gates)
  expect(courseGateCountPreview(training)).toBeLessThanOrEqual(20)
  expect(courseGateCountPreview(resolveCourseReplaySeed(courseDefinitionForId('free-flight'), 6))).toBe(0)
  for (const id of ['daily-ops', 'weekly-ops', 'monthly-ops']) {
    const course = resolveCourseDefinition(courseDefinitionForId(id), Date.UTC(2026,9,22))
    expect(courseGateCountPreview(course)).toBe(generateMission(course.seed!, course.terrainTheme!).goals.gates)
  }
})

it('describes generated courses with the 8 to 20 gate rule', () => {
  for (const course of COURSE_LIBRARY) expect(course.detail).not.toContain('15 to 100')
  expect(courseDefinitionForId('desert-run').detail).toContain('8 to 20')
})

it('describes Training orbit as gate practice now that runs finish in the air', () => {
  expect(courseDefinitionForId('training-orbit').detail).toBe('Gentle circuit and gate practice')
})

it('keeps Training orbit routes unchanged while preferring 11 gates', async () => {
  const { createHash } = await import('node:crypto')
  const routes = Array.from({ length: 2000 }, (_, i) => {
    const spec = generateMission(i * 101 + 11, 'desert-run', true)
    expect(spec.goals.gates).toBeGreaterThanOrEqual(11)
    expect(spec.goals.gates).toBeLessThanOrEqual(14)
    return spec.course
  })
  expect(createHash('sha256').update(JSON.stringify(routes)).digest('hex'))
    .toBe('1b27b457d91744b8e9535f90346ce1d90c0101ecef0bff2fbf720e33391c3725')
}, 120_000)
