import type { EnergyChoice, RouteChoice } from './choices'
import { operationPathKey } from './choices'
import { flyOperation, type MeasuredOperation, type MeasuredStage } from './harness'
import { OPERATION_ID } from './identity'
import { OPERATION_DT_SEC } from './layout'
import { medalForScore, type OperationMedal } from './medal'

export const OPERATION_PATHS = [
  ['valley', 'conserve'],
  ['valley', 'commit'],
  ['ridge', 'conserve'],
  ['ridge', 'commit'],
] as const satisfies ReadonlyArray<readonly [RouteChoice, EnergyChoice]>

export interface PathSummary {
  route: RouteChoice
  energy: EnergyChoice
  passed: boolean
  score: number
  medal: OperationMedal
  elapsedSec: number
  peakSpeedMps: number
  minClearanceM: number
  steps: number
  stages: MeasuredStage[]
}

export function summarizeMeasured(measured: MeasuredOperation): PathSummary {
  const elapsedSec = measured.stages.reduce((sum, stage) => sum + stage.elapsedSec, 0)
  const peakSpeedMps = measured.stages.reduce((peak, stage) => Math.max(peak, stage.peakSpeedMps), 0)
  const minClearanceM = measured.stages.reduce((min, stage) => Math.min(min, stage.minClearanceM), Infinity)
  return {
    route: measured.route,
    energy: measured.energy,
    passed: measured.passed,
    score: measured.score,
    medal: medalForScore(measured.score, measured.passed),
    elapsedSec,
    peakSpeedMps,
    minClearanceM: Number.isFinite(minClearanceM) ? minClearanceM : 0,
    steps: measured.steps,
    stages: measured.stages,
  }
}

/** Fly every decision path on one seed and keep the simulated numbers. */
export function measureOperationPaths(seed = 42): Record<string, PathSummary> {
  const paths: Record<string, PathSummary> = {}
  for (const [route, energy] of OPERATION_PATHS) {
    paths[operationPathKey(route, energy)] = summarizeMeasured(flyOperation(seed, route, energy))
  }
  return paths
}

/** True when the four flown paths are not the same result. */
export function pathOutcomesDiffer(paths: Record<string, PathSummary>): boolean {
  const expected = OPERATION_PATHS.map(([route, energy]) => operationPathKey(route, energy))
  if (!expected.every(key => paths[key] != null)) return false
  const valley = paths['valley-conserve']
  const ridge = paths['ridge-conserve']
  const commit = paths['valley-commit']
  if (!valley || !ridge || !commit) return false
  const scores = new Set(expected.map(key => paths[key]!.score))
  if (scores.size < 4) return false
  const valleyEgress = valley.stages.find(stage => stage.id === 'egress')
  const commitEgress = commit.stages.find(stage => stage.id === 'egress')
  if (!valleyEgress || !commitEgress) return false
  return valley.minClearanceM < ridge.minClearanceM && commitEgress.peakSpeedMps > valleyEgress.peakSpeedMps
}

function round3(value: number): number {
  return Number(value.toFixed(3))
}

export interface OperationPerformanceRecord {
  chunk: '11.038'
  operationId: typeof OPERATION_ID
  seed: number
  dtSec: number
  note: string
  paths: Record<string, PathSummary>
}

/** Rounded simulated-flight record. Wall-clock time is added by the profiler, not here. */
export function operationPerformanceRecord(seed = 42): OperationPerformanceRecord {
  const paths: Record<string, PathSummary> = {}
  for (const [key, path] of Object.entries(measureOperationPaths(seed))) {
    paths[key] = {
      ...path,
      elapsedSec: round3(path.elapsedSec),
      peakSpeedMps: round3(path.peakSpeedMps),
      minClearanceM: round3(path.minClearanceM),
      stages: path.stages.map(stage => ({
        ...stage,
        elapsedSec: round3(stage.elapsedSec),
        peakSpeedMps: round3(stage.peakSpeedMps),
        minClearanceM: round3(stage.minClearanceM),
        endAltitudeM: round3(stage.endAltitudeM),
        pathDeviationM: round3(stage.pathDeviationM),
        altitudeErrorM: round3(stage.altitudeErrorM),
        meanSpeedMps: round3(stage.meanSpeedMps),
        fuelUsed: round3(stage.fuelUsed),
        nitroUsed: round3(stage.nitroUsed),
      })),
    }
  }
  return {
    chunk: '11.038',
    operationId: OPERATION_ID,
    seed,
    dtSec: OPERATION_DT_SEC,
    note: 'Aircraft.step on the dry desert operation profile. Times are simulated flight seconds, not frames per second.',
    paths,
  }
}
