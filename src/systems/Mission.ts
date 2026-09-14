import {
  AdditiveBlending,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three'
import { sampleTerrainHeight } from '../world/terrainSample'
import { disposeObjectTree } from '../core/dispose'

export type MissionStatus = 'idle' | 'live' | 'complete'

export interface MissionHud {
  status: MissionStatus
  current: number
  total: number
  /** Meters to the active gate, or 0 if complete. */
  dist: number
  /** Radians, 0 = ahead, + = right of the nose. Null if no live gate. */
  bearing: number | null
  /** Gate altitude minus aircraft altitude (m). */
  altDelta: number
  label: string
}

interface Gate {
  root: Group
  pos: Vector3
  fwd: Vector3
  radius: number
  passed: boolean
  lastAlong: number
}

const GATE_COUNT = 5
const GATE_RADIUS = 38
const ROUTE_RADIUS = 980
const ROUTE_RADIUS_VARIATION = 150
const ROUTE_ANGLE_VARIATION = 0.12
const ROUTE_CLEARANCE = 120
const ROUTE_SEGMENT_SAMPLES = 4
const PRESENTATION_FALLBACK_STEP_MS = 1000 / 60
const _to = new Vector3()
const _radial = new Vector3()
const _prevTo = new Vector3()

export interface MissionRoutePoint {
  x: number
  y: number
  z: number
  fwdX: number
  fwdZ: number
}

export type MissionRouteProfile = 'orbit' | 'sweep' | 'slalom' | 'free'
export type MissionRouteDifficulty = 'relaxed' | 'standard' | 'technical'
export type MissionChallenge = 'approach' | 'range' | 'precision'
export type MissionRouteModifier = 'steady' | 'tempo' | 'altitude'
export type MissionScoringFocus = 'balanced' | 'gates' | 'pace' | 'landing'

export type GateQualityLabel = 'PERFECT' | 'CLEAN' | 'EDGE' | 'MISS'

/** Turn a normalized ring-center score into one stable event label. */
export function gateQualityLabel(quality: number): GateQualityLabel {
  const safe = Number.isFinite(quality) ? MathUtils.clamp(quality, 0, 1) : 0
  if (safe >= 0.82) return 'PERFECT'
  if (safe >= 0.5) return 'CLEAN'
  if (safe > 0) return 'EDGE'
  return 'MISS'
}

export interface MissionRouteSummary {
  profile: MissionRouteProfile
  label: string
  challenge: MissionChallenge
  challengeLabel: string
  modifier: MissionRouteModifier
  modifierLabel: string
  scoringFocus: MissionScoringFocus
  scoringFocusLabel: string
  difficulty: MissionRouteDifficulty
  lengthMeters: number
  maxTurnDegrees: number
  minClearanceMeters: number
  maxAltitudeMeters: number
}

const ROUTE_PROFILE_LABELS: Record<MissionRouteProfile, string> = {
  orbit: 'ORBIT',
  sweep: 'SWEEP',
  slalom: 'SLALOM',
  free: 'FREE FLIGHT',
}

const MISSION_CHALLENGE_LABELS: Record<MissionChallenge, string> = {
  approach: 'APPROACH',
  range: 'RANGE',
  precision: 'PRECISION',
}

const ROUTE_MODIFIER_LABELS: Record<MissionRouteModifier, string> = {
  steady: 'STEADY',
  tempo: 'TEMPO',
  altitude: 'ALTITUDE',
}

const SCORING_FOCUS_LABELS: Record<MissionScoringFocus, string> = {
  balanced: 'BALANCED',
  gates: 'GATES',
  pace: 'PACE',
  landing: 'LANDING',
}

export function routeProfileForSpawn(
  spawnX: number,
  spawnZ: number,
  spawnYaw = 0,
): MissionRouteProfile {
  const safeX = finiteOr(spawnX, 0)
  const safeZ = finiteOr(spawnZ, 0)
  const safeYaw = finiteOr(spawnYaw, 0)
  const hash = Math.abs(Math.floor(
    safeX * 0.0023 + safeZ * 0.0017 + safeYaw * 2.7,
  ))
  return (['orbit', 'sweep', 'slalom'] as const)[hash % 3]!
}

export function routeProfileLabel(profile: MissionRouteProfile): string {
  return ROUTE_PROFILE_LABELS[profile] ?? ROUTE_PROFILE_LABELS.orbit
}

export function missionChallengeForProfile(profile: MissionRouteProfile): MissionChallenge {
  if (profile === 'sweep') return 'range'
  if (profile === 'slalom') return 'precision'
  return 'approach'
}

export function missionChallengeLabel(challenge: MissionChallenge): string {
  return MISSION_CHALLENGE_LABELS[challenge] ?? MISSION_CHALLENGE_LABELS.approach
}

export function routeModifierForSpawn(
  spawnX: number,
  spawnZ: number,
  spawnYaw = 0,
  profile = routeProfileForSpawn(spawnX, spawnZ, spawnYaw),
): MissionRouteModifier {
  const safeX = finiteOr(spawnX, 0)
  const safeZ = finiteOr(spawnZ, 0)
  const safeYaw = finiteOr(spawnYaw, 0)
  const profileBias = profile === 'sweep' ? 1 : profile === 'slalom' ? 2 : 0
  const hash = Math.abs(Math.floor(
    safeX * 0.0019 + safeZ * 0.0013 + safeYaw * 2.1 + profileBias,
  ))
  return (['steady', 'tempo', 'altitude'] as const)[hash % 3]!
}

export function routeModifierLabel(modifier: MissionRouteModifier): string {
  return ROUTE_MODIFIER_LABELS[modifier] ?? ROUTE_MODIFIER_LABELS.steady
}

export function scoringFocusForModifier(modifier: MissionRouteModifier): MissionScoringFocus {
  if (modifier === 'tempo') return 'pace'
  if (modifier === 'altitude') return 'landing'
  return 'balanced'
}

export function scoringFocusLabel(focus: MissionScoringFocus): string {
  return SCORING_FOCUS_LABELS[focus] ?? SCORING_FOCUS_LABELS.balanced
}

/**
 * Build a varied route whose first leg follows the runway heading and whose
 * sampled straight segments stay above the generated terrain.
 */
export function buildMissionRoute(
  spawnX: number,
  spawnY: number,
  spawnZ: number,
  spawnYaw: number,
  profile = routeProfileForSpawn(spawnX, spawnZ, spawnYaw),
  modifier = routeModifierForSpawn(spawnX, spawnZ, spawnYaw, profile),
): MissionRoutePoint[] {
  const safeSpawnX = finiteOr(spawnX, 0)
  const safeSpawnY = finiteOr(spawnY, 0)
  const safeSpawnZ = finiteOr(spawnZ, 0)
  const safeSpawnYaw = finiteOr(spawnYaw, 0)
  const seedPhase = Math.sin(safeSpawnX * 0.00031 + safeSpawnZ * 0.00017)
  const forwardX = Math.sin(safeSpawnYaw)
  const forwardZ = Math.cos(safeSpawnYaw)
  const rightX = Math.cos(safeSpawnYaw)
  const rightZ = -Math.sin(safeSpawnYaw)
  if (profile === 'free') return []
  const offsets = routeOffsets(profile, seedPhase, modifier)
  const points = offsets.map((offset, i) => ({
    x: safeSpawnX + forwardX * offset.forward + rightX * offset.right,
    y: safeSpawnY + offset.height + i * (profile === 'slalom' ? 12 : 22),
    z: safeSpawnZ + forwardZ * offset.forward + rightZ * offset.right,
  }))

  let previousX = safeSpawnX
  let previousY = safeSpawnY
  let previousZ = safeSpawnZ
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!
    let requiredY = Math.max(point.y, previousY)
    for (let sample = 1; sample <= ROUTE_SEGMENT_SAMPLES; sample++) {
      const t = sample / (ROUTE_SEGMENT_SAMPLES + 1)
      const x = previousX + (point.x - previousX) * t
      const z = previousZ + (point.z - previousZ) * t
      const ground = sampleTerrainHeight(x, z)
      if (Number.isFinite(ground)) {
        const needed = ground + ROUTE_CLEARANCE
        const endpointY = (needed - previousY * (1 - t)) / t
        requiredY = Math.max(requiredY, endpointY)
      }
    }
    point.y = Math.max(point.y, requiredY)
    if (i > 0) points[i - 1]!.y = Math.max(points[i - 1]!.y, requiredY)
    previousX = point.x
    previousY = point.y
    previousZ = point.z
  }

  let priorX = safeSpawnX
  let priorZ = safeSpawnZ
  return points.map((point) => {
    const dx = point.x - priorX
    const dz = point.z - priorZ
    const length = Math.hypot(dx, dz)
    const invLength = length > 1e-6 ? 1 / length : 0
    const routePoint: MissionRoutePoint = {
      x: point.x,
      y: point.y,
      z: point.z,
      fwdX: dx * invLength,
      fwdZ: dz * invLength,
    }
    priorX = point.x
    priorZ = point.z
    return routePoint
  })
}

