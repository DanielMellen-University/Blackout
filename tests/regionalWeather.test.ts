import { AmbientLight, DirectionalLight, HemisphereLight, InstancedMesh, Scene } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Atmosphere } from '../src/world/Atmosphere'
import { RegionalWeather, createRegionalWeatherSample } from '../src/world/RegionalWeather'
import { PROFILE_KEYS, WEATHER_ORDER } from '../src/world/WeatherDirector'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'

const originalSeed = getWorldSeed()
afterEach(() => setWorldSeed(originalSeed))
const numericKeys = [...PROFILE_KEYS, 'windX', 'windZ', 'cloudBase'] as const

function atmosphere() {
  return new Atmosphere(new Scene(), {
    sun: new DirectionalLight(), moon: new DirectionalLight(), fill: new DirectionalLight(),
    hemi: new HemisphereLight(), ambient: new AmbientLight(),
  }, 1200, 30240)
}

describe('regional weather', () => {
  it('fills caller-owned samples deterministically regardless of query order', () => {
    setWorldSeed(42)
    const sampler = new RegionalWeather(), out = createRegionalWeatherSample()
    expect(sampler.sampleInto(out, 32000, 200, -64000, 180)).toBe(out)
    const first = { ...out }
    sampler.sampleInto(out, -400000, 5000, 900000, 4000)
    sampler.sampleInto(out, 32000, 200, -64000, 180)
    expect(out).toEqual(first)
    setWorldSeed(1337)
    sampler.sampleInto(out, 32000, 200, -64000, 180)
    expect(out).not.toEqual(first)
    sampler.sampleInto(out, NaN, Infinity, NaN, NaN)
    for (const key of numericKeys) expect(Number.isFinite(out[key])).toBe(true)
  })

  it('supports every weather family without making every region wet or stormy', () => {
    setWorldSeed(1)
    const sampler = new RegionalWeather(), out = createRegionalWeatherSample(), counts = new Map<string, number>()
    let total = 0
    for (let x = -200000; x <= 200000; x += 8000) for (let z = -200000; z <= 200000; z += 8000) {
      sampler.sampleInto(out, x, 200, z, 180)
      counts.set(out.id, (counts.get(out.id) ?? 0) + 1); total++
      expect(out.rain + out.snow).toBeLessThanOrEqual(1.000001)
      expect(out.windMps).toBeLessThanOrEqual(27)
      expect(Math.hypot(out.windX, out.windZ)).toBeCloseTo(out.windMps, 8)
      expect(out.gust).toBeLessThanOrEqual(.85)
      expect(out.cloudBase).toBeGreaterThan(700)
      if (out.snow > .99) expect(out.lightning).toBeLessThan(.01)
    }
    for (const id of WEATHER_ORDER) expect(counts.get(id) ?? 0).toBeGreaterThan(0)
    expect(counts.get('clear')! / total).toBeGreaterThan(.1)
    expect(counts.get('storm')! / total).toBeLessThan(.2)
  })

  it('blends region boundaries and advances fronts smoothly in simulation time', () => {
    setWorldSeed(42)
    const sampler = new RegionalWeather(), a = createRegionalWeatherSample(), b = createRegionalWeatherSample()
    let moved = 0
    for (let i = -4; i <= 4; i++) {
      const x = i * 32000, z = (i + 1) * 24000
      sampler.sampleInto(a, x - .01, 300, z, 90)
      sampler.sampleInto(b, x + .01, 300, z, 90)
      for (const key of numericKeys) expect(Math.abs(a[key] - b[key])).toBeLessThan(.03)
      sampler.sampleInto(a, x, 300, z, 90)
      sampler.sampleInto(b, x, 300, z, 90 + 1 / 60)
      for (const key of PROFILE_KEYS) expect(Math.abs(a[key] - b[key])).toBeLessThan(.002)
      sampler.sampleInto(b, x, 300, z, 1890)
      moved += Math.abs(a.rain - b.rain) + Math.abs(a.lowClouds - b.lowClouds)
    }
    expect(moved).toBeGreaterThan(.5)
  })

  it('keeps precipitation type and source altitude independent of observer altitude', () => {
    setWorldSeed(1)
    const sampler = new RegionalWeather(), low = createRegionalWeatherSample(), high = createRegionalWeatherSample()
    for (const z of [-136000, -104000, 56000, 168000]) {
      sampler.sampleInto(low, -200000, 100, z, 180)
      sampler.sampleInto(high, -200000, 15000, z, 180)
      expect(high.rain).toBe(low.rain); expect(high.snow).toBe(low.snow)
      expect(high.cloudBase).toBe(low.cloudBase)
    }
  })

  it('freezes fronts on pause, samples moved anchors, and mutes precipitation above its deck', () => {
    setWorldSeed(1)
    const weather = atmosphere()
    try {
      weather.randomizeWeather(1, { x: -200000, y: 200, z: -136000 })
      weather.update(180, -200000, 200, -136000, 0)
      const before = { ...weather.weatherSnapshot }, time = weather.weatherSimulationTime
      weather.update(0, -200000, 200, -136000, .1)
      expect(weather.weatherSimulationTime).toBe(time)
      expect(weather.weatherSnapshot).toEqual(before)
      expect(weather.precipitationVisibility).toBe(1)
      weather.update(0, -200000, 15000, -136000, 0)
      expect(weather.weatherSimulationTime).toBe(time)
      expect(weather.precipitationVisibility).toBe(0)
      expect(weather.weatherSnapshot.rain).toBe(before.rain)
    } finally { weather.dispose() }
  })

  it('cycles manual presets plus Automatic and preserves authored locks', () => {
    setWorldSeed(42)
    const weather = atmosphere()
    try {
      weather.randomizeWeather(42)
      expect(weather.weatherAutomatic).toBe(true)
      const before = { ...weather.weatherSnapshot }
      expect(weather.cycleWeather()).toBe('clear')
      expect(weather.weatherAutomatic).toBe(false)
      expect(weather.weatherSnapshot.rain).toBe(before.rain)
      for (const id of WEATHER_ORDER.slice(1)) expect(weather.cycleWeather()).toBe(id)
      weather.cycleWeather()
      expect(weather.weatherAutomatic).toBe(true)
      weather.setWeather('storm', true); weather.setWeatherLocked(true)
      const locked = { ...weather.weatherSnapshot }
      weather.setAutomaticWeather(true)
      weather.cycleWeather(); weather.update(600, 30000, 300, -50000, 0)
      expect(weather.weatherAutomatic).toBe(false)
      expect(weather.weatherSnapshot).toEqual(locked)
      weather.setReducedMotion(true); weather.update(.1, 30000, 300, -50000)
      expect(weather.lightningActive).toBe(false)
    } finally { weather.dispose() }
  })

  it('keeps cloud pools fixed and spatial queries on a bounded lower-frequency cadence', () => {
    setWorldSeed(1)
    const weather = atmosphere(), samples = vi.spyOn(RegionalWeather.prototype, 'sampleInto')
    const batches = Object.values((weather as unknown as {cloudInstances: Record<string, InstancedMesh>}).cloudInstances)
    const pools = batches.map(mesh => ({ mesh, geometry: mesh.geometry, capacity: mesh.instanceMatrix.count }))
    try {
      weather.randomizeWeather(1)
      for (let i = 0; i < 120; i++) weather.update(1 / 60, i * 8, 200, 0)
      // 120 local samples, at most eleven 46-cloud samples and nine distant
      // rounds, rather than sampling every puff or all clusters every frame.
      expect(samples.mock.calls.length).toBeLessThan(800)
      expect(samples.mock.calls.length).toBeGreaterThan(120)
      for (let i = 0; i < 10; i++) weather.update(1 / 60, i * 100000, 200, -i * 100000)
      weather.setCloudDensityScale(.5); weather.setCloudDensityScale(1)
      for (const pool of pools) {
        expect(pool.mesh.geometry).toBe(pool.geometry)
        expect(pool.mesh.instanceMatrix.count).toBe(pool.capacity)
        expect(pool.mesh.count).toBeLessThanOrEqual(pool.capacity)
      }
    } finally { samples.mockRestore(); weather.dispose() }
  })

  it('moves the sky origin every frame without resampling the distant deck every frame', () => {
    setWorldSeed(1)
    const weather = atmosphere()
    const sky = (weather as unknown as { sky: { setRegionalOrigin: (x: number, z: number, seconds: number) => void;
      setRegionalWeather: (...args: unknown[]) => void } }).sky
    const origin = vi.spyOn(sky, 'setRegionalOrigin'), deck = vi.spyOn(sky, 'setRegionalWeather')
    try {
      weather.randomizeWeather(1)
      for (let i = 0; i < 120; i++) weather.update(1 / 60, i * 24, 200, -i * 12)
      expect(origin.mock.calls.length).toBeGreaterThanOrEqual(120)
      expect(origin.mock.calls.at(-1)).toEqual([119 * 24, -119 * 12, weather.weatherSimulationTime])
      expect(deck.mock.calls.length).toBeLessThan(12)
    } finally { origin.mockRestore(); deck.mockRestore(); weather.dispose() }
  })
})
