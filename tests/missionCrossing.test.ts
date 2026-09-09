import { Scene } from 'three'
import { describe, expect, it } from 'vitest'
import {
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

  it('keeps the gate pass flash bounded and monotonic', () => {
    expect(missionPassFlashScale(0)).toBe(1)
    expect(missionPassFlashScale(0.5)).toBeGreaterThan(1)
    expect(missionPassFlashScale(1)).toBeCloseTo(3.2)
    expect(missionPassFlashOpacity(0)).toBeCloseTo(0.86)
    expect(missionPassFlashOpacity(0.5)).toBeGreaterThan(missionPassFlashOpacity(1))
    expect(missionPassFlashOpacity(2)).toBe(0)
  })
})
