import { describe, expect, it, vi } from 'vitest'
import { AmbientLight, BufferAttribute, DirectionalLight, Fog, HemisphereLight, InstancedMesh, LineBasicMaterial, Matrix4, PointsMaterial, Scene, Vector3 } from 'three'
import { Atmosphere } from '../src/world/Atmosphere'
import { cloudInteriorDensity } from '../src/world/CloudMaterial'
import { precipitationAtAltitude, RainField } from '../src/world/RainField'
import { skyLayerVisibility } from '../src/world/SkyDome'
import { SnowField } from '../src/world/SnowField'

function atmosphere() {
  const scene = new Scene()
  const weather = new Atmosphere(scene, {
    sun: new DirectionalLight(), moon: new DirectionalLight(), fill: new DirectionalLight(),
    hemi: new HemisphereLight(), ambient: new AmbientLight(),
  }, 1200, 18000)
  weather.setWeather('storm', true)
  return { scene, weather }
}

describe('weather rendering', () => {
  it('raises storm towers without stretching individual billows into needle-like droplets', () => {
    const { scene, weather } = atmosphere()
    try {
      weather.randomizeWeather(1); weather.setWeather('storm', true)
      weather.update(0, 8000, 1400, -56000, 10)
      const clouds = scene.getObjectByName('CloudBatch-cumulus') as InstancedMesh
      const matrix = new Matrix4(), scale = new Vector3(), alpha = clouds.geometry.getAttribute('cloudAlpha')
      let visible = 0
      for (let i = 0; i < clouds.count; i++) if (alpha.getX(i) > .5) {
        clouds.getMatrixAt(i, matrix); scale.setFromMatrixScale(matrix); visible++
        expect(scale.y / Math.max(scale.x, scale.z)).toBeLessThan(2.8)
      }
      expect(visible).toBeGreaterThan(50)
    } finally { weather.dispose() }
  })

  it('uses coverage to select clouds without fading their material opacity a second time', () => {
    const { scene, weather } = atmosphere()
    try {
      const clouds = scene.getObjectByName('CloudBatch-cumulus') as InstancedMesh
      for (const id of ['clear', 'cloudy', 'overcast', 'storm'] as const) {
        weather.setWeather(id, true); weather.update(.2, 0, 1400, 0)
        expect((clouds.material as { opacity: number }).opacity).toBe(.95)
      }
      weather.setAutomaticWeather(true); weather.update(.2, 0, 1400, 0)
      expect((clouds.material as { opacity: number }).opacity).toBe(.95)
    } finally { weather.dispose() }
  })

  it('uses physical blizzard visibility without changing the streaming envelope, and clears it above the source', () => {
    const { scene, weather } = atmosphere()
    try {
      weather.setWeather('blizzard', true); weather.update(.2, 0, -100, 0)
      expect((scene.fog as Fog).far).toBe(2600)
      weather.update(.2, 0, 20000, 0)
      expect((scene.fog as Fog).far).toBe(18000)
    } finally { weather.dispose() }
  })

  it('keeps storm illumination localized without changing ambient or fill lights', () => {
    const { scene, weather } = atmosphere()
    const lights = weather as unknown as { ambient: { intensity: number }; fill: { intensity: number };
      cloudFlash: { value: number }; cloudInstances: Record<string, InstancedMesh> }
    weather.timeOfDay = .5; weather.setTimeOfDayLocked(true)
    weather.update(.1, 0, 1400, 0)
    const ambient = lights.ambient.intensity, fill = lights.fill.intensity
    const matrixVersion = lights.cloudInstances.cumulus!.instanceMatrix.version
    let flashed = false, thunder = 0
    try {
      for (let i = 0; i < 1500; i++) {
        weather.update(.1, 0, 1400, 0)
        flashed ||= lights.cloudFlash.value > 0
        if (weather.consumeThunder() > 0) thunder++
        expect(lights.ambient.intensity).toBe(ambient)
        expect(lights.fill.intensity).toBe(fill)
      }
      expect(flashed).toBe(true); expect(thunder).toBeGreaterThan(0)
      expect(lights.cloudInstances.cumulus!.instanceMatrix.version - matrixVersion).toBe(750)
      expect(scene.getObjectByName('RainShafts')).toBeTruthy()
      weather.setReducedMotion(true); expect(lights.cloudFlash.value).toBe(0)
      weather.setReducedMotion(false); weather.setWeather('clear', true)
      expect(weather.lightningActive).toBe(false)
      expect(lights.cloudFlash.value).toBe(0)
    } finally { weather.dispose() }
  })

  it('varies rain opacity and lengths without changing its particle capacity', () => {
    const rain = new RainField(), different = new RainField()
    try {
      rain.setSeed(1.1); different.setSeed(1.2)
      rain.update(0, 0, 1000, 0, 1, 0, 0)
      const alpha = rain.mesh.geometry.getAttribute('rainAlpha')
      const other = different.mesh.geometry.getAttribute('rainAlpha')
      expect(alpha.count).toBe(3600)
      expect(Array.from(alpha.array)).not.toEqual(Array.from(other.array))
      const lengths = new Set<number>(), p = rain.mesh.geometry.getAttribute('position')
      for (let i = 0; i < p.count; i += 2) {
        expect(alpha.getX(i)).toBeGreaterThan(alpha.getX(i + 1))
        lengths.add(Math.round((p.getY(i + 1) - p.getY(i)) * 100))
      }
      expect(lengths.size).toBeGreaterThan(100)
    } finally { rain.dispose(); different.dispose() }
  })

  it('clips wind-slanted rain at its regional source without making a horizontal ceiling', () => {
    const rain = new RainField()
    rain.setSeed(731)
    rain.update(0, 0, 1000, 0, 1, 20, -10, 1010)
    const p = rain.mesh.geometry.getAttribute('position')
    let collapsed = 0, below = 0
    for (let i = 0; i < rain.mesh.geometry.drawRange.count; i += 2) {
      expect(p.getY(i) + 1000).toBeLessThanOrEqual(1010.0001)
      expect(p.getY(i + 1) + 1000).toBeLessThanOrEqual(1010.0001)
      if (p.getY(i) === p.getY(i + 1)) {
        collapsed++
        expect(p.getX(i)).toBe(p.getX(i + 1)); expect(p.getZ(i)).toBe(p.getZ(i + 1))
      } else below++
    }
    expect(collapsed).toBeGreaterThan(0); expect(below).toBeGreaterThan(0)
    rain.dispose()
  })

  it('fades cloud opacity without shrinking the formation and budgets whole instances', () => {
    const { scene, weather } = atmosphere()
    weather.update(.1, 0, 1000, 0)
    const clouds = scene.getObjectByName('CloudBatch-cumulus') as InstancedMesh
    const alpha = clouds.geometry.getAttribute('cloudAlpha')
    let index = -1
    for (let i = 0; i < alpha.count; i++) if (alpha.getX(i) > 0) { index = i; break }
    expect(index).toBeGreaterThanOrEqual(0)
    const opacity = alpha.getX(index)
    const matrix = new Matrix4(), before = new Vector3(), after = new Vector3()
    clouds.getMatrixAt(index, matrix); before.setFromMatrixScale(matrix)
    for (let i = 0; i < 30; i++) weather.update(1 / 30, 0, 1000, 0)
    clouds.getMatrixAt(index, matrix); after.setFromMatrixScale(matrix)
    expect(after.distanceTo(before)).toBeLessThan(.001)
    expect(alpha.getX(index)).toBeGreaterThan(opacity)
    const fullCount = clouds.count
    const geometry = clouds.geometry
    weather.setCloudDensityScale(.5)
    expect(clouds.count).toBeLessThan(fullCount)
    expect(clouds.geometry).toBe(geometry)
    expect(clouds.geometry.drawRange.count).toBe(Infinity)
    weather.setCloudDensityScale(1)
    expect(clouds.count).toBe(fullCount)
    weather.dispose()
  })

  it('keeps atmosphere state finite when a frame reports malformed timing or position', () => {
    const { weather } = atmosphere()
    weather.update(.1, 0, 1000, 0)
    const timeBefore = weather.timeOfDay
    weather.update(Number.NaN, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN)
    expect(weather.timeOfDay).toBe(timeBefore)
    expect(Number.isFinite(weather.cloudImmersionLevel)).toBe(true)
    weather.update(.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)
    expect(Number.isFinite(weather.timeOfDay)).toBe(true)
    expect(Number.isFinite(weather.cloudImmersionLevel)).toBe(true)
    weather.dispose()
  })

  it('keeps the sky background stable while atmosphere owns the final fog colour', () => {
    const { scene, weather } = atmosphere()
    const background = scene.background
    weather.update(.1, 0, 1000, 0)
    expect(scene.background).toBe(background)
    expect(scene.fog).toBeTruthy()
    weather.dispose()
  })

  it('keeps stationary rain in world space when the observer moves', () => {
    const rain = new RainField()
    rain.update(0, 10, 1000, 20, 1, 0, 0)
    const attribute = rain.mesh.geometry.getAttribute('position')
    const index = 60 // away from wrapping boundaries
    const oldX = attribute.getX(index) + rain.mesh.position.x
    const oldY = attribute.getY(index) + rain.mesh.position.y
    const oldZ = attribute.getZ(index) + rain.mesh.position.z
    rain.update(0, 11, 1001, 21, 1, 0, 0)
    expect(attribute.getX(index) + rain.mesh.position.x).toBeCloseTo(oldX, 4)
    expect(attribute.getY(index) + rain.mesh.position.y).toBeCloseTo(oldY, 4)
    expect(attribute.getZ(index) + rain.mesh.position.z).toBeCloseTo(oldZ, 4)
    expect(rain.mesh.geometry.getAttribute('position')).toBe(attribute)
    rain.dispose()
  })

  it('keys pooled rain placement and speeds to the world seed', () => {
    const first = new RainField()
    const second = new RainField()
    const different = new RainField()
    first.setSeed(731)
    second.setSeed(731)
    different.setSeed(732)
    first.update(.016, 0, 1000, 0, 1, 12, -7)
    second.update(.016, 0, 1000, 0, 1, 12, -7)
    different.update(.016, 0, 1000, 0, 1, 12, -7)
    const firstPositions = Array.from((first.mesh.geometry.getAttribute('position') as BufferAttribute).array)
    const secondPositions = Array.from((second.mesh.geometry.getAttribute('position') as BufferAttribute).array)
    const differentPositions = Array.from((different.mesh.geometry.getAttribute('position') as BufferAttribute).array)
    expect(secondPositions).toEqual(firstPositions)
    expect(differentPositions).not.toEqual(firstPositions)
    first.dispose(); second.dispose(); different.dispose()
  })

  it('refreshes visible streak buffers when a live field is reseeded', () => {
    const rain = new RainField()
    rain.update(.016, 0, 1000, 0, 1, 0, 0)
    const before = Array.from((rain.mesh.geometry.getAttribute('position') as BufferAttribute).array)
    rain.setSeed(991)
    expect(rain.mesh.visible).toBe(false)
    const refreshed = Array.from((rain.mesh.geometry.getAttribute('position') as BufferAttribute).array)
    expect(refreshed).not.toEqual(before)
    rain.update(0, 0, 1000, 0, 1, 0, 0)
    expect(rain.mesh.visible).toBe(true)
    rain.dispose()
  })

  it('drifts and slants rain with wind, caps density, and releases buffers once', () => {
    const rain = new RainField()
    rain.setDensityScale(.5)
    rain.update(.016, 0, 1000, 0, 1, 20, -10)
    const geometry = rain.mesh.geometry
    expect(geometry.drawRange.count).toBe(1800)
    const p = geometry.getAttribute('position')
    expect(p.getX(1)).toBeLessThan(p.getX(0))
    expect(p.getY(1)).toBeGreaterThan(p.getY(0))
    expect(p.getZ(1)).toBeGreaterThan(p.getZ(0))
    rain.update(1, 100000, 9000, -200000, 1, 20, -10)
    for (let i = 0; i < geometry.drawRange.count; i += 2) {
      expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(90)
      expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(60)
      expect(Math.abs(p.getZ(i))).toBeLessThanOrEqual(90)
    }
    rain.setDensityScale(0)
    rain.update(.016, 0, 1000, 0, 1, 0, 0)
    expect(rain.mesh.visible).toBe(false)
    const dispose = vi.spyOn(geometry, 'dispose')
    rain.dispose(); rain.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps pooled rain transforms finite when the follow anchor is malformed', () => {
    const rain = new RainField()
    rain.update(.016, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1, 0, 0)
    expect(Number.isFinite(rain.mesh.position.x)).toBe(true)
    expect(Number.isFinite(rain.mesh.position.y)).toBe(true)
    expect(Number.isFinite(rain.mesh.position.z)).toBe(true)
    rain.dispose()
  })

  it('keeps peak precipitation soft enough to preserve scene contrast', () => {
    const rain = new RainField()
    rain.update(.016, 0, 1000, 0, 1, 0, 0)
    expect((rain.mesh.material as LineBasicMaterial).opacity).toBeLessThan(.3)
    rain.dispose()

    const snow = new SnowField()
    snow.update(.016, 0, 1000, 0, 1, 0, 0)
    expect((snow.points.material as PointsMaterial).opacity).toBeLessThan(.6)
    snow.dispose()
  })

  it('clears precipitation and the overhead deck above cloud tops', () => {
    expect(precipitationAtAltitude(1000, 0)).toBe(1)
    expect(precipitationAtAltitude(3000, 0)).toBeGreaterThan(0)
    expect(precipitationAtAltitude(3000, 0)).toBeLessThan(1)
    expect(precipitationAtAltitude(7000, 1)).toBe(0)
    expect(precipitationAtAltitude(4000, 1)).toBe(1)
    expect(precipitationAtAltitude(NaN, 0)).toBe(0)
    expect(skyLayerVisibility(1000, 2500, 3350)).toBe(1)
    expect(skyLayerVisibility(2925, 2500, 3350)).toBe(.5)
    expect(skyLayerVisibility(7000, 2500, 3350)).toBe(0)
  })

  it('builds immersion only inside a cloud with a soft edge', () => {
    expect(cloudInteriorDensity(0, 0, 0)).toBe(1)
    expect(cloudInteriorDensity(.8, 0, 0)).toBeGreaterThan(0)
    expect(cloudInteriorDensity(.8, 0, 0)).toBeLessThan(1)
    expect(cloudInteriorDensity(1, 0, 0)).toBe(0)
    expect(cloudInteriorDensity(0, -2, 0)).toBe(0)
    expect(cloudInteriorDensity(NaN, 0, 0)).toBe(0)
  })
})
