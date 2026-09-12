/** Persistent, browser-safe volume preference for the procedural flight mix. */
export const AUDIO_VOLUME_STORAGE_KEY = 'blackout.audioVolume'

export function normalizeAudioVolume(value: unknown, fallback = 1): number {
  const safeFallback = Number.isFinite(fallback) ? clamp01(fallback) : 1
  if (typeof value !== 'number' || !Number.isFinite(value)) return safeFallback
  return clamp01(value)
}

export function readAudioVolume(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback = 1,
): number {
  try {
    const saved = storage?.getItem(AUDIO_VOLUME_STORAGE_KEY)
    if (saved === null || saved === undefined || saved.trim() === '') return normalizeAudioVolume(fallback)
    return normalizeAudioVolume(Number(saved), fallback)
  } catch {
    return normalizeAudioVolume(fallback)
  }
}

export function writeAudioVolume(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  volume: number,
): void {
  try {
    storage?.setItem(AUDIO_VOLUME_STORAGE_KEY, String(normalizeAudioVolume(volume)))
  } catch {
    /* Storage is optional. */
  }
}

export function audioVolumePercent(volume: number): string {
  return `${Math.round(normalizeAudioVolume(volume) * 100)}%`
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
