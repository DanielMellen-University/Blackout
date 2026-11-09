export interface FlightSample {
  t: number
  x: number
  y: number
  z: number
  speed: number
  clearance: number
  airborne: boolean
}

const NUMERIC_KEYS = ['t', 'x', 'y', 'z', 'speed', 'clearance'] as const

export function isFlightSample(value: unknown): value is FlightSample {
  if (!value || typeof value !== 'object') return false
  const sample = value as FlightSample
  if (typeof sample.airborne !== 'boolean') return false
  return NUMERIC_KEYS.every(key => Number.isFinite(sample[key]))
}

export interface SampleStats {
  elapsedSec: number
  distanceM: number
  peakSpeedMps: number
  minAltitudeM: number
  minClearanceM: number
  endZ: number
  endAltitudeM: number
  maxAbsLateralErrorM: number
  airborne: boolean
}

/** Reduce a stage trace. Returns null when the trace is too short or time runs backwards. */
export function sampleStats(samples: readonly FlightSample[], lateral: number): SampleStats | null {
  if (samples.length < 2) return null
  let distanceM = 0
  let peakSpeedMps = 0
  let minAltitudeM = Infinity
  let minClearanceM = Infinity
  let maxAbsLateralErrorM = 0
  let airborne = true
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    if (!sample || !isFlightSample(sample)) return null
    if (index > 0) {
      const previous = samples[index - 1]!
      if (sample.t < previous.t) return null
      distanceM += Math.hypot(sample.x - previous.x, sample.y - previous.y, sample.z - previous.z)
    }
    peakSpeedMps = Math.max(peakSpeedMps, sample.speed)
    minAltitudeM = Math.min(minAltitudeM, sample.y)
    minClearanceM = Math.min(minClearanceM, sample.clearance)
    maxAbsLateralErrorM = Math.max(maxAbsLateralErrorM, Math.abs(sample.x - lateral))
    if (!sample.airborne) airborne = false
  }
  const first = samples[0]!
  const last = samples[samples.length - 1]!
  return {
    elapsedSec: last.t - first.t,
    distanceM,
    peakSpeedMps,
    minAltitudeM,
    minClearanceM,
    endZ: last.z,
    endAltitudeM: last.y,
    maxAbsLateralErrorM,
    airborne,
  }
}
