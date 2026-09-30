import { describe, expect, it } from 'vitest'
import {
  WEATHER_NEIGHBORS,
  WEATHER_PROFILES,
  WeatherDirector,
  blendWind,
  blendWeatherProfile,
  normalizeWeatherId,
  timeOfDayForSeed,
  weatherIdForSeed,
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

  it('shares the world seed resolver with preflight previews', () => {
    expect(timeOfDayForSeed(1)).toBeCloseTo(0.182916352, 8)
    expect(weatherIdForSeed(1)).toBe('snow')
    expect(weatherIdForSeed(1337)).toBe('cloudy')
    expect(weatherIdForSeed(1)).toBe(weatherIdForSeed(1))
  })

  it('repairs malformed weather IDs before profile lookup', () => {
    expect(normalizeWeatherId('storm')).toBe('storm')
    expect(normalizeWeatherId('unknown')).toBe('clear')
    expect(normalizeWeatherId({}, 'rain')).toBe('rain')

    const director = new WeatherDirector()
    director.randomize(7, 'invalid' as never)
    expect(director.targetId).toBe('clear')
    director.setWeather('invalid' as never, true)
    expect(director.targetId).toBe('clear')
    expect(director.snapshot().rain).toBe(0)
  })

  it('fills a caller-owned runtime snapshot without changing public snapshots', () => {
    const director = new WeatherDirector()
    director.randomize(1337, 'storm')
    const target = {} as ReturnType<WeatherDirector['snapshot']>

    expect(director.snapshotInto(target)).toBe(target)
    expect(target).toEqual(director.snapshot())
  })

  it('uses believable adjacent states for automatic fronts', () => {
    const director = new WeatherDirector()
    director.randomize(17, 'clear')
    director.update(1000)
    expect(WEATHER_NEIGHBORS.clear).toContain(director.targetId)
    expect(director.targetId).not.toBe('storm')
    expect(director.targetId).not.toBe('blizzard')
  })

  it('can hold an authored front against cycles and automatic transitions', () => {
    const director = new WeatherDirector()
    director.randomize(17, 'storm')
    director.setLocked(true)
    const before = director.snapshot()
    expect(director.cycle()).toBe('storm')
    director.update(10_000)
    expect(director.targetId).toBe('storm')
    expect(director.snapshot()).toEqual(before)
  })

  it('ignores malformed update deltas without poisoning a live front', () => {
    const director = new WeatherDirector()
    director.randomize(91, 'clear')
    director.setWeather('storm')
    const before = director.snapshot()
    director.update(Number.NaN)
    director.update(Number.POSITIVE_INFINITY)
    expect(director.snapshot()).toEqual(before)
    expect(director.transitioning).toBe(true)
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

  it('does not restart a moving front when the same target is reapplied', () => {
    const director = new WeatherDirector()
    director.randomize(91, 'clear')
    director.setWeather('storm')
    director.update(8)
    const before = director.progress

    director.setWeather('storm')

    expect(director.progress).toBeCloseTo(before, 8)
    expect(director.transitioning).toBe(true)
    director.setWeather('storm', true)
    expect(director.progress).toBe(1)
    expect(director.transitioning).toBe(false)
  })

  it('turns wind through the shortest arc without inventing a calm lull', () => {
    const middle = blendWind({ x: 12, z: 0 }, { x: -12, z: 0 }, .5)
    expect(Math.hypot(middle.x, middle.z)).toBeCloseTo(12, 8)
    expect(Math.abs(middle.x)).toBeLessThan(.001)
    expect(Math.abs(middle.z)).toBeCloseTo(12, 8)
  })

  it('keeps an authored wind heading while preserving seeded speed', () => {
    const director = new WeatherDirector()
    director.randomize(29, 'storm')
    const beforeSpeed = Math.hypot(director.snapshot().windX, director.snapshot().windZ)
    director.setWindHeading(Math.PI / 2)
    const after = director.snapshot()
    expect(Math.hypot(after.windX, after.windZ)).toBeCloseTo(beforeSpeed, 8)
    expect(after.windX).toBeGreaterThan(0)
    expect(Math.abs(after.windZ)).toBeLessThan(0.000001)
    expect(director.authoredWindHeading).toBeCloseTo(Math.PI / 2)
  })
})