interface RouteOffset {
  forward: number
  right: number
  height: number
}

function routeOffsets(
  profile: MissionRouteProfile,
  seedPhase: number,
  modifier: MissionRouteModifier,
): RouteOffset[] {
  const cadence = modifier === 'tempo'
    ? [1, 0.8, 1.18, 0.86, 1.08]
    : [1, 1, 1, 1, 1]
  const altitudeWave = modifier === 'altitude'
    ? [0, 58, 132, 68, 188]
    : [0, 0, 0, 0, 0]
  const shape = (offset: RouteOffset, index: number): RouteOffset => ({
    forward: offset.forward * cadence[index]!,
    right: offset.right * cadence[index]!,
    height: offset.height + altitudeWave[index]!,
  })
  if (profile === 'sweep') {
    const spread = 560 + seedPhase * 90
    return [
      { forward: 760, right: 0, height: 118 },
      { forward: 1040, right: spread, height: 142 },
      { forward: 360, right: spread * 1.08, height: 170 },
      { forward: -420, right: spread * 0.62, height: 198 },
      { forward: -760, right: -120, height: 168 },
    ].map(shape)
  }
  if (profile === 'slalom') {
    const spread = 520 + seedPhase * 80
    return [
      { forward: 680, right: 0, height: 98 },
      { forward: 1040, right: -spread, height: 154 },
      { forward: 520, right: spread * 0.96, height: 116 },
      { forward: -180, right: -spread * 1.08, height: 176 },
      { forward: -760, right: spread * 0.12, height: 142 },
    ].map(shape)
  }

  return Array.from({ length: GATE_COUNT }, (_, i) => {
    const angle = seedPhase * ROUTE_ANGLE_VARIATION +
      (i / GATE_COUNT) * Math.PI * 2 +
      Math.sin(seedPhase * 2.1 + i * 1.73) * ROUTE_ANGLE_VARIATION
    const radius = ROUTE_RADIUS +
      Math.sin(seedPhase * 1.7 + i * 2.21) * ROUTE_RADIUS_VARIATION
    return shape({
      forward: Math.cos(angle) * radius,
      right: Math.sin(angle) * radius,
      height: 104,
    }, i)
  })
}

