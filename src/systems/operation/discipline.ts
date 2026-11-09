import { CORRIDOR_HALF_WIDTH_M } from './layout'
import type { StageSpec } from './plan'
import { isFlightSample, type FlightSample } from './samples'

export const PATH_POINTS = 1200
export const ALTITUDE_POINTS = 1600
export const SPEED_POINTS = 1200
export const ENERGY_POINTS = 800
const ALTITUDE_SCALE_M = 220
const NITRO_SLACK = 0.02

export interface StageDiscipline {
  pathDeviationM: number
  altitudeErrorM: number
  speedErrorMps: number
  meanSpeedMps: number
  fuelUsed: number
  nitroUsed: number
  pathScore: number
  altitudeScore: number
  speedScore: number
  energyScore: number
  score: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function points(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

function consumed(samples: readonly FlightSample[], key: 'fuel' | 'nitro'): number {
  const first = samples[0]?.[key]
  const last = samples[samples.length - 1]?.[key]
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0
  return Math.max(0, (first as number) - (last as number))
}

const EMPTY: StageDiscipline = {
  pathDeviationM: 0,
  altitudeErrorM: 0,
  speedErrorMps: 0,
  meanSpeedMps: 0,
  fuelUsed: 0,
  nitroUsed: 0,
  pathScore: 0,
  altitudeScore: 0,
  speedScore: 0,
  energyScore: 0,
  score: 0,
}

/** How closely the trace held the briefed line, altitude, speed and energy. */
export function measureDiscipline(spec: StageSpec, samples: readonly FlightSample[]): StageDiscipline {
  const usable = samples.filter(sample => isFlightSample(sample))
  if (usable.length === 0) return { ...EMPTY }
  let lateral = 0
  let altitude = 0
  let speed = 0
  let outside = 0
  let inside = 0
  for (const sample of usable) {
    lateral += Math.abs(sample.x - spec.lateralM)
    altitude += Math.abs(sample.y - spec.altitudeM)
    speed += sample.speed
    const error = Math.max(0, spec.speedBand.minMps - sample.speed, sample.speed - spec.speedBand.maxMps)
    outside += error
    if (error === 0) inside += 1
  }
  const count = usable.length
  const pathDeviationM = lateral / count
  const altitudeErrorM = altitude / count
  const speedErrorMps = outside / count
  const meanSpeedMps = speed / count
  const fuelUsed = consumed(usable, 'fuel')
  const nitroUsed = consumed(usable, 'nitro')
  const pathScore = points(PATH_POINTS * clamp01(1 - pathDeviationM / CORRIDOR_HALF_WIDTH_M))
  const altitudeScore = points(ALTITUDE_POINTS * clamp01(1 - altitudeErrorM / ALTITUDE_SCALE_M))
  const speedScore = points(SPEED_POINTS * (inside / count))
  const budget = spec.fuelBudget > 0 ? spec.fuelBudget : 1
  let energyScore = fuelUsed <= budget ? ENERGY_POINTS : points(ENERGY_POINTS * budget / fuelUsed)
  if (!spec.boost && nitroUsed > NITRO_SLACK) energyScore = points(energyScore * clamp01(1 - nitroUsed))
  return {
    pathDeviationM,
    altitudeErrorM,
    speedErrorMps,
    meanSpeedMps,
    fuelUsed,
    nitroUsed,
    pathScore,
    altitudeScore,
    speedScore,
    energyScore,
    score: pathScore + altitudeScore + speedScore + energyScore,
  }
}
