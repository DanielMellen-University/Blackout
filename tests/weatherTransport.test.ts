import { afterEach, describe, expect, it } from 'vitest'
import { writeWeatherTransport } from '../src/world/WeatherTransport'
import { createRegionalWeatherSample, RegionalWeather } from '../src/world/RegionalWeather'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'
import { SkyDome } from '../src/world/SkyDome'
import { AmbientLight, DirectionalLight, HemisphereLight, Scene } from 'three'
import { Atmosphere } from '../src/world/Atmosphere'

const originalSeed = getWorldSeed()
afterEach(() => setWorldSeed(originalSeed))

describe('wind-carried regional fronts', () => {
  it('reuses storage, reproduces a seed and gives different seeds distinct prevailing winds', () => {
    const out = { x: 0, z: 0 }
    expect(writeWeatherTransport(out, 73)).toBe(out)
    const first = { ...out }
    expect(writeWeatherTransport(out, 1337)).not.toEqual(first)
    expect(writeWeatherTransport(out, 73)).toEqual(first)
    expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(10)
    expect(Math.hypot(out.x, out.z)).toBeLessThanOrEqual(16)
    expect(Number.isFinite(writeWeatherTransport(out, NaN).x)).toBe(true)
  })

  it('has clear, overcast, rainy and stormy regions at the same simulation time', () => {
    setWorldSeed(1)
    const sample = createRegionalWeatherSample(), weather = new RegionalWeather(), ids = new Set<string>()
    for (let x = -256000; x <= 256000; x += 16000) for (let z = -256000; z <= 256000; z += 16000) {
      weather.sampleInto(sample, x, 600, z, 180); ids.add(sample.id)
    }
    for (const id of ['clear', 'overcast', 'rain', 'storm']) expect(ids.has(id), id).toBe(true)
  })

  it('keeps local surface wind aligned with cloud/front transport while preserving weather strength', () => {
    setWorldSeed(73)
    const flow = writeWeatherTransport({ x: 0, z: 0 }, 73), sample = createRegionalWeatherSample(), weather = new RegionalWeather()
    for (let x = -160000; x <= 160000; x += 8000) {
      weather.sampleInto(sample, x, 600, x * .37, 300)
      const alignment = (flow.x * sample.windX + flow.z * sample.windZ) / Math.hypot(flow.x, flow.z) / sample.windMps
      expect(alignment).toBeGreaterThan(.95)
      expect(Math.hypot(sample.windX, sample.windZ)).toBeCloseTo(sample.windMps, 8)
      expect(sample.windMps).toBeLessThanOrEqual(27)
      expect(sample.gust).toBeLessThanOrEqual(.85)
    }
  })

  it('crosses a boundary smoothly at maximum speed and reproduces revisited positions and clocks', () => {
    setWorldSeed(1)
    const sample = createRegionalWeatherSample(), weather = new RegionalWeather()
    let previous: typeof sample | undefined
    for (let i = 0; i <= 1200; i++) {
      weather.sampleInto(sample, -240000 - i * 16, 600, -192000 - i * 16, 180 + i / 30)
      if (previous) for (const key of ['rain', 'snow', 'haze', 'lowClouds', 'lightning', 'gust'] as const)
        expect(Math.abs(sample[key] - previous[key]), key).toBeLessThan(.04)
      previous = { ...sample }
    }
    weather.sampleInto(sample, -240000, 600, -192000, 180)
    const initial = { ...sample }
    weather.sampleInto(sample, 100000, 1000, 200000, 900)
    weather.sampleInto(sample, -240000, 600, -192000, 180)
    expect(sample).toEqual(initial)
  })

  it('does not teleport cloud identities when switching between manual and regional modes', () => {
    setWorldSeed(1)
    const weather = new Atmosphere(new Scene(), {
      sun: new DirectionalLight(), moon: new DirectionalLight(), fill: new DirectionalLight(),
      hemi: new HemisphereLight(), ambient: new AmbientLight(),
    }, 1200, 30240)
    try {
      weather.randomizeWeather(1)
      weather.setAutomaticWeather(true, 180)
      weather.update(0, -240000, 600, -192000, 5)
      const positions = (weather as unknown as { cloudWorld: { x: number; z: number }[] }).cloudWorld
      const before = positions.map(({ x, z }) => [x, z])
      weather.setWeather('storm', true)
      weather.update(0, -240000, 600, -192000, .2)
      expect(positions.map(({ x, z }) => [x, z])).toEqual(before)
      weather.setAutomaticWeather(true, 180)
      weather.update(0, -240000, 600, -192000, .2)
      expect(positions.map(({ x, z }) => [x, z])).toEqual(before)
    } finally { weather.dispose() }
  })

  it('advects the distant sky through the same coordinates without changing its buffers', () => {
    const sky = new SkyDome(new Scene()), wind = writeWeatherTransport({ x: 0, z: 0 }, 73)
    try {
      sky.setRegionalTransport(wind.x, wind.z)
      const uniforms = (sky as unknown as { mat: { uniforms: Record<string, { value: any }> } }).mat.uniforms
      const origin = uniforms.uRegionalOrigin!.value
      sky.setRegionalOrigin(wind.x * 1000, wind.z * 1000, 1000)
      expect(origin.x).toBeCloseTo(0, 10); expect(origin.y).toBeCloseTo(0, 10)
      sky.setRegionalOrigin(wind.x * 1000, wind.z * 1000, 1000)
      expect(uniforms.uRegionalOrigin!.value).toBe(origin)
      expect(origin.x).toBeCloseTo(0, 10)
    } finally { sky.dispose() }
  })
})
