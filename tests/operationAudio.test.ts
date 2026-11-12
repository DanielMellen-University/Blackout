import { describe, expect, it } from 'vitest'
import {
  applyOperationAudioInputs, flightAfterburnerAudio, flightAudioMuted, operationAudioInputs, shouldResumeFlightAudio,
  type FlightAudioGate,
} from '../src/ui/operation/audio'
import {
  closeOperationFlight, openOperationFlight, operationFlightPose, stepOperationFlight,
} from '../src/systems/operation/flight'

const gate: FlightAudioGate = {
  playing: false, operationActive: true, audioMuted: false, hidden: false,
  paused: false, resultsOpen: false, crashed: false, crashCinematic: false,
}

describe('main flight audio routing', () => {
  it('resumes the context on tab return while output stays muted, so a later unmute works', () => {
    expect(shouldResumeFlightAudio({ ...gate, audioMuted: true })).toBe(true)
    const scene = { ...gate, playing: true, operationActive: false, audioMuted: true }
    expect(shouldResumeFlightAudio(scene)).toBe(true)
    expect(flightAudioMuted(scene)).toBe(true)
    expect(shouldResumeFlightAudio({ ...scene, playing: false })).toBe(false)
    expect(shouldResumeFlightAudio({ ...scene, paused: true })).toBe(false)
    expect(shouldResumeFlightAudio({ ...scene, hidden: true })).toBe(false)
    expect(shouldResumeFlightAudio({ ...scene, resultsOpen: true })).toBe(false)
  })

  it('cues nitro on and off from the stepped operation while the scene sortie is idle', () => {
    const flight = openOperationFlight(42)
    const routing = { ...gate, simLive: false }
    try {
      const stick = { pitch: 0, roll: 0, yaw: 0, throttle: 1, boost: true, airbrake: false }
      stepOperationFlight(flight, 1, stick)
      const on = operationAudioInputs(operationFlightPose(flight))!
      expect(on.boost).toBe(true)
      const burnerOn = flightAfterburnerAudio(false, false, on, routing)
      expect(burnerOn).toEqual({ active: true, cue: 'ab' })
      expect(flightAfterburnerAudio(burnerOn.active, false, on, routing).cue).toBeNull()
      stepOperationFlight(flight, 1, { ...stick, boost: false })
      const off = operationAudioInputs(operationFlightPose(flight))!
      expect(off.boost).toBe(false)
      // Deliberately oppose the scene flag to catch the wrong aircraft source.
      expect(flightAfterburnerAudio(burnerOn.active, true, off, routing)).toEqual({ active: false, cue: 'ab-off' })
    } finally {
      closeOperationFlight(flight)
    }
  })

  it.each(['audioMuted', 'hidden', 'paused', 'resultsOpen'] as const)('suppresses nitro cues while %s', key => {
    const inputs = { throttle: 1, effectivePower: 1, boost: true, speed: 200 }
    expect(flightAfterburnerAudio(false, false, inputs, { ...gate, simLive: false, [key]: true }).cue).toBeNull()
  })

  it('retains normal sortie nitro cues and suppresses idle or crashed scene cues', () => {
    const scene = { ...gate, operationActive: false, playing: true, simLive: true }
    expect(flightAfterburnerAudio(false, true, null, scene)).toEqual({ active: true, cue: 'ab' })
    expect(flightAfterburnerAudio(true, false, null, scene).cue).toBe('ab-off')
    expect(flightAfterburnerAudio(false, true, null, { ...scene, simLive: false }).cue).toBeNull()
    expect(flightAfterburnerAudio(false, true, null, { ...scene, crashed: true }).cue).toBeNull()
    expect(flightAfterburnerAudio(false, true, null, { ...scene, crashed: true, crashCinematic: true }).cue).toBeNull()
  })

  it('maps the real stepped operation into the mixer frame while no sortie is playing', () => {
    const flight = openOperationFlight(42)
    try {
      stepOperationFlight(flight, 60)
      const pose = operationFlightPose(flight)!
      const inputs = operationAudioInputs(pose)
      const frame = { throttle: 0, effectivePower: 0, boost: true, speed: 0, airbrake: false }
      applyOperationAudioInputs(frame, inputs)
      expect(pose.speed).toBeGreaterThan(150)
      expect(frame).toEqual({
        throttle: pose.throttle, effectivePower: pose.effectivePower,
        boost: pose.boost, speed: pose.speed, airbrake: false,
      })
      expect(flightAudioMuted({ ...gate, operationActive: !!inputs })).toBe(false)
    } finally {
      closeOperationFlight(flight)
    }
  })

  it('ignores the inactive scene aircraft crash state during the operation', () => {
    expect(flightAudioMuted({ ...gate, crashed: true })).toBe(false)
  })

  it.each(['audioMuted', 'hidden', 'paused', 'resultsOpen'] as const)('keeps %s muted during an operation', key => {
    expect(flightAudioMuted({ ...gate, [key]: true })).toBe(true)
  })

  it('preserves title, normal flight, crash and crash cinematic gating', () => {
    const scene = { ...gate, operationActive: false }
    expect(flightAudioMuted(scene)).toBe(true)
    expect(flightAudioMuted({ ...scene, playing: true })).toBe(false)
    expect(flightAudioMuted({ ...scene, playing: true, crashed: true })).toBe(true)
    expect(flightAudioMuted({ ...scene, playing: true, crashed: true, crashCinematic: true })).toBe(false)
  })

  it('keeps the scene mixer inputs when the operation aircraft is unavailable', () => {
    const frame = { throttle: .4, effectivePower: .5, boost: false, speed: 200 }
    expect(operationAudioInputs(null)).toBeNull()
    applyOperationAudioInputs(frame, operationAudioInputs(null))
    expect(frame).toEqual({ throttle: .4, effectivePower: .5, boost: false, speed: 200 })
  })
})
