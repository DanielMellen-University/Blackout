import type { OperationAttempt } from '../../systems/operation/attempt'
import { operationBrief } from '../../systems/operation/brief'
import { OPERATION_STAGES } from '../../systems/operation/identity'
import { medalForScore } from '../../systems/operation/medal'
import { buildOperationPlan } from '../../systems/operation/plan'
import type { OperationBest } from '../../systems/operation/save'
import { formatOperationMedal, formatOperationScore, operationChoiceLabel } from './format'

export interface OperationResultModel {
  title: string
  scoreLabel: string
  medalLabel: string
  medal: 'none' | 'bronze' | 'silver' | 'gold'
  pathLabel: string
  bestLabel: string
  timeLabel: string
  summary: string
  canReplay: boolean
}

function pathLabel(attempt: OperationAttempt): string {
  if (!attempt.route || !attempt.energy) return 'Unfinished'
  return `${operationChoiceLabel(attempt.route)} then ${operationChoiceLabel(attempt.energy).toLowerCase()}`
}

function timeLabel(attempt: OperationAttempt): string {
  const total = OPERATION_STAGES.reduce((sum, id) => sum + (attempt.stages[id]?.elapsedSec ?? 0), 0)
  if (!(total > 0)) return ''
  return `${total.toFixed(1)} s`
}

/**
 * Results for one finish. `previousBest` is the stored best from before this
 * finish, so a higher score can be called a new best.
 */
export function operationResultModel(
  attempt: OperationAttempt,
  best: OperationBest | null,
  previousBest: OperationBest | null,
  hasTranscript: boolean,
): OperationResultModel {
  const passed = attempt.phase === 'complete'
  const medal = medalForScore(attempt.score, passed)
  const plan = buildOperationPlan(attempt.seed, attempt.route, attempt.energy)
  let bestLabel = 'No best yet'
  if (passed && previousBest == null) bestLabel = `Best ${formatOperationScore(attempt.score)}`
  else if (passed && previousBest && attempt.score > previousBest.score) bestLabel = `New best ${formatOperationScore(attempt.score)}`
  else if (best) bestLabel = `Best ${formatOperationScore(best.score)}`
  return {
    title: passed ? 'Ridge relay complete' : 'Ridge relay stopped',
    scoreLabel: formatOperationScore(attempt.score),
    medalLabel: formatOperationMedal(medal),
    medal,
    pathLabel: pathLabel(attempt),
    bestLabel,
    timeLabel: timeLabel(attempt),
    summary: operationBrief(plan, attempt.phase),
    canReplay: passed && hasTranscript,
  }
}
