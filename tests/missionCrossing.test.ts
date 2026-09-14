import { Scene } from 'three'
import { describe, expect, it } from 'vitest'
import {
  gateProximityEmphasis,
  gateBeaconDistanceOpacity,
  missionPassFlashOpacity,
  missionPassFlashScale,
  buildMissionRoute,
  routeProfileForSpawn,
  routeProfileLabel,
  routeModifierForSpawn,
  routeModifierLabel,
  scoringFocusForModifier,
  scoringFocusLabel,
  summarizeMissionRoute,
  MissionSystem,
  gateQualityLabel,
} from '../src/systems/Mission'
import { sampleTerrainHeight } from '../src/world/terrainSample'

describe('MissionSystem gate crossing', () => {
  it('maps finite gate quality into readable event labels', () => {
    expect(gateQualityLabel(1)).toBe('PERFECT')
    expect(gateQualityLabel(0.6)).toBe('CLEAN')
    expect(gateQualityLabel(0.2)).toBe('EDGE')
    expect(gateQualityLabel(0)).toBe('MISS')
    expect(gateQualityLabel(Number.NaN)).toBe('MISS')
  })

  it('does not award a gate that the jet spawned beyond', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const gate = mission.activeGatePos()
    expect(gate).not.toBeNull()
    const pos = gate!
    // First sample arms the previous-position latch.
    expect(mission.update(pos.x, pos.y, pos.z)).toBe('none')
    // Sitting 10 m past the plane without a prior crossing must not count.
    const aheadX = pos.x + 10
    expect(mission.update(aheadX, pos.y, pos.z)).toBe('none')
  })

  it('awards a forward plane crossing inside the ring', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const gate = mission.activeGatePos()!
    const ring = mission.root.getObjectByName('gate_0')!
    const fwdX = Math.sin(ring.rotation.y)
    const fwdZ = Math.cos(ring.rotation.y)
    const behindX = gate.x - fwdX * 20
    const behindZ = gate.z - fwdZ * 20
    const aheadX = gate.x + fwdX * 20
    const aheadZ = gate.z + fwdZ * 20
    expect(mission.update(behindX, gate.y, behindZ)).toBe('none')
    expect(mission.update(aheadX, gate.y, aheadZ)).toBe('pass')
  })

  it('reports a forward crossing outside the ring so the pilot can re-align', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const gate = mission.activeGatePos()!
    const ring = mission.root.getObjectByName('gate_0')!
    const fwdX = Math.sin(ring.rotation.y)
    const fwdZ = Math.cos(ring.rotation.y)
    const behindX = gate.x - fwdX * 20
    const behindZ = gate.z - fwdZ * 20
    const missY = gate.y + 80
    const aheadX = gate.x + fwdX * 20
    const aheadZ = gate.z + fwdZ * 20
    expect(mission.update(behindX, missY, behindZ)).toBe('none')
    expect(mission.update(aheadX, missY, aheadZ)).toBe('miss')
    expect(mission.activeGatePos()).toBe(gate)
    expect(mission.lastPassQuality).toBe(0)
    mission.dispose()
  })

  it('reuses the HUD telemetry snapshot between frames', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)

    const first = mission.hud(0, 20, 0)
    const second = mission.hud(4, 24, 8)

    expect(second).toBe(first)
    expect(second.status).toBe('live')
    expect(second.dist).toBeGreaterThan(0)
  })

  it('keeps the live beacon aligned without a per-frame reposition', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const gate = mission.activeGatePos()!
    const beacon = mission.root.getObjectByName('GateBeacon')!

    expect(beacon.position.x).toBe(gate.x)
    expect(beacon.position.y).toBe(gate.y)
    expect(beacon.position.z).toBe(gate.z)

    mission.tick()

    expect(beacon.position.x).toBe(gate.x)
    expect(beacon.position.y).toBe(gate.y)
    expect(beacon.position.z).toBe(gate.z)
    mission.dispose()
  })

  it('uses a deterministic frame clock for gate presentation', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const ring = mission.root.getObjectByName('gate_0')!

    mission.tick()
    const firstScale = ring.scale.x
    mission.tick()

    expect(ring.scale.x).not.toBe(firstScale)
    mission.dispose()
  })

  it('reuses the fixed gate scene footprint across retries', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    const childCount = mission.root.children.length
    const firstGate = mission.root.getObjectByName('gate_0')

    mission.start(120, 24, -80, 0.7)

    expect(mission.root.children).toHaveLength(childCount)
    expect(mission.root.getObjectByName('gate_0')).toBe(firstGate)
    expect(mission.activeGatePos()?.x).not.toBe(0)
    mission.dispose()
  })

  it('keeps the gate pass flash bounded and monotonic', () => {
    expect(missionPassFlashScale(0)).toBe(1)
    expect(missionPassFlashScale(0.5)).toBeGreaterThan(1)
    expect(missionPassFlashScale(1)).toBeCloseTo(3.2)
    expect(missionPassFlashOpacity(0)).toBeCloseTo(0.86)
    expect(missionPassFlashOpacity(0.5)).toBeGreaterThan(missionPassFlashOpacity(1))
    expect(missionPassFlashOpacity(2)).toBe(0)
  })

  it('ramps soft gate proximity emphasis inside a few ring radii', () => {
    expect(gateProximityEmphasis(400, 36)).toBe(0)
    expect(gateProximityEmphasis(36, 36)).toBe(1)
    expect(gateProximityEmphasis(90, 36)).toBeGreaterThan(0)
    expect(gateProximityEmphasis(90, 36)).toBeLessThan(1)
    expect(gateProximityEmphasis(Number.NaN, 36)).toBe(0)
  })

  it('dims the tall beacon at close range without losing distant guidance', () => {
    expect(gateBeaconDistanceOpacity(0)).toBeCloseTo(0.24)
    expect(gateBeaconDistanceOpacity(420)).toBeCloseTo(1)
    expect(gateBeaconDistanceOpacity(1000)).toBeCloseTo(1)
    expect(gateBeaconDistanceOpacity(Number.NaN)).toBe(1)
  })

  it('contains malformed telemetry without poisoning the mission state', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN)
    const gate = mission.activeGatePos()!

    expect(Number.isFinite(gate.x)).toBe(true)
    expect(Number.isFinite(gate.y)).toBe(true)
    expect(Number.isFinite(gate.z)).toBe(true)

    const nav = mission.hud(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, Number.NaN)
    expect(Number.isFinite(nav.dist)).toBe(true)
    expect(Number.isFinite(nav.bearing!)).toBe(true)
    expect(Number.isFinite(nav.altDelta)).toBe(true)

    expect(mission.update(Number.NaN, gate.y, gate.z)).toBe('none')
    const ring = mission.root.getObjectByName('gate_0')!
    const fwdX = Math.sin(ring.rotation.y)
    const fwdZ = Math.cos(ring.rotation.y)
    expect(mission.update(gate.x - fwdX * 20, gate.y, gate.z - fwdZ * 20)).toBe('none')
    expect(mission.update(gate.x + fwdX * 20, gate.y, gate.z + fwdZ * 20)).toBe('pass')
    expect(Number.isFinite(missionPassFlashScale(Number.NaN))).toBe(true)
    mission.dispose()
  })

  it('builds a varied route with a forward first leg and finite gate poses', () => {
    const routeA = buildMissionRoute(0, 20, 0, 0)
    const routeB = buildMissionRoute(1400, 20, -900, 0.8)
    expect(routeA).toHaveLength(5)
    expect(routeB).toHaveLength(5)
    expect(routeA[0]!.z).toBeGreaterThan(0)
    expect(routeA[0]!.fwdZ).toBeGreaterThan(0.9)
    expect(routeA.map((point) => `${point.x.toFixed(2)}:${point.z.toFixed(2)}`))
      .not.toEqual(routeB.map((point) => `${point.x.toFixed(2)}:${point.z.toFixed(2)}`))
    for (const point of [...routeA, ...routeB]) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
      expect(Number.isFinite(point.z)).toBe(true)
      expect(Math.hypot(point.fwdX, point.fwdZ)).toBeCloseTo(1)
    }

    const routeC = buildMissionRoute(0, 20, 0, 0, 'ridge')
    for (const [route, start] of [
      [routeA, { x: 0, y: 20, z: 0 }],
      [routeB, { x: 1400, y: 20, z: -900 }],
      [routeC, { x: 0, y: 20, z: 0 }],
    ] as const) {
      let previous = start
      for (const point of route) {
        for (const t of [0.2, 0.4, 0.6, 0.8]) {
          const x = previous.x + (point.x - previous.x) * t
          const y = previous.y + (point.y - previous.y) * t
          const z = previous.z + (point.z - previous.z) * t
          expect(y - sampleTerrainHeight(x, z)).toBeGreaterThanOrEqual(119.9)
        }
        previous = point
      }
    }

    const summary = summarizeMissionRoute(0, 20, 0, routeA, 'orbit')
    expect(summary.profile).toBe('orbit')
    expect(summary.challenge).toBe('approach')
    expect(summary.challengeLabel).toBe('APPROACH')
    expect(summary.lengthMeters).toBeGreaterThan(0)
    expect(summary.minClearanceMeters).toBeGreaterThanOrEqual(119.9)
    expect(['relaxed', 'standard', 'technical']).toContain(summary.difficulty)
  })

  it('supports distinct readable route profiles without changing gate count', () => {
    const orbit = buildMissionRoute(0, 20, 0, 0, 'orbit')
    const sweep = buildMissionRoute(0, 20, 0, 0, 'sweep')
    const slalom = buildMissionRoute(0, 20, 0, 0, 'slalom')
    const ridge = buildMissionRoute(0, 20, 0, 0, 'ridge')
    const canyon = buildMissionRoute(0, 20, 0, 0, 'canyon')
    expect(orbit).toHaveLength(5)
    expect(sweep).toHaveLength(5)
    expect(slalom).toHaveLength(5)
    expect(ridge).toHaveLength(5)
    expect(canyon).toHaveLength(5)
    expect(sweep[1]!.x).not.toBeCloseTo(orbit[1]!.x)
    expect(slalom[1]!.x).not.toBeCloseTo(orbit[1]!.x)
    expect(ridge[3]!.y).toBeGreaterThan(orbit[3]!.y)
    expect(canyon[1]!.z).toBeGreaterThan(0)
    expect(sweep[0]!.z).toBeGreaterThan(0)
    expect(slalom[0]!.z).toBeGreaterThan(0)
    expect(routeProfileForSpawn(0, 0, 0)).toBe('orbit')
    expect(routeProfileForSpawn(0, 0, 1.2)).toBe('ridge')
    expect(routeProfileLabel('sweep')).toBe('SWEEP')
    expect(routeProfileLabel('slalom')).toBe('SLALOM')
    expect(routeProfileLabel('ridge')).toBe('RIDGE RUN')
    expect(routeProfileLabel('canyon')).toBe('CANYON RUN')
  })

  it('supports a no-gate free-flight profile', () => {
    expect(buildMissionRoute(0, 20, 0, 0, 'free')).toHaveLength(0)
    expect(routeProfileLabel('free')).toBe('FREE FLIGHT')
    const summary = summarizeMissionRoute(0, 20, 0, [], 'free')
    expect(summary.lengthMeters).toBe(0)
    expect(summary.label).toBe('FREE FLIGHT')

    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0, 'free')
    expect(mission.totalGates).toBe(0)
    expect(mission.routeBriefing).toContain('FREE FLIGHT')
    expect(mission.activeGatePos()).toBeNull()
    expect(mission.update(0, 20, 0)).toBe('none')
    mission.dispose()
  })

  it('adds deterministic route rhythm modifiers without changing the pooled gate count', () => {
    const steady = buildMissionRoute(0, 100_000, 0, 0, 'orbit', 'steady')
    const tempo = buildMissionRoute(0, 100_000, 0, 0, 'orbit', 'tempo')
    const altitude = buildMissionRoute(0, 100_000, 0, 0, 'orbit', 'altitude')
    expect(steady).toHaveLength(5)
    expect(tempo).toHaveLength(5)
    expect(altitude).toHaveLength(5)
    expect(tempo[1]!.x).not.toBeCloseTo(steady[1]!.x)
    expect(altitude[2]!.y).toBeGreaterThan(steady[2]!.y)
    expect(routeModifierForSpawn(0, 0, 0, 'orbit')).toBe('steady')
    expect(routeModifierLabel('tempo')).toBe('TEMPO')
    expect(scoringFocusForModifier('altitude')).toBe('landing')
    expect(scoringFocusLabel('pace')).toBe('PACE')
  })

  it('exposes cached route feedback after mission start', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    expect(mission.routeSummary.label).toBe(mission.routeProfileLabel)
    expect(mission.routeBriefing).toContain('MIN CLR')
    expect(mission.routeBriefing).toContain(mission.routeProfileLabel)
    expect(mission.routeBriefing).toContain(mission.routeModifierLabel)
    expect(mission.routeBriefing).toContain(mission.routeSummary.scoringFocusLabel)
    expect(mission.routeSummary.minClearanceMeters).toBeGreaterThanOrEqual(119.9)
    mission.dispose()
  })

  it('turns slalom routes into a tighter precision challenge', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8)
    const ring = mission.root.getObjectByName('gate_0')!
    expect(mission.routeProfile).toBe('slalom')
    expect(mission.routeSummary.challenge).toBe('precision')
    expect(mission.routeBriefing).toContain('PRECISION')
    expect(ring.scale.x).toBeCloseTo(0.82)
    mission.dispose()
  })

  it('turns ridge routes into a high-altitude challenge', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8, 'ridge')
    expect(mission.routeProfile).toBe('ridge')
    expect(mission.routeSummary.challenge).toBe('altitude')
    expect(mission.routeSummary.challengeLabel).toBe('CLIMB')
    expect(mission.routeSummary.maxAltitudeMeters).toBeGreaterThan(500)
    expect(mission.routeBriefing).toContain('CLIMB')
    mission.dispose()
  })

  it('turns canyon routes into a low-weave precision challenge', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8, 'canyon')
    expect(mission.routeProfile).toBe('canyon')
    expect(mission.routeSummary.challenge).toBe('precision')
    expect(mission.routeSummary.challengeLabel).toBe('PRECISION')
    expect(mission.routeSummary.lengthMeters).toBeGreaterThan(2_000)
    expect(mission.routeBriefing).toContain('CANYON RUN')
    mission.dispose()
  })

  it('preserves an explicitly selected course profile across route rebuilds', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0.8, 'orbit')
    expect(mission.routeProfile).toBe('orbit')
    expect(mission.routeSummary.challenge).toBe('approach')
    mission.start(0, 20, 0, 0.8, 'slalom')
    expect(mission.routeProfile).toBe('slalom')
    expect(mission.routeSummary.challenge).toBe('precision')
    mission.dispose()
  })

  it('ignores late mission calls after idempotent teardown', () => {
    const mission = new MissionSystem(new Scene())
    mission.start(0, 20, 0, 0)
    mission.dispose()
    mission.dispose()
    mission.start(100, 20, 100, 0)
    expect(mission.update(0, 0, 0)).toBe('none')
    expect(() => mission.tick()).not.toThrow()
  })
})
