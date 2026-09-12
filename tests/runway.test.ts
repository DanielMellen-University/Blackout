import { afterEach, describe, expect, it, vi } from 'vitest'
import { Mesh, MeshStandardMaterial } from 'three'
import { createRunway, runwayLightIntensity, setRunwayDaylight } from '../src/world/Runway'
import {
  papiLightIntensity,
  papiLightPattern,
  setAirfieldPapi,
  setAirfieldWind,
} from '../src/world/Airfield'

describe('runway lighting', () => {
  let runway: ReturnType<typeof createRunway> | null = null

  afterEach(() => {
    const geometries = new Set<{ dispose: () => void }>()
    const materials = new Set<{ dispose: () => void }>()
    runway?.traverse(object => {
      if (!(object instanceof Mesh)) return
      geometries.add(object.geometry)
      const mats = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of mats) materials.add(material)
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    runway = null
  })

  it('clamps and scales light intensity across the day', () => {
    expect(runwayLightIntensity(1)).toBeCloseTo(.18)
    expect(runwayLightIntensity(0)).toBeCloseTo(1.8)
    expect(runwayLightIntensity(-1)).toBeCloseTo(1.8)
    expect(runwayLightIntensity(2)).toBeCloseTo(.18)
  })

  it('updates the shared runway edge-light material', () => {
    runway = createRunway()
    setRunwayDaylight(runway, 1)
    const light = runway.getObjectByName('RunwayLights')?.children[0] as Mesh
    expect((light.material as MeshStandardMaterial).emissiveIntensity).toBeCloseTo(.18)
    setRunwayDaylight(runway, 0)
    expect((light.material as MeshStandardMaterial).emissiveIntensity).toBeCloseTo(1.8)
  })

  it('updates the cached shared material without traversing the runway', () => {
    runway = createRunway()
    const lookup = vi.spyOn(runway, 'getObjectByName')

    setRunwayDaylight(runway, 0.5)
    setRunwayDaylight(runway, 0.5)

    expect(lookup).not.toHaveBeenCalled()
  })

  it('freezes static runway meshes while leaving the windsock fabric animatable', () => {
    runway = createRunway()
    const asphalt = runway.children.find(child => child instanceof Mesh) as Mesh
    const fabric = runway.getObjectByName('WindsockFabric') as Mesh
    expect(asphalt.matrixAutoUpdate).toBe(false)
    expect(fabric.matrixAutoUpdate).toBe(true)
  })

  it('aims the windsock downwind in runway-local space', () => {
    runway = createRunway()
    const windsock = runway.getObjectByName('Windsock')!
    const fabric = runway.getObjectByName('WindsockFabric')!

    setAirfieldWind(runway, 10, 0)
    expect(windsock.rotation.y).toBeCloseTo(-Math.PI / 2)
    expect(fabric.scale.y).toBeGreaterThan(0.84)

    runway.rotation.y = Math.PI / 2
    setAirfieldWind(runway, 10, 0)
    expect(Math.abs(Math.abs(windsock.rotation.y) - Math.PI)).toBeLessThan(0.005)
  })

  it('caches windsock nodes after the first weather update', () => {
    runway = createRunway()
    const lookup = vi.spyOn(runway, 'getObjectByName')

    setAirfieldWind(runway, 10, 0)
    lookup.mockClear()
    setAirfieldWind(runway, -8, 4)

    expect(lookup).not.toHaveBeenCalled()
  })

  it('maps glide angle to a readable PAPI pattern', () => {
    const distance = 100
    expect(papiLightPattern(Math.tan(4 * Math.PI / 180) * distance, distance)).toBe(4)
    expect(papiLightPattern(Math.tan(3.2 * Math.PI / 180) * distance, distance)).toBe(3)
    expect(papiLightPattern(Math.tan(2.6 * Math.PI / 180) * distance, distance)).toBe(2)
    expect(papiLightPattern(Math.tan(2 * Math.PI / 180) * distance, distance)).toBe(1)
    expect(papiLightPattern(Math.tan(1 * Math.PI / 180) * distance, distance)).toBe(0)
    expect(papiLightPattern(Number.NaN, distance)).toBe(2)
  })

  it('keeps PAPI dimmer in daylight and brighter at night', () => {
    expect(papiLightIntensity(1, true)).toBeCloseTo(1.008)
    expect(papiLightIntensity(0, true)).toBeCloseTo(2.058)
    expect(papiLightIntensity(0, false)).toBeCloseTo(2.352)
    expect(papiLightIntensity(Number.NaN, true)).toBeCloseTo(1.008)
  })

  it('updates PAPI lenses only when the approach pattern changes', () => {
    runway = createRunway()
    const lookup = vi.spyOn(runway, 'getObjectByName')
    setAirfieldPapi(runway, 0, 0, 0)
    expect(lookup).toHaveBeenCalledTimes(1)

    const distance = 100
    const height = Math.tan(4 * Math.PI / 180) * distance
    setAirfieldPapi(runway, -13.5, height, -138)
    const papi = runway.getObjectByName('PAPI')!
    const lenses = papi.children.filter(child => child.name.startsWith('PapiLens')) as Mesh[]
    expect(lenses).toHaveLength(4)
    expect((lenses[0]!.material as MeshStandardMaterial).color.getHex()).toBe(0xf4f8ff)
    expect((lenses[3]!.material as MeshStandardMaterial).color.getHex()).toBe(0xf4f8ff)
    expect((lenses[0]!.material as MeshStandardMaterial).emissiveIntensity).toBeCloseTo(1.008)

    const previous = lenses.map(lens => (lens.material as MeshStandardMaterial).color.getHex())
    lookup.mockClear()
    setAirfieldPapi(runway, -13.5, height, -138)
    expect(lookup).not.toHaveBeenCalled()
    expect(lenses.map(lens => (lens.material as MeshStandardMaterial).color.getHex())).toEqual(previous)

    setAirfieldPapi(runway, -13.5, height, -138, 0)
    expect((lenses[0]!.material as MeshStandardMaterial).emissiveIntensity).toBeCloseTo(2.058)
  })

  it('invalidates cached PAPI pose when the runway rotates', () => {
    runway = createRunway()
    const lookup = vi.spyOn(runway, 'getObjectByName')
    setAirfieldPapi(runway, 0, 0, 0)
    lookup.mockClear()

    runway.rotation.y = Math.PI / 2
    setAirfieldPapi(runway, 0, 0, 0)

    expect(lookup).not.toHaveBeenCalled()
  })
})
