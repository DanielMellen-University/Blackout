import {
  AUDIO_CHANNEL_STORAGE_KEYS,
  AUDIO_VOLUME_STORAGE_KEY,
} from '../audio/AudioPreferences'
import {
  CAMERA_AUTO_RETURN_STORAGE_KEY,
  CAMERA_EFFECTS_STORAGE_KEY,
  CAMERA_MODE_STORAGE_KEY,
  CAMERA_SENSITIVITY_STORAGE_KEY,
  CAMERA_SPEED_FRAMING_STORAGE_KEY,
  GHOST_VISIBILITY_STORAGE_KEY,
  HUD_DISPLAY_STORAGE_KEY,
  KEYBOARD_BINDINGS_STORAGE_KEY,
  KEYBOARD_SCHEME_STORAGE_KEY,
  KEYBOARD_PITCH_STORAGE_KEY,
  KEYBOARD_ROLL_STORAGE_KEY,
  KEYBOARD_YAW_STORAGE_KEY,
  REDUCED_MOTION_STORAGE_KEY,
  STABILITY_ASSIST_STORAGE_KEY,
} from './FlightPreferences'
import { RENDER_QUALITY_STORAGE_KEY } from './RenderQuality'

/** Settings keys that can be safely cleared without touching progression data. */
export const FLIGHT_PREFERENCE_STORAGE_KEYS: readonly string[] = Object.freeze([
  RENDER_QUALITY_STORAGE_KEY,
  AUDIO_VOLUME_STORAGE_KEY,
  ...Object.values(AUDIO_CHANNEL_STORAGE_KEYS),
  KEYBOARD_YAW_STORAGE_KEY,
  KEYBOARD_ROLL_STORAGE_KEY,
  KEYBOARD_PITCH_STORAGE_KEY,
  KEYBOARD_BINDINGS_STORAGE_KEY,
  KEYBOARD_SCHEME_STORAGE_KEY,
  GHOST_VISIBILITY_STORAGE_KEY,
  CAMERA_MODE_STORAGE_KEY,
  CAMERA_SENSITIVITY_STORAGE_KEY,
  CAMERA_SPEED_FRAMING_STORAGE_KEY,
  CAMERA_AUTO_RETURN_STORAGE_KEY,
  CAMERA_EFFECTS_STORAGE_KEY,
  REDUCED_MOTION_STORAGE_KEY,
  HUD_DISPLAY_STORAGE_KEY,
  STABILITY_ASSIST_STORAGE_KEY,
])

/**
 * Clear only user-facing flight preferences. Course history, Favorites, Recent,
 * replay records, and Ops streaks intentionally remain untouched.
 */
export function resetFlightPreferences(
  storage: Pick<Storage, 'removeItem'> | null | undefined,
): void {
  for (const key of FLIGHT_PREFERENCE_STORAGE_KEYS) {
    try {
      storage?.removeItem(key)
    } catch {
      /* Private browsing or quota policy can deny removal. */
    }
  }
}
