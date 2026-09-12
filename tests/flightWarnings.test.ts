import { afterEach, describe, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig } from '../src/aircraft/flightConfig'
import {
  evaluateWarnings,
  lowAltitudeWarningActive,
  lowAltitudeWarningCeiling,
  overspeedWarningActive,
  stallWarningActive,
} from '../src/systems/FlightWarnings'
import { sampleGroundHeight, setContactHeightSampler } from '../src/world/ground'

describe('flight cautions', () => {
  afterEach(() => setContactHeightSampler(null))

  it('raises stall before other caution labels', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, 0, flightConfig.minSpeed * 0.5)
    aircraft.controls.gearDown = false

    const warning = evaluateWarnings(aircraft, 9000)
    expect(warning.text).toBe('STALL')
    expect(warning.level).toBe('warning')
    expect(warning.stall).toBe(true)
  })

  it('raises low-altitude caution only while descending quickly', () => {
    const aircraft = new Aircraft()
    const ground = sampleGroundHeight(0, 0)
    aircraft.position.set(0, ground + 31 + flightConfig.bellyHeight, 0)
    aircraft.velocity.set(0, -10, 52)
    aircraft.controls.gearDown = false

    const warning = evaluateWarnings(aircraft, 31)
    expect(warning.text).toBe('LOW ALT')
    expect(warning.level).toBe('caution')
    expect(warning.lowAlt).toBe(true)

    aircraft.velocity.y = 0
    expect(evaluateWarnings(aircraft, 31).text).toBeNull()
  })

  it('reuses the stable no-warning state between frames', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, 0, flightConfig.maxSpeed)
    expect(evaluateWarnings(aircraft, 9000)).toBe(evaluateWarnings(aircraft, 9000))
  })

  it('scales low-altitude caution distance with speed', () => {
    expect(lowAltitudeWarningCeiling(35)).toBe(48)
    expect(lowAltitudeWarningCeiling(flightConfig.maxSpeed)).toBe(96)
    expect(lowAltitudeWarningActive(70, 500, -8, false)).toBe(true)
    expect(lowAltitudeWarningActive(70, 45, -8, true)).toBe(false)
  })

  it('keeps stall thresholds finite and flight-envelope based', () => {
    expect(stallWarningActive(flightConfig.minSpeed * 0.5, 0, 9000)).toBe(true)
    expect(stallWarningActive(flightConfig.liftSpeed, flightConfig.stallAoA * 1.2, 9000)).toBe(true)
    expect(stallWarningActive(Number.NaN, Number.NaN, 9000)).toBe(false)
  })

  it('raises overspeed only beyond the dry speed envelope', () => {
    expect(overspeedWarningActive(flightConfig.maxSpeed)).toBe(false)
    expect(overspeedWarningActive(flightConfig.maxSpeed + 0.1)).toBe(true)
    expect(overspeedWarningActive(Number.NaN)).toBe(false)
  })

  it('labels an overspeed transition without changing caution priority', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, 0, flightConfig.maxSpeed + 1)

    const warning = evaluateWarnings(aircraft, 9000)
    expect(warning.text).toBe('OVERSPEED')
    expect(warning.level).toBe('caution')
    expect(warning.overspeed).toBe(true)
    expect(warning.stall).toBe(false)
  })
})
