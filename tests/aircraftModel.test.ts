import { Box3, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { createF35Model } from '../src/aircraft/createF35Model'
import { setContactHeightSampler } from '../src/world/ground'

describe('rebuilt aircraft', () => {
  afterEach(() => setContactHeightSampler(null))

  it('has outward facing wings on both sides and wheels at the contact height', () => {
    const model = createF35Model()
    model.updateMatrixWorld(true)
    for (const x of [-3, 3]) {
      const ray = new Raycaster(new Vector3(x, 5, -1.8), new Vector3(0, -1, 0))
      const hits = ray.intersectObject(model, true)
      expect(hits.some(hit => hit.object.name === 'MainWing')).toBe(true)
    }
    const bounds = new Box3().setFromObject(model.getObjectByName('landingGear')!)
    expect(bounds.min.y).toBeCloseTo(-1.4, 5)
    const body = model.getObjectByName('BlendedFuselage') as Mesh
    const ray = new Raycaster(new Vector3(3, 0, 0), new Vector3(-1, 0, 0))
    expect(ray.intersectObject(body).length).toBeGreaterThan(0)
  })

  it('retracts over multiple physics frames and extends again near the ground', () => {
    setContactHeightSampler(() => 0)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.step(1 / 60)
    const left = aircraft.mesh.getObjectByName('gearLeft')!
    expect(left.rotation.z).toBeGreaterThan(0)
    expect(left.rotation.z).toBeLessThan(.2)
    for (let i = 0; i < 120; i++) aircraft.step(1 / 60)
    expect(aircraft.mesh.getObjectByName('landingGear')!.visible).toBe(false)
    aircraft.position.set(0, 1.4, 0)
    aircraft.velocity.set(0, 0, 0)
    aircraft.step(1 / 60)
    expect(aircraft.mesh.getObjectByName('landingGear')!.visible).toBe(true)
    expect(left.rotation.z).toBeGreaterThan(1)
  })

  it('turns off both the plume and nozzle glow when power is cut', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.controls.throttle = 1
    aircraft.controls.boost = true
    aircraft.step(1 / 60)
    const plume = aircraft.mesh.getObjectByName('afterburner')!
    expect(plume.visible).toBe(true)
    let glow: MeshStandardMaterial | undefined
    aircraft.mesh.traverse(obj => {
      if (obj instanceof Mesh && obj.material instanceof MeshStandardMaterial && obj.material.name === 'nozzleGlow') glow = obj.material
    })
    expect(glow!.emissiveIntensity).toBeGreaterThan(1)
    aircraft.controls.throttle = 0
    aircraft.controls.boost = false
    aircraft.step(1 / 60)
    expect(plume.visible).toBe(false)
    expect(glow!.emissiveIntensity).toBe(0)
  })
})
