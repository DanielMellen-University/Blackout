/** Developer inspection paths only, not mission or world-generation settings.
 * These positions inspect actual seeded fronts through the shared sampler. */
export const WEATHER_REVIEW_START_SECONDS = 180
export const WEATHER_REVIEW_DISTANCE_M = 28000
export const WEATHER_REVIEW_ROUTES = {
  weatherfront: { seed: 1, x: -240000, z: -192000, dx: -Math.SQRT1_2, dz: -Math.SQRT1_2 },
  // Re-centered for the seeded prevailing wind at the review clock.
  weatherstorm: { seed: 1, x: -56000, z: -222000, dx: -Math.SQRT1_2, dz: -Math.SQRT1_2 },
  weathersnow: { seed: 1, x: -176000, z: 128000, dx: 1, dz: 0 },
} as const
