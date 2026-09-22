import { afterEach, describe, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig } from '../src/aircraft/flightConfig'
import {
  evaluateWarnings,
  flareWarningActive,
  goAroundWarningActive,
  gearWarningActive,
  lowAltitudeWarningActive,
  lowAltitudeWarningCeiling,
  overspeedWarningActive,
  stallWarningActive,
  terrainClosureWarningActive,
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
    aircraft.velocity.set(0, -10, 80)
    aircraft.controls.gearDown = true

    const warning = evaluateWarnings(aircraft, 31)
    expect(warning.text).toBe('LOW ALT')
    expect(warning.level).toBe('caution')
    expect(warning.lowAlt).toBe(true)

    aircraft.velocity.y = 0
    expect(evaluateWarnings(aircraft, 31).text).toBeNull()
  })

  it('warns about retracted gear only on a low approach', () => {
    expect(gearWarningActive(35, 80, -8, false)).toBe(true)
    expect(gearWarningActive(35, 80, 0, false)).toBe(false)
    expect(gearWarningActive(6, 40, 0, false)).toBe(true)
    expect(gearWarningActive(35, 80, -8, true)).toBe(false)
    expect(gearWarningActive(Number.NaN, 80, -8, false)).toBe(false)

    setContactHeightSampler(() => 0)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, -8, 80)
    aircraft.controls.gearDown = false
    const warning = evaluateWarnings(aircraft, 35)
    expect(warning.text).toBe('GEAR')
    expect(warning.gear).toBe(true)
    expect(warning.level).toBe('caution')
  })

  it('marks the bounded flare window on a configured approach', () => {
    expect(flareWarningActive(8, 52, -2.2, true)).toBe(true)
    expect(flareWarningActive(1, 52, -2.2, true)).toBe(false)
    expect(flareWarningActive(8, 90, -2.2, true)).toBe(false)
    expect(flareWarningActive(8, 52, 0, true)).toBe(false)
    expect(flareWarningActive(8, 52, -2.2, false)).toBe(false)

    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, -2.2, 52)
    aircraft.controls.gearDown = true
    const warning = evaluateWarnings(aircraft, 8)
    expect(warning.text).toBe('FLARE')
    expect(warning.level).toBe('caution')
    expect(warning.flare).toBe(true)
  })

  it('flags an unstable approach before the flare cue', () => {
    expect(goAroundWarningActive(8, 52, -10, true)).toBe(true)
    expect(goAroundWarningActive(8, 28, -2, true)).toBe(true)
    expect(goAroundWarningActive(8, 52, -3, true)).toBe(false)
    expect(goAroundWarningActive(32, 52, -10, true)).toBe(false)
    expect(goAroundWarningActive(8, 52, -10, false)).toBe(false)

    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, -10, 52)
    aircraft.controls.gearDown = true
    const warning = evaluateWarnings(aircraft, 8)
    expect(warning.text).toBe('GO AROUND')
    expect(warning.level).toBe('warning')
    expect(warning.goAround).toBe(true)
  })

  it('reuses the stable no-warning state between frames', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, 0, flightConfig.maxSpeed)
    expect(evaluateWarnings(aircraft, 9000)).toBe(evaluateWarnings(aircraft, 9000))
  })

  it('scales low-altitude caution distance with speed', () => {
    expect(lowAltitudeWarningCeiling(35)).toBe(48)
    expect(lowAltitudeWarningCeiling(flightConfig.cruiseSpeed)).toBeGreaterThan(48)
    expect(lowAltitudeWarningCeiling(flightConfig.cruiseSpeed)).toBeLessThan(96)
    expect(lowAltitudeWarningCeiling(2000)).toBe(96)
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

  it('predicts fast terrain closure without alarming normal approaches', () => {
    expect(terrainClosureWarningActive(20, 90, -10)).toBe(true)
    expect(terrainClosureWarningActive(40, 90, -10)).toBe(false)
    expect(terrainClosureWarningActive(20, 60, -10)).toBe(false)
    expect(terrainClosureWarningActive(20, 90, -4)).toBe(false)
    expect(terrainClosureWarningActive(Number.NaN, 90, -10)).toBe(false)

    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, -10, 90)
    const warning = evaluateWarnings(aircraft, 20)
    expect(warning.text).toBe('PULL UP')
    expect(warning.level).toBe('warning')
    expect(warning.terrainClosure).toBe(true)
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

  it('raises low-fuel caution bands only after the flight leaves the ground', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, 0, flightConfig.cruiseSpeed)
    aircraft.fuel.fraction = 0.2
    expect(evaluateWarnings(aircraft, 9000).text).toBe('FUEL LOW')
    expect(evaluateWarnings(aircraft, 9000).fuel).toBe(true)

    aircraft.fuel.fraction = 0
    expect(evaluateWarnings(aircraft, 9000).text).toBe('FUEL EMPTY')
    expect(evaluateWarnings(aircraft, 9000).level).toBe('warning')

    aircraft.position.y = sampleGroundHeight(0, 0) + flightConfig.gearHeight
    expect(evaluateWarnings(aircraft, 0).text).toBeNull()
  })
})