export function summarizeMissionRoute(
  spawnX: number,
  spawnY: number,
  spawnZ: number,
  route: readonly MissionRoutePoint[],
  profile: MissionRouteProfile,
  modifier = routeModifierForSpawn(spawnX, spawnZ, 0, profile),
): MissionRouteSummary {
  const safeSpawnX = finiteOr(spawnX, 0)
  const safeSpawnY = finiteOr(spawnY, 0)
  const safeSpawnZ = finiteOr(spawnZ, 0)
  let previousX = safeSpawnX
  let previousY = safeSpawnY
  let previousZ = safeSpawnZ
  let previousDx = 0
  let previousDz = 0
  let lengthMeters = 0
  let maxTurnDegrees = 0
  let minClearanceMeters = Number.POSITIVE_INFINITY
  let maxAltitudeMeters = safeSpawnY

  for (const point of route) {
    const dx = point.x - previousX
    const dy = point.y - previousY
    const dz = point.z - previousZ
    const horizontalLength = Math.hypot(dx, dz)
    lengthMeters += Math.hypot(dx, dy, dz)
    maxAltitudeMeters = Math.max(maxAltitudeMeters, point.y)
    if (horizontalLength > 1e-6 && Math.hypot(previousDx, previousDz) > 1e-6) {
      const dot = (previousDx * dx + previousDz * dz) /
        (Math.hypot(previousDx, previousDz) * horizontalLength)
      maxTurnDegrees = Math.max(maxTurnDegrees, Math.acos(MathUtils.clamp(dot, -1, 1)) * 180 / Math.PI)
    }

    for (let sample = 1; sample <= ROUTE_SEGMENT_SAMPLES; sample++) {
      const t = sample / (ROUTE_SEGMENT_SAMPLES + 1)
      const x = previousX + dx * t
      const y = previousY + dy * t
      const z = previousZ + dz * t
      const ground = sampleTerrainHeight(x, z)
      if (Number.isFinite(ground)) minClearanceMeters = Math.min(minClearanceMeters, y - ground)
    }

    previousX = point.x
    previousY = point.y
    previousZ = point.z
    previousDx = dx
    previousDz = dz
  }

  if (!Number.isFinite(minClearanceMeters)) minClearanceMeters = ROUTE_CLEARANCE
  const climbMeters = Math.max(0, maxAltitudeMeters - safeSpawnY)
  const difficulty: MissionRouteDifficulty =
    maxTurnDegrees >= 112 || climbMeters >= 420 || lengthMeters >= 7_200
      ? 'technical'
      : maxTurnDegrees >= 72 || climbMeters >= 240 || lengthMeters >= 5_400
        ? 'standard'
        : 'relaxed'
  return {
    profile,
    label: routeProfileLabel(profile),
    challenge: missionChallengeForProfile(profile),
    challengeLabel: missionChallengeLabel(missionChallengeForProfile(profile)),
    modifier,
    modifierLabel: routeModifierLabel(modifier),
    scoringFocus: scoringFocusForModifier(modifier),
    scoringFocusLabel: scoringFocusLabel(scoringFocusForModifier(modifier)),
    difficulty,
    lengthMeters: finiteOr(lengthMeters, 0),
    maxTurnDegrees: finiteOr(maxTurnDegrees, 0),
    minClearanceMeters: Math.max(0, finiteOr(minClearanceMeters, ROUTE_CLEARANCE)),
    maxAltitudeMeters: finiteOr(maxAltitudeMeters, safeSpawnY),
  }
}

