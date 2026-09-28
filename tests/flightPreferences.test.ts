import { describe, expect, it } from 'vitest'
import {
  DEFAULT_KEYBOARD_YAW,
  DEFAULT_KEYBOARD_ROLL,
  DEFAULT_KEYBOARD_PITCH,
  DEFAULT_KEYBOARD_BINDINGS,
  KEYBOARD_BINDINGS_STORAGE_KEY,
  DEFAULT_GHOST_VISIBLE,
  GHOST_VISIBILITY_STORAGE_KEY,
  CAMERA_MODE_STORAGE_KEY,
  DEFAULT_CAMERA_MODE,
  DEFAULT_STABILITY_ASSIST,
  CAMERA_SENSITIVITY_STORAGE_KEY,
  DEFAULT_CAMERA_SENSITIVITY,
  CAMERA_SPEED_FRAMING_STORAGE_KEY,
  DEFAULT_CAMERA_SPEED_FRAMING,
  CAMERA_AUTO_RETURN_STORAGE_KEY,
  DEFAULT_CAMERA_AUTO_RETURN,
  CAMERA_EFFECTS_STORAGE_KEY,
  DEFAULT_CAMERA_EFFECTS,
  HUD_DISPLAY_STORAGE_KEY,
  DEFAULT_HUD_DISPLAY,
  STABILITY_ASSIST_STORAGE_KEY,
  KEYBOARD_PITCH_STORAGE_KEY,
  KEYBOARD_ROLL_STORAGE_KEY,
  KEYBOARD_YAW_STORAGE_KEY,
  keyboardRollPreferenceLabel,
  keyboardYawPreferenceLabel,
  keyboardPitchPreferenceLabel,
  keyboardBindingLabel,
  normalizeKeyboardBindings,
  readKeyboardBindings,
  writeKeyboardBindings,
  normalizeKeyboardRollPreference,
  normalizeKeyboardYawPreference,
  normalizeKeyboardPitchPreference,
  normalizeGhostVisibilityPreference,
  normalizeCameraMode,
  normalizeStabilityAssistPreference,
  normalizeCameraSensitivity,
  cameraSensitivityMultiplier,
  cameraSensitivityLabel,
  readKeyboardRollPreference,
  readKeyboardYawPreference,
  readKeyboardPitchPreference,
  readGhostVisibilityPreference,
  readCameraModePreference,
  readStabilityAssistPreference,
  readCameraSensitivityPreference,
  writeKeyboardRollPreference,
  writeKeyboardYawPreference,
  writeKeyboardPitchPreference,
  writeGhostVisibilityPreference,
  writeCameraModePreference,
  writeStabilityAssistPreference,
  writeCameraSensitivityPreference,
  normalizeCameraSpeedFraming,
  readCameraSpeedFramingPreference,
  writeCameraSpeedFramingPreference,
  cameraSpeedFramingMultiplier,
  cameraSpeedFramingLabel,
  normalizeCameraAutoReturnPreference,
  readCameraAutoReturnPreference,
  writeCameraAutoReturnPreference,
  normalizeCameraEffectsPreference,
  readCameraEffectsPreference,
  writeCameraEffectsPreference,
  normalizeHudDisplay,
  readHudDisplayPreference,
  writeHudDisplayPreference,
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

  it('repairs duplicate utility bindings and persists a safe custom map', () => {
    const values = new Map<string, string>([
      [KEYBOARD_BINDINGS_STORAGE_KEY, JSON.stringify({ boost: 'KeyB', airbrake: 'KeyB', gear: 'bad' })],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const repaired = readKeyboardBindings(storage)
    expect(repaired.boost).toBe('KeyB')
    expect(repaired.airbrake).not.toBe(repaired.boost)
    expect(repaired.gear).not.toBe(repaired.boost)
    expect(normalizeKeyboardBindings({ boost: 'KeyF', airbrake: 'KeyH', gear: 'KeyJ' }))
      .toEqual({ boost: 'KeyF', airbrake: 'KeyH', gear: 'KeyJ' })
    writeKeyboardBindings(storage, { boost: 'KeyF', airbrake: 'KeyH', gear: 'KeyJ' })
    expect(JSON.parse(values.get(KEYBOARD_BINDINGS_STORAGE_KEY)!)).toEqual({
      boost: 'KeyF', airbrake: 'KeyH', gear: 'KeyJ',
    })
    expect(keyboardBindingLabel(DEFAULT_KEYBOARD_BINDINGS.boost)).toBe('SPACE')
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

  it('persists a valid camera mode and falls back on malformed values', () => {
    const values = new Map<string, string>([[CAMERA_MODE_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeCameraMode('orbit')).toBe('orbit')
    expect(normalizeCameraMode('bad')).toBe(DEFAULT_CAMERA_MODE)
    expect(readCameraModePreference(storage)).toBe(DEFAULT_CAMERA_MODE)
    writeCameraModePreference(storage, 'cockpit')
    expect(values.get(CAMERA_MODE_STORAGE_KEY)).toBe('cockpit')
    expect(readCameraModePreference(storage)).toBe('cockpit')
  })

  it('persists stability assist independently with a safe boolean fallback', () => {
    const values = new Map<string, string>([[STABILITY_ASSIST_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeStabilityAssistPreference('1')).toBe(true)
    expect(normalizeStabilityAssistPreference('bad')).toBe(DEFAULT_STABILITY_ASSIST)
    expect(readStabilityAssistPreference(storage)).toBe(DEFAULT_STABILITY_ASSIST)
    writeStabilityAssistPreference(storage, true)
    expect(values.get(STABILITY_ASSIST_STORAGE_KEY)).toBe('true')
    expect(readStabilityAssistPreference(storage)).toBe(true)
  })

  it('persists camera look sensitivity with bounded readable levels', () => {
    const values = new Map<string, string>([[CAMERA_SENSITIVITY_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeCameraSensitivity('low')).toBe('low')
    expect(normalizeCameraSensitivity('bad')).toBe(DEFAULT_CAMERA_SENSITIVITY)
    expect(readCameraSensitivityPreference(storage)).toBe(DEFAULT_CAMERA_SENSITIVITY)
    writeCameraSensitivityPreference(storage, 'high')
    expect(values.get(CAMERA_SENSITIVITY_STORAGE_KEY)).toBe('high')
    expect(readCameraSensitivityPreference(storage)).toBe('high')
    expect(cameraSensitivityMultiplier('low')).toBeLessThan(1)
    expect(cameraSensitivityMultiplier('high')).toBeGreaterThan(1)
    expect(cameraSensitivityLabel('normal')).toBe('NORMAL')
  })

  it('persists camera auto-return as a safe boolean preference', () => {
    const values = new Map<string, string>([[CAMERA_AUTO_RETURN_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeCameraAutoReturnPreference('0')).toBe(false)
    expect(normalizeCameraAutoReturnPreference('bad')).toBe(DEFAULT_CAMERA_AUTO_RETURN)
    expect(readCameraAutoReturnPreference(storage)).toBe(DEFAULT_CAMERA_AUTO_RETURN)
    writeCameraAutoReturnPreference(storage, false)
    expect(values.get(CAMERA_AUTO_RETURN_STORAGE_KEY)).toBe('false')
    expect(readCameraAutoReturnPreference(storage)).toBe(false)
  })

  it('persists camera effects independently from auto-return', () => {
    const values = new Map<string, string>([[CAMERA_EFFECTS_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeCameraEffectsPreference('0')).toBe(false)
    expect(normalizeCameraEffectsPreference('bad')).toBe(DEFAULT_CAMERA_EFFECTS)
    expect(readCameraEffectsPreference(storage)).toBe(DEFAULT_CAMERA_EFFECTS)
    writeCameraEffectsPreference(storage, false)
    expect(values.get(CAMERA_EFFECTS_STORAGE_KEY)).toBe('false')
    expect(readCameraEffectsPreference(storage)).toBe(false)
  })

  it('persists minimal HUD display without changing flight preferences', () => {
    const values = new Map<string, string>([[HUD_DISPLAY_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeHudDisplay('minimal')).toBe('minimal')
    expect(normalizeHudDisplay('bad')).toBe(DEFAULT_HUD_DISPLAY)
    expect(readHudDisplayPreference(storage)).toBe(DEFAULT_HUD_DISPLAY)
    writeHudDisplayPreference(storage, 'minimal')
    expect(values.get(HUD_DISPLAY_STORAGE_KEY)).toBe('minimal')
    expect(readHudDisplayPreference(storage)).toBe('minimal')
  })

  it('persists speed framing levels independently from camera look', () => {
    const values = new Map<string, string>([[CAMERA_SPEED_FRAMING_STORAGE_KEY, 'bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(normalizeCameraSpeedFraming('subtle')).toBe('subtle')
    expect(normalizeCameraSpeedFraming('bad')).toBe(DEFAULT_CAMERA_SPEED_FRAMING)
    expect(readCameraSpeedFramingPreference(storage)).toBe(DEFAULT_CAMERA_SPEED_FRAMING)
    writeCameraSpeedFramingPreference(storage, 'wide')
    expect(values.get(CAMERA_SPEED_FRAMING_STORAGE_KEY)).toBe('wide')
    expect(readCameraSpeedFramingPreference(storage)).toBe('wide')
    expect(cameraSpeedFramingMultiplier('subtle')).toBeLessThan(1)
    expect(cameraSpeedFramingMultiplier('wide')).toBeGreaterThan(1)
    expect(cameraSpeedFramingLabel('standard')).toBe('STANDARD')
  })
})
