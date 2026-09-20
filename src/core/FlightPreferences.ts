/** Keyboard-only flight preferences kept separate from simulation state. */
export type KeyboardYawPreference = 'a-right' | 'a-left'

export const KEYBOARD_YAW_STORAGE_KEY = 'blackout.keyboardYaw'
export const DEFAULT_KEYBOARD_YAW: KeyboardYawPreference = 'a-right'

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
