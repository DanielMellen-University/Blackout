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
  obstacleLookaheadWarningActive,
  overspeedWarningActive,
  stallWarningActive,
  warningCueForState,
} from '../src/systems/FlightWarnings'
import { sampleGroundHeight, setContactHeightSampler, setGroundHeightSampler } from '../src/world/ground'

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

  it('stays quiet on a low fast descent outside the landing-guidance window', () => {
    const aircraft = new Aircraft()
    try {
      aircraft.position.set(0, 10000, 0)
      aircraft.controls.gearDown = true
      for (const [alt, sink, speed] of [[31, -10, 80], [40, -20, 90], [70, -8, 300]]) {
        aircraft.velocity.set(0, sink!, speed!)
        const warning = evaluateWarnings(aircraft, alt!)
        expect(warning.text).toBeNull()
        expect(warningCueForState(warning)).toBeNull()
      }
    } finally { aircraft.dispose() }
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

  it('never asks for a flare above the collision landing-speed limit', () => {
    const limit = flightConfig.maxLandingSpeed
    expect(flareWarningActive(8, limit, -2, true)).toBe(true)
    expect(flareWarningActive(8, limit + .01, -2, true)).toBe(false)
    expect(goAroundWarningActive(8, limit + .01, -2, true)).toBe(true)
    expect(goAroundWarningActive(28, limit + 10, -2, true)).toBe(true)
    expect(goAroundWarningActive(29, limit + 10, -2, true)).toBe(false)
    expect(goAroundWarningActive(8, limit + 10, 3, true)).toBe(false)
    expect(goAroundWarningActive(8, limit + 10, 0, true)).toBe(false)
    expect(goAroundWarningActive(8, limit + 10, -2, false)).toBe(false)

    const aircraft = new Aircraft()
    try {
      aircraft.position.set(0, 10000, 0)
      aircraft.velocity.set(0, -2, limit + 2)
      aircraft.controls.gearDown = true
      expect(evaluateWarnings(aircraft, 8).text).toBe('GO AROUND')
      aircraft.velocity.y = 3
      expect(evaluateWarnings(aircraft, 8).text).toBeNull()
    } finally {
      aircraft.dispose()
    }
  })

  it('leaves no quiet sink-rate gap between flare and go-around cues', () => {
    for (const sink of [-7.49, -7.5, -8, -8.5]) {
      const flare = flareWarningActive(8, 52, sink, true)
      const goAround = goAroundWarningActive(8, 52, sink, true)
      expect(flare || goAround).toBe(true)
      expect(flare && goAround).toBe(false)
    }
  })

  it('reuses the stable no-warning state between frames', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, 0, flightConfig.maxSpeed)
    expect(evaluateWarnings(aircraft, 9000)).toBe(evaluateWarnings(aircraft, 9000))
  })

  it('skips horizontal-speed square roots below lookahead speed', () => {
    const aircraft = new Aircraft()
    aircraft.position.set(0, 10000, 0)
    aircraft.velocity.set(0, 0, 40)

    const originalHypot = Math.hypot
    let hypotCalls = 0
    Math.hypot = ((...values: number[]) => {
      hypotCalls++
      return originalHypot(...values)
    }) as typeof Math.hypot
    try {
      expect(evaluateWarnings(aircraft, 9000).text).toBeNull()
      expect(hypotCalls).toBe(0)
    } finally {
      Math.hypot = originalHypot
    }
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


  it('does not sample ahead or warn when a ridge rises into the flight path', () => {
    let samples = 0
    setGroundHeightSampler((x) => { samples++; return x > 100 ? 150 : 0 })
    const aircraft = new Aircraft()
    try {
      aircraft.position.set(0, 121.4, 0)
      aircraft.velocity.set(160, 0, 0)
      aircraft.controls.gearDown = true
      samples = 0
      expect(evaluateWarnings(aircraft, 120).text).toBeNull()
      // The on-ground check still resolves present contact; warnings add no probes.
      expect(samples).toBe(1)
    } finally { aircraft.dispose() }
  })


  it('warns about a loaded obstacle before the padded flight path reaches it', () => {
    expect(obstacleLookaheadWarningActive(120, 90)).toBe(true)
    expect(obstacleLookaheadWarningActive(361, 90)).toBe(false)
    expect(obstacleLookaheadWarningActive(120, 59)).toBe(false)
    expect(obstacleLookaheadWarningActive(Number.NaN, 90)).toBe(false)

    const aircraft = new Aircraft()
    aircraft.position.set(0, 120, 0)
    aircraft.velocity.set(0, 0, 120)
    const probes: Array<[number, number, number]> = []
    const warning = evaluateWarnings(aircraft, 120, (x, y, z) => {
      probes.push([x, y, z])
      return z >= 80
    })
    expect(warning.text).toBe('OBSTACLE')
    expect(warning.obstacle).toBe(true)
    expect(probes.length).toBe(2)
    expect(probes[0]![2]).toBeGreaterThan(0)
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
      text: 'OVERSPEED',
      level: 'caution' as const,
      stall: false,
      gear: false,
      flare: false,
      goAround: false,
      overspeed: false,
      fuel: false,
      obstacle: false,
    }
    expect(warningCueForState({ ...base, text: null, level: 'none' })).toBeNull()
    expect(warningCueForState({ ...base, text: 'OBSTACLE', level: 'warning', obstacle: true })).toBe('obstacle')
    expect(warningCueForState({ ...base, text: 'STALL', level: 'warning', stall: true })).toBe('stall')
    expect(warningCueForState({ ...base, text: 'GEAR', gear: true })).toBe('gear-warning')
    expect(warningCueForState({ ...base, text: 'OVERSPEED', overspeed: true })).toBe('overspeed')
    expect(warningCueForState({ ...base, text: 'FUEL LOW', fuel: true })).toBe('fuel')
    expect(warningCueForState({ ...base, text: 'GO AROUND', level: 'warning', goAround: true })).toBe('go-around')
    expect(warningCueForState({ ...base, text: 'FLARE', flare: true })).toBe('flare')
    expect(warningCueForState({ ...base, text: 'NOTICE' })).toBe('warning')
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
    const caution = { text: 'OVERSPEED', level: 'caution' as const, stall: false, gear: false, flare: false, goAround: false, overspeed: false, fuel: false, obstacle: false }
    const clear = { ...caution, text: null, level: 'none' as const }
    tracker.reset(caution)
    expect(tracker.update(clear, WARNING_CLEAR_HOLD_SEC * .5)).toBe(caution)
    expect(tracker.update(clear, WARNING_CLEAR_HOLD_SEC * .5)).toBe(clear)
    tracker.reset(caution)
    const replacement = { ...caution, text: 'GEAR', gear: true }
    expect(tracker.update(replacement, WARNING_SWITCH_HOLD_SEC * .5)).toBe(caution)
    expect(tracker.update(replacement, WARNING_SWITCH_HOLD_SEC * .5)).toBe(replacement)
  })

  it('escalates a warning immediately and contains malformed elapsed time', () => {
    const tracker = new FlightWarningTracker()
    const caution = { text: 'OVERSPEED', level: 'caution' as const, stall: false, gear: false, flare: false, goAround: false, overspeed: false, fuel: false, obstacle: false }
    const urgent = { ...caution, text: 'OBSTACLE', level: 'warning' as const, obstacle: true }
    tracker.reset(caution)
    expect(tracker.update(urgent, Number.NaN)).toBe(urgent)
    expect(tracker.state).toBe(urgent)
  })
})
