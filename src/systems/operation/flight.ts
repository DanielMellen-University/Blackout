import { Quaternion, Vector3 } from 'three'
import { Aircraft } from '../../aircraft/Aircraft'
import { getWorldSeed, setWorldSeed } from '../../world/noise'
import { getTerrainProfile, setTerrainProfile, type TerrainProfile } from '../../world/TerrainProfile'
import { clearOpsPad, getOpsPad, setOpsPad, type OpsPadSnapshot } from '../../world/terrainSample'
import { chooseEnergy, chooseRoute, createAttempt, recordStage, type AttemptStep, type OperationAttempt } from './attempt'
import { captureFlightSample } from './capture'
import type { OperationStageId } from './identity'
import { OPERATION_APPROACH_LEAD_M, OPERATION_DT_SEC } from './layout'
import { pilotForStage, type PilotPose } from './pilot'
import { clampOperationStick, type OperationStick } from './stick'
import { buildOperationPlan, stageSpec } from './plan'
import { createTranscript, type OperationTranscript } from './replay'
import type { FlightSample } from './samples'
import { normalizeOperationSeed } from './seed'
import { OPERATION_TERRAIN } from './terrain'

const MAX_STEPS = 90 * 60
const START_SPEED_MPS = 150

export interface OperationFlightPose {
  x: number
  y: number
  z: number
  qx: number
  qy: number
  qz: number
  qw: number
  throttle: number
  effectivePower: number
  boost: boolean
  speed: number
}

interface HeldWorld {
  seed: number
  profile: Readonly<TerrainProfile> | null
  pad: OpsPadSnapshot | null
}

let presentationSeed: number | null = null
let heldWorld: HeldWorld | null = null

interface FlightBody {
  aircraft: Aircraft
  time: number
  steps: number
  maxSteps: number
  closed: boolean
}

const bodies = new WeakMap<OperationFlight, FlightBody>()