/**
 * Arcade checkpoint circuit around the airfield.
 * Large rings, climb slightly, fly through in order.
 */
export class MissionSystem {
  readonly root = new Group()
  private readonly gates: Gate[] = []
  private next = 0
  private status: MissionStatus = 'idle'
  private liveLabel = '—'
  private profile: MissionRouteProfile = 'orbit'
  private modifier: MissionRouteModifier = 'steady'
  private scoringFocusValue: MissionScoringFocus = 'balanced'
  private readonly summary: MissionRouteSummary = {
    profile: 'orbit',
    label: 'ORBIT',
    challenge: 'approach',
    challengeLabel: 'APPROACH',
    modifier: 'steady',
    modifierLabel: 'STEADY',
    scoringFocus: 'balanced',
    scoringFocusLabel: 'BALANCED',
    difficulty: 'standard',
    lengthMeters: 0,
    maxTurnDegrees: 0,
    minClearanceMeters: ROUTE_CLEARANCE,
    maxAltitudeMeters: 0,
  }
  private routeBriefingText = 'ROUTE ORBIT / APPROACH / STEADY / BALANCED / STANDARD / MIN CLR 120M'
  private readonly hudState: MissionHud = {
    status: 'idle',
    current: 0,
    total: 0,
    dist: 0,
    bearing: null,
    altDelta: 0,
    label: '—',
  }
  private havePrev = false
  private prevX = 0
  private prevY = 0
  private prevZ = 0
  lastPassQuality = 1
  private readonly gateGeo: TorusGeometry
  private readonly gatePool: Gate[] = []
  private readonly beacon = new Group()
  private readonly liveMat: MeshBasicMaterial
  private readonly waitMat: MeshBasicMaterial
  private readonly doneMat: MeshBasicMaterial
  private readonly beaconMat: MeshBasicMaterial
  private readonly passFlashMat: MeshBasicMaterial
  private readonly passFlash: Mesh
  private passFlashStartedAt = 0
  /** Presentation clock in milliseconds, supplied by RAF when available. */
  private presentationTimeMs = 0
  private disposed = false

