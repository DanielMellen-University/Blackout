import { describe, expect, it } from 'vitest'
import { isFlightSample, sampleStats, type FlightSample } from '../src/systems/operation/samples'

function sample(partial: Partial<FlightSample> = {}): FlightSample {
  return { t: 0, x: 0, y: 400, z: 0, speed: 150, clearance: 200, airborne: true, ...partial }
}

describe('operation samples', () => {
  it('accepts a finite airborne sample', () => {
    expect(isFlightSample(sample())).toBe(true)
  })
})
