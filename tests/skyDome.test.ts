import { describe, expect, it } from 'vitest'
import { deriveSkyCloudDeck, deriveSkyCloudDeckInto } from '../src/world/SkyDome'
import { WEATHER_PROFILES } from '../src/world/WeatherDirector'

function deckFor(id: keyof typeof WEATHER_PROFILES) {
  const weather = WEATHER_PROFILES[id]
  return deriveSkyCloudDeck({
    ...weather,
    windX: weather.windMps,
    windZ: -weather.windMps * 0.5,
  })
}

describe('analytic sky cloud deck', () => {
  it('turns profile layers into distinct but bounded sky states', () => {
    const clear = deckFor('clear')
    const cloudy = deckFor('cloudy')
    const rain = deckFor('rain')
    const storm = deckFor('storm')

    for (const deck of [clear, cloudy, rain, storm]) {
      for (const value of [
        deck.broken,
        deck.blanket,
        deck.cirrus,
        deck.storm,
        deck.darkness,
      ]) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }

    expect(clear.cirrus).toBeGreaterThan(clear.blanket)
    expect(cloudy.broken).toBeGreaterThan(clear.broken)
    expect(rain.blanket).toBeGreaterThan(cloudy.blanket)
    expect(rain.broken).toBeLessThan(cloudy.broken)
    expect(storm.storm).toBe(1)
    expect(storm.darkness).toBeGreaterThan(rain.darkness)
  })

  it('changes continuously through a front and preserves the wind direction', () => {
    const rain = WEATHER_PROFILES.rain
    const storm = WEATHER_PROFILES.storm
    const halfway = deriveSkyCloudDeck({
      lowClouds: (rain.lowClouds + storm.lowClouds) * 0.5,
      midClouds: (rain.midClouds + storm.midClouds) * 0.5,
      highClouds: (rain.highClouds + storm.highClouds) * 0.5,
      rain: (rain.rain + storm.rain) * 0.5,
      lightning: (rain.lightning + storm.lightning) * 0.5,
      windX: 12,
      windZ: -8,
    })
    const justAfter = deriveSkyCloudDeck({
      lowClouds: (rain.lowClouds + storm.lowClouds) * 0.5,
      midClouds: (rain.midClouds + storm.midClouds) * 0.5,
      highClouds: (rain.highClouds + storm.highClouds) * 0.5,
      rain: (rain.rain + storm.rain) * 0.5,
      lightning: (rain.lightning + storm.lightning) * 0.5 + 0.001,
      windX: 12,
      windZ: -8,
    })

    expect(halfway.blanket).toBeGreaterThanOrEqual(deckFor('rain').blanket)
    expect(halfway.blanket).toBeLessThanOrEqual(deckFor('storm').blanket)
    expect(justAfter.storm - halfway.storm).toBeGreaterThan(0)
    expect(justAfter.storm - halfway.storm).toBeLessThan(0.01)
    expect(halfway.windX).toBeGreaterThan(0)
    expect(halfway.windZ).toBeLessThan(0)
  })

  it('fills a caller-owned deck for runtime updates', () => {
    const weather = WEATHER_PROFILES.cloudy
    const target = {} as ReturnType<typeof deriveSkyCloudDeck>
    const input = { ...weather, windX: 8, windZ: -4 }

    expect(deriveSkyCloudDeckInto(target, input)).toBe(target)
    expect(target).toEqual(deriveSkyCloudDeck(input))
  })
})
