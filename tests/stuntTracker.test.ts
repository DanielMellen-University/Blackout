import { describe, expect, it } from 'vitest'
import { MAX_STUNT_ROLLS, StuntTracker } from '../src/systems/StuntTracker'

describe('StuntTracker', () => {
  it('announces a completed barrel roll and keeps partial progress bounded', () => {
    const tracker = new StuntTracker()
    const rate = Math.PI * 2
    expect(tracker.update(0.5, true, rate)).toBeNull()
    expect(tracker.progress).toBeCloseTo(0.5)
    const event = tracker.update(0.5, true, rate)
    expect(event).toEqual({ kind: 'barrel-roll', rolls: 1, totalRolls: 1 })
    expect(tracker.progress).toBeCloseTo(0)
  })

  it('resets partial travel on touchdown or a committed direction change', () => {
    const tracker = new StuntTracker()
    tracker.update(0.4, true, Math.PI)
    expect(tracker.progress).toBeGreaterThan(0)
    tracker.update(0.1, true, -Math.PI)
    expect(tracker.progress).toBeCloseTo(0.05)
    tracker.update(0.2, true, Math.PI)
    tracker.update(0.1, false, Math.PI)
    expect(tracker.progress).toBe(0)
    expect(tracker.totalRolls).toBe(0)
  })

  it('clamps malformed rates and the total stunt budget', () => {
    const tracker = new StuntTracker()
    expect(tracker.update(Number.NaN, true, Number.POSITIVE_INFINITY)).toBeNull()
    for (let i = 0; i < MAX_STUNT_ROLLS + 2; i++) {
      tracker.update(0.5, true, Math.PI * 4)
      tracker.update(0.5, true, Math.PI * 4)
    }
    expect(tracker.totalRolls).toBe(MAX_STUNT_ROLLS)
    expect(tracker.progress).toBeGreaterThanOrEqual(0)
    expect(tracker.progress).toBeLessThanOrEqual(1)
  })
})
