import { Quaternion, Vector3 } from 'three'
import { Aircraft } from '../../aircraft/Aircraft'
import { getWorldSeed, setWorldSeed } from '../../world/noise'
import { getTerrainProfile, setTerrainProfile } from '../../world/TerrainProfile'
import { clearOpsPad, sampleTerrainSurfaceHeightFast } from '../../world/terrainSample'
import {
  chooseEnergy,
  chooseRoute,
  createAttempt,
  recordStage,
  type OperationAttempt,
} from './attempt'
import type { EnergyChoice, RouteChoice } from './choices'
import { OPERATION_STAGES, type OperationStageId } from './identity'
import { OPERATION_DT_SEC } from './layout'
import { pilotForStage, type PilotPose } from './pilot'
import { buildOperationPlan, stageSpec } from './plan'
import { createTranscript, type OperationTranscript } from './replay'
import type { FlightSample } from './samples'
import type { StageResult } from './score'
import { normalizeOperationSeed } from './seed'
import { OPERATION_TERRAIN } from './terrain'

const MAX_STEPS = 90 * 60
const START_SPEED_MPS = 150
const START_LEAD_M = 200

export interface MeasuredStage {
  id: OperationStageId
  passed: boolean
  elapsedSec: number
  score: number
  peakSpeedMps: number
  minClearanceM: number
  endAltitudeM: number
  steps: number
}

export interface MeasuredOperation {
  seed: number
  route: RouteChoice
  energy: EnergyChoice
  passed: boolean
  score: number
  failure: OperationAttempt['failure']
  stages: MeasuredStage[]
  samples: Record<OperationStageId, FlightSample[]>
  attempt: OperationAttempt
  transcript: OperationTranscript | null
  steps: number
}

function attitude(orientation: Quaternion): { pitch: number; heading: number; roll: number } {
  const forward = new Vector3(0, 0, 1).applyQuaternion(orientation)
  const up = new Vector3(0, 1, 0).applyQuaternion(orientation.clone().invert())
  return {
    pitch: Math.asin(Math.max(-1, Math.min(1, forward.y))),
    heading: Math.atan2(forward.x, forward.z),
    roll: Math.atan2(-up.x, up.y),
  }
}

function poseOf(aircraft: Aircraft, altitudeM: number, lateralM: number): PilotPose {
  const pose = attitude(aircraft.orientation)
  return {
    altitudeErrorM: altitudeM - aircraft.position.y,
    verticalSpeed: aircraft.velocity.y,
    pitchRad: pose.pitch,
    rollRad: pose.roll,
    headingRad: pose.heading,
    lateralErrorM: lateralM - aircraft.position.x,
  }
}

function emptySamples(): Record<OperationStageId, FlightSample[]> {
  return { ingress: [], transit: [], egress: [] }
}

/**
 * Fly all three stages with the real aircraft model.
 * Decisions are applied between stages and the aircraft is not reset.
 */
export function flyOperation(seed: number, route: RouteChoice, energy: EnergyChoice): MeasuredOperation {
  const previousSeed = getWorldSeed()
  const previousProfile = getTerrainProfile()
  const safeSeed = normalizeOperationSeed(seed)
  setWorldSeed(safeSeed)
  setTerrainProfile(OPERATION_TERRAIN)
  clearOpsPad()
  try {
    return flyWithWorld(safeSeed, route, energy)
  } finally {
    setWorldSeed(previousSeed)
    setTerrainProfile(previousProfile)
    clearOpsPad()
  }
}

function flyWithWorld(seed: number, route: RouteChoice, energy: EnergyChoice): MeasuredOperation {
  const opening = buildOperationPlan(seed, null, null)
  const lateral = opening.stages[0]!.lateralM
  const aircraft = new Aircraft()
  aircraft.reset({ x: lateral, y: opening.stages[0]!.altitudeM, z: -START_LEAD_M, yaw: 0 })
  aircraft.velocity.set(0, 0, START_SPEED_MPS)
  aircraft.controls.gearDown = false
  aircraft.controls.boost = false
  aircraft.controls.stabilityAssist = false
  aircraft.snapDisplay()

  let attempt = createAttempt(seed)
  const samples = emptySamples()
  const stageSteps: Record<OperationStageId, number> = { ingress: 0, transit: 0, egress: 0 }
  let time = 0
  let stageCursor = 0
  let steps = 0

  for (; steps < MAX_STEPS && stageCursor < OPERATION_STAGES.length; steps += 1) {
    const id = OPERATION_STAGES[stageCursor]!
    const plan = buildOperationPlan(seed, attempt.route, attempt.energy)
    const spec = stageSpec(plan, id)
    const command = pilotForStage(id, attempt.route, attempt.energy, poseOf(aircraft, spec.altitudeM, spec.lateralM))
    aircraft.controls.pitch = command.pitch
    aircraft.controls.roll = command.roll
    aircraft.controls.yaw = command.yaw
    aircraft.controls.throttle = command.throttle
    aircraft.controls.boost = command.boost
    aircraft.controls.gearDown = false
    aircraft.controls.airbrake = false
    aircraft.step(OPERATION_DT_SEC, time * 1000)
    time += OPERATION_DT_SEC
    stageSteps[id] += 1
    const clearance = aircraft.position.y - sampleTerrainSurfaceHeightFast(aircraft.position.x, aircraft.position.z)
    samples[id].push({
      t: time,
      x: aircraft.position.x,
      y: aircraft.position.y,
      z: aircraft.position.z,
      speed: aircraft.speed,
      clearance,
      airborne: aircraft.status === 'ok' && !aircraft.onGround,
    })
    const crossed = aircraft.position.z >= spec.endZ
    const stopped = aircraft.status !== 'ok' || aircraft.onGround
    if (!crossed && !stopped) continue
    const recorded = recordStage(attempt, samples[id])
    attempt = recorded.attempt
    if (attempt.phase === 'failed') break
    if (id === 'ingress') {
      const chosen = chooseRoute(attempt, route)
      if (!chosen.ok) break
      attempt = chosen.attempt
    } else if (id === 'transit') {
      const chosen = chooseEnergy(attempt, energy)
      if (!chosen.ok) break
      attempt = chosen.attempt
    }
    stageCursor += 1
  }

  if (stageCursor < OPERATION_STAGES.length && attempt.phase !== 'failed') {
    const id = OPERATION_STAGES[stageCursor]!
    const recorded = recordStage(attempt, samples[id])
    attempt = recorded.attempt
  }

  const transcript = attempt.phase === 'complete'
    ? createTranscript(seed, route, energy, samples)
    : null
  const stages = OPERATION_STAGES.flatMap(id => {
    const result: StageResult | undefined = attempt.stages[id]
    if (!result) return []
    return [{
      id,
      passed: result.passed,
      elapsedSec: result.elapsedSec,
      score: result.score,
      peakSpeedMps: result.peakSpeedMps,
      minClearanceM: result.minClearanceM,
      endAltitudeM: result.endAltitudeM,
      steps: stageSteps[id],
    }]
  })
  return {
    seed,
    route,
    energy,
    passed: attempt.phase === 'complete',
    score: attempt.score,
    failure: attempt.failure,
    stages,
    samples,
    attempt,
    transcript,
    steps,
  }
}
