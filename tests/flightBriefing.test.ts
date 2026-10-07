import { describe, expect, it } from 'vitest'
import { BRIEFING_DURATION_SECONDS, briefingControls, briefingRemainingSeconds, flightBriefingHint } from '../src/core/FlightBriefing'
import { normalizeKeyboardBindings } from '../src/core/FlightPreferences'

const takeoff = { onGround: true, speed: 12, altitudeM: 0, missionPhase: 'ready', gatesPassed: 0, gearDown: true }

describe('flight briefing', () => {
  it('uses the inverted pitch key and the repaired utility binding', () => {
    const keyboardBindings = normalizeKeyboardBindings({ boost: 'KeyG', airbrake: 'KeyF', gear: 'KeyH' })
    const options = { keyboardPitch: 'w-down' as const, keyboardBindings }
    expect(briefingControls(options)).toEqual({ power: 'SHIFT / 2', rotate: 'S', gear: 'H' })
    expect(flightBriefingHint({ ...takeoff, ...options })).toBe('SHIFT / 2 POWER · S ROTATE · H GEAR AFTER TAKEOFF')
    expect(flightBriefingHint({ ...takeoff, ...options, onGround: false, missionPhase: 'returning', gearDown: false }))
      .toBe('H GEAR DOWN · ALIGN WITH RUNWAY · FLARE & LAND')
    for (const gear of ['Space', 'KeyB', 'KeyG', 'KeyF', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI']) {
      const bindings = normalizeKeyboardBindings({ gear, boost: 'KeyH', airbrake: 'KeyJ' })
      expect(flightBriefingHint({ ...takeoff, keyboardBindings: bindings })).toContain(`${briefingControls({ keyboardBindings: bindings }).gear} GEAR`)
    }
  })

  it('uses touch labels without leaking keyboard mapping or duplicating GEAR', () => {
    const state = { ...takeoff, inputSource: 'touch' as const, keyboardPitch: 'w-down' as const }
    expect(flightBriefingHint(state)).toBe('+ PWR POWER · ▲ ROTATE · GEAR AFTER TAKEOFF')
    expect(flightBriefingHint({ ...state, missionPhase: 'returning', gearDown: false }))
      .toBe('GEAR DOWN · ALIGN WITH RUNWAY · FLARE & LAND')
    expect(flightBriefingHint({ ...state, onGround: false, gatesPassed: 2 })).toContain('YAW L / R')
  })

  it('describes the actual standard-controller mapping', () => {
    const state = { ...takeoff, inputSource: 'gamepad' as const }
    expect(flightBriefingHint(state)).toBe('RT / R2 POWER · LEFT STICK UP ROTATE · X / SQUARE GEAR AFTER TAKEOFF')
    expect(flightBriefingHint({ ...state, missionPhase: 'returning', gearDown: false })).toContain('X / SQUARE GEAR DOWN')
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
})
