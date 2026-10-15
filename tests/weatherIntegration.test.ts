import { AmbientLight, BufferGeometry, DirectionalLight, Fog, HemisphereLight,
  InstancedMesh, Material, Matrix4, Scene, Vector3 } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { Atmosphere } from '../src/world/Atmosphere'
import { WEATHER_ORDER } from '../src/world/WeatherDirector'
import { getWorldSeed, setWorldSeed } from '../src/world/noise'

const originalSeed = getWorldSeed()
afterEach(() => setWorldSeed(originalSeed))

function fixture() {
  const scene = new Scene()
  const weather = new Atmosphere(scene, { sun: new DirectionalLight(), moon: new DirectionalLight(),
    fill: new DirectionalLight(), hemi: new HemisphereLight(), ambient: new AmbientLight() }, 1200, 30240)
  return { scene, weather }
}

function resources(scene: Scene) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), arrays = new Set<ArrayLike<number>>()
  let objects = 0
  scene.traverse(node => {
    objects++
    const mesh = node as InstancedMesh
    if (mesh.geometry) {
      geometries.add(mesh.geometry)
      for (const attribute of Object.values(mesh.geometry.attributes)) arrays.add(attribute.array)
    }
    if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material)
    if (mesh.instanceMatrix) arrays.add(mesh.instanceMatrix.array)
  })
  return { geometries, materials, arrays, objects }
}

function expectSameResources(before: ReturnType<typeof resources>, after: ReturnType<typeof resources>) {
  expect(after.objects).toBe(before.objects)
  for (const key of ['geometries', 'materials', 'arrays'] as const) {
    expect(after[key].size).toBe(before[key].size)
    for (const item of after[key]) expect((before[key] as Set<unknown>).has(item)).toBe(true)
  }
}

describe('weather presentation integration', () => {
  it.each(['cloudy', 'storm'] as const)('enters an actual transformed %s cloud and restores depth visibility after leaving', preset => {
    setWorldSeed(1)
    const { scene, weather } = fixture()
    try {
      weather.randomizeWeather(1)
      weather.setWeather(preset, true)
      weather.setAutomaticWeather(false, 180)
      weather.update(0, 8000, 1400, -56000, 10)
      const cloud = scene.getObjectByName('CloudBatch-cumulus') as InstancedMesh
      const alpha = cloud.geometry.getAttribute('cloudAlpha'), matrix = new Matrix4(), point = new Vector3()
      let found = false
      for (let i = 0; i < cloud.count; i++) if (alpha.getX(i) > .5) {
        cloud.getMatrixAt(i, matrix); point.setFromMatrixPosition(matrix); found = true; break
      }
      expect(found).toBe(true)
      for (let i = 0; i < 30; i++) weather.update(0, point.x, point.y, point.z, .1)
      expect(weather.cloudImmersionLevel).toBeGreaterThan(.5)
      expect((scene.fog as Fog).far).toBeLessThan(10000)
      expect(weather.weatherSimulationTime).toBe(180)
      for (let i = 0; i < 30; i++) weather.update(0, point.x, 30000, point.z, .1)
      expect(weather.cloudImmersionLevel).toBeLessThan(.01)
      expect((scene.fog as Fog).far).toBeGreaterThan(30000)
      expect(weather.precipitationVisibility).toBe(0)
    } finally { weather.dispose() }
  })

  it('freezes matrices, precipitation, fog and storm state on a true game pause', () => {
    const { scene, weather } = fixture()
    try {
      weather.setWeather('storm', true); weather.update(10, 0, 1400, 0)
      const pool = resources(scene)
      const before = [...pool.arrays].map(array => Array.from(array))
      const fog = (scene.fog as Fog).clone(), time = weather.weatherSimulationTime
      const snapshot = { ...weather.weatherSnapshot }, immersion = weather.cloudImmersionLevel
      for (let i = 0; i < 120; i++) weather.update(0, 0, 1400, 0)
      expect([...pool.arrays].map(array => Array.from(array))).toEqual(before)
      expect(weather.weatherSimulationTime).toBe(time)
      expect(weather.weatherSnapshot).toEqual(snapshot)
      expect(weather.cloudImmersionLevel).toBe(immersion)
      expect(scene.fog).toEqual(fog)
    } finally { weather.dispose() }
  })

  it('retains every object and buffer over 900 simulated seconds of travel, quality changes and presets', () => {
    // Accelerated weather-only lifecycle regression. Not the required real-time
    // full-game memory/performance run: there is no renderer or terrain here.
    setWorldSeed(73)
    const { scene, weather } = fixture()
    try {
      weather.randomizeWeather(73)
      const before = resources(scene)
      for (let i = 0; i < 4500; i++) {
        if (i % 450 === 0) {
          const preset = i / 450
          if (preset < WEATHER_ORDER.length) weather.setWeather(WEATHER_ORDER[preset]!, true)
          else weather.setAutomaticWeather(true)
          const quality = preset % 2 ? .5 : 1
          weather.setCloudDensityScale(quality); weather.setPrecipitationScale(quality)
          weather.setReducedMotion(preset % 3 === 0)
        }
        weather.update(.2, 8000 + i * 136, 1400 + Math.sin(i / 100) * 1000, -56000 - i * 68)
        weather.consumeThunder()
        if (i % 450 === 449) {
          const after = resources(scene)
          expectSameResources(before, after)
          expect(Number.isFinite((scene.fog as Fog).far)).toBe(true)
          for (const node of ['CloudBatch-cumulus', 'CloudBatch-stratus', 'CloudBatch-cirrus', 'RainShafts']) {
            const mesh = scene.getObjectByName(node) as InstancedMesh
            expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count)
          }
        }
      }
      weather.randomizeWeather(42)
      weather.update(.2, 0, 1000, 0)
      expectSameResources(before, resources(scene))
      expect(weather.weatherAutomatic).toBe(true)
      expect(weather.lightningActive).toBe(false)
      expect(weather.consumeThunder()).toBe(0)
      expect(weather.weatherSimulationTime).toBeCloseTo(.2)
    } finally { weather.dispose() }
  })
})
