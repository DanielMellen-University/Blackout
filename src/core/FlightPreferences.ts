import { CAMERA_MODES, type CameraMode } from './types'

/** Keyboard-only flight preferences kept separate from simulation state. */
export type KeyboardYawPreference = 'a-right' | 'a-left'
export type KeyboardRollPreference = 'q-right' | 'q-left'
export type KeyboardPitchPreference = 'w-up' | 'w-down'
export type CameraSensitivity = 'low' | 'normal' | 'high'
export type CameraSpeedFraming = 'subtle' | 'standard' | 'wide'

export const KEYBOARD_YAW_STORAGE_KEY = 'blackout.keyboardYaw'
export const DEFAULT_KEYBOARD_YAW: KeyboardYawPreference = 'a-right'
export const KEYBOARD_ROLL_STORAGE_KEY = 'blackout.keyboardRoll'
export const DEFAULT_KEYBOARD_ROLL: KeyboardRollPreference = 'q-right'
export const KEYBOARD_PITCH_STORAGE_KEY = 'blackout.keyboardPitch'
export const DEFAULT_KEYBOARD_PITCH: KeyboardPitchPreference = 'w-up'
export const GHOST_VISIBILITY_STORAGE_KEY = 'blackout.ghostVisible'
export const DEFAULT_GHOST_VISIBLE = true
export const CAMERA_MODE_STORAGE_KEY = 'blackout.cameraMode'
export const DEFAULT_CAMERA_MODE: CameraMode = 'chase'
export const CAMERA_SENSITIVITY_STORAGE_KEY = 'blackout.cameraSensitivity'
export const DEFAULT_CAMERA_SENSITIVITY: CameraSensitivity = 'normal'
export const CAMERA_SPEED_FRAMING_STORAGE_KEY = 'blackout.cameraSpeedFraming'
export const DEFAULT_CAMERA_SPEED_FRAMING: CameraSpeedFraming = 'standard'
export const CAMERA_AUTO_RETURN_STORAGE_KEY = 'blackout.cameraAutoReturn'
export const DEFAULT_CAMERA_AUTO_RETURN = true
export const CAMERA_EFFECTS_STORAGE_KEY = 'blackout.cameraEffects'
export const DEFAULT_CAMERA_EFFECTS = true
export const STABILITY_ASSIST_STORAGE_KEY = 'blackout.stabilityAssist'
export const DEFAULT_STABILITY_ASSIST = false

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

/** Keep the replay path preference finite-safe across storage versions. */
export function normalizeGhostVisibilityPreference(
  value: unknown,
  fallback = DEFAULT_GHOST_VISIBLE,
): boolean {
  if (value === true || value === 'true' || value === '1') return true
  if (value === false || value === 'false' || value === '0') return false
  return fallback
}

export function readGhostVisibilityPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback = DEFAULT_GHOST_VISIBLE,
): boolean {
  try {
    return normalizeGhostVisibilityPreference(storage?.getItem(GHOST_VISIBILITY_STORAGE_KEY), fallback)
  } catch {
    return normalizeGhostVisibilityPreference(undefined, fallback)
  }
}

export function writeGhostVisibilityPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  visible: boolean,
): void {
  try {
    storage?.setItem(
      GHOST_VISIBILITY_STORAGE_KEY,
      normalizeGhostVisibilityPreference(visible) ? 'true' : 'false',
    )
  } catch {
    /* Storage is optional. */
  }
}

export function normalizeCameraMode(
  value: unknown,
  fallback: CameraMode = DEFAULT_CAMERA_MODE,
): CameraMode {
  if (CAMERA_MODES.includes(value as CameraMode)) return value as CameraMode
  return CAMERA_MODES.includes(fallback) ? fallback : DEFAULT_CAMERA_MODE
}

export function readCameraModePreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback: CameraMode = DEFAULT_CAMERA_MODE,
): CameraMode {
  try {
    return normalizeCameraMode(storage?.getItem(CAMERA_MODE_STORAGE_KEY), fallback)
  } catch {
    return normalizeCameraMode(undefined, fallback)
  }
}

export function writeCameraModePreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  mode: CameraMode,
): void {
  try {
    storage?.setItem(CAMERA_MODE_STORAGE_KEY, normalizeCameraMode(mode))
  } catch {
    /* Storage is optional. */
  }
}

export function normalizeCameraSensitivity(
  value: unknown,
  fallback: CameraSensitivity = DEFAULT_CAMERA_SENSITIVITY,
): CameraSensitivity {
  if (value === 'low' || value === 'normal' || value === 'high') return value
  return fallback === 'low' || fallback === 'high' ? fallback : DEFAULT_CAMERA_SENSITIVITY
}

export function readCameraSensitivityPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback: CameraSensitivity = DEFAULT_CAMERA_SENSITIVITY,
): CameraSensitivity {
  try {
    return normalizeCameraSensitivity(storage?.getItem(CAMERA_SENSITIVITY_STORAGE_KEY), fallback)
  } catch {
    return normalizeCameraSensitivity(undefined, fallback)
  }
}

export function writeCameraSensitivityPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  sensitivity: CameraSensitivity,
): void {
  try {
    storage?.setItem(
      CAMERA_SENSITIVITY_STORAGE_KEY,
      normalizeCameraSensitivity(sensitivity),
    )
  } catch {
    /* Storage is optional. */
  }
}

