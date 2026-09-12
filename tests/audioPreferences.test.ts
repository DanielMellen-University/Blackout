import { describe, expect, it } from 'vitest'
import {
  audioVolumePercent,
  normalizeAudioVolume,
  readAudioVolume,
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
})
