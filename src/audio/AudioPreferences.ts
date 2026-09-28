/** Persistent, browser-safe volume preference for the procedural flight mix. */
export const AUDIO_VOLUME_STORAGE_KEY = 'blackout.audioVolume'
export type AudioChannel = 'engine' | 'environment' | 'effects'
export const AUDIO_CHANNEL_STORAGE_KEYS: Readonly<Record<AudioChannel, string>> = Object.freeze({
  engine: 'blackout.audioEngineVolume',
  environment: 'blackout.audioEnvironmentVolume',
  effects: 'blackout.audioEffectsVolume',
})

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

export function normalizeAudioChannelVolume(value: unknown, fallback = 1): number {
  return normalizeAudioVolume(value, fallback)
}

export function readAudioChannelVolume(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  channel: AudioChannel,
  fallback = 1,
): number {
  try {
    const saved = storage?.getItem(AUDIO_CHANNEL_STORAGE_KEYS[channel])
    if (saved === null || saved === undefined || saved.trim() === '') return normalizeAudioChannelVolume(fallback)
    return normalizeAudioChannelVolume(Number(saved), fallback)
  } catch {
    return normalizeAudioChannelVolume(fallback)
  }
}

export function writeAudioChannelVolume(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  channel: AudioChannel,
  volume: number,
): void {
  try {
    storage?.setItem(AUDIO_CHANNEL_STORAGE_KEYS[channel], String(normalizeAudioChannelVolume(volume)))
  } catch {
    /* Storage is optional. */
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