/** Convert the readable preference into the small external-camera input scale. */
export function cameraSensitivityMultiplier(sensitivity: CameraSensitivity): number {
  switch (normalizeCameraSensitivity(sensitivity)) {
    case 'low': return 0.65
    case 'high': return 1.45
    default: return 1
  }
}

export function cameraSensitivityLabel(sensitivity: CameraSensitivity): string {
  switch (normalizeCameraSensitivity(sensitivity)) {
    case 'low': return 'LOW'
    case 'high': return 'HIGH'
    default: return 'NORMAL'
  }
}

export function normalizeCameraSpeedFraming(
  value: unknown,
  fallback: CameraSpeedFraming = DEFAULT_CAMERA_SPEED_FRAMING,
): CameraSpeedFraming {
  if (value === 'subtle' || value === 'standard' || value === 'wide') return value
  return fallback === 'subtle' || fallback === 'wide' ? fallback : DEFAULT_CAMERA_SPEED_FRAMING
}

export function readCameraSpeedFramingPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback: CameraSpeedFraming = DEFAULT_CAMERA_SPEED_FRAMING,
): CameraSpeedFraming {
  try {
    return normalizeCameraSpeedFraming(storage?.getItem(CAMERA_SPEED_FRAMING_STORAGE_KEY), fallback)
  } catch {
    return normalizeCameraSpeedFraming(undefined, fallback)
  }
}

export function writeCameraSpeedFramingPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  framing: CameraSpeedFraming,
): void {
  try {
    storage?.setItem(CAMERA_SPEED_FRAMING_STORAGE_KEY, normalizeCameraSpeedFraming(framing))
  } catch {
    /* Storage is optional. */
  }
}

export function cameraSpeedFramingMultiplier(framing: CameraSpeedFraming): number {
  switch (normalizeCameraSpeedFraming(framing)) {
    case 'subtle': return 0.55
    case 'wide': return 1.35
    default: return 1
  }
}

export function cameraSpeedFramingLabel(framing: CameraSpeedFraming): string {
  switch (normalizeCameraSpeedFraming(framing)) {
    case 'subtle': return 'SUBTLE'
    case 'wide': return 'WIDE'
    default: return 'STANDARD'
  }
}

export function normalizeCameraAutoReturnPreference(
  value: unknown,
  fallback = DEFAULT_CAMERA_AUTO_RETURN,
): boolean {
  if (value === true || value === 'true' || value === '1') return true
  if (value === false || value === 'false' || value === '0') return false
  return fallback === true
}

export function readCameraAutoReturnPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback = DEFAULT_CAMERA_AUTO_RETURN,
): boolean {
  try {
    return normalizeCameraAutoReturnPreference(storage?.getItem(CAMERA_AUTO_RETURN_STORAGE_KEY), fallback)
  } catch {
    return normalizeCameraAutoReturnPreference(undefined, fallback)
  }
}

export function writeCameraAutoReturnPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  enabled: boolean,
): void {
  try {
    storage?.setItem(
      CAMERA_AUTO_RETURN_STORAGE_KEY,
      normalizeCameraAutoReturnPreference(enabled) ? 'true' : 'false',
    )
  } catch {
    /* Storage is optional. */
  }
}

export function normalizeCameraEffectsPreference(
  value: unknown,
  fallback = DEFAULT_CAMERA_EFFECTS,
): boolean {
  if (value === true || value === 'true' || value === '1') return true
  if (value === false || value === 'false' || value === '0') return false
  return fallback === true
}

export function readCameraEffectsPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback = DEFAULT_CAMERA_EFFECTS,
): boolean {
  try {
    return normalizeCameraEffectsPreference(storage?.getItem(CAMERA_EFFECTS_STORAGE_KEY), fallback)
  } catch {
    return normalizeCameraEffectsPreference(undefined, fallback)
  }
}

export function writeCameraEffectsPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  enabled: boolean,
): void {
  try {
    storage?.setItem(
      CAMERA_EFFECTS_STORAGE_KEY,
      normalizeCameraEffectsPreference(enabled) ? 'true' : 'false',
    )
  } catch {
    /* Storage is optional. */
  }
}

export function normalizeStabilityAssistPreference(
  value: unknown,
  fallback = DEFAULT_STABILITY_ASSIST,
): boolean {
  if (value === true || value === 'true' || value === '1') return true
  if (value === false || value === 'false' || value === '0') return false
  return fallback
}

export function readStabilityAssistPreference(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback = DEFAULT_STABILITY_ASSIST,
): boolean {
  try {
    return normalizeStabilityAssistPreference(storage?.getItem(STABILITY_ASSIST_STORAGE_KEY), fallback)
  } catch {
    return normalizeStabilityAssistPreference(undefined, fallback)
  }
}

export function writeStabilityAssistPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  enabled: boolean,
): void {
  try {
    storage?.setItem(
      STABILITY_ASSIST_STORAGE_KEY,
      normalizeStabilityAssistPreference(enabled) ? 'true' : 'false',
    )
  } catch {
    /* Storage is optional. */
  }
}
