import type { OperationAttempt } from '../../systems/operation/attempt'
import { operationBrief } from '../../systems/operation/brief'
import { stageIndex, type OperationStageId } from '../../systems/operation/identity'
import { stageEndZ, stageStartZ } from '../../systems/operation/layout'
import { buildOperationPlan, stageSpec } from '../../systems/operation/plan'
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
  guideLabel: string
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

function stageIdFor(attempt: OperationAttempt): OperationStageId {
  if (attempt.phase === 'route-choice') return 'ingress'
  if (attempt.phase === 'energy-choice') return 'transit'
  if (attempt.phase === 'failed') return attempt.stages.egress ? 'egress' : attempt.stages.transit ? 'transit' : 'ingress'
  if (attempt.phase === 'complete') return 'egress'
  return attempt.phase
}

function signedMetres(value: number): string {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}`
  return `${rounded}`
}

/** Line, altitude and energy the pilot can see while the leg is in the air. */
export function operationGuideLabel(attempt: OperationAttempt, live: FlightSample | null): string {
  if (!live) return '—'
  const plan = buildOperationPlan(attempt.seed, attempt.route, attempt.energy)
  const spec = stageSpec(plan, stageIdFor(attempt))
  const fuel = Number.isFinite(live.fuel) ? live.fuel!.toFixed(1) : '—'
  const nitro = Number.isFinite(live.nitro) ? `${Math.round(live.nitro! * 100)}%` : '—'
  return `Line ${signedMetres(live.x - spec.lateralM)} m · band ${signedMetres(live.y - spec.altitudeM)} m · ${Math.round(live.speed)} m/s · fuel ${fuel} · nitro ${nitro}`
}

/** Percent of the leg already flown, from the latest sample. */
export function operationLegProgress(attempt: OperationAttempt, live: FlightSample | null): string {
  if (!live) return '—'
  const id = stageIdFor(attempt)
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
    guideLabel: operationGuideLabel(attempt, live),
    decisions: decisionsFor(attempt),
    chosen: extras.chosen ?? null,
  }
}
