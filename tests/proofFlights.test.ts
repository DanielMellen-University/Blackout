import { afterEach, describe, expect, it } from 'vitest'
import { Quaternion, Scene, Vector3 } from 'three'
import { readFileSync } from 'node:fs'
import { Aircraft } from '../src/aircraft/Aircraft'
import { refillNitroAtGate } from '../src/aircraft/NitroSystem'
import { CollisionSystem } from '../src/systems/Collision'
import { flightStart } from '../src/systems/AirborneStart'
import { ChallengeRun } from '../src/systems/ChallengeRun'
import { DAILY_OPS_COURSE_ID, courseDefinitionForId, dailyOpsDayKey, resolveCourseDefinition, type CourseDefinition } from '../src/systems/CourseLibrary'
import { generateLegacyMission, generateLegacyTerrain } from '../src/systems/LegacyMissionGenerator'
import { MissionSystem } from '../src/systems/Mission'
import { generateMission } from '../src/systems/MissionGenerator'
import { PERFECT_LINE_SPEED } from '../src/world/PerfectLine'
import { generatedThemeForProfile, setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, sampleTerrainSurfaceHeightFast, setOpsPad } from '../src/world/terrainSample'

// r9 proof flights: headless, deterministic, controls-only. The review pilot
// from scripts/browser-generator.js writes controls only, never pose or gates.
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const PILOT = readFileSync('scripts/browser-generator.js', 'utf8').split('window.__training.catalog=')[0]!
afterEach(() => { setTerrainProfile(null); clearOpsPad() })

export interface ProofFlight {
  complete: boolean
  elapsed: number
  gates: number
  passes: number[]
  misses: number
  everOnGround: boolean
  landed: boolean
  crashed: string | null
  minClearance: number
  finishAgl: number
  result: ReturnType<ChallengeRun['finishAirborne']>
  startAgl: number
  startSpeed: number
}

function setup(course: CourseDefinition, seed: number) {
  // Resolved catalog and Ops courses carry their terrain theme, as World.reseed uses it.
  if (course.terrainTheme) return { spec: generateLegacyTerrain(seed, course.terrainTheme), modifier: course.missionModifier,
    contractSeed: course.contractSeed ?? seed, profile: course.profile! }
  const theme = generatedThemeForProfile(course.profile)
  if (theme) return { spec: generateMission(seed, theme), modifier: undefined, contractSeed: seed, profile: course.profile! }
  const adapted = generateLegacyMission(course, seed)!
  return { spec: adapted.spec, modifier: adapted.modifier, contractSeed: adapted.contractSeed, profile: course.profile! }
}

/** Fly one gated course exactly as main.ts launches it: airborne at gate 1. */
export function flyProof(course: CourseDefinition, seed: number, maxSeconds = 420): ProofFlight {
  const { spec, modifier, contractSeed, profile } = setup(course, seed)
  const pad = spec.landingRunway
  setWorldSeed(seed); setTerrainProfile(spec.terrain); setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  const aircraft = new Aircraft(), mission = new MissionSystem(new Scene()), collision = new CollisionSystem()
  const fwd = new Vector3(), inv = new Quaternion(), up = new Vector3()
  const attitude = (o: Quaternion) => {
    fwd.set(0, 0, 1).applyQuaternion(o); inv.copy(o).invert(); up.set(0, 1, 0).applyQuaternion(inv)
    return { pitch: Math.asin(clamp(fwd.y, -1, 1)), heading: Math.atan2(fwd.x, fwd.z), roll: Math.atan2(-up.x, up.y) }
  }
  try {
    mission.start(spec.start.x, spec.start.y, spec.start.z, spec.start.yaw, profile, modifier)
    expect(mission.routeFallbackUsed).toBe(false)
    const gateStart = mission.firstGateApproach()!
    const start = flightStart(spec.start, gateStart, sampleTerrainSurfaceHeightFast)
    aircraft.reset(start)
    aircraft.velocity.set(Math.sin(start.yaw) * PERFECT_LINE_SPEED, 0, Math.cos(start.yaw) * PERFECT_LINE_SPEED)
    aircraft.controls.gearDown = false
    aircraft.controls.throttle = .5
    aircraft.snapDisplay()
    const run = new ChallengeRun(null)
    run.reset(`proof:${course.id}`, mission.totalGates, mission.scoringFocus, contractSeed, course.contractCatalog === true, mission.timeAllowanceSec, mission.gateLineClearanceM)
    const challenge = { phase: 'running' }
    const window: any = {}
    const make = new Function('window', 'aircraft', 'world', 'attitudeFromOrientation', 'challenge', 'activeSortie', 'b21Ground', 'wasAirborne', PILOT + '\nreturn window.__training')
    const pilot = make(window, aircraft, { mission, spawn: spec.start }, attitude, challenge, { course: {} }, sampleTerrainSurfaceHeightFast, true)
    const flight: ProofFlight = {
      complete: false, elapsed: 0, gates: mission.totalGates, passes: [], misses: 0, everOnGround: aircraft.onGround,
      landed: false, crashed: null, minClearance: Infinity, finishAgl: 0, result: null,
      startAgl: start.y - sampleTerrainSurfaceHeightFast(start.x, start.z), startSpeed: aircraft.speed,
    }
    pilot.start()
    const dt = 1 / 60
    for (let step = 0; step < maxSeconds * 60; step++) {
      pilot.before(dt)
      aircraft.step(dt, step * 1000 / 60)
      const touch = collision.check(aircraft)
      if (touch === 'crash' || touch === 'ditch') { flight.crashed = `${touch}:${collision.failureReason}`; break }
      if (touch === 'landed' || touch === 'roll' || aircraft.onGround) flight.everOnGround = true
      if (aircraft.status === 'landed') flight.landed = true
      const clearance = aircraft.position.y - sampleTerrainSurfaceHeightFast(aircraft.position.x, aircraft.position.z)
      flight.minClearance = Math.min(flight.minClearance, clearance)
      run.update(dt, aircraft.speed, Math.max(0, aircraft.position.y - spec.start.y), 0, 0, aircraft.controls.airbrake,
        !aircraft.onGround, aircraft.engineHeat.fraction, 0, aircraft.loadFactor, aircraft.fuel.fraction, false,
        aircraft.engineState.afterburnerActive, clearance, 1, Math.max(0, aircraft.speed * dt))
      const next = mission.next
      const event = mission.update(aircraft.position.x, aircraft.position.y, aircraft.position.z, step * 1000 / 60)
      if (event === 'miss') { flight.misses++; run.recordGateMiss() }
      if (event === 'pass' || event === 'complete') {
        flight.passes.push(next)
        run.recordGate(mission.lastPassQuality)
        refillNitroAtGate(aircraft.nitro, mission.totalGates)
      }
      if (event === 'complete') {
        flight.complete = true
        flight.elapsed = (step + 1) / 60
        flight.finishAgl = clearance
        flight.result = run.finishAirborne(aircraft.fuel.fraction)
        break
      }
    }
    return flight
  } finally { aircraft.dispose(); mission.dispose() }
}

