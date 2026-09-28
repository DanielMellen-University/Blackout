/** Maximum retained banner duration when a browser or test supplies bad data. */
export const MAX_BANNER_DURATION_MS = 30_000

/** Capture the finite amount of banner time that should survive a pause. */
export function bannerRemainingMs(nowMs: number, untilMs: number): number | null {
  if (!Number.isFinite(untilMs)) return null
  if (!Number.isFinite(nowMs)) return 0
  return Math.min(MAX_BANNER_DURATION_MS, Math.max(0, untilMs - nowMs))
}

/** Rebuild a wall-clock deadline after the live simulation resumes. */
export function bannerUntilFromRemaining(nowMs: number, remainingMs: number): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(remainingMs)) return nowMs
  return nowMs + Math.min(MAX_BANNER_DURATION_MS, Math.max(0, remainingMs))
}
