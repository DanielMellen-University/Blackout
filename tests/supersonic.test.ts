import { describe, expect, it } from 'vitest'
import {
  SUPERSONIC_REARM_MPS,
  SUPERSONIC_THRESHOLD_MPS,
  SupersonicTracker,
} from '../src/systems/Supersonic'

describe('supersonic flight cue', () => {
  it('crosses Mach 1 once and stays active above the re-arm band', () => {
    const tracker = new SupersonicTracker()
    tracker.reset(0)
    expect(tracker.active).toBe(false)
    expect(tracker.update(SUPERSONIC_THRESHOLD_MPS - 1)).toBe('none')
    expect(tracker.update(SUPERSONIC_THRESHOLD_MPS)).toBe('boom')
    expect(tracker.active).toBe(true)
    expect(tracker.update(SUPERSONIC_THRESHOLD_MPS + 20)).toBe('none')
    expect(tracker.update(SUPERSONIC_THRESHOLD_MPS)).toBe('none')
  })

  it('re-arms only after a meaningful subsonic drop', () => {
    const tracker = new SupersonicTracker()
    tracker.reset(SUPERSONIC_THRESHOLD_MPS)
    expect(tracker.update(SUPERSONIC_REARM_MPS + 1)).toBe('none')
    expect(tracker.active).toBe(true)
    expect(tracker.update(SUPERSONIC_REARM_MPS)).toBe('subsonic')
    expect(tracker.active).toBe(false)
    expect(tracker.update(SUPERSONIC_THRESHOLD_MPS)).toBe('boom')
  })

  it('contains malformed and negative speed values without poisoning state', () => {
    const tracker = new SupersonicTracker()
    tracker.reset(Number.NaN)
    expect(tracker.update(Number.NaN)).toBe('none')
    expect(tracker.update(-100)).toBe('none')
    expect(tracker.active).toBe(false)
    tracker.reset(Number.POSITIVE_INFINITY)
    expect(tracker.active).toBe(false)
    expect(tracker.update(Number.NaN)).toBe('none')
    expect(tracker.active).toBe(false)
  })
})