const THEMED = ['training-orbit', 'desert-run', 'mountain-valley-run', 'coastal-island-run', 'generated-volcanic-run', 'waterway-run']

describe('r9 proof flights: every theme, airborne start to airborne finish', () => {
  for (const id of THEMED) {
    it.each([42, 1337])(`${id} seed %s flies every gate in order and scores in the air`, seed => {
      const course = resolveCourseDefinition(courseDefinitionForId(id))
      const flight = flyProof(course, seed)
      expect(flight.crashed).toBeNull()
      expect(flight.startAgl).toBeGreaterThan(20)
      expect(flight.startSpeed).toBeCloseTo(PERFECT_LINE_SPEED, 0)
      expect(flight.everOnGround).toBe(false)
      expect(flight.landed).toBe(false)
      expect(flight.complete).toBe(true)
      expect(flight.misses).toBe(0)
      expect(flight.passes).toEqual([...Array(flight.gates).keys()])
      expect(flight.finishAgl).toBeGreaterThan(20)
      const result = flight.result!
      expect(result).not.toBeNull()
      expect(result.landingQuality).toBe(0)
      // M4: time score plus the three sampled flying bonuses.
      const bonus = result.flyingBonuses!
      for (const value of [bonus.lowScore, bonus.terrainScore, bonus.speedScore]) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(10_000)
      }
      expect(bonus.lowScore + bonus.terrainScore + bonus.speedScore).toBeGreaterThan(0)
      // 11.023: the terrain bonus is measured against the gate line, so flying the line scores some.
      expect(bonus.terrainScore).toBeGreaterThan(500)
      // 11.023: the allowance is the gate line at 160 m/s. The proof pilot flies
      // it at about 134 to 141 m/s, so it loses time points; full time needs nitro.
      expect(result.timeAllowanceSec).toBeGreaterThan(0)
      expect(flight.elapsed).toBeGreaterThan(result.timeAllowanceSec!)
      expect(result.timeScore).toBeLessThan(75_000)
      expect(result.timeScore).toBeGreaterThan(65_000)
      const raw = result.timeScore + bonus.lowScore + bonus.terrainScore + bonus.speedScore
      expect(result.totalScore).toBeGreaterThan(0); expect(result.totalScore).toBeLessThanOrEqual(raw)
      expect(result.medal).toBeTruthy()
    }, 120_000)
  }
})

describe('r9 proof: Daily challenge is the same flight for everyone on a UTC day', () => {
  const daily = courseDefinitionForId(DAILY_OPS_COURSE_ID)
  it.each([Date.UTC(2026, 9, 27), Date.UTC(2026, 10, 6), Date.UTC(2027, 0, 1)])('day %s resolves and flies identically', dayStart => {
    const morning = resolveCourseDefinition(daily, dayStart + 60_000)
    const evening = resolveCourseDefinition(daily, dayStart + 23 * 3_600_000)
    expect(evening).toEqual(morning)
    expect(morning.seed).not.toBeNull()
    expect(morning.terrainTheme).toBeTruthy()
    expect(dailyOpsDayKey(dayStart + 60_000)).toBe(dailyOpsDayKey(dayStart + 23 * 3_600_000))
    const first = flyProof(morning, morning.seed!), second = flyProof(evening, evening.seed!)
    expect(first.complete).toBe(true)
    expect(first.crashed).toBeNull()
    expect(first.everOnGround).toBe(false)
    expect(first.passes).toEqual([...Array(first.gates).keys()])
    expect(second.elapsed).toBe(first.elapsed)
    expect(second.passes).toEqual(first.passes)
    expect(second.result!.totalScore).toBe(first.result!.totalScore)
    expect(second.result!.flyingBonuses).toEqual(first.result!.flyingBonuses)
    const nextDay = resolveCourseDefinition(daily, dayStart + 24 * 3_600_000 + 60_000)
    expect(nextDay.seed).not.toBe(morning.seed)
  }, 120_000)
})
