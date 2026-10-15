import { AmbientLight, DirectionalLight, HemisphereLight, InstancedMesh, Scene } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Atmosphere } from '../src/world/Atmosphere'
import { RegionalWeather, createRegionalWeatherSample, populateWeatherStructure, WEATHER_STRUCTURE_KEYS } from '../src/world/RegionalWeather'
import { PROFILE_KEYS, WEATHER_ORDER, WEATHER_PROFILES } from '../src/world/WeatherDirector'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'
import { sampleLandforms } from '../src/world/Landforms'

const originalSeed = getWorldSeed()
afterEach(() => setWorldSeed(originalSeed))
const numericKeys = [...PROFILE_KEYS, 'windX', 'windZ', ...WEATHER_STRUCTURE_KEYS] as const

function atmosphere() {
  return new Atmosphere(new Scene(), {
    sun: new DirectionalLight(), moon: new DirectionalLight(), fill: new DirectionalLight(),
    hemi: new HemisphereLight(), ambient: new AmbientLight(),
  }, 1200, 30240)
}

describe('regional weather', () => {
  it('samples manual climate envelopes at 5 Hz while adapting the profile without new buffers', () => {
    const weather = atmosphere(), bases = vi.spyOn(RegionalWeather.prototype, 'cloudBaseAt')
    try {
      weather.setWeather('rain', true)
      for (let i = 0; i < 120; i++) weather.update(1 / 60, 100, 200, 300)
      const local = () => bases.mock.calls.filter(([x, z]) => x === 100 && z === 300).length
      expect(local()).toBe(10)
      weather.update(0, 100, 15000, 300, 0)
      expect(local()).toBe(10)
      expect(weather.precipitationVisibility).toBe(0)
      weather.setWeather('storm', true); weather.update(0, 100, 200, 300, 0)
      expect(local()).toBe(11)
      expect(weather.precipitationVisibility).toBe(1)
    } finally { bases.mockRestore(); weather.dispose() }
  })

  it('fits manual cloud sources above mountain terrain without changing the authored profile', () => {
    setWorldSeed(1337)
    const sampler = new RegionalWeather(), out = createRegionalWeatherSample()
    Object.assign(out, WEATHER_PROFILES.storm)
    const before = PROFILE_KEYS.map(key => out[key])
    let mountains = 0
    for (let x = -9600; x <= 14400; x += 3000) for (let z = 8400; z <= 32400; z += 3000) {
      const land = sampleLandforms(x, z)
      sampler.structureInto(out, x, z)
      expect(PROFILE_KEYS.map(key => out[key])).toEqual(before)
      expect(out.precipitationBase).toBeGreaterThan(land.height + 400)
      expect(out.cloudTop).toBeGreaterThan(out.cloudBase)
      if (land.height > 1400) mountains++
    }
    expect(mountains).toBeGreaterThan(0)
  })

  it('samples local conditions at 5 Hz, interpolates presentation and preserves fixed cloud budgets', () => {
    setWorldSeed(73)
    const weather = atmosphere(), samples = vi.spyOn(RegionalWeather.prototype, 'sampleInto')
    try {
      weather.randomizeWeather(73, { x: 100, y: 200, z: 300 })
      for (let i = 0; i < 120; i++) weather.update(1 / 60, 100, 200, 300)
      const local = samples.mock.calls.filter(([, x, y, z]) => x === 100 && y === 200 && z === 300)
      expect(local.length).toBeGreaterThanOrEqual(9)
      expect(local.length).toBeLessThanOrEqual(11)
      const internals = weather as unknown as { cloudInstances: Record<string, InstancedMesh>;
        cloudDrift: { value: { x: number; z: number } } }
      expect(Object.values(internals.cloudInstances).reduce((sum, mesh) => sum + mesh.instanceMatrix.count, 0)).toBe(688)
      weather.setAutomaticWeather(true, 180)
      weather.update(0, 100, 200, 300, .2)
      const before = { ...weather.weatherSnapshot }
      weather.update(0, 100, 200, 300, .1)
      expect(weather.weatherSnapshot).toEqual(before)
      expect(internals.cloudDrift.value.x).toBe(0)
      expect(internals.cloudDrift.value.z).toBe(0)
    } finally { samples.mockRestore(); weather.dispose() }
  })

  it('keeps fair weather dominant while separating dry overcast, showers and convection', () => {
    const sampler = new RegionalWeather(), out = createRegionalWeatherSample()
    let dryOvercast = 0, quietRain = 0
    for (const seed of [1, 42, 73, 1337, 2026]) {
      setWorldSeed(seed)
      let total = 0, fair = 0, severe = 0
      for (let x = -200000; x <= 200000; x += 8000) for (let z = -200000; z <= 200000; z += 8000) {
        sampler.sampleInto(out, x, 200, z, 180); total++
        if (out.id === 'clear' || out.id === 'cloudy') fair++
        if (out.id === 'storm' || out.id === 'blizzard') severe++
        if (out.midClouds > .8 && out.rain + out.snow < .05) dryOvercast++
        if (out.rain > .3 && out.lightning < .01) quietRain++
        expect(out.cloudTop).toBeGreaterThan(out.cloudBase)
        expect(out.precipitationBase).toBe(out.cloudBase)
        expect(out.visibilityM).toBeGreaterThanOrEqual(1800)
        expect(out.convection).toBeGreaterThanOrEqual(0)
        expect(out.convection).toBeLessThanOrEqual(1)
      }
      expect(fair / total).toBeGreaterThanOrEqual(.55)
      expect(fair / total).toBeLessThanOrEqual(.70)
      expect(severe / total).toBeLessThanOrEqual(.10)
    }
    expect(dryOvercast).toBeGreaterThan(20)
    expect(quietRain).toBeGreaterThan(20)
  })

  it('populates the same vertical fields for every manual preset', () => {
    const out = createRegionalWeatherSample()
    for (const id of WEATHER_ORDER) {
      Object.assign(out, WEATHER_PROFILES[id]); populateWeatherStructure(out)
      for (const key of WEATHER_STRUCTURE_KEYS) expect(Number.isFinite(out[key])).toBe(true)
      expect(out.cloudTop).toBeGreaterThan(out.precipitationBase)
      expect(out.precipitationBase).toBe(out.cloudBase)
    }
    Object.assign(out, WEATHER_PROFILES.blizzard); populateWeatherStructure(out)
    expect(out.visibilityM).toBe(2600)
    Object.assign(out, WEATHER_PROFILES.clear); populateWeatherStructure(out)
    expect(out.visibilityM).toBeCloseTo(30240 * WEATHER_PROFILES.clear.fogFarMul)
  })
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
      for (const key of numericKeys) expect(Math.abs(a[key] - b[key]), key)
        .toBeLessThan(key === 'visibilityM' ? .3 : .03)
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
      // The authored conditions stay locked; their physical cloud envelope
      // still fits the terrain at the moved position, rather than going underground.
      for (const key of [...PROFILE_KEYS, 'windX', 'windZ'] as const)
        expect(weather.weatherSnapshot[key]).toBe(locked[key])
      expect((weather.weatherSnapshot as typeof locked).id).toBe(locked.id)
      expect((weather.weatherSnapshot as typeof locked).cloudBase)
        .toBeGreaterThan(sampleLandforms(30000, -50000).height + 400)
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
