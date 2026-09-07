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
