import { expect, it } from 'vitest'
import { flightConfig } from '../src/aircraft/flightConfig'
import { WEATHER_REVIEW_DISTANCE_M, WEATHER_REVIEW_ROUTES, WEATHER_REVIEW_START_SECONDS } from '../src/debug/WeatherReviewRoutes'
import { createRegionalWeatherSample, RegionalWeather } from '../src/world/RegionalWeather'
import { sampleLandformsInto, type LandformSample } from '../src/world/Landforms'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'

it.each(Object.keys(WEATHER_REVIEW_ROUTES) as (keyof typeof WEATHER_REVIEW_ROUTES)[])(
  'keeps the %s maximum-speed review crossing the intended regional conditions', key => {
  const before = getWorldSeed(), route = WEATHER_REVIEW_ROUTES[key]
  const sampler = new RegionalWeather(), out = createRegionalWeatherSample(), land = {} as LandformSample
  function point(t: number) {
    const x = route.x + route.dx * t * WEATHER_REVIEW_DISTANCE_M
    const z = route.z + route.dz * t * WEATHER_REVIEW_DISTANCE_M
    sampleLandformsInto(land, x, z)
    sampler.sampleInto(out, x, land.height + 220, z,
      WEATHER_REVIEW_START_SECONDS + t * WEATHER_REVIEW_DISTANCE_M / flightConfig.maxSpeedBoost)
    return { id: out.id, rain: out.rain, snow: out.snow, lightning: out.lightning,
      height: land.height, low: out.lowClouds }
  }
  try {
    setWorldSeed(route.seed)
    const start = point(0), end = point(1)
    if (key === 'weatherfront') {
      expect(start.rain + start.snow).toBeLessThan(.03)
      expect(start.low).toBeLessThan(.65)
      expect(end.id).toBe('rain'); expect(end.rain).toBeGreaterThan(.22)
      expect(end.lightning).toBeLessThan(.2)
    } else if (key === 'weatherstorm') {
      expect(start.id).toBe('rain'); expect(end.id).toBe('storm')
      expect(start.lightning).toBeLessThan(.3)
      expect(end.lightning).toBeGreaterThan(.35)
    } else {
      expect(start.rain + start.snow).toBeLessThan(.03)
      expect(end.snow).toBeGreaterThan(.72)
      expect(end.height).toBeGreaterThan(1400)
    }
  } finally { setWorldSeed(before) }
})
