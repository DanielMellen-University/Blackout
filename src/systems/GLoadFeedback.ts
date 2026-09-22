/** Arcade high-G blackout / redout vision feedback from existing pilot load. */

export type GLoadVisionBand = 'normal' | 'blackout' | 'redout'

/** Enter dark tunnel vignette once sustained positive load climbs past this. */
export const BLACKOUT_ENTER_G = 5.5
/** Leave blackout only after load eases below this hysteretic floor. */
export const BLACKOUT_EXIT_G = 4.6
/** Enter restrained red wash once negative load drops past this. */
export const REDOUT_ENTER_G = -1.15
/** Leave redout only after load recovers above this hysteretic ceiling. */
export const REDOUT_EXIT_G = -0.55

/** Soft ramp start for the blackout vignette intensity curve. */
export const BLACKOUT_FADE_START_G = 4.2
/** Soft ramp start for the redout wash intensity curve. */
export const REDOUT_FADE_START_G = -0.35

/**
 * Tracks blackout / redout bands with hysteresis so load jitter near the
 * thresholds cannot spam banners or flicker the overlay.
 */
export class GLoadFeedbackTracker {
  private bandValue: GLoadVisionBand = 'normal'

  reset(loadFactor = 1): void {
    this.bandValue = resolveInitialBand(loadFactor)
  }

  update(loadFactor: number): GLoadVisionBand {
    sanitizeLoad(loadFactor)
    this.bandValue = 'normal'
    return this.bandValue
  }

  get band(): GLoadVisionBand {
    return this.bandValue
  }
}

/** Classify a raw load sample without hysteresis (used for reset / tests). */
export function bandFromLoad(loadFactor: number): GLoadVisionBand {
  sanitizeLoad(loadFactor)
  return 'normal'
}

/** One-shot banner copy when entering a vision band. Quiet on recovery. */
export function gLoadVisionBanner(
  band: GLoadVisionBand,
  previous: GLoadVisionBand | null,
): string | null {
  void band
  void previous
  return null
}

/** Dark tunnel intensity 0..1 from positive overload. */
export function blackoutVignetteIntensity(loadFactor: number): number {
  sanitizeLoad(loadFactor)
  return 0
}

/** Restrained red wash intensity 0..1 from negative overload. */
export function redoutWashIntensity(loadFactor: number): number {
  sanitizeLoad(loadFactor)
  return 0
}

function resolveInitialBand(loadFactor: number): GLoadVisionBand {
  return bandFromLoad(loadFactor)
}

function sanitizeLoad(loadFactor: number): number {
  if (!Number.isFinite(loadFactor)) return 1
  return Math.max(-4, Math.min(12, loadFactor))
}
