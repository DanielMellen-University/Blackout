import { Box3, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Raycaster, Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Aircraft,
  afterburnerDiamondPulse,
  antiCollisionBeaconOpacity,
  canopyGlassEmissiveIntensity,
  disposeAircraftObject,
  landingLightOpacity,
  navigationLightOpacity,
  nightAirframeEmissiveIntensity,
  resolveLoadFactor,
  wingtipVaporIntensity,
} from '../src/aircraft/Aircraft'
import { contactSweepNeedsDetailedProbes } from '../src/aircraft/FlightModel'
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
    const leftDoor = aircraft.mesh.getObjectByName('gearDoorLeft')!
    expect(left.rotation.z).toBeGreaterThan(0)
    expect(left.rotation.z).toBeLessThan(.2)
    expect(leftDoor.rotation.z).toBeLessThan(0)
    for (let i = 0; i < 120; i++) aircraft.step(1 / 60)
    expect(aircraft.mesh.getObjectByName('landingGear')!.visible).toBe(false)
    expect(leftDoor.rotation.z).toBeLessThan(-.4)
    aircraft.position.set(0, 1.4, 0)
    aircraft.velocity.set(0, 0, 0)
    aircraft.step(1 / 60)
    expect(aircraft.mesh.getObjectByName('landingGear')!.visible).toBe(true)
    expect(left.rotation.z).toBeGreaterThan(1)
    for (let i = 0; i < 60; i++) aircraft.step(1 / 60)
    expect(leftDoor.rotation.z).toBeGreaterThan(-.1)
  })

  it('avoids a second terrain query when auto-gear already knows the jet is grounded', () => {
    let samples = 0
    setContactHeightSampler(() => {
      samples++
      return 0
    })
    const aircraft = new Aircraft()
    aircraft.reset({ x: 0, y: 1.4, z: 0, yaw: 0 })
    samples = 0

    aircraft.step(0)

    expect(samples).toBe(1)
    expect(aircraft.controls.gearDown).toBe(true)
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

  it('skips detailed contact probes while the jet is safely above terrain', () => {
    let samples = 0
    setContactHeightSampler(() => {
      samples++
      return 0
    })
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.velocity.set(0, 0, 120)
    const before = samples
    aircraft.step(1 / 60)
    expect(samples - before).toBeLessThan(10)
  })

  it('keeps the detailed path enabled near the conservative contact envelope', () => {
    expect(contactSweepNeedsDetailedProbes(80, 80, 80, 20)).toBe(false)
    expect(contactSweepNeedsDetailedProbes(38, 38, 38, 20)).toBe(true)
    expect(contactSweepNeedsDetailedProbes(Number.NaN, 100, 100, 20)).toBe(true)
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

  it('steers the nose wheel with runway yaw input and recenters airborne', () => {
    setContactHeightSampler(() => 0)
    const aircraft = new Aircraft()
    aircraft.reset({ x: 0, y: 1.4, z: 0, yaw: 0 })
    const noseGear = aircraft.mesh.getObjectByName('gearNose')!

    aircraft.controls.yaw = 1
    aircraft.step(0)
    expect(noseGear.rotation.y).toBeCloseTo(0.38)

    aircraft.controls.yaw = 0
    aircraft.position.y = 100
    aircraft.step(1 / 60)
    expect(noseGear.rotation.y).toBeLessThan(0.38)
    expect(noseGear.rotation.y).toBeGreaterThan(0)
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
    expect(navigationLightOpacity(1000, 1)).toBeLessThan(navigationLightOpacity(1000, 0))
    expect(navigationLightOpacity(1000, 1)).toBeGreaterThan(.3)
  })

  it('links the nose landing lamp to gear extension without a dynamic light', () => {
    const model = createF35Model()
    const lamp = model.getObjectByName('landingLightNose') as Mesh
    expect(lamp).toBeTruthy()
    expect((lamp.material as MeshBasicMaterial).toneMapped).toBe(false)
    expect(landingLightOpacity(0)).toBe(0)
    expect(landingLightOpacity(.5)).toBe(0)
    expect(landingLightOpacity(1)).toBeCloseTo(.95)
    expect(landingLightOpacity(Number.NaN)).toBe(0)
  })

  it('keeps the airframe readable at night without a daylight glow', () => {
    expect(nightAirframeEmissiveIntensity(1)).toBe(0)
    expect(nightAirframeEmissiveIntensity(0)).toBeCloseTo(0.32)
    expect(nightAirframeEmissiveIntensity(-1)).toBeCloseTo(0.32)
    expect(nightAirframeEmissiveIntensity(Number.NaN)).toBeCloseTo(0.32)

    const aircraft = new Aircraft()
    const body = aircraft.mesh.getObjectByName('BlendedFuselage') as Mesh
    const material = body.material as MeshStandardMaterial
    aircraft.setNightReadability(0)
    expect(material.emissiveIntensity).toBeCloseTo(0.32)
    aircraft.setNightReadability(1)
    expect(material.emissiveIntensity).toBeCloseTo(0)
  })

  it('keeps canopy glass restrained by day and readable at night', () => {
    expect(canopyGlassEmissiveIntensity(1)).toBeCloseTo(0.08)
    expect(canopyGlassEmissiveIntensity(0)).toBeCloseTo(0.24)
    expect(canopyGlassEmissiveIntensity(Number.NaN)).toBeCloseTo(0.24)

    const aircraft = new Aircraft()
    const canopy = aircraft.mesh.getObjectByName('GoldCanopy') as Mesh
    const material = canopy.material as MeshPhysicalMaterial
    aircraft.setNightReadability(1)
    expect(material.emissiveIntensity).toBeCloseTo(0.08)
    aircraft.setNightReadability(0)
    expect(material.emissiveIntensity).toBeCloseTo(0.24)
  })

  it('maps body-up acceleration to a bounded pilot load estimate', () => {
    expect(resolveLoadFactor(new Vector3(0, 0, 0), new Vector3(0, 1, 0))).toBeCloseTo(1)
    expect(resolveLoadFactor(new Vector3(0, 9.81, 0), new Vector3(0, 1, 0))).toBeCloseTo(2)
    expect(resolveLoadFactor(new Vector3(0, -98.1, 0), new Vector3(0, 1, 0))).toBeCloseTo(-4)
    expect(resolveLoadFactor(new Vector3(Number.NaN, 0, 0), new Vector3(0, 1, 0))).toBeCloseTo(1)
  })

  it('keeps wingtip vapor dormant at taxi speed and bounded in a hard turn', () => {
    expect(wingtipVaporIntensity(0, 1)).toBe(0)
    expect(wingtipVaporIntensity(260, 1)).toBe(0)
    expect(wingtipVaporIntensity(780, 1)).toBeGreaterThan(0.045)
    expect(wingtipVaporIntensity(780, 1)).toBeLessThan(0.07)
    expect(wingtipVaporIntensity(1600, 5)).toBeCloseTo(0.22)
    expect(wingtipVaporIntensity(Number.NaN, Number.NaN)).toBe(0)
  })

  it('builds hidden shared-material wingtip vapor nodes', () => {
    const model = createF35Model()
    const left = model.getObjectByName('vaporTrailLeft') as Mesh
    const right = model.getObjectByName('vaporTrailRight') as Mesh
    expect(left).toBeTruthy()
    expect(right).toBeTruthy()
    expect(left.visible).toBe(false)
    expect(right.visible).toBe(false)
    expect(left.material).toBe(right.material)
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

  it('flares the exhaust petals with engine power and afterburner', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    const petal = aircraft.mesh.getObjectByName('nozzlePetal0')!

    aircraft.controls.throttle = 0.25
    aircraft.controls.boost = false
    aircraft.step(0)
    const militaryFlare = Math.hypot(petal.rotation.x, petal.rotation.y)

    aircraft.controls.throttle = 1
    aircraft.controls.boost = true
    aircraft.step(0)
    const afterburnerFlare = Math.hypot(petal.rotation.x, petal.rotation.y)

    expect(militaryFlare).toBeGreaterThan(0)
    expect(afterburnerFlare).toBeGreaterThan(militaryFlare)
    expect(afterburnerFlare).toBeLessThanOrEqual(0.12)
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

  it('cancels optional model hydration after aircraft disposal', async () => {
    const aircraft = new Aircraft()
    aircraft.dispose()

    await expect(aircraft.tryLoadModel('/models/late.glb')).resolves.toBe(false)
    expect(aircraft.mesh.children).toHaveLength(0)
  })

  it('caches visual nodes instead of searching the model every physics step', () => {
    const aircraft = new Aircraft()
    const lookup = vi.spyOn(aircraft.mesh, 'getObjectByName')
    aircraft.position.set(0, 1000, 0)
    aircraft.controls.throttle = 0.7
    aircraft.step(1 / 60)

    expect(lookup).not.toHaveBeenCalled()
  })

  it('uses the supplied frame timestamp for presentation animation', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
    aircraft.controls.throttle = 0.8
    aircraft.step(1 / 60, 1400)

    const beacon = aircraft.mesh.getObjectByName('antiCollisionBeacon')!
    const firstOpacity = (beacon as Mesh).material as MeshBasicMaterial
    expect(firstOpacity.opacity).toBeCloseTo(0)

    aircraft.step(1 / 60, 1418)
    expect((beacon as Mesh).material as MeshBasicMaterial).toBe(firstOpacity)
    expect(firstOpacity.opacity).toBeGreaterThan(0)
  })
})
