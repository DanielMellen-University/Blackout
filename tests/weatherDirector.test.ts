import { describe, expect, it } from 'vitest'
import {
  WEATHER_NEIGHBORS,
  WEATHER_PROFILES,
  WeatherDirector,
  blendWeatherProfile,
} from '../src/world/WeatherDirector'

describe('weather director', () => {
  it('blends fronts smoothly instead of stepping between presets', () => {
    const halfway = blendWeatherProfile(
      WEATHER_PROFILES.clear,
      WEATHER_PROFILES.storm,
      0.5,
    )
    expect(halfway.rain).toBeCloseTo(0.5)
    expect(halfway.lowClouds).toBeGreaterThan(WEATHER_PROFILES.clear.lowClouds)
    expect(halfway.lowClouds).toBeLessThan(WEATHER_PROFILES.storm.lowClouds)
    expect(halfway.windMps).toBeCloseTo(15.5)
  })

  it('reserves lightning flashes for storm-strength weather', () => {
    expect(WEATHER_PROFILES.rain.lightning).toBe(0)
    expect(WEATHER_PROFILES.storm.lightning).toBeGreaterThan(0.35)
  })

  it('keeps seeded weather and wind reproducible', () => {
    const first = new WeatherDirector()
    const second = new WeatherDirector()
    first.randomize(1337)
    second.randomize(1337)
    expect(first.targetId).toBe(second.targetId)
    expect(first.snapshot()).toEqual(second.snapshot())

    first.update(500)
    second.update(500)
    expect(first.targetId).toBe(second.targetId)
    expect(first.snapshot()).toEqual(second.snapshot())
  })

  it('uses believable adjacent states for automatic fronts', () => {
    const director = new WeatherDirector()
    director.randomize(17, 'clear')
    director.update(1000)
    expect(WEATHER_NEIGHBORS.clear).toContain(director.targetId)
    expect(director.targetId).not.toBe('storm')
    expect(director.targetId).not.toBe('blizzard')
  })

  it('can redirect a moving front without a visual discontinuity', () => {
    const director = new WeatherDirector()
    director.randomize(91, 'clear')
    director.setWeather('storm')
    director.update(8)
    const before = director.snapshot()
    director.setWeather('rain')
    const after = director.snapshot()
    expect(after.rain).toBeCloseTo(before.rain, 8)
    expect(after.haze).toBeCloseTo(before.haze, 8)
    expect(after.windX).toBeCloseTo(before.windX, 8)
    expect(after.windZ).toBeCloseTo(before.windZ, 8)
  })
})
