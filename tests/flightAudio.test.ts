import { describe, expect, it } from 'vitest'
import {
  EVENT_NOISE_BUFFER_SECONDS,
  FLIGHT_AUDIO_LIMITER,
  FlightAudio,
  audioContextUsable,
  enginePlaybackRate,
  engineWhineLevel,
  flightAudioViewMix,
  gLoadCueBand,
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
    expect(shouldScheduleAudioTarget(0.4, Number.NaN)).toBe(false)
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

  it('treats a browser-closed context as unavailable for graph writes', () => {
    expect(audioContextUsable('running')).toBe(true)
    expect(audioContextUsable('suspended')).toBe(true)
    expect(audioContextUsable('closed')).toBe(false)
    expect(audioContextUsable('unexpected')).toBe(true)
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
    expect(enginePlaybackRate(Number.NaN, false)).toBeCloseTo(.72)
  })

  it('adds a smooth, bounded turbine whine above idle', () => {
    expect(engineWhineLevel(0, false)).toBe(0)
    expect(engineWhineLevel(.16, false)).toBe(0)
    expect(engineWhineLevel(.5, false)).toBeGreaterThan(0)
    expect(engineWhineLevel(1, false)).toBeCloseTo(.82)
    expect(engineWhineLevel(1, true)).toBe(1)
    expect(engineWhineLevel(2, true)).toBeLessThanOrEqual(1)
    expect(engineWhineLevel(-1, true)).toBe(0)
    expect(engineWhineLevel(Number.NaN, true)).toBe(0)
  })

  it('keeps precipitation ambience subtle and bounded', () => {
    expect(precipitationAudioLevel(0, 0)).toBe(0)
    expect(precipitationAudioLevel(1, 0)).toBeCloseTo(0.9)
    expect(precipitationAudioLevel(0, 1)).toBeCloseTo(0.18)
    expect(precipitationAudioLevel(4, 4)).toBeLessThanOrEqual(1)
    expect(precipitationAudioLevel(-1, -1)).toBe(0)
    expect(precipitationAudioLevel(Number.NaN, Number.NaN)).toBe(0)
  })

  it('only announces meaningful high or negative load bands', () => {
    expect(gLoadCueBand(1)).toBe('normal')
    expect(gLoadCueBand(4)).toBe('high')
    expect(gLoadCueBand(-0.35)).toBe('negative')
    expect(gLoadCueBand(-0.2)).toBe('normal')
    expect(gLoadCueBand(Number.NaN)).toBe('normal')
  })

  it('muffles external wind and precipitation inside the cockpit', () => {
    const external = flightAudioViewMix(false)
    const cockpit = flightAudioViewMix(true)
    expect(cockpit.wind).toBeLessThan(external.wind)
    expect(cockpit.precipitation).toBeLessThan(external.precipitation)
    expect(cockpit.engine).toBeLessThan(external.engine)
    expect(cockpit.engine).toBeGreaterThan(0.8)
  })

  it('keeps the user volume level bounded', () => {
    const audio = new FlightAudio()
    expect(audio.setVolume(-1)).toBe(0)
    expect(audio.volumeLevel).toBe(0)
    expect(audio.setVolume(0.65)).toBeCloseTo(0.65)
    expect(audio.setVolume(2)).toBe(1)
  })

  it('makes teardown idempotent and blocks post-dispose graph work', async () => {
    const audio = new FlightAudio()
    expect(audio.isDisposed).toBe(false)
    audio.dispose()
    expect(audio.isDisposed).toBe(true)
    audio.dispose()
    await audio.resume()
    audio.playCue('gate')
    audio.silence()
    expect(audio.isDisposed).toBe(true)
  })
})
