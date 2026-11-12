import type { OperationAttempt, OperationPhase } from './attempt'
import { isEnergyChoice, isRouteChoice, type EnergyChoice, type RouteChoice } from './choices'
import { OPERATION_ID, OPERATION_STAGES, isOperationStageId, type OperationStageId } from './identity'
import type { StageResult } from './score'
import type { OperationTranscript } from './replay'
import { isFlightSample } from './samples'

export const OPERATION_SAVE_VERSION = 1 as const
export const OPERATION_STORAGE_KEY = 'blackout.operation.ridge-relay'
export const OPERATION_HISTORY_LIMIT = 12

export interface OperationBest {
  id: typeof OPERATION_ID
  seed: number
  route: RouteChoice
  energy: EnergyChoice
  score: number
  stages: Record<OperationStageId, StageResult>
}

export interface OperationProgress {
  version: typeof OPERATION_SAVE_VERSION
  active: OperationAttempt | null
  best: OperationBest | null
  history: OperationBest[]
  replay: OperationTranscript | null
}

export interface OperationStore {
  read(): string | null
  write(text: string): void
}

export function emptyProgress(): OperationProgress {
  return { version: OPERATION_SAVE_VERSION, active: null, best: null, history: [], replay: null }
}

export function memoryOperationStore(initial: string | null = null): OperationStore & { snapshot(): string | null } {
  let text = initial
  return {
    read: () => text,
    write: value => { text = value },
    snapshot: () => text,
  }
}

const PHASES: readonly OperationPhase[] = [
  'ingress', 'route-choice', 'transit', 'energy-choice', 'egress', 'complete', 'failed',
]

function isPhase(value: unknown): value is OperationPhase {
  return typeof value === 'string' && PHASES.some(phase => phase === value)
}

const STAGE_RESULT_NUMBERS = [
  'elapsedSec', 'distanceM', 'peakSpeedMps', 'minAltitudeM', 'minClearanceM', 'endAltitudeM',
  'timeScore', 'flyingScore', 'gateScore', 'pathDeviationM', 'altitudeErrorM', 'speedErrorMps',
  'meanSpeedMps', 'fuelUsed', 'nitroUsed', 'disciplineScore', 'score',
] as const
// These seven discipline measurements were added after version-1 saves were
// already in use. Accept their absence in legacy records, but validate them
// whenever they are present.
const STAGE_RESULT_DISCIPLINE_NUMBERS = [
  'pathDeviationM', 'altitudeErrorM', 'speedErrorMps', 'meanSpeedMps',
  'fuelUsed', 'nitroUsed', 'disciplineScore',
] as const satisfies readonly (typeof STAGE_RESULT_NUMBERS[number])[]
const LEGACY_STAGE_RESULT_NUMBERS = STAGE_RESULT_NUMBERS.filter(
  key => !(STAGE_RESULT_DISCIPLINE_NUMBERS as readonly string[]).includes(key),
)
const STAGE_RESULT_REASONS: readonly StageResult['reason'][] = [
  'complete', 'timeout', 'ground', 'incomplete', 'off-corridor', 'clearance',
]

function isStageResult(value: unknown, id: OperationStageId): value is StageResult {
  if (!value || typeof value !== 'object') return false
  const result = value as StageResult
  return result.id === id
    && typeof result.passed === 'boolean'
    && STAGE_RESULT_REASONS.includes(result.reason)
    && result.passed === (result.reason === 'complete')
    && LEGACY_STAGE_RESULT_NUMBERS.every(key => Number.isFinite(result[key]))
    && STAGE_RESULT_DISCIPLINE_NUMBERS.every(key => !(key in result) || Number.isFinite(result[key]))
}

export function isAttempt(value: unknown): value is OperationAttempt {
  if (!value || typeof value !== 'object') return false
  const attempt = value as OperationAttempt
  if (attempt.id !== OPERATION_ID || !Number.isFinite(attempt.seed) || !isPhase(attempt.phase)) return false
  if (!(attempt.route === null || isRouteChoice(attempt.route))) return false
  if (!(attempt.energy === null || isEnergyChoice(attempt.energy))) return false
  if (!Number.isFinite(attempt.score) || attempt.stages == null || typeof attempt.stages !== 'object') return false
  const stages = attempt.stages as Record<string, unknown>
  if (Object.keys(stages).some(id => !isOperationStageId(id))) return false
  if (!OPERATION_STAGES.every(id => !(id in stages) || isStageResult(stages[id], id))) return false
  return true
}

