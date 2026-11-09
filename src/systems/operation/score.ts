import { FlyingScore } from '../FlyingScore'
import type { EnergyChoice, RouteChoice } from './choices'
import { measureDiscipline } from './discipline'
import type { OperationStageId } from './identity'
import { CORRIDOR_HALF_WIDTH_M, MIN_CLEARANCE_M } from './layout'
import type { StageSpec } from './plan'
import { isFlightSample, sampleStats, type FlightSample } from './samples'
import { OPERATION_TERRAIN } from './terrain'

export type StageFailReason = 'complete' | 'timeout' | 'ground' | 'incomplete' | 'off-corridor' | 'clearance'

export interface StageResult {
  id: OperationStageId
  passed: boolean
  reason: StageFailReason
  elapsedSec: number
  distanceM: number
  peakSpeedMps: number
  minAltitudeM: number
  minClearanceM: number
  endAltitudeM: number
  timeScore: number
  flyingScore: number
  gateScore: number
  pathDeviationM: number
  altitudeErrorM: number
  speedErrorMps: number
  meanSpeedMps: number
  fuelUsed: number
  nitroUsed: number
  disciplineScore: number
  score: number
}

export const VALLEY_CLEARANCE_M = 160
export const COMMIT_SPEED_MPS = 320
export const VALLEY_BONUS = 900
export const COMMIT_BONUS = 1800
const GATE_CAPTURE_M = 120

export function timeScoreFor(elapsedSec: number, allowanceSec: number): number {
  if (!Number.isFinite(elapsedSec) || !Number.isFinite(allowanceSec)) return 0
  return Math.round(Math.max(-5000, Math.min(8000, (allowanceSec - elapsedSec) * 100)))
}

/** Time-weighted flying bonus, using height above the operation floor as altitude. */
export function flyingScoreFor(samples: readonly FlightSample[], weights: StageSpec['weights']): number {
  const flying = new FlyingScore(160)
  const floor = OPERATION_TERRAIN.baseHeight
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const sample = samples[index]
    if (!previous || !sample || !isFlightSample(previous) || !isFlightSample(sample)) continue
    flying.sample(sample.t - previous.t, sample.y - floor, sample.clearance, sample.speed)
  }
  const bonus = flying.bonuses()
  return Math.round(bonus.lowScore * weights.low + bonus.terrainScore * weights.terrain + bonus.speedScore * weights.speed)
}

export function gateScoreFor(spec: StageSpec, samples: readonly FlightSample[]): number {
  let score = 0
  for (const gate of spec.gates) {
    let best = Infinity
    for (const sample of samples) {
      if (!isFlightSample(sample)) continue
      best = Math.min(best, Math.hypot(sample.x - gate.x, sample.y - gate.y, sample.z - gate.z))
    }
    if (best <= GATE_CAPTURE_M) score += Math.round(400 * (1 - best / GATE_CAPTURE_M))
  }
  return score
}

function emptyResult(id: OperationStageId, reason: StageFailReason): StageResult {
  return {
    id,
    passed: false,
    reason,
    elapsedSec: 0,
    distanceM: 0,
    peakSpeedMps: 0,
    minAltitudeM: 0,
    minClearanceM: 0,
    endAltitudeM: 0,
    timeScore: 0,
    flyingScore: 0,
    gateScore: 0,
    pathDeviationM: 0,
    altitudeErrorM: 0,
    speedErrorMps: 0,
    meanSpeedMps: 0,
    fuelUsed: 0,
    nitroUsed: 0,
    disciplineScore: 0,
    score: 0,
  }
}

/** Score one stage from its trace. A failed stage banks nothing. */
export function scoreStage(spec: StageSpec, samples: readonly FlightSample[]): StageResult {
  const stats = sampleStats(samples, spec.lateralM)
  if (!stats) return emptyResult(spec.id, 'incomplete')
  let reason: StageFailReason = 'complete'
  if (!stats.airborne) reason = 'ground'
  else if (stats.minClearanceM < MIN_CLEARANCE_M) reason = 'clearance'
  else if (stats.maxAbsLateralErrorM > CORRIDOR_HALF_WIDTH_M) reason = 'off-corridor'
  else if (stats.endZ < spec.endZ - 1) reason = 'incomplete'
  else if (stats.elapsedSec > spec.timeAllowanceSec) reason = 'timeout'
  const passed = reason === 'complete'
  const discipline = measureDiscipline(spec, samples)
  const timeScore = passed ? timeScoreFor(stats.elapsedSec, spec.timeAllowanceSec) : 0
  const flyingScore = passed ? flyingScoreFor(samples, spec.weights) : 0
  const gateScore = passed ? gateScoreFor(spec, samples) : 0
  const disciplineScore = passed ? discipline.score : 0
  return {
    id: spec.id,
    passed,
    reason,
    elapsedSec: stats.elapsedSec,
    distanceM: stats.distanceM,
    peakSpeedMps: stats.peakSpeedMps,
    minAltitudeM: stats.minAltitudeM,
    minClearanceM: stats.minClearanceM,
    endAltitudeM: stats.endAltitudeM,
    timeScore,
    flyingScore,
    gateScore,
    pathDeviationM: discipline.pathDeviationM,
    altitudeErrorM: discipline.altitudeErrorM,
    speedErrorMps: discipline.speedErrorMps,
    meanSpeedMps: discipline.meanSpeedMps,
    fuelUsed: discipline.fuelUsed,
    nitroUsed: discipline.nitroUsed,
    disciplineScore,
    score: timeScore + flyingScore + gateScore + disciplineScore,
  }
}

/**
 * Valley pays when the transit leg stayed low.
 * Commit pays when the egress leg, flown after that choice, actually carried speed.
 */
export function decisionBonus(
  route: RouteChoice | null,
  energy: EnergyChoice | null,
  transit: StageResult | undefined,
  egress: StageResult | undefined,
): number {
  let bonus = 0
  if (route === 'valley' && transit?.passed && transit.minClearanceM <= VALLEY_CLEARANCE_M) bonus += VALLEY_BONUS
  if (energy === 'commit' && egress?.passed && egress.peakSpeedMps >= COMMIT_SPEED_MPS) bonus += COMMIT_BONUS
  return bonus
}