/** One aircraft flying the ridge relay, paused at the two decisions. */
export interface OperationFlight {
  seed: number
  attempt: OperationAttempt
  samples: Record<OperationStageId, FlightSample[]>
  live: FlightSample | null
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

function liveStage(flight: OperationFlight): OperationStageId | null {
  const phase = flight.attempt.phase
  if (phase === 'ingress' || phase === 'transit' || phase === 'egress') return phase
  return null
}

function withOperationWorld(seed: number, run: () => void): void {
  const previousSeed = getWorldSeed()
  const previousProfile = getTerrainProfile()
  const pad = getOpsPad()
  setWorldSeed(seed)
  setTerrainProfile(OPERATION_TERRAIN)
  clearOpsPad()
  try {
    run()
  } finally {
    restoreWorld(previousSeed, previousProfile, pad)
  }
}

function applyPresentation(): void {
  if (presentationSeed === null) return
  setWorldSeed(presentationSeed)
  setTerrainProfile(OPERATION_TERRAIN)
  clearOpsPad()
}

function restoreWorld(seed: number, profile: Readonly<TerrainProfile> | null, pad: OpsPadSnapshot | null): void {
  if (presentationSeed !== null) {
    applyPresentation()
    return
  }
  setWorldSeed(seed)
  setTerrainProfile(profile)
  if (pad) setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
  else clearOpsPad()
}

/**
 * Keep the operation terrain in place while the 3D scene is showing it.
 * Passing null puts back the world that was current when the hold began.
 */
export function holdOperationPresentation(seed: number | null): void {
  if (seed !== null) {
    if (!heldWorld) {
      heldWorld = { seed: getWorldSeed(), profile: getTerrainProfile(), pad: getOpsPad() }
    }
    presentationSeed = normalizeOperationSeed(seed)
    applyPresentation()
    return
  }
  if (!heldWorld) {
    presentationSeed = null
    return
  }
  const previous = heldWorld
  heldWorld = null
  presentationSeed = null
  restoreWorld(previous.seed, previous.profile, previous.pad)
}

/** Start at ingress. The surrounding world seed and pad are put back after every step. */
export function openOperationFlight(seed: number, maxSteps = MAX_STEPS): OperationFlight {
  const safeSeed = normalizeOperationSeed(seed)
  const opening = buildOperationPlan(safeSeed, null, null)
  const lateral = opening.stages[0]!.lateralM
  const aircraft = new Aircraft()
  const previousSeed = getWorldSeed()
  const previousProfile = getTerrainProfile()
  const pad = getOpsPad()
  setWorldSeed(safeSeed)
  setTerrainProfile(OPERATION_TERRAIN)
  clearOpsPad()
  try {
    aircraft.reset({ x: lateral, y: opening.stages[0]!.altitudeM, z: -OPERATION_APPROACH_LEAD_M, yaw: 0 })
    aircraft.velocity.set(0, 0, START_SPEED_MPS)
    aircraft.controls.gearDown = false
    aircraft.controls.boost = false
    aircraft.controls.stabilityAssist = false
    aircraft.snapDisplay()
  } finally {
    restoreWorld(previousSeed, previousProfile, pad)
  }
  const flight: OperationFlight = {
    seed: safeSeed,
    attempt: createAttempt(safeSeed),
    samples: { ingress: [], transit: [], egress: [] },
    live: null,
  }
  bodies.set(flight, {
    aircraft,
    time: 0,
    steps: 0,
    maxSteps: Number.isFinite(maxSteps) ? Math.max(1, Math.floor(maxSteps)) : MAX_STEPS,
    closed: false,
  })
  return flight
}

/** Live aircraft pose for the 3D scene. Null once the flight is closed. */
export function operationFlightPose(flight: OperationFlight): OperationFlightPose | null {
  const body = bodies.get(flight)
  if (!body || body.closed) return null
  const position = body.aircraft.position
  const orientation = body.aircraft.orientation
  return {
    x: position.x,
    y: position.y,
    z: position.z,
    qx: orientation.x,
    qy: orientation.y,
    qz: orientation.z,
    qw: orientation.w,
    throttle: body.aircraft.engineState.lever,
    effectivePower: body.aircraft.engineState.effectivePower,
    boost: body.aircraft.engineState.afterburnerActive,
    speed: body.aircraft.speed,
  }
}

/** Further steps become no-ops. Samples already recorded stay on the flight. */
export function closeOperationFlight(flight: OperationFlight): void {
  const body = bodies.get(flight)
  if (!body || body.closed) return
  body.closed = true
}

/**
 * Advance the live stage by up to `maxSteps` physics steps.
 * Stops when the stage ends so the caller can ask for the next decision.
 */
export function stepOperationFlight(flight: OperationFlight, maxSteps = 1, stick?: OperationStick | null): OperationFlight {
  const body = bodies.get(flight)
  if (!body || body.closed) return flight
  const budget = Number.isFinite(maxSteps) ? Math.max(0, Math.floor(maxSteps)) : 0
  if (budget === 0 || !liveStage(flight)) return flight
  withOperationWorld(flight.seed, () => {
    for (let n = 0; n < budget; n += 1) {
      const id = liveStage(flight)
      if (!id) break
      if (body.steps >= body.maxSteps) {
        flight.attempt = recordStage(flight.attempt, flight.samples[id]).attempt
        break
      }
      const plan = buildOperationPlan(flight.seed, flight.attempt.route, flight.attempt.energy)
      const spec = stageSpec(plan, id)
      const aircraft = body.aircraft
      const player = stick == null ? null : clampOperationStick(stick)
      const command = player ?? pilotForStage(id, flight.attempt.route, flight.attempt.energy, poseOf(aircraft, spec.altitudeM, spec.lateralM))
      aircraft.controls.pitch = command.pitch
      aircraft.controls.roll = command.roll
      aircraft.controls.yaw = command.yaw
      aircraft.controls.throttle = command.throttle
      aircraft.controls.boost = command.boost
      aircraft.controls.gearDown = false
      aircraft.controls.airbrake = player?.airbrake === true
      aircraft.controls.stabilityAssist = player != null
      aircraft.step(OPERATION_DT_SEC, body.time * 1000)
      body.time += OPERATION_DT_SEC
      body.steps += 1
      const sample: FlightSample = captureFlightSample(aircraft, body.time)
      flight.samples[id].push(sample)
      flight.live = sample
      const crossed = aircraft.position.z >= spec.endZ
      const stopped = aircraft.status !== 'ok' || aircraft.onGround
      if (!crossed && !stopped) continue
      flight.attempt = recordStage(flight.attempt, flight.samples[id]).attempt
      break
    }
  })
  return flight
}

/** Valley or ridge, only while the flight is waiting after ingress. */
export function chooseOperationRoute(flight: OperationFlight, choice: unknown): AttemptStep {
  const body = bodies.get(flight)
  if (!body || body.closed) return { ok: false, reason: 'closed', attempt: flight.attempt }
  const step = chooseRoute(flight.attempt, choice)
  if (step.ok) flight.attempt = step.attempt
  return step
}

/** Conserve or commit, only while the flight is waiting after transit. */
export function chooseOperationEnergy(flight: OperationFlight, choice: unknown): AttemptStep {
  const body = bodies.get(flight)
  if (!body || body.closed) return { ok: false, reason: 'closed', attempt: flight.attempt }
  const step = chooseEnergy(flight.attempt, choice)
  if (step.ok) flight.attempt = step.attempt
  return step
}

/** Transcript of a finished airborne run, or null when a stage is still open. */
export function operationFlightTranscript(flight: OperationFlight): OperationTranscript | null {
  if (flight.attempt.phase !== 'complete' || !flight.attempt.route || !flight.attempt.energy) return null
  return createTranscript(flight.seed, flight.attempt.route, flight.attempt.energy, flight.samples)
}
