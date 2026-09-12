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
const CIRCUIT_R = 980
const GATE_RADIUS = 38
const PRESENTATION_FALLBACK_STEP_MS = 1000 / 60
const _to = new Vector3()
const _radial = new Vector3()
const _prevTo = new Vector3()

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
  start(spawnX: number, spawnY: number, spawnZ: number, spawnYaw: number): void {
    this.clear()
    this.status = 'live'
    this.next = 0
    this.havePrev = false
    this.lastPassQuality = 1

    for (let i = 0; i < GATE_COUNT; i++) {
      const t = (i / GATE_COUNT) * Math.PI * 2 + spawnYaw + 0.55
      const x = spawnX + Math.sin(t) * CIRCUIT_R
      const z = spawnZ + Math.cos(t) * CIRCUIT_R
      const ground = sampleTerrainHeight(x, z)
      const y = Math.max(spawnY + 72 + i * 18, ground + 80)

      // Tangent so you fly the circle
      const gate = this.gatePool[i]!
      const fwd = gate.fwd.set(Math.cos(t), 0, -Math.sin(t)).normalize()
      const ring = gate.root.children[0] as Mesh
      // Torus lies in XY; stand it up and face along fwd
      ring.rotation.y = Math.atan2(fwd.x, fwd.z)
      gate.root.position.set(x, y, z)
      gate.root.visible = true
      gate.pos.set(x, y, z)
      gate.passed = false
      gate.lastAlong = 0
      this.gates.push(gate)
    }
    this.liveLabel = `GATE 1/${this.gates.length}`
    this.paint()
    this.placeBeacon()
  }

  /** Pulse the live ring and hold the far-visible beacon on it. */
  tick(nowMs?: number): void {
    const now = this.resolvePresentationTime(nowMs, nowMs === undefined)
    if (this.passFlash?.visible) {
      const progress = (now - this.passFlashStartedAt) / 560
      if (progress >= 1) {
        this.passFlash.visible = false
        this.passFlashMat.opacity = 0
      } else {
        this.passFlash.scale.setScalar(missionPassFlashScale(progress))
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
      const s = 1.02 + Math.sin(now * 0.005) * 0.05 + near * 0.09
      ring.scale.setScalar(s)
    }
    this.liveMat.opacity = 0.85 + near * 0.12
    const pulse = 0.42 + (Math.sin(now * 0.006) + 1) * 0.18
    this.beaconMat.opacity = pulse + near * 0.18
  }

  update(px: number, py: number, pz: number, nowMs?: number): 'none' | 'pass' | 'complete' {
    this.resolvePresentationTime(nowMs)
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
    if (radial > g.radius) return 'none'

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
    const dx = g.pos.x - px
    const dz = g.pos.z - pz
    const dist = Math.hypot(dx, g.pos.y - py, dz)
    const gateBrg = Math.atan2(dx, dz)
    const bearing = MathUtils.euclideanModulo(gateBrg - headingYaw + Math.PI, Math.PI * 2) - Math.PI
    this.hudState.status = 'live'
    this.hudState.current = this.next + 1
    this.hudState.total = total
    this.hudState.dist = dist
    this.hudState.bearing = bearing
    this.hudState.altDelta = g.pos.y - py
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
      ring.scale.setScalar(1)
    }
    this.placeBeacon()
  }

  private triggerPassFlash(gate: Gate): void {
    const flash = this.passFlash
    if (!flash) return
    flash.position.copy(gate.pos)
    const ring = gate.root.children[0]
    if (ring) flash.rotation.copy(ring.rotation)
    flash.scale.setScalar(1)
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
    disposeObjectTree(this.root)
    this.root.removeFromParent()
    this.gates.length = 0
  }
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

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