  constructor(scene: Scene) {
    this.root.name = 'MissionGates'
    scene.add(this.root)

    this.liveMat = new MeshBasicMaterial({
      color: 0x3dcea8,
      transparent: true,
      opacity: 0.85,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.waitMat = new MeshBasicMaterial({
      color: 0x4a6678,
      transparent: true,
      opacity: 0.35,
      side: DoubleSide,
      depthWrite: false,
    })
    this.doneMat = new MeshBasicMaterial({
      color: 0xf0b429,
      transparent: true,
      opacity: 0.28,
      side: DoubleSide,
      depthWrite: false,
    })
    this.beaconMat = new MeshBasicMaterial({
      color: 0x3dcea8,
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.passFlashMat = new MeshBasicMaterial({
      color: 0xf0b429,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.gateGeo = new TorusGeometry(GATE_RADIUS, 1.15, 10, 36)
    for (let i = 0; i < GATE_COUNT; i++) {
      const ring = new Mesh(this.gateGeo, this.waitMat)
      ring.name = `gate_${i}`
      const root = new Group()
      root.add(ring)
      root.visible = false
      this.root.add(root)
      this.gatePool.push({
        root,
        pos: new Vector3(),
        fwd: new Vector3(),
        radius: GATE_RADIUS - 2,
        passed: false,
        lastAlong: 0,
      })
    }
    this.passFlash = new Mesh(this.gateGeo, this.passFlashMat)
    this.passFlash.name = 'GatePassFlash'
    this.passFlash.visible = false
    this.root.add(this.passFlash)
    this.buildBeacon()
    this.root.add(this.beacon)
  }

  /** Place a new circuit from the current runway spawn. */
  start(
    spawnX: number,
    spawnY: number,
    spawnZ: number,
    spawnYaw: number,
    requestedProfile?: MissionRouteProfile,
    requestedModifier?: MissionRouteModifier,
  ): void {
    if (this.disposed) return
    this.clear()
    const safeSpawnX = finiteOr(spawnX, 0)
    const safeSpawnY = finiteOr(spawnY, 0)
    const safeSpawnZ = finiteOr(spawnZ, 0)
    this.profile = requestedProfile ?? routeProfileForSpawn(safeSpawnX, safeSpawnZ, spawnYaw)
    this.status = 'idle'
    this.next = 0
    this.havePrev = false
    this.lastPassQuality = 1
    this.modifier = requestedModifier ?? routeModifierForSpawn(safeSpawnX, safeSpawnZ, spawnYaw, this.profile)
    this.scoringFocusValue = scoringFocusForModifier(this.modifier)

    const route = buildMissionRoute(
      safeSpawnX,
      safeSpawnY,
      safeSpawnZ,
      spawnYaw,
      this.profile,
      this.modifier,
    )
    const summary = summarizeMissionRoute(
      safeSpawnX,
      safeSpawnY,
      safeSpawnZ,
      route,
      this.profile,
      this.modifier,
    )
    this.summary.profile = summary.profile
    this.summary.label = summary.label
    this.summary.challenge = summary.challenge
    this.summary.challengeLabel = summary.challengeLabel
    this.summary.modifier = summary.modifier
    this.summary.modifierLabel = summary.modifierLabel
    this.summary.scoringFocus = summary.scoringFocus
    this.summary.scoringFocusLabel = summary.scoringFocusLabel
    this.summary.difficulty = summary.difficulty
    this.summary.lengthMeters = summary.lengthMeters
    this.summary.maxTurnDegrees = summary.maxTurnDegrees
    this.summary.minClearanceMeters = summary.minClearanceMeters
    this.summary.maxAltitudeMeters = summary.maxAltitudeMeters
    this.routeBriefingText = this.profile === 'free'
      ? `FREE FLIGHT / EXPLORE / ${summary.modifierLabel} / ${summary.scoringFocusLabel}`
      : [
        `ROUTE ${summary.label}`,
        summary.challengeLabel,
        summary.modifierLabel,
        summary.scoringFocusLabel,
        summary.difficulty.toUpperCase(),
        `MIN CLR ${Math.round(summary.minClearanceMeters)}M`,
      ].join(' / ')
    for (let i = 0; i < route.length; i++) {
      const point = route[i]!
      const gate = this.gatePool[i]!
      const fwd = gate.fwd.set(point.fwdX, 0, point.fwdZ).normalize()
      gate.radius = summary.challenge === 'precision' ? GATE_RADIUS * 0.78 - 2 : GATE_RADIUS - 2
      const ring = gate.root.children[0] as Mesh
      // Torus lies in XY; stand it up and face along fwd
      ring.rotation.y = Math.atan2(fwd.x, fwd.z)
      gate.root.position.set(point.x, point.y, point.z)
      gate.root.visible = true
      gate.pos.set(point.x, point.y, point.z)
      gate.passed = false
      gate.lastAlong = 0
      this.gates.push(gate)
    }
    this.status = route.length > 0 ? 'live' : 'idle'
    this.liveLabel = route.length > 0 ? `GATE 1/${this.gates.length}` : 'FREE FLIGHT'
    this.paint()
    this.placeBeacon()
  }

  /** Pulse the live ring and hold the far-visible beacon on it. */
  tick(nowMs?: number, playerX?: number, playerY?: number, playerZ?: number): void {
    if (this.disposed) return
    const now = this.resolvePresentationTime(nowMs, nowMs === undefined)
    if (this.passFlash?.visible) {
      const progress = (now - this.passFlashStartedAt) / 560
      if (progress >= 1) {
        this.passFlash.visible = false
        this.passFlashMat.opacity = 0
      } else {
        const baseScale = this.summary.challenge === 'precision' ? 0.82 : 1
        this.passFlash.scale.setScalar(baseScale * missionPassFlashScale(progress))
        this.passFlashMat.opacity = missionPassFlashOpacity(progress)
      }
    }

    if (this.status !== 'live' || this.next >= this.gates.length) {
      this.beacon.visible = false
      this.liveMat.opacity = 0.85
      return
    }
    const g = this.gates[this.next]!
    let near = 0
    if (this.havePrev) {
      const dist = Math.hypot(
        this.prevX - g.pos.x,
        this.prevY - g.pos.y,
        this.prevZ - g.pos.z,
      )
      near = gateProximityEmphasis(dist, g.radius)
    }
    const ring = g.root.children[0]
    if (ring) {
      const baseScale = this.summary.challenge === 'precision' ? 0.82 : 1
      const s = baseScale * (1.02 + Math.sin(now * 0.005) * 0.05 + near * 0.09)
      ring.scale.setScalar(s)
    }
    this.liveMat.opacity = 0.85 + near * 0.12
    const pulse = 0.42 + (Math.sin(now * 0.006) + 1) * 0.18
    const distance = finiteDistanceToGate(playerX, playerY, playerZ, g.pos)
    this.beaconMat.opacity = (pulse + near * 0.18) * gateBeaconDistanceOpacity(distance)
  }

  update(px: number, py: number, pz: number, nowMs?: number): 'none' | 'pass' | 'miss' | 'complete' {
    if (this.disposed) return 'none'
    this.resolvePresentationTime(nowMs)
    if (!finiteCoordinates(px, py, pz)) return 'none'
    if (this.status !== 'live' || this.next >= this.gates.length) {
      this.remember(px, py, pz)
      return 'none'
    }
    if (!this.havePrev) {
      this.remember(px, py, pz)
      return 'none'
    }

    const g = this.gates[this.next]!
    _prevTo.set(this.prevX - g.pos.x, this.prevY - g.pos.y, this.prevZ - g.pos.z)
    _to.set(px - g.pos.x, py - g.pos.y, pz - g.pos.z)
    const prevAlong = _prevTo.dot(g.fwd)
    const along = _to.dot(g.fwd)
    g.lastAlong = along

    // Forward crossing only: the motion segment must hit the gate plane.
    const crossedPlane = prevAlong < 0 && along >= 0
    if (!crossedPlane) {
      this.remember(px, py, pz)
      return 'none'
    }

    const denom = along - prevAlong
    const t = denom !== 0 ? MathUtils.clamp(-prevAlong / denom, 0, 1) : 1
    const ix = this.prevX + (px - this.prevX) * t
    const iy = this.prevY + (py - this.prevY) * t
    const iz = this.prevZ + (pz - this.prevZ) * t
    this.remember(px, py, pz)
    _radial.set(ix - g.pos.x, iy - g.pos.y, iz - g.pos.z)
    _radial.addScaledVector(g.fwd, -_radial.dot(g.fwd))
    const radial = _radial.length()
    if (radial > g.radius) {
      this.lastPassQuality = 0
      return 'miss'
    }

    this.lastPassQuality = 1 - Math.min(1, radial / Math.max(1, g.radius))
    g.passed = true
    this.triggerPassFlash(g)
    this.next += 1
    if (this.next >= this.gates.length) {
      this.status = 'complete'
      this.liveLabel = 'CIRCUIT DONE'
      this.paint()
      return 'complete'
    }
    this.liveLabel = `GATE ${this.next + 1}/${this.gates.length}`
    this.paint()
    return 'pass'
  }

  activeGatePos(): Vector3 | null {
    if (this.status !== 'live' || this.next >= this.gates.length) return null
    return this.gates[this.next]!.pos
  }

  get totalGates(): number {
    return this.gates.length
  }

  get routeProfile(): MissionRouteProfile {
    return this.profile
  }

  get routeProfileLabel(): string {
    return routeProfileLabel(this.profile)
  }

  get routeModifier(): MissionRouteModifier {
    return this.modifier
  }

  get routeModifierLabel(): string {
    return routeModifierLabel(this.modifier)
  }

  get scoringFocus(): MissionScoringFocus {
    return this.scoringFocusValue
  }

  get routeSummary(): MissionRouteSummary {
    return this.summary
  }

  get routeBriefing(): string {
    return this.routeBriefingText
  }

  hud(px: number, py: number, pz: number, headingYaw = 0): MissionHud {
    const total = this.gates.length
    if (this.status === 'complete') {
      this.hudState.status = 'complete'
      this.hudState.current = total
      this.hudState.total = total
      this.hudState.dist = 0
      this.hudState.bearing = null
      this.hudState.altDelta = 0
      this.hudState.label = this.liveLabel
      return this.hudState
    }
    if (this.status !== 'live' || total === 0) {
      this.hudState.status = 'idle'
      this.hudState.current = 0
      this.hudState.total = total
      this.hudState.dist = 0
      this.hudState.bearing = null
      this.hudState.altDelta = 0
      this.hudState.label = '—'
      return this.hudState
    }
    const g = this.gates[this.next]!
    const safePx = finiteOr(px, this.havePrev ? this.prevX : 0)
    const safePy = finiteOr(py, this.havePrev ? this.prevY : 0)
    const safePz = finiteOr(pz, this.havePrev ? this.prevZ : 0)
    const safeHeading = finiteOr(headingYaw, 0)
    const dx = g.pos.x - safePx
    const dz = g.pos.z - safePz
    const dist = Math.hypot(dx, g.pos.y - safePy, dz)
    const gateBrg = Math.atan2(dx, dz)
    const bearing = MathUtils.euclideanModulo(gateBrg - safeHeading + Math.PI, Math.PI * 2) - Math.PI
    this.hudState.status = 'live'
    this.hudState.current = this.next + 1
    this.hudState.total = total
    this.hudState.dist = dist
    this.hudState.bearing = bearing
    this.hudState.altDelta = g.pos.y - safePy
    this.hudState.label = this.liveLabel
    return this.hudState
  }

  get isComplete(): boolean {
    return this.status === 'complete'
  }

  private paint(): void {
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i]!
      const ring = g.root.children[0] as Mesh
      if (g.passed) ring.material = this.doneMat
      else if (i === this.next) ring.material = this.liveMat
      else ring.material = this.waitMat
      ring.scale.setScalar(this.summary.challenge === 'precision' ? 0.82 : 1)
    }
    this.placeBeacon()
  }

  private triggerPassFlash(gate: Gate): void {
    const flash = this.passFlash
    if (!flash) return
    flash.position.copy(gate.pos)
    const ring = gate.root.children[0]
    if (ring) flash.rotation.copy(ring.rotation)
    flash.scale.setScalar(this.summary.challenge === 'precision' ? 0.82 : 1)
    this.passFlashStartedAt = this.presentationTimeMs
    this.passFlashMat.opacity = missionPassFlashOpacity(0)
    flash.visible = true
  }

  private buildBeacon(): void {
    this.beacon.name = 'GateBeacon'
    const shaft = new Mesh(new CylinderGeometry(0.55, 0.55, 180, 6), this.beaconMat)
    shaft.position.y = 90
    const tip = new Mesh(new ConeGeometry(4.2, 10, 4), this.beaconMat)
    tip.position.y = 188
    this.beacon.add(shaft, tip)
    this.beacon.visible = false
  }

  private placeBeacon(): void {
    if (this.status !== 'live' || this.next >= this.gates.length) {
      this.beacon.visible = false
      return
    }
    const g = this.gates[this.next]!
    this.beacon.position.copy(g.pos)
    this.beacon.visible = true
  }

  private remember(px: number, py: number, pz: number): void {
    this.prevX = px
    this.prevY = py
    this.prevZ = pz
    this.havePrev = true
  }

  private clear(): void {
    for (const g of this.gatePool) g.root.visible = false
    this.gates.length = 0
    this.next = 0
    this.status = 'idle'
    this.liveLabel = '—'
    this.havePrev = false
    this.beacon.visible = false
    this.passFlashMat.opacity = 0
    this.passFlash.visible = false
    this.passFlashStartedAt = 0
    this.presentationTimeMs = 0
  }

  /** Keep mission presentation monotonic and independent from wall-clock reads. */
  private resolvePresentationTime(nowMs?: number, advanceFallback = false): number {
    if (Number.isFinite(nowMs)) {
      this.presentationTimeMs = Math.max(this.presentationTimeMs, nowMs!)
    } else if (advanceFallback) {
      this.presentationTimeMs += PRESENTATION_FALLBACK_STEP_MS
    }
    return this.presentationTimeMs
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    disposeObjectTree(this.root)
    this.root.removeFromParent()
    this.gates.length = 0
  }
}

function finiteDistanceToGate(
  x: number | undefined,
  y: number | undefined,
  z: number | undefined,
  gate: Vector3,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return Number.NaN
  return Math.hypot(x! - gate.x, y! - gate.y, z! - gate.z)
}

function finiteCoordinates(x: number, y: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

/** Bounded ring scale for a completed checkpoint flash. */
export function missionPassFlashScale(progress: number): number {
  const t = clamp01(progress)
  const eased = 1 - (1 - t) * (1 - t)
  return 1 + eased * 2.2
}

/** Fade the checkpoint flash without a harsh one-frame brightness spike. */
export function missionPassFlashOpacity(progress: number): number {
  const t = clamp01(progress)
  return (1 - t) * 0.86
}

/**
 * Soft near-gate emphasis (0-1). Stronger inside ~4 ring radii, none beyond.
 * Not the pass flash; just a readable proximity cue.
 */
export function gateProximityEmphasis(dist: number, gateRadius: number): number {
  if (!Number.isFinite(dist) || !Number.isFinite(gateRadius) || gateRadius <= 0) return 0
  const outer = gateRadius * 4.5
  if (dist >= outer) return 0
  const inner = gateRadius * 1.15
  if (dist <= inner) return 1
  return 1 - (dist - inner) / (outer - inner)
}

/** Keep the tall gate beacon quiet at close range while preserving far guidance. */
export function gateBeaconDistanceOpacity(distance: number): number {
  if (!Number.isFinite(distance)) return 1
  const safeDistance = Math.max(0, distance)
  return 0.24 + MathUtils.smoothstep(safeDistance, 80, 420) * 0.76
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}
