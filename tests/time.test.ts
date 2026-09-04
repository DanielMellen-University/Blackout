import { describe, expect, it } from 'vitest'
import { SIM_STEP, Time } from '../src/core/Time'

describe('Time', () => {
  it('runs extra fixed steps instead of slowing down at 10 fps', () => {
    const time = new Time()
    expect(time.beginFrame(0).steps).toBe(0)
    const frame = time.beginFrame(100)
    // 100 ms at 10 fps → 6 steps of 1/60 would be needed; catch-up is capped at 5.
    expect(frame.stepDt).toBe(SIM_STEP)
    expect(frame.steps).toBe(5)
  })

  it('does not dump a long tab-hide gap into the simulator', () => {
    const time = new Time()
    time.beginFrame(0)
    const frame = time.beginFrame(5000)
    expect(frame.steps).toBe(1)
  })

  it('drops accumulated time while skipped / paused', () => {
    const time = new Time()
    time.beginFrame(0)
    time.skipFrame(1000)
    const frame = time.beginFrame(1016)
    expect(frame.steps).toBeLessThanOrEqual(2)
  })

  it('exposes leftover time as a render blend factor', () => {
    const time = new Time()
    time.beginFrame(0)
    const frame = time.beginFrame(20)
    expect(frame.steps).toBe(1)
    expect(frame.alpha).toBeCloseTo(20 / 1000 / SIM_STEP - 1, 5)
    expect(frame.alpha).toBeGreaterThan(0)
    expect(frame.alpha).toBeLessThan(1)
  })
})
