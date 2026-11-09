import { stageBoost, stageThrottle } from './bands'
import type { EnergyChoice, RouteChoice } from './choices'
import type { OperationStageId } from './identity'

export interface PilotPose {
  altitudeErrorM: number
  verticalSpeed: number
  pitchRad: number
  rollRad: number
  headingRad: number
  lateralErrorM: number
}

export interface PilotCommand {
  pitch: number
  roll: number
  yaw: number
  throttle: number
  boost: boolean
}

function axis(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value))
}

/** Hold the briefed altitude and the seeded line. Positive pitch raises the nose. */
export function commandPilot(pose: PilotPose, throttle: number, boost: boolean): PilotCommand {
  return {
    pitch: axis(pose.altitudeErrorM * 0.006 - pose.verticalSpeed * 0.1 - pose.pitchRad * 0.5),
    roll: axis(-pose.rollRad * 1.4 + pose.lateralErrorM * 0.004),
    yaw: axis(pose.lateralErrorM * 0.006 - pose.headingRad * 1.1),
    throttle: Number.isFinite(throttle) ? Math.max(0, Math.min(1, throttle)) : 0,
    boost,
  }
}

export function pilotForStage(
  id: OperationStageId,
  route: RouteChoice | null,
  energy: EnergyChoice | null,
  pose: PilotPose,
): PilotCommand {
  return commandPilot(pose, stageThrottle(id, route, energy), stageBoost(id, energy))
}
