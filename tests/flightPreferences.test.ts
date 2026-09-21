import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KEYBOARD_YAW,
  DEFAULT_KEYBOARD_ROLL,
  DEFAULT_KEYBOARD_PITCH,
  DEFAULT_GHOST_VISIBLE,
  GHOST_VISIBILITY_STORAGE_KEY,
  KEYBOARD_PITCH_STORAGE_KEY,
  KEYBOARD_ROLL_STORAGE_KEY,
  KEYBOARD_YAW_STORAGE_KEY,
  keyboardRollPreferenceLabel,
  keyboardYawPreferenceLabel,
  keyboardPitchPreferenceLabel,
  normalizeKeyboardRollPreference,
  normalizeKeyboardYawPreference,
  normalizeKeyboardPitchPreference,
  normalizeGhostVisibilityPreference,
  readKeyboardRollPreference,
  readKeyboardYawPreference,
  readKeyboardPitchPreference,
  readGhostVisibilityPreference,
  writeKeyboardRollPreference,
  writeKeyboardYawPreference,
  writeKeyboardPitchPreference,
  writeGhostVisibilityPreference,
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

  it('normalizes and persists the keyboard roll preference independently', () => {
    const values = new Map<string, string>([[KEYBOARD_ROLL_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeKeyboardRollPreference('q-left')).toBe('q-left')
    expect(normalizeKeyboardRollPreference('bad')).toBe(DEFAULT_KEYBOARD_ROLL)
    expect(readKeyboardRollPreference(storage)).toBe(DEFAULT_KEYBOARD_ROLL)
    writeKeyboardRollPreference(storage, 'q-left')
    expect(values.get(KEYBOARD_ROLL_STORAGE_KEY)).toBe('q-left')
    expect(keyboardRollPreferenceLabel('q-left')).toBe('Q LEFT / E RIGHT')
  })

  it('normalizes and persists the keyboard pitch preference independently', () => {
    const values = new Map<string, string>([[KEYBOARD_PITCH_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeKeyboardPitchPreference('w-down')).toBe('w-down')
    expect(normalizeKeyboardPitchPreference('bad')).toBe(DEFAULT_KEYBOARD_PITCH)
    expect(readKeyboardPitchPreference(storage)).toBe(DEFAULT_KEYBOARD_PITCH)
    writeKeyboardPitchPreference(storage, 'w-down')
    expect(values.get(KEYBOARD_PITCH_STORAGE_KEY)).toBe('w-down')
    expect(readKeyboardPitchPreference(storage)).toBe('w-down')
    expect(keyboardPitchPreferenceLabel('w-down')).toBe('W DOWN / S UP')
  })

  it('persists ghost visibility without coupling it to keyboard preferences', () => {
    const values = new Map<string, string>([[GHOST_VISIBILITY_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeGhostVisibilityPreference('false')).toBe(false)
    expect(normalizeGhostVisibilityPreference('1')).toBe(true)
    expect(normalizeGhostVisibilityPreference('bad')).toBe(DEFAULT_GHOST_VISIBLE)
    expect(readGhostVisibilityPreference(storage)).toBe(DEFAULT_GHOST_VISIBLE)
    writeGhostVisibilityPreference(storage, false)
    expect(values.get(GHOST_VISIBILITY_STORAGE_KEY)).toBe('false')
    expect(readGhostVisibilityPreference(storage)).toBe(false)
    writeGhostVisibilityPreference(storage, true)
    expect(values.get(GHOST_VISIBILITY_STORAGE_KEY)).toBe('true')
  })

  it('survives ghost preference storage failures', () => {
    const storage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(readGhostVisibilityPreference(storage, false)).toBe(false)
    expect(() => writeGhostVisibilityPreference(storage, true)).not.toThrow()
  })
})
