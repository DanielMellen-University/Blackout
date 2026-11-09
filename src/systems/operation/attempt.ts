import { decisionBonus, scoreStage, type StageResult } from './score'
import { buildOperationPlan, stageSpec } from './plan'
import type { EnergyChoice, RouteChoice } from './choices'
import { isEnergyChoice, isRouteChoice } from './choices'
import { OPERATION_ID, OPERATION_STAGES, type OperationStageId } from './identity'
import type { FlightSample } from './samples'
import { normalizeOperationSeed } from './seed'

export type OperationPhase =
  | 'ingress'
  | 'route-choice'
  | 'transit'
  | 'energy-choice'
  | 'egress'
  | 'complete'
  | 'failed'

export interface OperationAttempt {
  id: typeof OPERATION_ID
  seed: number
  phase: OperationPhase
  route: RouteChoice | null
  energy: EnergyChoice | null
  stages: Partial<Record<OperationStageId, StageResult>>
  score: number
  failure: StageResult['reason'] | null
}

export type AttemptStep =
  | { ok: true; attempt: OperationAttempt }
  | { ok: false; reason: string; attempt: OperationAttempt }

const LIVE_PHASES = ['ingress', 'transit', 'egress'] as const
type LivePhase = typeof LIVE_PHASES[number]

function isLivePhase(phase: OperationPhase): phase is LivePhase {
  return LIVE_PHASES.some(live => live === phase)
}

export function createAttempt(seed: number): OperationAttempt {
  return {
    id: OPERATION_ID,
    seed: normalizeOperationSeed(seed),
    phase: 'ingress',
    route: null,
    energy: null,
    stages: {},
    score: 0,
    failure: null,
  }
}

function cloneAttempt(attempt: OperationAttempt): OperationAttempt {
  return { ...attempt, stages: { ...attempt.stages } }
}

function totalScore(attempt: OperationAttempt): number {
  const stages = OPERATION_STAGES.reduce((sum, id) => sum + (attempt.stages[id]?.score ?? 0), 0)
  return stages + decisionBonus(attempt.route, attempt.energy, attempt.stages.transit, attempt.stages.egress)
}

/** Record the live stage and advance, or stop the run when the stage fails. */
export function recordStage(attempt: OperationAttempt, samples: readonly FlightSample[]): AttemptStep {
  if (!isLivePhase(attempt.phase)) return { ok: false, reason: 'no-live-stage', attempt }
  const plan = buildOperationPlan(attempt.seed, attempt.route, attempt.energy)
  const spec = stageSpec(plan, attempt.phase)
  const result = scoreStage(spec, samples)
  const next = cloneAttempt(attempt)
  next.stages[spec.id] = result
  if (!result.passed) {
    next.phase = 'failed'
    next.failure = result.reason
    next.score = totalScore(next)
    return { ok: true, attempt: next }
  }
  next.phase = spec.id === 'ingress' ? 'route-choice' : spec.id === 'transit' ? 'energy-choice' : 'complete'
  next.failure = null
  next.score = totalScore(next)
  return { ok: true, attempt: next }
}

/** Valley or ridge, only after ingress and only once. */
export function chooseRoute(attempt: OperationAttempt, choice: unknown): AttemptStep {
  if (attempt.phase !== 'route-choice') return { ok: false, reason: 'route-not-open', attempt }
  if (!isRouteChoice(choice)) return { ok: false, reason: 'bad-route', attempt }
  const next = cloneAttempt(attempt)
  next.route = choice
  next.phase = 'transit'
  next.score = totalScore(next)
  return { ok: true, attempt: next }
}

/** Conserve or commit, only after transit and only once. */
export function chooseEnergy(attempt: OperationAttempt, choice: unknown): AttemptStep {
  if (attempt.phase !== 'energy-choice') return { ok: false, reason: 'energy-not-open', attempt }
  if (!isEnergyChoice(choice)) return { ok: false, reason: 'bad-energy', attempt }
  const next = cloneAttempt(attempt)
  next.energy = choice
  next.phase = 'egress'
  next.score = totalScore(next)
  return { ok: true, attempt: next }
}
