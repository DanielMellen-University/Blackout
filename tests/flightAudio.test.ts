import { describe, expect, it } from 'vitest'
import {
  EVENT_NOISE_BUFFER_SECONDS,
  FLIGHT_AUDIO_LIMITER,
  enginePlaybackRate,
  precipitationAudioLevel,
  shouldScheduleAudioTarget,
  shouldSkipMutedAudioUpdate,
} from '../src/audio/FlightAudio'

describe('flight audio automation', () => {
  it('keeps the shared event-noise pool longer than every cue envelope', () => {
    expect(EVENT_NOISE_BUFFER_SECONDS).toBeGreaterThan(0.58)
    expect(EVENT_NOISE_BUFFER_SECONDS).toBeLessThan(1)
  })

  it('keeps the output limiter conservative and bounded', () => {
    expect(FLIGHT_AUDIO_LIMITER.threshold).toBeLessThan(0)
    expect(FLIGHT_AUDIO_LIMITER.knee).toBeGreaterThan(0)
    expect(FLIGHT_AUDIO_LIMITER.ratio).toBeGreaterThanOrEqual(8)
    expect(FLIGHT_AUDIO_LIMITER.attack).toBeGreaterThan(0)
    expect(FLIGHT_AUDIO_LIMITER.attack).toBeLessThan(0.01)
    expect(FLIGHT_AUDIO_LIMITER.release).toBeGreaterThan(0.05)
    expect(FLIGHT_AUDIO_LIMITER.release).toBeLessThan(0.3)
  })

  it('schedules the first target and meaningful changes', () => {
    expect(shouldScheduleAudioTarget(undefined, 0.4)).toBe(true)
    expect(shouldScheduleAudioTarget(0.4, 0.401)).toBe(true)
    expect(shouldScheduleAudioTarget(0.4, 0.4004)).toBe(false)
  })

  it('treats non-positive epsilon as exact comparison', () => {
    expect(shouldScheduleAudioTarget(0.4, 0.400001, 0)).toBe(true)
    expect(shouldScheduleAudioTarget(0.4, 0.4, 0)).toBe(false)
  })

  it('skips repeated muted updates without blocking unmute transitions', () => {
    expect(shouldSkipMutedAudioUpdate(true, true)).toBe(true)
    expect(shouldSkipMutedAudioUpdate(true, false)).toBe(false)
    expect(shouldSkipMutedAudioUpdate(false, true)).toBe(false)
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
