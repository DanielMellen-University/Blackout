import type { OperationFlightPose } from '../../systems/operation/flight'

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
