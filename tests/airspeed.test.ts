import { Vector3 } from 'three'
import { afterEach, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig } from '../src/aircraft/flightConfig'
import { displayedKnots } from '../src/core/airspeed'
import { setContactHeightSampler } from '../src/world/ground'

afterEach(() => setContactHeightSampler(null))

it('converts metres per second to true knots without a fake scale', () => {
  expect(displayedKnots(100)).toBeCloseTo(194.384)
  expect(displayedKnots(flightConfig.maxSpeed)).toBeCloseTo(3000, 0)
  expect(displayedKnots(flightConfig.maxSpeedBoost)).toBeGreaterThan(3000)
  expect(displayedKnots(-1)).toBe(0)
})

it('keeps 50% ENG near 1500 kts and full dry power near 3000 kts', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  plane.controls.gearDown = false
  plane.controls.throttle = 0.5
  plane.velocity.set(0, 0, 600)
  for (let i = 0; i < 300; i++) plane.step(1 / 60)
  expect(displayedKnots(plane.speed)).toBeGreaterThan(1440)
  expect(displayedKnots(plane.speed)).toBeLessThan(1560)

  plane.controls.throttle = 1
  for (let i = 0; i < 480; i++) plane.step(1 / 60)
  expect(displayedKnots(plane.speed)).toBeGreaterThan(2940)
  expect(displayedKnots(plane.speed)).toBeLessThan(3060)
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
  expect(plane.speed).toBeGreaterThan(220)
  expect(plane.speed).toBeLessThan(235)
  expect(displayedKnots(plane.speed)).toBeLessThan(500)
  plane.controls.throttle = 0
  for (let i = 0; i < 60; i++) plane.step(1 / 60)
  expect(plane.speed).toBeLessThan(110)
  for (let i = 0; i < 180; i++) plane.step(1 / 60)
  expect(Number.isFinite(plane.speed)).toBe(true)
  expect(plane.speed).toBeLessThan(10)
})

it('does not slam the brakes after a powered dive', () => {
  setContactHeightSampler(() => 0)
  const plane = new Aircraft()
  plane.reset({ x: 0, y: 15000, z: 0, yaw: 0 })
  plane.controls.gearDown = false
  plane.controls.throttle = 0.5
  plane.velocity.set(0, 0, flightConfig.maxSpeed * 0.5)
  for (let i = 0; i < 180; i++) plane.step(1 / 60)
  const held = plane.speed
  expect(held).toBeGreaterThan(flightConfig.maxSpeed * 0.45)
  expect(held).toBeLessThan(flightConfig.maxSpeed * 0.55)
  plane.orientation.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
  plane.velocity.set(0, -held, 0)
  plane.angularVelocity.set(0, 0, 0)
  for (let i = 0; i < 180; i++) plane.step(1 / 60)
  expect(plane.speed).toBeGreaterThan(held + 15)
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
  expect(plane.speed).toBeGreaterThan(200)
})
