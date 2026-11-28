import { describe, expect, it } from 'vitest'
import {
  AUDIO_CHANNEL_STORAGE_KEYS,
  audioVolumePercent,
  normalizeAudioChannelVolume,
  normalizeAudioVolume,
  readAudioChannelVolume,
  readAudioVolume,
  writeAudioChannelVolume,
  writeAudioVolume,
} from '../src/audio/AudioPreferences'

describe('audio volume preferences', () => {
  it('normalizes invalid and out-of-range values', () => {
    expect(normalizeAudioVolume(-1)).toBe(0)
    expect(normalizeAudioVolume(2)).toBe(1)
    expect(normalizeAudioVolume(Number.NaN, 0.35)).toBeCloseTo(0.35)
  })

  it('round-trips volume through browser storage', () => {
    let value: string | null = null
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next },
    }
    writeAudioVolume(storage, 0.65)
    expect(readAudioVolume(storage)).toBeCloseTo(0.65)
  })

  it('formats a stable user-facing percentage', () => {
    expect(audioVolumePercent(0)).toBe('0%')
    expect(audioVolumePercent(0.655)).toBe('66%')
    expect(audioVolumePercent(2)).toBe('100%')
  })

  it('keeps engine, environment, and effects channels independent', () => {
    const values = new Map<string, string>([[AUDIO_CHANNEL_STORAGE_KEYS.engine, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeAudioChannelVolume(-1)).toBe(0)
    expect(readAudioChannelVolume(storage, 'engine')).toBe(1)
    writeAudioChannelVolume(storage, 'engine', 0.35)
    writeAudioChannelVolume(storage, 'environment', 0.65)
    writeAudioChannelVolume(storage, 'effects', 0.85)
    expect(readAudioChannelVolume(storage, 'engine')).toBeCloseTo(0.35)
    expect(readAudioChannelVolume(storage, 'environment')).toBeCloseTo(0.65)
    expect(readAudioChannelVolume(storage, 'effects')).toBeCloseTo(0.85)
  })

  it('falls back to a clamped default when storage reads or writes throw', () => {
    const denied = {
      getItem: (): string | null => { throw new Error('denied') },
      setItem: (): void => { throw new Error('quota') },
    }
    expect(readAudioVolume(denied, 0.4)).toBe(0.4)
    expect(readAudioVolume(denied, 3)).toBe(1)
    expect(readAudioVolume(denied, Number.NaN)).toBe(1)
    expect(readAudioChannelVolume(denied, 'effects', -2)).toBe(0)
    expect(readAudioChannelVolume({ getItem: () => '   ' }, 'engine', 0.25)).toBe(0.25)
    expect(() => writeAudioVolume(denied, 0.5)).not.toThrow()
    expect(() => writeAudioChannelVolume(denied, 'environment', 0.5)).not.toThrow()
  })
})
