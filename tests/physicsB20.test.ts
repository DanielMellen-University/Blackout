import { describe, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig as C } from '../src/aircraft/flightConfig'
import { setContactHeightSampler } from '../src/world/ground'
import { measurePhysics } from './helpers/physicsB20'

const metrics = measurePhysics()
describe('b20 jet handling envelope', () => {
  it('gives crisp full-stick rates and stops smoothly after release', () => {
    expect(metrics.roll.rateDegS).toBeGreaterThan(180)
    expect(metrics.roll.rateDegS).toBeLessThan(190)
    expect(metrics.pitch.rateDegS).toBeGreaterThan(59)
    expect(metrics.pitch.rateDegS).toBeLessThan(64)
    expect(metrics.roll.residualAfter250msDegS).toBeLessThan(3)
    expect(metrics.pitch.residualAfter250msDegS).toBeLessThan(3)
  })
  it('spends meaningful energy in a sustained hard turn', () => {
    expect(metrics.turn.lossMps).toBeGreaterThan(38)
    expect(metrics.turn.lossMps).toBeLessThan(52)
    expect(metrics.turn.peakG).toBeGreaterThan(7)
    expect(metrics.turn.peakG).toBeLessThan(9)
  })
  it('preserves dry cruise and trades energy with altitude once', () => {
    expect(metrics.topSpeedMps).toBeCloseTo(340, 1)
    expect(metrics.climb.endSpeedMps).toBeGreaterThan(320)
    expect(metrics.climb.endSpeedMps).toBeLessThan(324)
    expect(metrics.climb.meanMps).toBeGreaterThan(160)
    expect(metrics.climb.meanMps).toBeLessThan(165)
    expect(metrics.dive.endSpeedMps).toBeGreaterThan(354)
    expect(metrics.dive.endSpeedMps).toBeLessThan(360)
  })
  it('develops a clear stall sink and recovers with power and forward stick', () => {
    expect(metrics.stall.sink2MpsOnset.speedMps).toBeGreaterThan(41)
    expect(metrics.stall.sink2MpsOnset.speedMps).toBeLessThan(47)
    expect(metrics.stall.maxSinkMps).toBeGreaterThan(12)
    expect(metrics.recovery.endSpeedMps).toBeGreaterThan(200)
    expect(Math.abs(metrics.recovery.verticalMps)).toBeLessThan(3)
    expect(metrics.recovery.altitudeChangeM).toBeGreaterThan(-180)
  })
  it('leaves afterburner commands, thrust and speed limits unchanged', () => {
    expect([C.cruiseSpeedBoost, C.maxSpeed, C.maxSpeedBoost, C.milAccel, C.afterburnerMinThrottle]).toEqual([520, 680, 680, 48, .05])
  })
  it('does not charge a turn penalty for pure roll and remains stable across step rates', () => {
    setContactHeightSampler(() => 0)
    const speeds: number[] = []
    try {
      for (const dt of [1 / 60, 1 / 120]) {
        const a = new Aircraft()
        a.position.set(0, 20000, 0); a.velocity.set(0, 0, 340)
        Object.assign(a.controls, { throttle: 1, gearDown: false, stabilityAssist: false, roll: 1 })
        for (let i = 0; i < 2 / dt; i++) a.step(dt)
        speeds.push(a.speed)
        expect(a.speed).toBeGreaterThan(339)
        expect(a.orientation.length()).toBeCloseTo(1, 10)
        a.dispose()
      }
      expect(Math.abs(speeds[0]! - speeds[1]!)).toBeLessThan(.2)
    } finally { setContactHeightSampler(null) }
  })
})
