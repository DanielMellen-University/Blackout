import type { OperationAttempt } from './attempt'
import type { EnergyChoice, RouteChoice } from './choices'
import type { StageGate } from './gates'
import { OPERATION_STAGES, type OperationStageId } from './identity'
import { medalForScore, type OperationMedal } from './medal'
import { buildOperationPlan, stageSpec } from './plan'
import { replayOperation, type OperationTranscript } from './replay'
import { parseOperationReplayFile, replayFileTranscript, type ReplayFileFailure, type ReplayFlightMode } from './replayFile'
import { sampleStats } from './samples'

export interface ReplayStageSummary {
  id: OperationStageId
  elapsedSec: number
  score: number | null
  peakSpeedMps: number
  minClearanceM: number
  gates: StageGate[]
  gateScore: number | null
  passed: boolean
}

export interface OperationReplaySummary {
  seed: number
  decisionPath: readonly [RouteChoice, EnergyChoice]
  stages: ReplayStageSummary[]
  elapsedSec: number
  score: number
  medal: OperationMedal
  phase: OperationAttempt['phase']
}

/** Pure data for a later viewer. Null scores mean a prior failure stopped scoring that stage. */
export function operationReplaySummary(transcript: OperationTranscript): OperationReplaySummary {
  const attempt = replayOperation(transcript).attempt
  const plan = buildOperationPlan(transcript.seed, transcript.route, transcript.energy)
  const stages = OPERATION_STAGES.map(id => {
    const spec = stageSpec(plan, id)
    const result = attempt.stages[id]
    const stats = sampleStats(transcript.samples[id], spec.lateralM)
    return {
      id,
      elapsedSec: stats?.elapsedSec ?? 0,
      score: result?.score ?? null,
      peakSpeedMps: stats?.peakSpeedMps ?? 0,
      minClearanceM: stats?.minClearanceM ?? 0,
      gates: spec.gates.map(gate => ({ ...gate })),
      gateScore: result?.gateScore ?? null,
      passed: result?.passed ?? false,
    }
  })
  return {
    seed: transcript.seed,
    decisionPath: [transcript.route, transcript.energy],
    stages,
    elapsedSec: stages.reduce((sum, stage) => sum + stage.elapsedSec, 0),
    score: attempt.score,
    medal: medalForScore(attempt.score, attempt.phase === 'complete'),
    phase: attempt.phase,
  }
}

export interface ReplayScoreDifference {
  id: OperationStageId
  claimed: number
  actual: number | null
  /** Actual minus claimed. Null when a prior stage stopped the attempt. */
  difference: number | null
}

export type OperationReplayVerification = ReplayFileFailure | {
  ok: true
  matches: boolean
  stages: ReplayScoreDifference[]
  claimedTotal: number
  totalDifference: number
  flightMode?: ReplayFlightMode
  summary: OperationReplaySummary
}

/** Integrity is checked first. A valid checksum can still carry a wrong score claim. */
export function verifyOperationReplayFile(text: string): OperationReplayVerification {
  const parsed = parseOperationReplayFile(text)
  if (!parsed.ok) return parsed
  const file = parsed.file
  const summary = operationReplaySummary(replayFileTranscript(file))
  const stages = summary.stages.map(stage => ({
    id: stage.id,
    claimed: file.claimed.stages[stage.id],
    actual: stage.score,
    difference: stage.score === null ? null : stage.score - file.claimed.stages[stage.id],
  }))
  const totalDifference = summary.score - file.claimed.total
  return {
    ok: true,
    matches: summary.phase === 'complete' && totalDifference === 0 && stages.every(stage => stage.difference === 0),
    stages,
    claimedTotal: file.claimed.total,
    totalDifference,
    ...(file.flightMode ? { flightMode: file.flightMode } : {}),
    summary,
  }
}
