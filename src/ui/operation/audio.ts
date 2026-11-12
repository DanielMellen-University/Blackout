import type { OperationFlightPose } from '../../systems/operation/flight'
import type { FlightAudio } from '../../audio/FlightAudio'

export interface OperationAudioInputs {
  throttle: number
  effectivePower: number
  boost: boolean
  speed: number
}

/** Map the stepped aircraft's resolved state into the existing flight mixer. */
export function operationAudioInputs(pose: OperationFlightPose | null): OperationAudioInputs | null {
  if (!pose) return null
  return {
    throttle: pose.throttle,
    effectivePower: pose.effectivePower,
    boost: pose.boost,
    speed: pose.speed,
  }
}

/** Apply the operation override to the frame sent by main to FlightAudio. */
export function applyOperationAudioInputs(
  frame: Pick<Parameters<FlightAudio['update']>[0], keyof OperationAudioInputs>,
  operation: OperationAudioInputs | null | undefined,
): void {
  if (operation) Object.assign(frame, operation)
}

export interface FlightAudioGate {
  playing: boolean
  operationActive: boolean
  audioMuted: boolean
  hidden: boolean
  paused: boolean
  resultsOpen: boolean
  crashed: boolean
  crashCinematic: boolean
}

/** Shared by frame routing and visibility recovery. */
export function flightAudioMuted(state: FlightAudioGate): boolean {
  return state.audioMuted || state.hidden || (!state.playing && !state.operationActive) || state.paused || state.resultsOpen ||
    (!state.operationActive && state.crashed && !state.crashCinematic)
}

/** Resolve both the sustained burner flag and its edge cue from the same aircraft. */
export function flightAfterburnerAudio(
  previous: boolean,
  sceneBoost: boolean,
  operation: OperationAudioInputs | null | undefined,
  gate: FlightAudioGate & { simLive: boolean },
): { active: boolean; cue: 'ab' | 'ab-off' | null } {
  const active = operation?.boost ?? sceneBoost
  const audible = !flightAudioMuted(gate) &&
    (!!operation || (gate.simLive && gate.playing && !gate.crashed))
  return { active, cue: audible && active !== previous ? active ? 'ab' : 'ab-off' : null }
}
