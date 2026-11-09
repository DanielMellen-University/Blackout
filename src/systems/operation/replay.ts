import { chooseEnergy, chooseRoute, createAttempt, recordStage, type AttemptStep, type OperationAttempt } from './attempt'
import { isEnergyChoice, isRouteChoice, type EnergyChoice, type RouteChoice } from './choices'
import { OPERATION_ID, OPERATION_STAGES, type OperationStageId } from './identity'
import { buildOperationPlan, type OperationPlan } from './plan'
import { isFlightSample, type FlightSample } from './samples'
import { normalizeOperationSeed } from './seed'

export interface OperationTranscript {
  version: 1
  id: typeof OPERATION_ID
  seed: number
  route: RouteChoice
  energy: EnergyChoice
  samples: Record<OperationStageId, FlightSample[]>
}

export function createTranscript(
  seed: number,
  route: RouteChoice,
  energy: EnergyChoice,
  samples: Record<OperationStageId, readonly FlightSample[]>,
): OperationTranscript | null {
  if (!isRouteChoice(route) || !isEnergyChoice(energy)) return null
  const stored = {} as Record<OperationStageId, FlightSample[]>
  for (const id of OPERATION_STAGES) {
    const stage = samples[id]
    if (!stage || stage.length < 2 || stage.some(sample => !isFlightSample(sample))) return null
    stored[id] = stage.map(sample => ({ ...sample }))
  }
  return {
    version: 1,
    id: OPERATION_ID,
    seed: normalizeOperationSeed(seed),
    route,
    energy,
    samples: stored,
  }
}

export function transcriptPlan(transcript: OperationTranscript): OperationPlan {
  return buildOperationPlan(transcript.seed, transcript.route, transcript.energy)
}

/** Rescore a stored trace. The same samples and decisions always return the same attempt. */
export function replayOperation(transcript: OperationTranscript): AttemptStep {
  if (transcript.id !== OPERATION_ID || transcript.version !== 1) {
    const attempt = createAttempt(transcript.seed)
    return { ok: false, reason: 'wrong-operation', attempt }
  }
  let step: AttemptStep = { ok: true, attempt: createAttempt(transcript.seed) }
  step = recordStage(step.attempt, transcript.samples.ingress)
  if (!step.ok || step.attempt.phase === 'failed') return step
  step = chooseRoute(step.attempt, transcript.route)
  if (!step.ok) return step
  step = recordStage(step.attempt, transcript.samples.transit)
  if (!step.ok || step.attempt.phase === 'failed') return step
  step = chooseEnergy(step.attempt, transcript.energy)
  if (!step.ok) return step
  return recordStage(step.attempt, transcript.samples.egress)
}

export function canonicalTranscript(transcript: OperationTranscript): string {
  return JSON.stringify({
    version: transcript.version,
    id: transcript.id,
    seed: transcript.seed,
    route: transcript.route,
    energy: transcript.energy,
    samples: {
      ingress: transcript.samples.ingress,
      transit: transcript.samples.transit,
      egress: transcript.samples.egress,
    },
  })
}

export function sameAttemptScore(left: OperationAttempt, right: OperationAttempt): boolean {
  return left.phase === right.phase && left.score === right.score && left.failure === right.failure
}
