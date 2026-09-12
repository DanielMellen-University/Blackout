import { Box3, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Raycaster, Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Aircraft,
  afterburnerDiamondPulse,
  antiCollisionBeaconOpacity,
  disposeAircraftObject,
  navigationLightOpacity,
  nightAirframeEmissiveIntensity,
} from '../src/aircraft/Aircraft'
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
    const canopy = model.getObjectByName('GoldCanopy')!
    const canopyBounds = new Box3().setFromObject(canopy)
    expect(canopyBounds.max.y).toBeLessThan(1.1)
    expect(canopyBounds.max.y - canopyBounds.min.y).toBeLessThan(1.0)
    expect(canopy).toBeInstanceOf(Mesh)
    expect((canopy as Mesh).material).toBeInstanceOf(MeshPhysicalMaterial)
    expect(((canopy as Mesh).material as MeshPhysicalMaterial).clearcoat).toBeGreaterThan(.8)
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

  it('reuses the grounded query until the flight pose changes', () => {
    let samples = 0
    setContactHeightSampler(() => {
      samples++
      return 0
    })
    const aircraft = new Aircraft()
    aircraft.position.set(0, 100, 0)
    expect(aircraft.onGround).toBe(false)
    const firstSamples = samples
    expect(aircraft.onGround).toBe(false)
    expect(samples).toBe(firstSamples)

    aircraft.position.x += 1
    expect(aircraft.onGround).toBe(false)
    expect(samples).toBeGreaterThan(firstSamples)
  })

  it('spins deployed wheels with rollout speed and resets the spin', () => {
    setContactHeightSampler(() => 0)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.velocity.set(0, 0, 40)
    aircraft.controls.throttle = 0
    aircraft.step(1 / 60)

    const nose = aircraft.mesh.getObjectByName('wheelNose')!
    const left = aircraft.mesh.getObjectByName('wheelLeft')!
    expect(nose.rotation.x).toBeGreaterThan(0)
    expect(left.rotation.x).toBeCloseTo(nose.rotation.x)

    aircraft.reset({ x: 0, y: 1.4, z: 0, yaw: 0 })
    expect(nose.rotation.x).toBe(0)
    expect(left.rotation.x).toBe(0)
  })

  it('keeps red and green navigation lights softly pulsing', () => {
    const model = createF35Model()
    const left = model.getObjectByName('navLightLeft') as Mesh
    const right = model.getObjectByName('navLightRight') as Mesh
    expect(left).toBeTruthy()
    expect(right).toBeTruthy()
    expect((left.material as MeshBasicMaterial).transparent).toBe(true)
    expect((right.material as MeshBasicMaterial).transparent).toBe(true)
    expect(navigationLightOpacity(0)).toBeCloseTo(.82)
    expect(navigationLightOpacity(1000)).toBeGreaterThan(.75)
    expect(navigationLightOpacity(1000)).toBeLessThan(.9)
    expect(Math.abs(navigationLightOpacity(1000) - navigationLightOpacity(1001))).toBeLessThan(.001)
  })

  it('keeps the airframe readable at night without a daylight glow', () => {
    expect(nightAirframeEmissiveIntensity(1)).toBe(0)
    expect(nightAirframeEmissiveIntensity(0)).toBeCloseTo(0.24)
    expect(nightAirframeEmissiveIntensity(-1)).toBeCloseTo(0.24)
    expect(nightAirframeEmissiveIntensity(Number.NaN)).toBeCloseTo(0.24)

    const aircraft = new Aircraft()
    const body = aircraft.mesh.getObjectByName('BlendedFuselage') as Mesh
    const material = body.material as MeshStandardMaterial
    aircraft.setNightReadability(0)
    expect(material.emissiveIntensity).toBeCloseTo(0.24)
    aircraft.setNightReadability(1)
    expect(material.emissiveIntensity).toBeCloseTo(0)
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

  it('keeps the anti-collision beacon brief and hidden between flashes', () => {
    const model = createF35Model()
    const beacon = model.getObjectByName('antiCollisionBeacon') as Mesh
    expect(beacon).toBeTruthy()
    expect(antiCollisionBeaconOpacity(0)).toBe(0)
    expect(antiCollisionBeaconOpacity(18)).toBeCloseTo(1)
    expect(antiCollisionBeaconOpacity(80)).toBeGreaterThan(0)
    expect(antiCollisionBeaconOpacity(200)).toBe(0)
    expect(antiCollisionBeaconOpacity(1400)).toBe(0)
  })

  it('keeps exhaust Mach-diamond motion bounded and throttle driven', () => {
    expect(afterburnerDiamondPulse(0, 1000, false, 0)).toBeCloseTo(.9)
    expect(afterburnerDiamondPulse(0, 1000, false, 1)).toBeCloseTo(1)
    const low = afterburnerDiamondPulse(1, 1000, true, .25)
    const high = afterburnerDiamondPulse(1, 1000, true, 1)
    expect(low).toBeGreaterThan(.97)
    expect(low).toBeLessThan(1.03)
    expect(high).toBeGreaterThan(.9)
    expect(high).toBeLessThan(1.1)
  })

  it('scales afterburner length with the displayed engine-power percentage', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.controls.boost = true
    const plume = aircraft.mesh.getObjectByName('afterburner')!

    aircraft.controls.throttle = 0.25
    aircraft.step(0)
    const quarterLength = plume.scale.z
    expect(plume.userData.powerPercent).toBe(25)

    aircraft.controls.throttle = 0.5
    aircraft.step(0)
    const halfLength = plume.scale.z
    expect(plume.userData.powerPercent).toBe(50)

    aircraft.controls.throttle = 1
    aircraft.step(0)
    expect(plume.userData.powerPercent).toBe(100)
    expect(plume.scale.z).toBeGreaterThan(halfLength)
    expect(halfLength).toBeGreaterThan(quarterLength)
    expect(plume.scale.z).toBeGreaterThan(2.8)
  })

  it('animates differential control surfaces from pitch, roll, and yaw input', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.controls.pitch = .7
    aircraft.controls.roll = .5
    aircraft.controls.yaw = .6
    aircraft.step(0)

    const leftFlaperon = aircraft.mesh.getObjectByName('flaperonLeft')!
    const rightFlaperon = aircraft.mesh.getObjectByName('flaperonRight')!
    const leftTail = aircraft.mesh.getObjectByName('tailLeft')!
    const rightTail = aircraft.mesh.getObjectByName('tailRight')!
    expect(leftFlaperon.rotation.x).toBeLessThan(rightFlaperon.rotation.x)
    expect(leftTail.rotation.y).toBeGreaterThan(0)
    expect(rightTail.rotation.y).toBeLessThan(0)

    aircraft.controls.pitch = 0
    aircraft.controls.roll = 0
    aircraft.controls.yaw = 0
    aircraft.step(0)
    expect(leftFlaperon.rotation.x).toBeCloseTo(0)
    expect(rightFlaperon.rotation.x).toBeCloseTo(0)
    expect(leftTail.rotation.y).toBeCloseTo(0)
    expect(rightTail.rotation.y).toBeCloseTo(0)
  })

  it('turns the nose in the same direction as the A/D yaw mapping', () => {
    setContactHeightSampler(() => 0)
    const forward = (yaw: number): number => {
      const aircraft = new Aircraft()
      aircraft.position.set(0, 1000, 0)
      aircraft.velocity.set(0, 0, 120)
      aircraft.controls.yaw = yaw
      aircraft.step(1 / 60)
      return new Vector3(0, 0, 1).applyQuaternion(aircraft.orientation).x
    }

    expect(forward(-1)).toBeLessThan(0)
    expect(forward(1)).toBeGreaterThan(0)
  })

  it('disposes replaced procedural model resources exactly once', () => {
    const model = createF35Model()
    const body = model.getObjectByName('BlendedFuselage') as Mesh
    const geometryDispose = vi.spyOn(body.geometry, 'dispose')
    const material = body.material as MeshStandardMaterial
    const materialDispose = vi.spyOn(material, 'dispose')

    disposeAircraftObject(model)

    expect(geometryDispose).toHaveBeenCalledTimes(1)
    expect(materialDispose).toHaveBeenCalledTimes(1)
    expect(model.children).toHaveLength(0)
  })

  it('caches visual nodes instead of searching the model every physics step', () => {
    const aircraft = new Aircraft()
    const lookup = vi.spyOn(aircraft.mesh, 'getObjectByName')
    aircraft.position.set(0, 1000, 0)
    aircraft.controls.throttle = 0.7
    aircraft.step(1 / 60)

    expect(lookup).not.toHaveBeenCalled()
  })
})
