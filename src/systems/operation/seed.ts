const MAX_SEED = 1_000_000_000

/** Finite, non-zero, stable seed. The same input always replays the same line. */
export function normalizeOperationSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1
  const whole = Math.trunc(Math.abs(seed))
  if (whole === 0) return 1
  return Math.min(whole, MAX_SEED)
}
