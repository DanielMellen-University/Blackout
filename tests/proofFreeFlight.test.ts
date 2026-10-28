import { afterEach, describe, expect, it } from 'vitest'
import { Scene } from 'three'
import { readFileSync } from 'node:fs'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig } from '../src/aircraft/flightConfig'
import { CollisionSystem } from '../src/systems/Collision'
import { announcesLanding, flightStart } from '../src/systems/AirborneStart'
import { ChallengeRun } from '../src/systems/ChallengeRun'
import { MissionSystem } from '../src/systems/Mission'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, findPlayableSpawn, sampleTerrainSurfaceHeightFast, setOpsPad } from '../src/world/terrainSample'
import { createLandingPilot, planLanding } from './support/landingPilot'

// r9/r10a proof: Free flight on real seeded terrain keeps its runway start, a
// controls-only takeoff, a circuit, and a touchdown that raises LANDED.
const MAIN = readFileSync('src/main.ts', 'utf8')
afterEach(() => { setTerrainProfile(null); clearOpsPad() })

function freeFlight(seed: number) {
  setWorldSeed(seed); setTerrainProfile(null); clearOpsPad()
  const pad = findPlayableSpawn()!
  setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  // World.applySpawn: 45 m behind the pad centre, resting on the gear.
  const spawn = { x: pad.x - Math.sin(pad.yaw) * 45, y: pad.y + flightConfig.gearHeight, z: pad.z - Math.cos(pad.yaw) * 45, yaw: pad.yaw }
  const aircraft = new Aircraft(), mission = new MissionSystem(new Scene()), collision = new CollisionSystem()
  try {
    mission.start(spawn.x, spawn.y, spawn.z, spawn.yaw, 'free')
    const gateStart = mission.totalGates > 0 ? mission.firstGateApproach() : null
    const start = flightStart(spawn, gateStart, sampleTerrainSurfaceHeightFast)
    aircraft.reset(start)
    const run = new ChallengeRun(null)
    run.reset('free-flight', mission.totalGates)
    // Glide slope, flare and speed control on controls only (tests/support/landingPilot.ts).
    const plan = planLanding(pad, sampleTerrainSurfaceHeightFast)
    expect(plan).not.toBeNull()
    const pilot = createLandingPilot(aircraft, pad, plan!, sampleTerrainSurfaceHeightFast)
    const out = { gates: mission.totalGates, startOnGround: aircraft.onGround, startSpeed: aircraft.speed, startDistance: Math.hypot(start.x - spawn.x, start.z - spawn.z),
      maxAgl: 0, crashed: null as string | null, banners: [] as string[], landedAt: -1, stopped: false, finish: null as unknown }
    let wasAirborne = false
    const dt = 1 / 60
    for (let step = 0; step < 60 * 900; step++) {
      pilot.before()
      aircraft.step(dt, step * 1000 / 60)
      // main.ts: airborne once clear of the ground by more than 8 m.
      if (!aircraft.onGround && aircraft.altitudeAgl > 8) wasAirborne = true
      out.maxAgl = Math.max(out.maxAgl, aircraft.altitudeAgl)
      const touch = collision.check(aircraft)
      if (touch === 'crash' || touch === 'ditch') { out.crashed = `${touch}:${collision.failureReason}`; break }
      run.update(dt, aircraft.speed, Math.max(0, aircraft.position.y - spawn.y), 0, 0, false, !aircraft.onGround)
      // main.ts: a Free flight touchdown after flight on an ok aircraft marks LANDED.
      if (announcesLanding(true, touch, wasAirborne, aircraft.status)) {
        aircraft.markLanded(); wasAirborne = false; out.banners.push('LANDED'); out.landedAt = step / 60
      }
      if (out.landedAt >= 0 && aircraft.speed < 5) { out.stopped = true; break }
    }
    out.finish = run.finishAirborne()
    return out
  } finally { aircraft.dispose(); mission.dispose() }
}

describe('r9 proof: Free flight keeps its runway start, takeoff and landing', () => {
  it.each([42, 1337, 9001, 7, 99, 2024])('seed %s takes off from the runway, flies a circuit and lands with LANDED', seed => {
    const flight = freeFlight(seed)
    expect(flight.gates).toBe(0)
    expect(flight.startOnGround).toBe(true)
    expect(flight.startSpeed).toBe(0)
    expect(flight.startDistance).toBe(0)
    expect(flight.crashed).toBeNull()
    expect(flight.maxAgl).toBeGreaterThan(100)
    expect(flight.banners).toEqual(['LANDED'])
    expect(flight.stopped).toBe(true)
    // Free flight is never scored as a gated finish.
    expect(flight.finish).toBeNull()
  }, 120_000)

  it.each([42, 1337, 9001, 7, 99, 2024])('seed %s starts at rest on its runway with no gates', seed => {
    setWorldSeed(seed); setTerrainProfile(null); clearOpsPad()
    const pad = findPlayableSpawn()!
    setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
    const spawn = { x: pad.x - Math.sin(pad.yaw) * 45, y: pad.y + flightConfig.gearHeight, z: pad.z - Math.cos(pad.yaw) * 45, yaw: pad.yaw }
    const aircraft = new Aircraft(), mission = new MissionSystem(new Scene())
    try {
      mission.start(spawn.x, spawn.y, spawn.z, spawn.yaw, 'free')
      expect(mission.totalGates).toBe(0)
      aircraft.reset(flightStart(spawn, null, sampleTerrainSurfaceHeightFast))
      expect(aircraft.onGround).toBe(true)
      expect(aircraft.speed).toBe(0)
      expect(aircraft.position.y).toBeCloseTo(spawn.y)
    } finally { aircraft.dispose(); mission.dispose() }
  })

  // A wider sweep guards against regressions without pinning every seed.
  // Misses are not crashes: a few seeds touch down away from the pad, and a
  // touchdown sinking faster than about 1.2 m/s can resolve as a rollout
  // without LANDED (see docs/reviews/proof-r9/findings.md).
  it('lands most of 16 more seeds and never crashes', () => {
    const seeds = [1, 2, 3, 5, 11, 17, 23, 31, 64, 101, 256, 777, 1234, 4242, 31415, 65535]
    const flights = seeds.map(seed => ({ seed, ...freeFlight(seed) }))
    for (const flight of flights) {
      expect(flight.startOnGround).toBe(true)
      expect(flight.crashed).toBeNull()
      expect(flight.finish).toBeNull()
    }
    expect(flights.filter(f => f.banners.length === 1 && f.stopped).length).toBeGreaterThanOrEqual(12)
  }, 240_000)

  it('keeps the LANDED banner wired to touchdown in the game loop', () => {
    expect(MAIN).toContain("const freeFlightCourse = !perfectLineActive && activeSortie.course.profile === 'free'")
    expect(MAIN).toMatch(/const announce = announcesLanding\(freeFlightCourse, touch, wasAirborne, aircraft\.status\)\s*aircraft\.markLanded\(\)\s*wasAirborne = false\s*if \(announce\) \{\s*audio\.playCue\('landed'\)\s*showBanner\('LANDED', 2800, 'success'\)/)
    expect(MAIN.match(/showBanner\('LANDED'/g)).toHaveLength(1)
  })
})
