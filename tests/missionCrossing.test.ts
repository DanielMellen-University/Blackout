import { Scene } from 'three'
import { describe, expect, it } from 'vitest'
import {
  gateProximityEmphasis,
  gateBeaconDistanceOpacity,
  missionPassFlashOpacity,
  missionPassFlashScale,
  MissionSystem,
} from '../src/systems/Mission'

describe('MissionSystem gate crossing', () => {
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
    const t = 0.55
    const fwdX = Math.cos(t)
    const fwdZ = -Math.sin(t)
    const behindX = gate.x - fwdX * 20
    const behindZ = gate.z - fwdZ * 20
    const aheadX = gate.x + fwdX * 20
    const aheadZ = gate.z + fwdZ * 20
    expect(mission.update(behindX, gate.y, behindZ)).toBe('none')
    expect(mission.update(aheadX, gate.y, aheadZ)).toBe('pass')
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
    const t = 0.55
    const fwdX = Math.cos(t)
    const fwdZ = -Math.sin(t)
    expect(mission.update(gate.x - fwdX * 20, gate.y, gate.z - fwdZ * 20)).toBe('none')
    expect(mission.update(gate.x + fwdX * 20, gate.y, gate.z + fwdZ * 20)).toBe('pass')
    expect(Number.isFinite(missionPassFlashScale(Number.NaN))).toBe(true)
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
