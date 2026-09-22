import { Vector3 } from 'three'
import { afterEach, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig } from '../src/aircraft/flightConfig'
import { displayedKnots } from '../src/core/airspeed'
import { setContactHeightSampler } from '../src/world/ground'

afterEach(() => setContactHeightSampler(null))

it('converts metres per second to true knots without a fake scale', () => {
  expect(displayedKnots(100)).toBeCloseTo(194.384)
  expect(displayedKnots(flightConfig.cruiseSpeed)).toBeGreaterThan(350)
  expect(displayedKnots(flightConfig.cruiseSpeed)).toBeLessThan(500)
  expect(displayedKnots(flightConfig.maxSpeed)).toBeLessThan(1000)
  expect(displayedKnots(flightConfig.maxSpeed)).toBeGreaterThan(displayedKnots(flightConfig.cruiseSpeedBoost))
  expect(displayedKnots(-1)).toBe(0)
})

it('settles military cruise well below 1543 m/s and lets afterburner go faster', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  plane.controls.gearDown = false
  plane.controls.throttle = 0.5
  plane.velocity.set(0, 0, 400)
  for (let i = 0; i < 24 * 60; i++) plane.step(1 / 60)
  const half = displayedKnots(plane.speed)
  expect(half).toBeGreaterThan(250)
  expect(half).toBeLessThan(330)

  plane.controls.throttle = 1
  for (let i = 0; i < 12 * 60; i++) plane.step(1 / 60)
  const military = displayedKnots(plane.speed)
  expect(military).toBeGreaterThan(370)
  expect(military).toBeLessThan(460)
  expect(plane.speed).toBeLessThan(500)

  const beforeBoost = plane.speed
  plane.controls.boost = true
  let peak = beforeBoost
  let lit = false
  for (let i = 0; i < 4 * 60; i++) {
    plane.step(1 / 60)
    if (plane.engineState.afterburnerActive) lit = true
    peak = Math.max(peak, plane.speed)
  }
  expect(lit).toBe(true)
  expect(peak).toBeGreaterThan(beforeBoost + 40)
  expect(peak).toBeLessThan(flightConfig.maxSpeed)
  expect(peak).toBeLessThan(1543)
})

it('loses speed in a sustained climb', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  plane.controls.gearDown = false
  plane.controls.throttle = 1
  plane.velocity.set(0, 0, flightConfig.cruiseSpeed)
  for (let i = 0; i < 4 * 60; i++) plane.step(1 / 60)
  const level = plane.speed
  plane.orientation.setFromAxisAngle(new Vector3(1, 0, 0), -0.55)
  plane.angularVelocity.set(0, 0, 0)
  const nose = new Vector3(0, 0, 1).applyQuaternion(plane.orientation)
  expect(nose.y).toBeGreaterThan(0.4)
  plane.velocity.copy(nose).multiplyScalar(level)
  for (let i = 0; i < 6 * 60; i++) plane.step(1 / 60)
  expect(plane.speed).toBeLessThan(level - 20)
  expect(plane.speed).toBeGreaterThan(80)
})

it('resets and consumes the aircraft fuel state with engine use', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  plane.controls.gearDown = false
  plane.controls.throttle = 1
  plane.controls.boost = true
  for (let i = 0; i < 120; i++) plane.step(1 / 60)
  expect(plane.fuel.remaining).toBeLessThan(100)
  expect(plane.fuel.fraction).toBeGreaterThan(0)
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  expect(plane.fuel.remaining).toBe(100)
  expect(plane.engineState.fuelAvailable).toBe(true)
})

it('accelerates and decelerates promptly without overshooting zero', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  plane.controls.gearDown = false
  plane.controls.throttle = 1
  plane.velocity.set(0, 0, 100)
  for (let i = 0; i < 60; i++) plane.step(1 / 60)
  expect(plane.speed).toBeGreaterThan(108)
  expect(plane.speed).toBeLessThan(160)
  expect(displayedKnots(plane.speed)).toBeLessThan(500)
  plane.controls.throttle = 0
  const chopped = plane.speed
  for (let i = 0; i < 60; i++) plane.step(1 / 60)
  expect(plane.speed).toBeLessThan(chopped - 15)
  for (let i = 0; i < 180; i++) plane.step(1 / 60)
  expect(Number.isFinite(plane.speed)).toBe(true)
  expect(plane.speed).toBeLessThan(40)
  expect(plane.speed).toBeGreaterThanOrEqual(0)
})

