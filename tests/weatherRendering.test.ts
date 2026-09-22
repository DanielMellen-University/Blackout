import { describe, expect, it, vi } from 'vitest'
import { AmbientLight, DirectionalLight, HemisphereLight, InstancedMesh, Matrix4, Scene, Vector3 } from 'three'
import { Atmosphere } from '../src/world/Atmosphere'
import { cloudInteriorDensity } from '../src/world/CloudMaterial'
import { precipitationAtAltitude, RainField } from '../src/world/RainField'
import { skyLayerVisibility } from '../src/world/SkyDome'

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
