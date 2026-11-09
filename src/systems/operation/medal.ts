export type OperationMedal = 'none' | 'bronze' | 'silver' | 'gold'

/** Score bands for a finished airborne run. A failed run earns no medal. */
export function medalForScore(score: number, passed: boolean): OperationMedal {
  if (!passed || !Number.isFinite(score) || score <= 0) return 'none'
  // Bands sit in the gaps between the seed-42 measured paths, so each
  // decision can earn a different medal without a landing.
  if (score >= 47_000) return 'gold'
  if (score >= 40_000) return 'silver'
  if (score >= 25_000) return 'bronze'
  return 'none'
}
