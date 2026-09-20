import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KEYBOARD_YAW,
  KEYBOARD_YAW_STORAGE_KEY,
  keyboardYawPreferenceLabel,
  normalizeKeyboardYawPreference,
  readKeyboardYawPreference,
  writeKeyboardYawPreference,
} from '../src/core/FlightPreferences'

describe('keyboard flight preferences', () => {
  it('normalizes invalid values to the safe default', () => {
    expect(normalizeKeyboardYawPreference('a-left')).toBe('a-left')
    expect(normalizeKeyboardYawPreference('bad')).toBe(DEFAULT_KEYBOARD_YAW)
    expect(normalizeKeyboardYawPreference(undefined, 'a-left')).toBe('a-left')
    expect(keyboardYawPreferenceLabel('a-left')).toBe('A LEFT / D RIGHT')
  })

  it('repairs malformed storage and persists a valid preference', () => {
    const values = new Map<string, string>([[KEYBOARD_YAW_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(readKeyboardYawPreference(storage)).toBe(DEFAULT_KEYBOARD_YAW)
    writeKeyboardYawPreference(storage, 'a-left')
    expect(values.get(KEYBOARD_YAW_STORAGE_KEY)).toBe('a-left')
    expect(readKeyboardYawPreference(storage)).toBe('a-left')
  })

  it('survives storage failures without blocking flight setup', () => {
    const storage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(readKeyboardYawPreference(storage, 'a-left')).toBe('a-left')
    expect(() => writeKeyboardYawPreference(storage, 'a-right')).not.toThrow()
  })
})
