import { describe, expect, it } from 'vitest'
import {
  altitudeMilestoneThresholds,
  AltitudeMilestoneTracker,
} from '../src/systems/AltitudeMilestones'

describe('AltitudeMilestoneTracker', () => {
  it('announces each climb tier once and retains the highest tier', () => {
    const tracker = new AltitudeMilestoneTracker()
    expect(altitudeMilestoneThresholds()).toEqual([500, 1_500, 3_000, 6_000])
    expect(tracker.update(499, true)).toBeNull()
    expect(tracker.update(500, true)).toEqual({ thresholdM: 500, crossedCount: 1 })
    expect(tracker.update(900, true)).toBeNull()
    expect(tracker.update(1_500, true)).toEqual({ thresholdM: 1_500, crossedCount: 2 })
    expect(tracker.highestThresholdM).toBe(1_500)
    expect(tracker.nextThresholdM).toBe(3_000)
    expect(tracker.update(300, true)).toBeNull()
    expect(tracker.highestThresholdM).toBe(1_500)
  })

  it('handles skipped tiers, malformed altitude, and reset safely', () => {
    const tracker = new AltitudeMilestoneTracker()
    expect(tracker.update(Number.NaN, true)).toBeNull()
    expect(tracker.update(6_000, true)).toEqual({ thresholdM: 6_000, crossedCount: 4 })
    expect(tracker.highestThresholdM).toBe(6_000)
    expect(tracker.nextThresholdM).toBe(0)
    expect(tracker.update(Number.POSITIVE_INFINITY, true)).toBeNull()
    expect(tracker.update(7_000, false)).toBeNull()
    tracker.reset()
    expect(tracker.highestThresholdM).toBe(0)
    expect(tracker.nextThresholdM).toBe(500)
    expect(tracker.update(500, true)).toEqual({ thresholdM: 500, crossedCount: 1 })
  })
})
