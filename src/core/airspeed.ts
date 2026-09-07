/** True airspeed in knots. Simulation stays in m/s; the HUD dial pins at 1000. */
export const MS_TO_KTS = 1.94384

export function displayedKnots(metresPerSecond: number): number {
  return Math.max(0, metresPerSecond * MS_TO_KTS)
}
