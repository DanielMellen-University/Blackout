/** True airspeed in knots. Simulation stays in m/s; non-finite reads as zero. */
export const MS_TO_KTS = 1.94384

export function displayedKnots(metresPerSecond: number): number {
  if (!Number.isFinite(metresPerSecond)) return 0
  return Math.max(0, metresPerSecond * MS_TO_KTS)
}
