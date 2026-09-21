/** Keyboard-only flight preferences kept separate from simulation state. */
export type KeyboardYawPreference = 'a-right' | 'a-left'
export type KeyboardRollPreference = 'q-right' | 'q-left'
export type KeyboardPitchPreference = 'w-up' | 'w-down'

export const KEYBOARD_YAW_STORAGE_KEY = 'blackout.keyboardYaw'
export const DEFAULT_KEYBOARD_YAW: KeyboardYawPreference = 'a-right'
export const KEYBOARD_ROLL_STORAGE_KEY = 'blackout.keyboardRoll'
export const DEFAULT_KEYBOARD_ROLL: KeyboardRollPreference = 'q-right'
export const KEYBOARD_PITCH_STORAGE_KEY = 'blackout.keyboardPitch'
export const DEFAULT_KEYBOARD_PITCH: KeyboardPitchPreference = 'w-up'

export function normalizeKeyboardYawPreference(
  value: unknown,
  fallback: KeyboardYawPreference = DEFAULT_KEYBOARD_YAW,
): KeyboardYawPreference {
  if (value === 'a-right' || value === 'a-left') return value
  return fallback === 'a-left' ? 'a-left' : DEFAULT_KEYBOARD_YAW
}

export function readKeyboardYawPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback: KeyboardYawPreference = DEFAULT_KEYBOARD_YAW,
): KeyboardYawPreference {
  try {
    return normalizeKeyboardYawPreference(storage?.getItem(KEYBOARD_YAW_STORAGE_KEY), fallback)
  } catch {
    return normalizeKeyboardYawPreference(undefined, fallback)
  }
}

export function writeKeyboardYawPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  preference: KeyboardYawPreference,
): void {
  try {
    storage?.setItem(
      KEYBOARD_YAW_STORAGE_KEY,
      normalizeKeyboardYawPreference(preference),
    )
  } catch {
    /* Storage is optional. */
  }
}

export function keyboardYawPreferenceLabel(preference: KeyboardYawPreference): string {
  return normalizeKeyboardYawPreference(preference) === 'a-left'
    ? 'A LEFT / D RIGHT'
    : 'A RIGHT / D LEFT'
}

export function normalizeKeyboardRollPreference(
  value: unknown,
  fallback: KeyboardRollPreference = DEFAULT_KEYBOARD_ROLL,
): KeyboardRollPreference {
  if (value === 'q-right' || value === 'q-left') return value
  return fallback === 'q-left' ? 'q-left' : DEFAULT_KEYBOARD_ROLL
}

export function readKeyboardRollPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback: KeyboardRollPreference = DEFAULT_KEYBOARD_ROLL,
): KeyboardRollPreference {
  try {
    return normalizeKeyboardRollPreference(storage?.getItem(KEYBOARD_ROLL_STORAGE_KEY), fallback)
  } catch {
    return normalizeKeyboardRollPreference(undefined, fallback)
  }
}

export function writeKeyboardRollPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  preference: KeyboardRollPreference,
): void {
  try {
    storage?.setItem(
      KEYBOARD_ROLL_STORAGE_KEY,
      normalizeKeyboardRollPreference(preference),
    )
  } catch {
    /* Storage is optional. */
  }
}

export function keyboardRollPreferenceLabel(preference: KeyboardRollPreference): string {
  return normalizeKeyboardRollPreference(preference) === 'q-left'
    ? 'Q LEFT / E RIGHT'
    : 'Q RIGHT / E LEFT'
}

export function normalizeKeyboardPitchPreference(
  value: unknown,
  fallback: KeyboardPitchPreference = DEFAULT_KEYBOARD_PITCH,
): KeyboardPitchPreference {
  if (value === 'w-up' || value === 'w-down') return value
  return fallback === 'w-down' ? 'w-down' : DEFAULT_KEYBOARD_PITCH
}

export function readKeyboardPitchPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback: KeyboardPitchPreference = DEFAULT_KEYBOARD_PITCH,
): KeyboardPitchPreference {
  try {
    return normalizeKeyboardPitchPreference(storage?.getItem(KEYBOARD_PITCH_STORAGE_KEY), fallback)
  } catch {
    return normalizeKeyboardPitchPreference(undefined, fallback)
  }
}

export function writeKeyboardPitchPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  preference: KeyboardPitchPreference,
): void {
  try {
    storage?.setItem(
      KEYBOARD_PITCH_STORAGE_KEY,
      normalizeKeyboardPitchPreference(preference),
    )
  } catch {
    /* Storage is optional. */
  }
}

export function keyboardPitchPreferenceLabel(preference: KeyboardPitchPreference): string {
  return normalizeKeyboardPitchPreference(preference) === 'w-down'
    ? 'W DOWN / S UP'
    : 'W UP / S DOWN'
}
