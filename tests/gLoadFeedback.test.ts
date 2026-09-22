import { describe, expect, it } from 'vitest'
import {
  BLACKOUT_ENTER_G,
  BLACKOUT_EXIT_G,
  GLoadFeedbackTracker,
  REDOUT_ENTER_G,
  REDOUT_EXIT_G,
  blackoutVignetteIntensity,
  gLoadVisionBanner,
  redoutWashIntensity,
} from '../src/systems/GLoadFeedback'

describe('high-G blackout / redout feedback', () => {
  it('stays clear through the old blackout band', () => {
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(1)
    expect(tracker.update(BLACKOUT_ENTER_G - 0.2)).toBe('normal')
    expect(tracker.update(BLACKOUT_ENTER_G)).toBe('normal')
    expect(tracker.band).toBe('normal')
    expect(tracker.update(BLACKOUT_EXIT_G)).toBe('normal')
    expect(tracker.update(12)).toBe('normal')
  })

  it('stays clear through the old redout band', () => {
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(1)
    expect(tracker.update(REDOUT_ENTER_G + 0.1)).toBe('normal')
    expect(tracker.update(REDOUT_ENTER_G)).toBe('normal')
    expect(tracker.update(REDOUT_EXIT_G)).toBe('normal')
    expect(tracker.update(-4)).toBe('normal')
  })

  it('does not announce blackout or redout', () => {
    expect(gLoadVisionBanner('blackout', null)).toBeNull()
    expect(gLoadVisionBanner('blackout', 'normal')).toBeNull()
    expect(gLoadVisionBanner('redout', 'normal')).toBeNull()
    expect(gLoadVisionBanner('normal', 'blackout')).toBeNull()
  })

  it('paints no vignette and contains malformed load', () => {
    expect(blackoutVignetteIntensity(1)).toBe(0)
    expect(blackoutVignetteIntensity(BLACKOUT_ENTER_G)).toBe(0)
    expect(blackoutVignetteIntensity(12)).toBe(0)
    expect(redoutWashIntensity(1)).toBe(0)
    expect(redoutWashIntensity(REDOUT_ENTER_G)).toBe(0)
    expect(redoutWashIntensity(-4)).toBe(0)
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(Number.NaN)
    expect(tracker.update(Number.NaN)).toBe('normal')
    expect(tracker.update(Number.POSITIVE_INFINITY)).toBe('normal')
    expect(blackoutVignetteIntensity(Number.NaN)).toBe(0)
    expect(redoutWashIntensity(Number.NaN)).toBe(0)
  })
})
