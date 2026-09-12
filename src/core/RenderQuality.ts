/**
 * Small, user-facing render presets. The adaptive scaler still smooths the
 * chosen pixel budget during flight, while this setting controls its ceiling
 * and the most expensive renderer feature.
 */
export type RenderQuality = 'low' | 'balanced' | 'high'

export interface RenderQualityProfile {
  readonly label: string
  readonly maxPixelRatio: number
  /** Whether the renderer should request multisample antialiasing at boot. */
  readonly antialias: boolean
  readonly shadows: boolean
  /** Fraction of pooled rain and snow particles simulated and drawn. */
  readonly precipitationScale: number
  /** Fraction of cloud puffs submitted to the instanced deck batches. */
  readonly cloudScale: number
  /** Fraction of near-field vegetation instances submitted per terrain chunk. */
  readonly vegetationScale: number
}

export const RENDER_QUALITY_PROFILES: Readonly<Record<RenderQuality, RenderQualityProfile>> =
  Object.freeze({
    low: Object.freeze({ label: 'Low', maxPixelRatio: 0.85, antialias: false, shadows: false, precipitationScale: 0.42, cloudScale: 0.5, vegetationScale: 0.45 }),
    balanced: Object.freeze({ label: 'Balanced', maxPixelRatio: 1.15, antialias: true, shadows: true, precipitationScale: 0.72, cloudScale: 0.78, vegetationScale: 0.75 }),
    high: Object.freeze({ label: 'High', maxPixelRatio: 1.5, antialias: true, shadows: true, precipitationScale: 1, cloudScale: 1, vegetationScale: 1 }),
  })

const STORAGE_KEY = 'blackout.renderQuality'

/** Normalize saved or externally supplied values without leaking invalid state. */
export function normalizeRenderQuality(value: unknown, fallback: RenderQuality = 'balanced'): RenderQuality {
  if (value === 'low' || value === 'balanced' || value === 'high') return value
  return fallback
}

/** Pick a conservative first-run preset from the device's reported budget. */
export function defaultRenderQuality(info: {
  hardwareConcurrency?: number
  deviceMemory?: number
} = {}): RenderQuality {
  const cores = Number.isFinite(info.hardwareConcurrency) ? info.hardwareConcurrency! : 8
  const memory = Number.isFinite(info.deviceMemory) ? info.deviceMemory! : 8
  if (cores <= 4 || memory <= 4) return 'low'
  return 'balanced'
}

/** Read the player's preference, falling back safely when storage is blocked. */
export function readRenderQuality(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  fallback: RenderQuality = 'balanced',
): RenderQuality {
  try {
    return normalizeRenderQuality(storage?.getItem(STORAGE_KEY), fallback)
  } catch {
    return fallback
  }
}

/** Persist the player's preference without making private-mode storage fatal. */
export function writeRenderQuality(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  quality: RenderQuality,
): void {
  try {
    storage?.setItem(STORAGE_KEY, normalizeRenderQuality(quality))
  } catch {
    /* Storage is optional. */
  }
}

export function renderQualityProfile(quality: RenderQuality): RenderQualityProfile {
  return RENDER_QUALITY_PROFILES[normalizeRenderQuality(quality)]
}
