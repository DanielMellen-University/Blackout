import { describe, expect, it } from 'vitest'
import { BRIEFING_DURATION_SECONDS, briefingControls, briefingRemainingSeconds, flightBriefingHint, FlightBriefingSession } from '../src/core/FlightBriefing'
import { normalizeKeyboardBindings } from '../src/core/FlightPreferences'

const takeoff = { onGround: true, speed: 12, altitudeM: 0, missionPhase: 'ready', gatesPassed: 0, gearDown: true }

describe('flight briefing', () => {
  it('uses the inverted pitch key and the repaired utility binding', () => {
    const keyboardBindings = normalizeKeyboardBindings({ boost: 'KeyG', airbrake: 'KeyF', gear: 'KeyH' })
    const options = { keyboardPitch: 'w-down' as const, keyboardBindings }
    expect(briefingControls(options)).toEqual({ power: 'SHIFT / 2', rotate: 'S', gear: 'H' })
    expect(flightBriefingHint({ ...takeoff, ...options })).toBe('SHIFT / 2 POWER · S ROTATE · GEAR AUTO')
    expect(flightBriefingHint({ ...takeoff, ...options, onGround: false, missionPhase: 'returning', gearDown: false }))
      .toBe('CTRL / 1 REDUCE POWER · H GEAR DOWN · FOLLOW BASE ARROW')
    for (const gear of ['Space', 'KeyB', 'KeyG', 'KeyF', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI']) {
      const bindings = normalizeKeyboardBindings({ gear, boost: 'KeyH', airbrake: 'KeyJ' })
      expect(flightBriefingHint({ ...takeoff, onGround: false, missionPhase: 'returning', gearDown: false, keyboardBindings: bindings })).toContain(`${briefingControls({ keyboardBindings: bindings }).gear} GEAR`)
    }
  })

  it('uses touch labels without leaking keyboard mapping or duplicating GEAR', () => {
    const state = { ...takeoff, inputSource: 'touch' as const, keyboardPitch: 'w-down' as const }
    expect(flightBriefingHint(state)).toBe('+ PWR POWER · ▲ ROTATE · GEAR AUTO')
    expect(flightBriefingHint({ ...state, onGround: false, missionPhase: 'returning', gearDown: false }))
      .toBe('− PWR REDUCE POWER · GEAR DOWN · FOLLOW BASE ARROW')
    expect(flightBriefingHint({ ...state, onGround: false, gatesPassed: 2 })).toContain('YAW L / R')
  })

  it('describes the actual standard-controller mapping', () => {
    const state = { ...takeoff, inputSource: 'gamepad' as const }
    expect(flightBriefingHint(state)).toBe('RT / R2 POWER · LEFT STICK UP ROTATE · GEAR AUTO')
    expect(flightBriefingHint({ ...state, onGround: false, missionPhase: 'returning', gearDown: false })).toContain('LT / L2 REDUCE POWER · X / SQUARE GEAR DOWN')
    expect(flightBriefingHint({ ...state, onGround: false, gatesPassed: 2 })).toContain('RIGHT STICK YAW')
  })

  it('keeps the full briefing budget through pauses, loading, and malformed timing', () => {
    let remaining = BRIEFING_DURATION_SECONDS
    remaining = briefingRemainingSeconds(remaining, 4, true)
    expect(remaining).toBe(12)
    for (const elapsed of [60, 300, Infinity, Number.NaN, -1]) {
      expect(briefingRemainingSeconds(remaining, elapsed, false)).toBe(12)
    }
    expect(briefingRemainingSeconds(remaining, Number.NaN, true)).toBe(12)
    expect(briefingRemainingSeconds(remaining, -1, true)).toBe(12)
    expect(briefingRemainingSeconds(remaining, 0, true)).toBe(12)
    expect(briefingRemainingSeconds(remaining, 12, true)).toBe(0)
    expect(briefingRemainingSeconds(remaining, 20, true)).toBe(0)
    expect(briefingRemainingSeconds(Number.NaN, 1, true)).toBe(0)
    expect(briefingRemainingSeconds(1000, 0, false)).toBe(BRIEFING_DURATION_SECONDS)
  })

  it('renews only for actual flight milestones, with a fresh final-approach reminder', () => {
    const session = new FlightBriefingSession()
    session.reset(true)
    session.advance(600, true)
    expect(session.visible).toBe(true)
    session.observe(false, 0, 'running', false, 5)
    expect(session.stage).toBe('first-gate')
    session.advance(16, true)
    expect(session.visible).toBe(false)
    session.observe(false, 1, 'running', false, 5)
    expect(session.stage).toBe('route')
    expect(session.remainingSeconds).toBe(16)
    session.advance(16, true)
    session.observe(false, 3, 'running', false, 5)
    expect(session.visible).toBe(false)
    session.observe(false, 5, 'returning', false, 5)
    expect(session.stage).toBe('return')
    session.advance(600, true)
    session.observe(false, 5, 'returning', true, 5)
    expect(session.stage).toBe('approach')
    expect(session.visible).toBe(true)
    session.advance(16, true)
    for (const inbound of [false, true, false, true]) session.observe(false, 5, 'returning', inbound, 5)
    expect(session.visible).toBe(false)
  })

  it('preserves training gate-one coaching but does not renew it on a bounce', () => {
    const session = new FlightBriefingSession()
    session.reset(true, true)
    session.observe(false, 0, 'running', false, 5)
    session.advance(300, true)
    expect(session.visible).toBe(true)
    session.observe(false, 1, 'running', false, 5)
    session.advance(16, true)
    session.observe(true, 1, 'running', false, 5)
    session.observe(false, 1, 'running', false, 5)
    expect(session.stage).toBe('route')
    expect(session.visible).toBe(false)
  })

  it('clears terminal sorties, resets retries, and retains pause-safe time', () => {
    const session = new FlightBriefingSession()
    session.reset(false)
    session.observe(false, 5, 'returning', true, 5)
    expect(session.visible).toBe(false)
    session.reset(true)
    session.observe(false, 1, 'running', false, 5)
    session.advance(5, true)
    session.advance(600, false)
    expect(session.remainingSeconds).toBe(11)
    for (const elapsed of [NaN, Infinity, -1]) session.advance(elapsed, true)
    expect(session.remainingSeconds).toBe(11)
    session.observe(true, 5, 'complete', false, 5)
    expect(session.visible).toBe(false)
    session.observe(false, 5, 'returning', true, 5)
    expect(session.visible).toBe(false)
    session.reset(true)
    expect(session.stage).toBe('takeoff')
    expect(session.visible).toBe(true)
    session.observe(false, 0, 'failed', false, 5)
    expect(session.visible).toBe(false)
  })

  it('keeps free-flight takeoff, exploration and emergency return distinct', () => {
    const session = new FlightBriefingSession()
    session.reset(true)
    session.observe(true, 0, 'returning', false, 0)
    expect(session.stage).toBe('takeoff')
    session.observe(false, 0, 'returning', false, 0)
    expect(session.stage).toBe('explore')
    expect(flightBriefingHint({ ...takeoff, onGround: false, missionPhase: 'returning', totalGates: 0 })).toContain('EXPLORE THE WORLD')
    session.observe(false, 0, 'returning', false, 0, true)
    expect(session.stage).toBe('return')
    expect(flightBriefingHint({ ...takeoff, onGround: false, totalGates: 0, emergencyReturn: true })).toContain('FOLLOW BASE ARROW')
    expect(flightBriefingHint({ ...takeoff, missionPhase: 'returning', totalGates: 0 })).toContain('ROTATE')
  })

  it('gives approach and selected-landmark advice without pointing at a nonexistent gate', () => {
    expect(flightBriefingHint({ ...takeoff, onGround: false, missionPhase: 'returning', approachActive: true }))
      .toBe('FLARE GENTLY · KEEP WINGS LEVEL')
    expect(flightBriefingHint({ ...takeoff, onGround: false, altitudeM: 40, missionPhase: 'returning', approachActive: true }))
      .toBe('TWO WHITE / TWO RED · STEADY DESCENT')
    expect(flightBriefingHint({ ...takeoff, onGround: false, navTarget: 'village' })).toContain('LANDMARK SELECTED')
  })
})
