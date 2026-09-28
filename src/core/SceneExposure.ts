/**
 * Convert precipitation and cloud cover into a small night-only readability
 * assist. Storms hide the horizon, so a bounded lift keeps terrain silhouettes
 * legible without washing out clear nights or bright daytime scenes.
 */
export function nightWeatherReadability(
  daylight: number,
  precipitation: number,
  cloudCover: number,
): number {
  const safeDaylight = Number.isFinite(daylight)
    ? Math.max(0, Math.min(1, daylight))
    : 0
  const safePrecipitation = Number.isFinite(precipitation)
    ? Math.max(0, Math.min(1, precipitation))
    : 0
  const safeCloudCover = Number.isFinite(cloudCover)
    ? Math.max(0, Math.min(1, cloudCover))
    : 0
  return (1 - safeDaylight) * Math.min(1, safePrecipitation * 0.55 + safeCloudCover * 0.35)
}

/** Smooth tone-mapping exposure for the continuous day/night envelope. */
export function sceneExposure(daylight: number, bloom = 0, nightReadability = 0): number {
  const safeDaylight = Number.isFinite(daylight)
    ? Math.max(0, Math.min(1, daylight))
    : 0
  const safeBloom = Number.isFinite(bloom)
    ? Math.max(0, Math.min(1, bloom))
    : 0
  const safeNightReadability = Number.isFinite(nightReadability)
    ? Math.max(0, Math.min(1, nightReadability))
    : 0
  return 0.95 + safeDaylight * 0.2 + safeBloom * 1.35 + (1 - safeDaylight) * safeNightReadability * 0.18
}
