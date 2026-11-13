/** Current ReviewFrames percentile definition: nearest rank, clamped at rank 1. */
export function nearestRank(values, fraction) {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
}

/** Previous review captures used floor(n * q); retain this for archive checks. */
export function legacyFloorQuantile(values, fraction) {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * fraction)]
}

export function matchesCurrentOrLegacy(values, fraction, recorded) {
  return nearestRank(values, fraction) === recorded || legacyFloorQuantile(values, fraction) === recorded
}

/** Preserve the convention recorded in an archive while using nearest rank for new captures. */
export function recordedQuantile(values, fraction, recorded) {
  const current = nearestRank(values, fraction)
  if (recorded === undefined) return current
  if (current === recorded) return current
  const legacy = legacyFloorQuantile(values, fraction)
  if (legacy === recorded) return legacy
  throw new Error(`Recorded p${Math.round(fraction * 100)} matches neither current nor legacy percentile`)
}
