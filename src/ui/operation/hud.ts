import type { OperationAttempt } from '../../systems/operation/attempt'
import { operationBrief } from '../../systems/operation/brief'
import { stageIndex } from '../../systems/operation/identity'
import { stageEndZ, stageStartZ } from '../../systems/operation/layout'
import { buildOperationPlan } from '../../systems/operation/plan'
import type { FlightSample } from '../../systems/operation/samples'
import { formatOperationClearance, formatOperationScore, formatOperationSpeed } from './format'

export type OperationDecision = 'valley' | 'ridge' | 'conserve' | 'commit'

export interface OperationHudModel {
  title: string
  stageLabel: string
  brief: string
  prompt: string
  speedLabel: string
  clearanceLabel: string
  progressLabel: string
  scoreLabel: string
  bestLabel: string
  airborneLabel: string
  decisions: readonly OperationDecision[]
  chosen: OperationDecision | null
}

export interface OperationHudExtras {
  scoreLabel?: string
  bestLabel?: string
  chosen?: OperationDecision | null
}

function stageName(attempt: OperationAttempt): string {
  if (attempt.phase === 'failed') return `Stopped · seed ${attempt.seed}`
  if (attempt.phase === 'complete') return `Complete · seed ${attempt.seed}`
  if (attempt.phase === 'route-choice') return `Stage 2 of 3 · valley or ridge · seed ${attempt.seed}`
  if (attempt.phase === 'energy-choice') return `Stage 3 of 3 · conserve or commit · seed ${attempt.seed}`
  if (attempt.phase === 'ingress') return `Stage 1 of 3 · ingress · seed ${attempt.seed}`
  if (attempt.phase === 'transit') return `Stage 2 of 3 · ${attempt.route ?? 'transit'} · seed ${attempt.seed}`
  return `Stage 3 of 3 · ${attempt.energy ?? 'egress'} · seed ${attempt.seed}`
}

function decisionsFor(attempt: OperationAttempt): readonly OperationDecision[] {
  if (attempt.phase === 'route-choice') return ['valley', 'ridge']
  if (attempt.phase === 'energy-choice') return ['conserve', 'commit']
  return []
}

function promptFor(attempt: OperationAttempt): string {
  if (attempt.phase === 'route-choice') return 'Valley or ridge'
  if (attempt.phase === 'energy-choice') return 'Conserve or commit'
  return ''
}

/** Percent of the leg already flown, from the latest sample. */
export function operationLegProgress(attempt: OperationAttempt, live: FlightSample | null): string {
  if (!live) return '—'
  const id = attempt.phase === 'route-choice' ? 'ingress'
    : attempt.phase === 'energy-choice' ? 'transit'
      : attempt.phase === 'failed'
        ? (attempt.stages.egress ? 'egress' : attempt.stages.transit ? 'transit' : 'ingress')
        : attempt.phase === 'complete' ? 'egress'
          : attempt.phase
  const index = stageIndex(id)
  if (index < 0) return '—'
  const span = Math.max(1, stageEndZ(index) - stageStartZ(index))
  const ratio = Math.max(0, Math.min(1, (live.z - stageStartZ(index)) / span))
  return `${Math.round(ratio * 100)}%`
}

/** Stage HUD for the live flight or a replay frame. Decisions appear only at the two pauses. */
export function operationHudModel(
  attempt: OperationAttempt,
  live: FlightSample | null,
  extras: OperationHudExtras = {},
): OperationHudModel {
  const plan = buildOperationPlan(attempt.seed, attempt.route, attempt.energy)
  return {
    title: 'Ridge relay',
    stageLabel: stageName(attempt),
    brief: operationBrief(plan, attempt.phase),
    prompt: promptFor(attempt),
    speedLabel: live ? formatOperationSpeed(live.speed) : '—',
    clearanceLabel: live ? formatOperationClearance(live.clearance) : '—',
    progressLabel: operationLegProgress(attempt, live),
    scoreLabel: extras.scoreLabel ?? formatOperationScore(attempt.score),
    bestLabel: extras.bestLabel ?? 'No best yet',
    airborneLabel: live ? (live.airborne ? 'Airborne' : 'Stopped') : '—',
    decisions: decisionsFor(attempt),
    chosen: extras.chosen ?? null,
  }
}
