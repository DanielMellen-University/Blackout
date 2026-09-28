import { afterEach, describe, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightConfig } from '../src/aircraft/flightConfig'
import {
  evaluateWarnings,
  FlightWarningTracker,
  WARNING_CLEAR_HOLD_SEC,
  WARNING_SWITCH_HOLD_SEC,
  flareWarningActive,
  goAroundWarningActive,
  gearWarningActive,
  lowAltitudeWarningActive,
  lowAltitudeWarningCeiling,
  overspeedWarningActive,
  stallWarningActive,
  terrainClosureWarningActive,
  terrainLookaheadWarningActive,
  warningCueForState,
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

  it('sees a rising ridge along the flight path before current AGL becomes critical', () => {
    expect(terrainLookaheadWarningActive(120, 160, 0, 150, 192)).toBe(true)
    expect(terrainLookaheadWarningActive(120, 160, 4, 150, 192)).toBe(false)
    expect(terrainLookaheadWarningActive(120, 160, 0, 12, 192)).toBe(false)

    setContactHeightSampler((x) => (x > 100 ? 150 : 0))
    const aircraft = new Aircraft()
    aircraft.position.set(0, 121.4, 0)
    aircraft.velocity.set(160, 0, 0)
    aircraft.controls.gearDown = true
    const warning = evaluateWarnings(aircraft, 120)
    expect(warning.text).toBe('PULL UP')
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

  it('maps warning states to distinct one-shot audio cues', () => {
    const base = {
      text: 'LOW ALT',
      level: 'caution' as const,
      stall: false,
      lowAlt: true,
      gear: false,
      flare: false,
      goAround: false,
      overspeed: false,
      fuel: false,
      terrainClosure: false,
    }
    expect(warningCueForState({ ...base, text: null, level: 'none', lowAlt: false })).toBeNull()
    expect(warningCueForState({ ...base, text: 'PULL UP', level: 'warning', terrainClosure: true })).toBe('pull-up')
    expect(warningCueForState({ ...base, text: 'STALL', level: 'warning', stall: true, lowAlt: false })).toBe('stall')
    expect(warningCueForState({ ...base, text: 'GEAR', gear: true, lowAlt: false })).toBe('gear-warning')
    expect(warningCueForState({ ...base, text: 'OVERSPEED', overspeed: true, lowAlt: false })).toBe('overspeed')
    expect(warningCueForState(base)).toBe('warning')
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

  it('holds a clear or equal-priority transition through threshold jitter', () => {
    const tracker = new FlightWarningTracker()
    // Use stable source states instead of relying on aircraft geometry here.
    const caution = { text: 'LOW ALT', level: 'caution' as const, stall: false, lowAlt: true, gear: false, flare: false, goAround: false, overspeed: false, fuel: false, terrainClosure: false }
    const clear = { ...caution, text: null, level: 'none' as const, lowAlt: false }
    tracker.reset(caution)
    expect(tracker.update(clear, WARNING_CLEAR_HOLD_SEC * .5)).toBe(caution)
    expect(tracker.update(clear, WARNING_CLEAR_HOLD_SEC * .5)).toBe(clear)
    tracker.reset(caution)
    const replacement = { ...caution, text: 'GEAR', gear: true, lowAlt: false }
    expect(tracker.update(replacement, WARNING_SWITCH_HOLD_SEC * .5)).toBe(caution)
    expect(tracker.update(replacement, WARNING_SWITCH_HOLD_SEC * .5)).toBe(replacement)
  })

  it('escalates a warning immediately and contains malformed elapsed time', () => {
    const tracker = new FlightWarningTracker()
    const caution = { text: 'LOW ALT', level: 'caution' as const, stall: false, lowAlt: true, gear: false, flare: false, goAround: false, overspeed: false, fuel: false, terrainClosure: false }
    const urgent = { ...caution, text: 'PULL UP', level: 'warning' as const, lowAlt: false, terrainClosure: true }
    tracker.reset(caution)
    expect(tracker.update(urgent, Number.NaN)).toBe(urgent)
    expect(tracker.state).toBe(urgent)
  })
})