it('turns a bounded thermal envelope into a gentle climb impulse', () => {
  setContactHeightSampler(() => 0)
  const neutral = new Aircraft()
  const lifted = new Aircraft()
  neutral.reset({ x: 0, y: 15_000, z: 0, yaw: 0 })
  lifted.reset({ x: 0, y: 15_000, z: 0, yaw: 0 })
  neutral.controls.gearDown = false
  lifted.controls.gearDown = false
  neutral.controls.throttle = 0.5
  lifted.controls.throttle = 0.5
  neutral.velocity.set(0, 0, 220)
  lifted.velocity.set(0, 0, 220)
  lifted.setThermalLift(1)

  for (let i = 0; i < 120; i++) {
    neutral.step(1 / 60)
    lifted.step(1 / 60)
  }

  expect(lifted.position.y).toBeGreaterThan(neutral.position.y + 0.4)
  expect(Number.isFinite(lifted.position.y)).toBe(true)
  lifted.setThermalLift(Number.NaN)
  expect(lifted.thermalLift).toBe(0)
})

it('does not slam the brakes after a powered dive', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  plane.controls.gearDown = false
  plane.controls.throttle = 0.5
  plane.velocity.set(0, 0, flightConfig.cruiseSpeed)
  for (let i = 0; i < 8 * 60; i++) plane.step(1 / 60)
  const held = plane.speed
  expect(held).toBeGreaterThan(flightConfig.cruiseSpeed * 0.6)
  expect(held).toBeLessThan(flightConfig.cruiseSpeed * 0.9)
  expect(held).toBeLessThan(1543)
  plane.orientation.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
  plane.velocity.set(0, -held, 0)
  plane.angularVelocity.set(0, 0, 0)
  for (let i = 0; i < 90; i++) plane.step(1 / 60)
  expect(plane.speed).toBeGreaterThan(held + 15)
  expect(plane.speed).toBeLessThan(flightConfig.maxSpeed + 1)
})

it('uses the held speed brake to bleed airborne speed while preserving finite state', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  plane.controls.gearDown = false
  plane.controls.throttle = 1
  plane.velocity.set(0, 0, 900)
  for (let i = 0; i < 30; i++) plane.step(1 / 60)
  const unbraked = plane.speed

  plane.controls.airbrake = true
  for (let i = 0; i < 60; i++) plane.step(1 / 60)

  expect(plane.speed).toBeLessThan(unbraked)
  expect(Number.isFinite(plane.speed)).toBe(true)
  expect(plane.speed).toBeGreaterThan(0)
})

it('uses the held brake as wheel braking during ground rollout', () => {
  setContactHeightSampler(() => 0)
  const unbraked = new Aircraft()
  unbraked.reset({ x: 0, y: 1.4, z: 0, yaw: 0 })
  unbraked.controls.throttle = 0.35
  unbraked.velocity.set(0, 0, 90)
  unbraked.step(1 / 60)

  const braked = new Aircraft()
  braked.reset({ x: 0, y: 1.4, z: 0, yaw: 0 })
  braked.controls.throttle = 0.35
  braked.controls.airbrake = true
  braked.velocity.set(0, 0, 90)
  braked.step(1 / 60)

  expect(braked.speed).toBeLessThan(unbraked.speed - 1)
  expect(Number.isFinite(braked.speed)).toBe(true)
})

it('holds the jet stopped against throttle while wheel brakes are held', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 1.4, z: 0, yaw: 0 })
  plane.controls.throttle = 1
  plane.controls.airbrake = true

  for (let i = 0; i < 60; i++) plane.step(1 / 60)

  expect(plane.speed).toBe(0)
  expect(Number.isFinite(plane.position.z)).toBe(true)
})

it('keeps accelerating on a shallow slope instead of bleeding off', () => {
  setContactHeightSampler((_x, z) => 0.12 * z)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 1.4, z: 0, yaw: 0 })
  plane.controls.throttle = 1
  const speeds: number[] = []
  for (let i = 0; i < 120; i++) {
    plane.step(1 / 60)
    if (i % 15 === 14) speeds.push(plane.speed)
  }
  for (let i = 1; i < speeds.length; i++) {
    expect(speeds[i]!).toBeGreaterThan(speeds[i - 1]! - 1)
  }
  expect(plane.speed).toBeGreaterThan(25)
  expect(plane.speed).toBeLessThan(flightConfig.cruiseSpeed)
})
