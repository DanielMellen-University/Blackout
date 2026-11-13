import { describe, expect, it } from 'vitest'
import {
  blendWeatherProfile,
  blendWind,
  WEATHER_PROFILES,
} from '../src/world/WeatherDirector'

describe('weather blend amount edges', () => {
  it('treats a NaN blend amount as zero instead of returning NaN wind', () => {
    const wind = blendWind({ x: 10, z: 0 }, { x: 0, z: 10 }, Number.NaN)
    expect(wind).toEqual({ x: 10, z: 0 })
    const profile = blendWeatherProfile(WEATHER_PROFILES.clear, WEATHER_PROFILES.storm, Number.NaN)
    expect(profile).toEqual(WEATHER_PROFILES.clear)
  })

  it('treats a NaN blend amount as zero for a reversed blend too', () => {
    const wind = blendWind({ x: 0, z: 10 }, { x: 10, z: 0 }, Number.NaN)
    expect(wind.x).toBeCloseTo(0, 8)
    expect(wind.z).toBeCloseTo(10, 8)
  })

  it('clamps out-of-range amounts to the nearer end', () => {
    const to = blendWind({ x: 10, z: 0 }, { x: 0, z: 10 }, 2)
    expect(to.x).toBeCloseTo(0, 8)
    expect(to.z).toBeCloseTo(10, 8)
    expect(blendWind({ x: 10, z: 0 }, { x: 0, z: 10 }, -1)).toEqual({ x: 10, z: 0 })
    const storm = blendWeatherProfile(WEATHER_PROFILES.clear, WEATHER_PROFILES.storm, 2)
    expect(storm.rain).toBeCloseTo(WEATHER_PROFILES.storm.rain, 8)
    expect(storm.fogNearMul).toBeCloseTo(WEATHER_PROFILES.storm.fogNearMul, 8)
    const clear = blendWeatherProfile(WEATHER_PROFILES.clear, WEATHER_PROFILES.storm, -1)
    expect(clear.rain).toBeCloseTo(WEATHER_PROFILES.clear.rain, 8)
    expect(clear.fogNearMul).toBeCloseTo(WEATHER_PROFILES.clear.fogNearMul, 8)
  })

  it('keeps every blended field finite at the midpoint', () => {
    const profile = blendWeatherProfile(WEATHER_PROFILES.clear, WEATHER_PROFILES.storm, .5)
    expect(Object.values(profile).every(Number.isFinite)).toBe(true)
    expect(profile.rain).toBeCloseTo(.5, 8)
  })
})
