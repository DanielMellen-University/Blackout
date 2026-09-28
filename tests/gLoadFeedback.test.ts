import { describe, expect, it } from 'vitest'
import {
  BLACKOUT_ENTER_G,
  BLACKOUT_EXIT_G,
  GLoadFeedbackTracker,
  REDOUT_ENTER_G,
  REDOUT_EXIT_G,
  bandFromLoad,
  blackoutVignetteIntensity,
  gLoadVisionBanner,
  redoutWashIntensity,
} from '../src/systems/GLoadFeedback'

describe('high-G blackout / redout feedback', () => {
  it('classifies positive, negative, and ordinary load', () => {
    expect(bandFromLoad(BLACKOUT_ENTER_G)).toBe('blackout')
    expect(bandFromLoad(REDOUT_ENTER_G)).toBe('redout')
    expect(bandFromLoad(1)).toBe('normal')
    expect(bandFromLoad(Number.NaN)).toBe('normal')
    expect(bandFromLoad(Number.POSITIVE_INFINITY)).toBe('normal')
  })

  it('holds blackout until the hysteresis floor, then recovers', () => {
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(1)
    expect(tracker.update(BLACKOUT_ENTER_G - 0.2)).toBe('normal')
    expect(tracker.update(BLACKOUT_ENTER_G)).toBe('blackout')
    expect(tracker.update(BLACKOUT_EXIT_G + 0.1)).toBe('blackout')
    expect(tracker.update(BLACKOUT_EXIT_G)).toBe('normal')
  })

  it('holds redout until the hysteresis ceiling, then recovers', () => {
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(1)
    expect(tracker.update(REDOUT_ENTER_G + 0.1)).toBe('normal')
    expect(tracker.update(REDOUT_ENTER_G)).toBe('redout')
    expect(tracker.update(REDOUT_EXIT_G - 0.1)).toBe('redout')
    expect(tracker.update(REDOUT_EXIT_G)).toBe('normal')
  })

  it('announces only transitions into a vision band', () => {
    expect(gLoadVisionBanner('blackout', null)).toBe('BLACKOUT / EASE THE G')
    expect(gLoadVisionBanner('blackout', 'normal')).toBe('BLACKOUT / EASE THE G')
    expect(gLoadVisionBanner('blackout', 'blackout')).toBeNull()
    expect(gLoadVisionBanner('redout', 'normal')).toBe('REDOUT / PUSH GENTLY')
    expect(gLoadVisionBanner('normal', 'blackout')).toBeNull()
  })

  it('ramps bounded veil intensity and contains malformed load', () => {
    expect(blackoutVignetteIntensity(1)).toBe(0)
    expect(blackoutVignetteIntensity(BLACKOUT_ENTER_G - 0.1)).toBeGreaterThan(0)
    expect(blackoutVignetteIntensity(BLACKOUT_ENTER_G)).toBe(1)
    expect(blackoutVignetteIntensity(12)).toBe(1)
    expect(redoutWashIntensity(1)).toBe(0)
    expect(redoutWashIntensity(REDOUT_ENTER_G + 0.1)).toBeGreaterThan(0)
    expect(redoutWashIntensity(REDOUT_ENTER_G)).toBe(1)
    expect(redoutWashIntensity(-4)).toBe(1)
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(Number.NaN)
    expect(tracker.update(Number.NaN)).toBe('normal')
    expect(tracker.update(Number.POSITIVE_INFINITY)).toBe('normal')
    expect(blackoutVignetteIntensity(Number.NaN)).toBe(0)
    expect(redoutWashIntensity(Number.NaN)).toBe(0)
  })
})
