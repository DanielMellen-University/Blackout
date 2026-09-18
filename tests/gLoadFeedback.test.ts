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
  it('enters blackout once and holds through the hysteretic band', () => {
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(1)
    expect(tracker.update(BLACKOUT_ENTER_G - 0.2)).toBe('normal')
    expect(tracker.update(BLACKOUT_ENTER_G)).toBe('blackout')
    expect(tracker.band).toBe('blackout')
    expect(tracker.update(BLACKOUT_EXIT_G + 0.1)).toBe('blackout')
    expect(tracker.update(BLACKOUT_EXIT_G)).toBe('normal')
  })

  it('enters redout once and recovers only after the exit ceiling', () => {
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(1)
    expect(tracker.update(REDOUT_ENTER_G + 0.1)).toBe('normal')
    expect(tracker.update(REDOUT_ENTER_G)).toBe('redout')
    expect(tracker.update(REDOUT_EXIT_G - 0.05)).toBe('redout')
    expect(tracker.update(REDOUT_EXIT_G)).toBe('normal')
  })

  it('announces only entry into blackout or redout', () => {
    expect(gLoadVisionBanner('blackout', null)).toBeNull()
    expect(gLoadVisionBanner('blackout', 'normal')).toBe('BLACKOUT / EASE THE PULL')
    expect(gLoadVisionBanner('redout', 'normal')).toBe('REDOUT / EASE THE PUSH')
    expect(gLoadVisionBanner('normal', 'blackout')).toBeNull()
    expect(gLoadVisionBanner('blackout', 'blackout')).toBeNull()
  })

  it('ramps overlay intensity and contains malformed load', () => {
    expect(blackoutVignetteIntensity(1)).toBe(0)
    expect(blackoutVignetteIntensity(BLACKOUT_ENTER_G)).toBeGreaterThan(0.5)
    expect(redoutWashIntensity(1)).toBe(0)
    expect(redoutWashIntensity(REDOUT_ENTER_G)).toBeGreaterThan(0.3)
    const tracker = new GLoadFeedbackTracker()
    tracker.reset(Number.NaN)
    expect(tracker.update(Number.NaN)).toBe('normal')
    expect(tracker.update(Number.POSITIVE_INFINITY)).toBe('normal')
    expect(tracker.update(12)).toBe('blackout')
    expect(blackoutVignetteIntensity(Number.NaN)).toBe(0)
    expect(redoutWashIntensity(Number.NaN)).toBe(0)
  })
})
