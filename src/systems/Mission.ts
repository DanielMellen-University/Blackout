import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three'

export type MissionStatus = 'idle' | 'live' | 'complete'

export interface MissionHud {
  status: MissionStatus
  current: number
  total: number
  /** Meters to the active gate, or 0 if complete. */
  dist: number
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
const PASS_THICK = 16
const _to = new Vector3()
const _radial = new Vector3()

/**
 * Arcade checkpoint circuit around the airfield.
 * Large rings, climb slightly, fly through in order.
 */
export class MissionSystem {
  readonly root = new Group()
  private readonly gates: Gate[] = []
  private next = 0
  private status: MissionStatus = 'idle'
  private readonly liveMat: MeshBasicMaterial
  private readonly waitMat: MeshBasicMaterial
  private readonly doneMat: MeshBasicMaterial

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
  }

  /** Place a new circuit from the current runway spawn. */
  start(spawnX: number, spawnY: number, spawnZ: number, spawnYaw: number): void {
    this.clear()
    this.status = 'live'
    this.next = 0

    const geo = new TorusGeometry(GATE_RADIUS, 1.15, 10, 36)
    for (let i = 0; i < GATE_COUNT; i++) {
      const t = (i / GATE_COUNT) * Math.PI * 2 + spawnYaw + 0.55
      const x = spawnX + Math.sin(t) * CIRCUIT_R
      const z = spawnZ + Math.cos(t) * CIRCUIT_R
      const y = spawnY + 72 + i * 18

      // Tangent so you fly the circle
      const fwd = new Vector3(Math.cos(t), 0, -Math.sin(t)).normalize()

      const ring = new Mesh(geo, this.waitMat)
      ring.name = `gate_${i}`
      // Torus lies in XY; stand it up and face along fwd
      ring.rotation.y = Math.atan2(fwd.x, fwd.z)

      const root = new Group()
      root.position.set(x, y, z)
      root.add(ring)
      this.root.add(root)

      this.gates.push({
        root,
        pos: new Vector3(x, y, z),
        fwd,
        radius: GATE_RADIUS - 2,
        passed: false,
        lastAlong: 0,
      })
    }
    this.paint()
  }

  update(px: number, py: number, pz: number): 'none' | 'pass' | 'complete' {
    if (this.status !== 'live' || this.next >= this.gates.length) return 'none'
    const g = this.gates[this.next]!
    _to.set(px - g.pos.x, py - g.pos.y, pz - g.pos.z)
    const along = _to.dot(g.fwd)
    _radial.copy(_to).addScaledVector(g.fwd, -along)
    const inDisk = _radial.length() < g.radius
    const crossed =
      g.lastAlong < -2 && along > 2 && inDisk && Math.abs(along) < PASS_THICK * 2
    const inside =
      inDisk && Math.abs(along) < PASS_THICK
    g.lastAlong = along

    if (!inside && !crossed) return 'none'

    g.passed = true
    this.next += 1
    if (this.next >= this.gates.length) {
      this.status = 'complete'
      this.paint()
      return 'complete'
    }
    this.paint()
    return 'pass'
  }

  hud(px: number, py: number, pz: number): MissionHud {
    const total = this.gates.length
    if (this.status === 'complete') {
      return { status: 'complete', current: total, total, dist: 0, label: 'CIRCUIT DONE' }
    }
    if (this.status !== 'live' || total === 0) {
      return { status: 'idle', current: 0, total, dist: 0, label: '—' }
    }
    const g = this.gates[this.next]!
    const dist = Math.hypot(px - g.pos.x, py - g.pos.y, pz - g.pos.z)
    return {
      status: 'live',
      current: this.next + 1,
      total,
      dist,
      label: `GATE ${this.next + 1}/${total}`,
    }
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
      // Pulse live gate
      const s = i === this.next && !g.passed ? 1.04 : 1
      g.root.scale.setScalar(s)
    }
  }

  private clear(): void {
    for (const g of this.gates) this.root.remove(g.root)
    this.gates.length = 0
    this.next = 0
    this.status = 'idle'
  }
}
