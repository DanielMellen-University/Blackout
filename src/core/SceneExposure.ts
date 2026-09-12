/** Smooth tone-mapping exposure for the continuous day/night envelope. */
export function sceneExposure(daylight: number, bloom = 0): number {
  const safeDaylight = Number.isFinite(daylight)
    ? Math.max(0, Math.min(1, daylight))
    : 0
  const safeBloom = Number.isFinite(bloom)
    ? Math.max(0, Math.min(1, bloom))
    : 0
  return 0.95 + safeDaylight * 0.2 + safeBloom * 1.35
}
