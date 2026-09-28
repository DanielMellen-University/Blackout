import { Color, Scene, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  auroraIntensity,
  deriveSkyCloudDeck,
  deriveSkyCloudDeckInto,
  SkyDome,
  skyCloudDetailScale,
  skyLayerVisibility,
} from '../src/world/SkyDome'
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
  it('keeps aurora envelopes deterministic, bounded, and night-only', () => {
    const clearNight = auroraIntensity(4200, -7100, 0, 0, 0)
    const repeated = auroraIntensity(4200, -7100, 0, 0, 0)

    expect(clearNight).toBe(repeated)
    expect(clearNight).toBeGreaterThanOrEqual(0)
    expect(clearNight).toBeLessThanOrEqual(1)
    expect(auroraIntensity(4200, -7100, 1, 0, 0)).toBe(0)
    expect(auroraIntensity(4200, -7100, 0, 1, 1)).toBeLessThanOrEqual(clearNight)
    expect(auroraIntensity(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, Number.NaN, Number.NaN)).toBe(0)
  })

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

  it('removes the detail octave only for the Low cloud budget', () => {
    expect(skyCloudDetailScale(0.5)).toBe(0)
    expect(skyCloudDetailScale(0.78)).toBe(1)
    expect(skyCloudDetailScale(1)).toBe(1)
    expect(skyCloudDetailScale(Number.NaN)).toBe(1)
  })

  it('fails closed for malformed cloud inputs and dome anchors', () => {
    const deck = deriveSkyCloudDeck({
      lowClouds: Number.NaN,
      midClouds: Number.POSITIVE_INFINITY,
      highClouds: Number.NEGATIVE_INFINITY,
      rain: Number.NaN,
      lightning: Number.POSITIVE_INFINITY,
      windX: Number.NaN,
      windZ: Number.POSITIVE_INFINITY,
    })
    for (const value of Object.values(deck)) expect(Number.isFinite(value)).toBe(true)
    expect(skyLayerVisibility(Number.NaN, 2500, 3350)).toBe(1)

    const sky = new SkyDome(new Scene())
    sky.update(
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      new Vector3(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN),
      Number.NaN,
      Number.POSITIVE_INFINITY,
      new Color(0xffffff),
      new Color(0xffffff),
      Number.NaN,
      deck,
      Number.NaN,
    )
    expect(Number.isFinite(sky.mesh.position.x)).toBe(true)
    expect(Number.isFinite(sky.mesh.position.y)).toBe(true)
    expect(Number.isFinite(sky.mesh.position.z)).toBe(true)
    sky.dispose()
  })

  it('routes the dome through the renderer output color pipeline', () => {
    const sky = new SkyDome(new Scene())
    const fragment = (sky as unknown as { mat: { fragmentShader: string } }).mat.fragmentShader

    expect(fragment).toContain('#include <tonemapping_fragment>')
    expect(fragment).toContain('#include <colorspace_fragment>')

    sky.dispose()
  })
})
