import { afterEach, describe, expect, it } from 'vitest'
import { Quaternion, Scene, Vector3 } from 'three'
import { readFileSync } from 'node:fs'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig } from '../src/aircraft/flightConfig'
import { CollisionSystem } from '../src/systems/Collision'
import { flightStart } from '../src/systems/AirborneStart'
import { ChallengeRun } from '../src/systems/ChallengeRun'
import { MissionSystem } from '../src/systems/Mission'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, findPlayableSpawn, sampleTerrainSurfaceHeightFast, setOpsPad } from '../src/world/terrainSample'

// r9 proof: Free flight on real seeded terrain keeps its runway start, a
// controls-only takeoff, a circuit, and a touchdown that raises LANDED.
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const PILOT = readFileSync('scripts/browser-generator.js', 'utf8').split('window.__training.catalog=')[0]!
const MAIN = readFileSync('src/main.ts', 'utf8')
afterEach(() => { setTerrainProfile(null); clearOpsPad() })

function freeFlight(seed: number) {
  setWorldSeed(seed); setTerrainProfile(null); clearOpsPad()
  const pad = findPlayableSpawn()!
  setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  // World.applySpawn: 45 m behind the pad centre, resting on the gear.
  const spawn = { x: pad.x - Math.sin(pad.yaw) * 45, y: pad.y + flightConfig.gearHeight, z: pad.z - Math.cos(pad.yaw) * 45, yaw: pad.yaw }
  const aircraft = new Aircraft(), mission = new MissionSystem(new Scene()), collision = new CollisionSystem()
  const fwd = new Vector3(), inv = new Quaternion(), up = new Vector3()
  const attitude = (o: Quaternion) => {
    fwd.set(0, 0, 1).applyQuaternion(o); inv.copy(o).invert(); up.set(0, 1, 0).applyQuaternion(inv)
    return { pitch: Math.asin(clamp(fwd.y, -1, 1)), heading: Math.atan2(fwd.x, fwd.z), roll: Math.atan2(-up.x, up.y) }
  }
  try {
    mission.start(spawn.x, spawn.y, spawn.z, spawn.yaw, 'free')
    const gateStart = mission.totalGates > 0 ? mission.firstGateApproach() : null
    const start = flightStart(spawn, gateStart, sampleTerrainSurfaceHeightFast)
    aircraft.reset(start)
    const run = new ChallengeRun(null)
    run.reset('free-flight', mission.totalGates)
    const window: any = {}
    const world = { mission, spawn, runway: { position: new Vector3(pad.x, pad.y, pad.z) }, terrain: { sampleMeshHeight: () => null } }
    const make = new Function('window', 'aircraft', 'world', 'attitudeFromOrientation', 'challenge', 'activeSortie', 'b21Ground', 'wasAirborne', PILOT + '\nreturn window.__training')
    const pilot = make(window, aircraft, world, attitude, { phase: 'running' }, { course: {} }, sampleTerrainSurfaceHeightFast, false)
    const out = { gates: mission.totalGates, startOnGround: aircraft.onGround, startSpeed: aircraft.speed, startDistance: Math.hypot(start.x - spawn.x, start.z - spawn.z),
      maxAgl: 0, crashed: null as string | null, banners: [] as string[], landedAt: -1, stopped: false, finish: null as unknown }
    let wasAirborne = false
    pilot.start()
    const dt = 1 / 60
    for (let step = 0; step < 60 * 600; step++) {
      pilot.before(dt)
      aircraft.step(dt, step * 1000 / 60)
      if (!aircraft.onGround) wasAirborne = true
      out.maxAgl = Math.max(out.maxAgl, aircraft.altitudeAgl)
      const touch = collision.check(aircraft)
      if (touch === 'crash' || touch === 'ditch') { out.crashed = `${touch}:${collision.failureReason}`; break }
      run.update(dt, aircraft.speed, Math.max(0, aircraft.position.y - spawn.y), 0, 0, false, !aircraft.onGround)
      // main.ts: a touchdown after flight on an ok aircraft marks LANDED.
      if (touch === 'landed' && wasAirborne && aircraft.status === 'ok') {
        aircraft.markLanded(); wasAirborne = false; out.banners.push('LANDED'); out.landedAt = step / 60
      }
      if (out.landedAt >= 0 && aircraft.speed < 5) { out.stopped = true; break }
    }
    out.finish = run.finishAirborne()
    return out
  } finally { aircraft.dispose(); mission.dispose() }
}

describe('r9 proof: Free flight keeps its runway start, takeoff and landing', () => {
  it.each([1337])('seed %s takes off from the runway, flies a circuit and lands with LANDED', seed => {
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

  it.each([42, 9001, 7, 99, 2024])('seed %s starts at rest on its runway with no gates', seed => {
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

  it('keeps the LANDED banner wired to touchdown in the game loop', () => {
    expect(MAIN).toMatch(/touch === 'landed' && wasAirborne && aircraft\.status === 'ok'\) \{\s*aircraft\.markLanded\(\)\s*wasAirborne = false\s*audio\.playCue\('landed'\)\s*showBanner\('LANDED', 2800, 'success'\)/)
  })
})
