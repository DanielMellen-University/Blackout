import { describe, expect, it } from 'vitest'
import { airborneStart, announcesLanding, flightStart } from '../src/systems/AirborneStart'
import { Aircraft } from '../src/aircraft/Aircraft'
import { setContactHeightSampler } from '../src/world/ground'

describe('gated airborne start', () => {
  it('starts behind the gate and aligned with its crossing direction', () => {
    const start = airborneStart({ x: 100, y: 250, z: 200, fwdX: 1, fwdZ: 0 }, () => 0)
    expect(start).toEqual({ x: -200, y: 250, z: 200, yaw: Math.PI / 2 })
  })

  it('stops the approach before an obstructing ridge', () => {
    const start = airborneStart({ x: 0, y: 100, z: 0, fwdX: 0, fwdZ: 1 }, (_x, z) => z < -120 ? 90 : 0)
    expect(start.z).toBe(-120)
  })
})

describe('free flight runway reset', () => {
  it('remains stationary on the runway with gear down', () => {
    setContactHeightSampler(() => 100)
    const aircraft = new Aircraft()
    const runwaySpawn = { x: 10, y: 101.4, z: -45, yaw: 0 }
    aircraft.reset(flightStart(runwaySpawn, null, () => 100))
    expect(aircraft.onGround).toBe(true)
    expect(aircraft.position.toArray()).toEqual([10, 101.4, -45])
    expect(aircraft.speed).toBe(0)
    expect(aircraft.controls.gearDown).toBe(true)
    aircraft.dispose()
    setContactHeightSampler(null)
  })
})

describe('landing announcement', () => {
  it('announces LANDED only for a Free flight touchdown after flight', () => {
    expect(announcesLanding(true, 'landed', true, 'ok')).toBe(true)
    // Gated runs finish in the air: ground contact is never a landing.
    expect(announcesLanding(false, 'landed', true, 'ok')).toBe(false)
    expect(announcesLanding(true, 'landed', false, 'ok')).toBe(false)
    expect(announcesLanding(true, 'roll', true, 'ok')).toBe(false)
    expect(announcesLanding(true, 'landed', true, 'landed')).toBe(false)
  })
})
