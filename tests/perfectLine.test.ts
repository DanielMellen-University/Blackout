import { afterEach, expect, test } from 'vitest'
import { Scene, Vector3, Quaternion } from 'three'
import { Aircraft } from '../src/aircraft/Aircraft'
import { CollisionSystem } from '../src/systems/Collision'
import { MissionSystem, buildMissionRoute } from '../src/systems/Mission'
import { refillNitroAtGate } from '../src/aircraft/NitroSystem'
import { buildPerfectLine, perfectLineHeight, PERFECT_LINE_SEED, PERFECT_LINE_SPEED } from '../src/world/PerfectLine'
import { setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, sampleTerrainSurfaceHeightFast } from '../src/world/terrainSample'
import { readFileSync } from 'node:fs'

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
afterEach(() => { setTerrainProfile(null); clearOpsPad() })

test('fixed corridor reproduces exactly, with 15 ordinary gates and shaped terrain', () => {
  const first = buildPerfectLine()
  setWorldSeed(99)
  expect(buildPerfectLine()).toEqual(first)
  expect(first.seed).toBe(PERFECT_LINE_SEED)
  expect(first.course).toHaveLength(15)
  expect(first.course.at(-1)!.z).toBe(11200)
  setWorldSeed(first.seed); setTerrainProfile(first.terrain); clearOpsPad()
  expect(buildMissionRoute(0, 420, 0, 0, 'perfect-line')).toEqual(first.course)
  const terrain = first.course.map(p => sampleTerrainSurfaceHeightFast(p.x, p.z))
  setTerrainProfile(null); setWorldSeed(1234)
  const retry = buildPerfectLine()
  setWorldSeed(retry.seed); setTerrainProfile(retry.terrain)
  expect(retry.course.map(p => sampleTerrainSurfaceHeightFast(p.x, p.z))).toEqual(terrain)
  for (const p of first.course) {
    expect(p.y - sampleTerrainSurfaceHeightFast(p.x, p.z)).toBeGreaterThan(120)
    expect(perfectLineHeight(p.x + 900, p.z) - perfectLineHeight(p.x, p.z)).toBeGreaterThan(450)
  }
})

test('ordinary controls fly all 15 gates to an airborne finish with unchanged physics', () => {
  const line = buildPerfectLine()
  setWorldSeed(line.seed); setTerrainProfile(line.terrain); clearOpsPad()
  const aircraft = new Aircraft(), mission = new MissionSystem(new Scene())
  const collision = new CollisionSystem()
  const fwd = new Vector3(), inv = new Quaternion(), up = new Vector3()
  const attitude = (orientation: Quaternion) => {
    fwd.set(0, 0, 1).applyQuaternion(orientation)
    inv.copy(orientation).invert(); up.set(0, 1, 0).applyQuaternion(inv)
    return { pitch: Math.asin(clamp(fwd.y, -1, 1)), heading: Math.atan2(fwd.x, fwd.z), roll: Math.atan2(-up.x, up.y) }
  }
  // Reuse the existing review pilot, controls only. It writes no flight state.
  const source = readFileSync('scripts/browser-generator.js', 'utf8').split('window.__training.catalog=')[0]!
  const window: any = {}
  try {
    aircraft.reset(line.start)
    aircraft.velocity.set(0, 0, PERFECT_LINE_SPEED)
    aircraft.controls.gearDown = false
    mission.start(0, 420, 0, 0, 'perfect-line', 'steady')
    expect(mission.routeFallbackUsed).toBe(false)
    expect(mission.totalGates).toBe(15)
    const makePilot = new Function('window', 'aircraft', 'world', 'attitudeFromOrientation', 'challenge', 'activeSortie', 'b21Ground', 'wasAirborne', source + '\nreturn window.__training')
    const pilot = makePilot(window, aircraft, { mission, spawn: line.start }, attitude, { phase: 'running' }, { course: {} }, sampleTerrainSurfaceHeightFast, true)
    pilot.start()
    let complete = false, elapsed = 0, awards = 0, misses = 0, minClearance = Infinity
    for (let step = 0; step < 60 * 100; step++) {
      pilot.before(1 / 60)
      aircraft.step(1 / 60, step * 1000 / 60)
      const touch = collision.check(aircraft)
      expect(touch).not.toBe('crash'); expect(touch).not.toBe('ditch')
      minClearance = Math.min(minClearance, aircraft.altitudeAgl)
      const event = mission.update(aircraft.position.x, aircraft.position.y, aircraft.position.z)
      if (event === 'miss') misses++
      if (event === 'pass' || event === 'complete') { refillNitroAtGate(aircraft.nitro, mission.totalGates); awards++ }
      if (event === 'complete') { complete = true; elapsed = (step + 1) / 60; break }
    }
    console.log(JSON.stringify({ complete, elapsed, awards, misses, minClearance, speed: aircraft.speed }))
    expect(complete).toBe(true); expect(awards).toBe(15); expect(misses).toBe(0)
    expect(aircraft.onGround).toBe(false)
    expect(elapsed).toBeGreaterThan(60); expect(elapsed).toBeLessThan(90)
    expect(minClearance).toBeGreaterThan(30)
  } finally { aircraft.dispose(); mission.dispose() }
})
