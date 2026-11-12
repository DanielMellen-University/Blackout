import { describe, expect, it } from 'vitest'
import {
  applyOperationAudioInputs, flightAudioMuted, operationAudioInputs,
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