export function isBest(value: unknown): value is OperationBest {
  if (!value || typeof value !== 'object') return false
  const best = value as OperationBest
  if (best.id !== OPERATION_ID || !Number.isFinite(best.seed) || !Number.isFinite(best.score)) return false
  if (!isRouteChoice(best.route) || !isEnergyChoice(best.energy) || !best.stages) return false
  return OPERATION_STAGES.every(id => isStageResult(best.stages[id], id))
}

export function toBest(attempt: OperationAttempt): OperationBest | null {
  if (attempt.phase !== 'complete' || !attempt.route || !attempt.energy) return null
  const ingress = attempt.stages.ingress
  const transit = attempt.stages.transit
  const egress = attempt.stages.egress
  if (!ingress?.passed || !transit?.passed || !egress?.passed) return null
  return {
    id: OPERATION_ID,
    seed: attempt.seed,
    route: attempt.route,
    energy: attempt.energy,
    score: attempt.score,
    stages: { ingress, transit, egress },
  }
}

export function serializeProgress(progress: OperationProgress): string {
  return JSON.stringify({
    version: OPERATION_SAVE_VERSION,
    active: progress.active,
    best: progress.best,
    history: progress.history.slice(-OPERATION_HISTORY_LIMIT),
    replay: progress.replay,
  })
}

export function parseProgress(text: string | null): OperationProgress | null {
  if (text == null || text === '') return emptyProgress()
  try {
    const value = JSON.parse(text) as Partial<OperationProgress>
    if (value.version !== OPERATION_SAVE_VERSION) return null
    if (value.active != null && !isAttempt(value.active)) return null
    if (value.best != null && !isBest(value.best)) return null
    if (!Array.isArray(value.history) || value.history.some(entry => !isBest(entry))) return null
    if (value.replay != null && !isStoredTranscript(value.replay)) return null
    return {
      version: OPERATION_SAVE_VERSION,
      active: value.active ?? null,
      best: value.best ?? null,
      history: value.history.slice(-OPERATION_HISTORY_LIMIT),
      replay: value.replay ?? null,
    }
  } catch {
    return null
  }
}

function isStoredTranscript(value: unknown): value is OperationTranscript {
  if (!value || typeof value !== 'object') return false
  const transcript = value as OperationTranscript
  if (transcript.version !== 1 || transcript.id !== OPERATION_ID) return false
  if (!Number.isFinite(transcript.seed) || !isRouteChoice(transcript.route) || !isEnergyChoice(transcript.energy)) return false
  if (!transcript.samples) return false
  return OPERATION_STAGES.every(id => {
    const stage = transcript.samples[id]
    if (!Array.isArray(stage) || stage.length < 2) return false
    // Legacy hand-built transcripts use stage-local clocks. Preserve those,
    // while rejecting traces that cannot be safely replayed or measured.
    return stage.every((sample, index) => isFlightSample(sample)
      && (index === 0 || sample.t >= stage[index - 1]!.t))
  })
}

export function loadProgress(store: OperationStore): OperationProgress | null {
  try {
    return parseProgress(store.read())
  } catch {
    return null
  }
}

export function writeProgress(store: OperationStore, progress: OperationProgress): boolean {
  try {
    store.write(serializeProgress(progress))
    return true
  } catch {
    return false
  }
}

/** Keep the in-progress attempt, replace the best only on a strictly higher finish, and remember the latest replay. */
export function commitAttempt(
  progress: OperationProgress,
  attempt: OperationAttempt,
  replay: OperationTranscript | null = null,
): OperationProgress {
  const finished = toBest(attempt)
  const matchingReplay = replay && finished && replay.version === 1 && replay.id === finished.id
    && replay.seed === finished.seed && replay.route === finished.route && replay.energy === finished.energy
    ? replay : null
  const history = finished
    ? [...progress.history, finished].slice(-OPERATION_HISTORY_LIMIT)
    : progress.history
  const best = finished && (progress.best == null || finished.score > progress.best.score)
    ? finished
    : progress.best
  return {
    version: OPERATION_SAVE_VERSION,
    active: attempt,
    best,
    history,
    replay: finished ? matchingReplay : progress.replay,
  }
}

export function clearActive(progress: OperationProgress): OperationProgress {
  return { ...progress, active: null }
}

export function stageIdsFromUnknown(value: unknown): OperationStageId[] {
  if (!Array.isArray(value)) return []
  return value.filter(isOperationStageId)
}
