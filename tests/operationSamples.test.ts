import { describe, expect, it } from 'vitest'
import { isFlightSample, sampleStats, type FlightSample } from '../src/systems/operation/samples'

function sample(partial: Partial<FlightSample> = {}): FlightSample {
  return { t: 0, x: 0, y: 400, z: 0, speed: 150, clearance: 200, airborne: true, ...partial }
}

describe('operation samples', () => {
  it('accepts a finite airborne sample', () => {
    expect(isFlightSample(sample())).toBe(true)
  })

  it('rejects a sample with a non-finite field', () => {
    expect(isFlightSample(sample({ speed: Number.NaN }))).toBe(false)
    expect(isFlightSample(null)).toBe(false)
    expect(isFlightSample({ ...sample(), airborne: 'yes' })).toBe(false)
  })

  it('reduces elapsed time, distance, peak speed and clearance', () => {
    const stats = sampleStats([
      sample({ t: 1, z: 0, speed: 100, clearance: 80 }),
      sample({ t: 3, z: 400, speed: 180, clearance: 50, y: 300 }),
    ], 0)
    expect(stats?.elapsedSec).toBe(2)
    expect(stats?.distanceM).toBeCloseTo(Math.hypot(0, 100, 400), 6)
    expect(stats?.peakSpeedMps).toBe(180)
    expect(stats?.minClearanceM).toBe(50)
    expect(stats?.minAltitudeM).toBe(300)
    expect(stats?.endZ).toBe(400)
  })

  it('returns null for a single sample', () => {
    expect(sampleStats([sample()], 0)).toBeNull()
  })

  it('returns null when time runs backwards', () => {
    expect(sampleStats([sample({ t: 2 }), sample({ t: 1, z: 10 })], 0)).toBeNull()
  })
})
