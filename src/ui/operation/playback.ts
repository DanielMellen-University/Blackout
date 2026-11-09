import { createAttempt, type OperationAttempt } from '../../systems/operation/attempt'
import type { OperationStageId } from '../../systems/operation/identity'
import type { OperationTranscript } from '../../systems/operation/replay'
import type { FlightSample } from '../../systems/operation/samples'
import { operationHudModel, type OperationDecision, type OperationHudModel } from './hud'

export type OperationReplayCue =
  | { kind: 'sample'; stage: OperationStageId; sample: FlightSample }
  | { kind: 'choice'; choice: OperationDecision }

/** Ingress samples, the route decision, transit, the energy decision, then egress. */
export function operationReplayCues(transcript: OperationTranscript): OperationReplayCue[] {
  const cues: OperationReplayCue[] = []
  for (const sample of transcript.samples.ingress) cues.push({ kind: 'sample', stage: 'ingress', sample })
  cues.push({ kind: 'choice', choice: transcript.route })
  for (const sample of transcript.samples.transit) cues.push({ kind: 'sample', stage: 'transit', sample })
  cues.push({ kind: 'choice', choice: transcript.energy })
  for (const sample of transcript.samples.egress) cues.push({ kind: 'sample', stage: 'egress', sample })
  return cues
}

function attemptForCue(transcript: OperationTranscript, cue: OperationReplayCue): OperationAttempt {
  const attempt = createAttempt(transcript.seed)
  if (cue.kind === 'sample' && cue.stage === 'ingress') return attempt
  if (cue.kind === 'choice' && (cue.choice === 'valley' || cue.choice === 'ridge')) {
    return { ...attempt, phase: 'route-choice' }
  }
  if (cue.kind === 'sample' && cue.stage === 'transit') {
    return { ...attempt, phase: 'transit', route: transcript.route }
  }
  if (cue.kind === 'choice') {
    return { ...attempt, phase: 'energy-choice', route: transcript.route }
  }
  return { ...attempt, phase: 'egress', route: transcript.route, energy: transcript.energy }
}

/** Stage HUD for one stored cue. The score stays on the results screen. */
export function operationReplayHud(
  transcript: OperationTranscript,
  cue: OperationReplayCue,
  live: FlightSample | null,
): OperationHudModel {
  const model = operationHudModel(attemptForCue(transcript, cue), live, { scoreLabel: 'Replay' })
  return cue.kind === 'choice' ? { ...model, chosen: cue.choice } : model
}
