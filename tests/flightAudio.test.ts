import { describe, expect, it } from 'vitest'
import {
  enginePlaybackRate,
  precipitationAudioLevel,
  shouldScheduleAudioTarget,
} from '../src/audio/FlightAudio'

describe('flight audio automation', () => {
  it('schedules the first target and meaningful changes', () => {
    expect(shouldScheduleAudioTarget(undefined, 0.4)).toBe(true)
    expect(shouldScheduleAudioTarget(0.4, 0.401)).toBe(true)
    expect(shouldScheduleAudioTarget(0.4, 0.4004)).toBe(false)
  })

  it('treats non-positive epsilon as exact comparison', () => {
    expect(shouldScheduleAudioTarget(0.4, 0.400001, 0)).toBe(true)
    expect(shouldScheduleAudioTarget(0.4, 0.4, 0)).toBe(false)
  })

  it('spools the procedural engine without exceeding a safe playback envelope', () => {
    const idle = enginePlaybackRate(0, false)
    const cruise = enginePlaybackRate(.5, false)
    const military = enginePlaybackRate(1, false)
    const boost = enginePlaybackRate(1, true)

    expect(idle).toBeCloseTo(.72)
    expect(cruise).toBeGreaterThan(idle)
    expect(military).toBeGreaterThan(cruise)
    expect(boost).toBeGreaterThan(military)
    expect(boost).toBeLessThanOrEqual(1.3)
  })

  it('keeps precipitation ambience subtle and bounded', () => {
    expect(precipitationAudioLevel(0, 0)).toBe(0)
    expect(precipitationAudioLevel(1, 0)).toBeCloseTo(0.9)
    expect(precipitationAudioLevel(0, 1)).toBeCloseTo(0.18)
    expect(precipitationAudioLevel(4, 4)).toBeLessThanOrEqual(1)
    expect(precipitationAudioLevel(-1, -1)).toBe(0)
  })
})
