import { afterEach, describe, expect, it, vi } from 'vitest'
import { Mesh, MeshStandardMaterial } from 'three'
import { createRunway, runwayLightIntensity, setRunwayDaylight } from '../src/world/Runway'

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
})
