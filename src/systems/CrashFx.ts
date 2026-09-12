import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three'
import { sampleGroundHeight } from '../world/ground'
import { disposeObjectTree } from '../core/dispose'
import type { RenderQuality } from '../core/RenderQuality'

interface Bit {
  mesh: Mesh
  vel: Vector3
  life: number
  maxLife: number
  kind: 'bloom' | 'smoke' | 'ball'
  size0: number
  core?: Mesh
  trail?: Mesh
}

const _look = new Vector3()
const _inherit = new Vector3()

/**
 * Crash boom: central flash plus ballistic fireballs that arc out.
 */
export class CrashFx {
  readonly root = new Group()
  private readonly bits: Bit[] = []
  private readonly bloomPool: Bit[] = []
  private readonly smokePool: Bit[] = []
  private readonly ballPool: Bit[] = []
  private readonly fireMat: MeshBasicMaterial
  private readonly fireHotMat: MeshBasicMaterial
  private readonly fireMidMat: MeshBasicMaterial
  private readonly smokeMat: MeshBasicMaterial
  private readonly ringMat: MeshBasicMaterial
  private readonly sphereGeo: SphereGeometry
  private readonly trailGeo: SphereGeometry
  private readonly ring: Mesh
  private readonly flash: Mesh
  private alive = false
  private age = 0
  private punch = 0
  private randomState = 1
  private disposed = false
  private renderQuality: RenderQuality = 'balanced'
  private reducedMotion = false

  constructor(scene: Scene) {
    this.root.name = 'CrashFx'
    this.root.visible = false
    scene.add(this.root)

    this.fireMat = new MeshBasicMaterial({
      color: 0xff5a10,
      transparent: true,
      opacity: 0.88,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.fireMidMat = new MeshBasicMaterial({
      color: 0xff9a28,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.fireHotMat = new MeshBasicMaterial({
      color: 0xfff4d0,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.smokeMat = new MeshBasicMaterial({
      color: 0x2a2c30,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    })
    this.ringMat = new MeshBasicMaterial({
      color: 0xffc070,
      transparent: true,
      opacity: 0.7,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })

    this.sphereGeo = new SphereGeometry(1, 12, 10)
    this.trailGeo = new SphereGeometry(1, 8, 6)

    for (let i = 0; i < 8; i++) this.bloomPool.push(this.makeBloomBit())
    for (let i = 0; i < 14; i++) this.smokePool.push(this.makeSmokeBit())
    for (let i = 0; i < 32; i++) this.ballPool.push(this.makeBallBit())

    this.ring = new Mesh(new RingGeometry(0.4, 1.15, 32), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.root.add(this.ring)

    this.flash = new Mesh(this.sphereGeo, this.fireHotMat.clone())
    this.root.add(this.flash)
  }

  get active(): boolean {
    return this.alive
  }

  /** Number of live pooled particles currently being simulated. */
  get activeCount(): number {
    return this.bits.length
  }

  get shake(): number {
    return this.punch
  }

  /** Reduce transient particle pressure on constrained render presets. */
  setRenderQuality(quality: RenderQuality): void {
    if (this.disposed) return
    this.renderQuality = quality
  }

  /** Keep the readable crash fade while removing large transient motion. */
  setReducedMotion(enabled: boolean): void {
    if (this.disposed) return
    this.reducedMotion = enabled
  }

  get bloom(): number {
    if (!this.alive) return 0
    const scale = this.reducedMotion ? 0.3 : 1
    return Math.max(0, 1 - this.age * 3.6) * scale
  }

  trigger(pos: Vector3, vel: Vector3): void {
    if (this.disposed) return
    this.clearBits()
    this.randomState = seedFromImpact(pos, vel)
    this.alive = true
    this.age = 0
    this.punch = this.reducedMotion ? 0 : 1
    this.root.position.copy(pos)
    this.root.visible = true
    this.ring.scale.setScalar(2)
    this.ringMat.opacity = 0.9
    this.flash.scale.setScalar(8)
    ;(this.flash.material as MeshBasicMaterial).opacity = 1

    _inherit.copy(vel).multiplyScalar(0.22)

    const low = this.renderQuality === 'low'
    const bloomCount = low ? 4 : 8
    const smokeCount = low ? 7 : 14
    const primaryBallCount = low ? 12 : 22
    const secondaryBallCount = low ? 4 : 10
    for (let i = 0; i < bloomCount; i++) {
      this.spawnBloom(this.bloomPool[i]!, _inherit)
    }
    for (let i = 0; i < smokeCount; i++) {
      this.spawnSmoke(this.smokePool[i]!, _inherit)
    }
    // The show: burning globes on real arcs
    const n = primaryBallCount
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + (this.nextRandom() - 0.5) * 0.45
      const pitch = 0.28 + this.nextRandom() * 0.72
      const speed = 22 + this.nextRandom() * 38
      this.spawnBall(this.ballPool[i]!, yaw, pitch, speed, _inherit)
    }
    for (let i = 0; i < secondaryBallCount; i++) {
      const yaw = this.nextRandom() * Math.PI * 2
      const pitch = 0.15 + this.nextRandom() * 0.5
      this.spawnBall(this.ballPool[primaryBallCount + i]!, yaw, pitch, 14 + this.nextRandom() * 22, _inherit)
    }
  }

  update(dt: number): void {
    if (this.disposed || !this.alive || dt <= 0) return
    this.age += dt
    this.punch = Math.max(0, this.punch - dt * 1.55)

    const flashMat = this.flash.material as MeshBasicMaterial
    const flashT = Math.max(0, 1 - this.age * 4.2)
    flashMat.opacity = flashT
    this.flash.scale.setScalar(this.reducedMotion ? 7 : 7 + this.age * 36)
    this.flash.visible = flashT > 0.02

    const ringT = Math.max(0, 1 - this.age * 1.2)
    this.ring.scale.setScalar(this.reducedMotion ? 4 : 4 + this.age * 48)
    this.ringMat.opacity = 0.7 * ringT
    this.ring.visible = ringT > 0.02

    // Once the pooled particles are gone, the flash and ring have already
    // finished their readable envelope. Stop immediately instead of carrying
    // an empty effect through the remaining hard-stop tail.
    if (this.bits.length === 0 && this.age > 1) {
      this.stop()
      return
    }

    // The burst stays local to its impact point. Resolve the visible ground
    // once per update instead of repeating the terrain sampler for every bit.
    const floor = sampleGroundHeight(this.root.position.x, this.root.position.z) + 0.4

    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i]!
      b.life -= dt
      if (b.life <= 0) {
        b.mesh.visible = false
        const last = this.bits.pop()!
        if (i < this.bits.length) this.bits[i] = last
        continue
      }
      const u = 1 - b.life / b.maxLife

      if (!this.reducedMotion) {
        if (b.kind === 'smoke') {
          b.vel.y += 5 * dt
          b.vel.multiplyScalar(Math.exp(-0.5 * dt))
        } else if (b.kind === 'bloom') {
          b.vel.multiplyScalar(Math.exp(-1.4 * dt))
          b.vel.y += 2 * dt
        } else {
          // Ballistic fireballs: gravity, almost no drag so the arc reads
          b.vel.y -= 19.5 * dt
          b.vel.multiplyScalar(Math.exp(-0.06 * dt))
        }

        b.mesh.position.addScaledVector(b.vel, dt)
      }

      const worldY = this.root.position.y + b.mesh.position.y
      if (!this.reducedMotion && worldY < floor) {
        b.mesh.position.y = floor - this.root.position.y
        if (b.kind === 'ball' && b.vel.y < 0) {
          b.vel.y *= -0.32
          b.vel.x *= 0.72
          b.vel.z *= 0.72
        } else if (b.vel.y < 0) {
          b.vel.y = 0
          b.vel.x *= 0.6
          b.vel.z *= 0.6
        }
      }

      const mat = b.mesh.material as MeshBasicMaterial
      if (b.kind === 'bloom') {
        const s = b.size0 * (1.1 + u * 3.4)
        b.mesh.scale.setScalar(s)
        mat.opacity = (1 - u) * 0.9
        mat.color.setHex(u < 0.3 ? 0xfff2c4 : 0xff6410)
      } else if (b.kind === 'smoke') {
        b.mesh.scale.setScalar(b.size0 * (1 + u * 5))
        mat.opacity = (1 - u) * 0.48
      } else {
        const spd = b.vel.length()
        const stretch = 1.15 + Math.min(2.4, spd * 0.045)
        const s = b.size0 * (1 - u * 0.35)
        b.mesh.scale.set(s, s, s * stretch)
        if (spd > 0.4) {
          _look.set(
            this.root.position.x + b.mesh.position.x + b.vel.x,
            this.root.position.y + b.mesh.position.y + b.vel.y,
            this.root.position.z + b.mesh.position.z + b.vel.z,
          )
          b.mesh.lookAt(_look)
        }
        mat.opacity = 0.35 + (1 - u) * 0.65
        mat.color.setHex(u < 0.45 ? 0xfff1b8 : u < 0.75 ? 0xff8a20 : 0xff3a08)
        if (b.core) {
          const cm = b.core.material as MeshBasicMaterial
          cm.opacity = (1 - u) * 0.95
          b.core.scale.setScalar(0.38 + (1 - u) * 0.12)
        }
        if (b.trail) {
          const tm = b.trail.material as MeshBasicMaterial
          tm.opacity = (1 - u) * 0.55
          b.trail.scale.set(0.55, 0.55, 1.6 + spd * 0.04)
        }
      }
    }

    if (this.bits.length === 0 && this.age > 1) this.stop()
    else if (this.age > 7.5) this.stop()
  }

  reset(): void {
    if (this.disposed) return
    this.stop()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    disposeObjectTree(this.root)
    this.root.removeFromParent()
    this.fireMat.dispose()
    this.fireHotMat.dispose()
    this.fireMidMat.dispose()
    this.smokeMat.dispose()
  }

  private stop(): void {
    this.alive = false
    this.punch = 0
    this.root.visible = false
    this.clearBits()
  }

  private spawnBloom(bit: Bit, inherit: Vector3): void {
    const mesh = bit.mesh
    mesh.position.set((this.nextRandom() - 0.5) * 2, this.nextRandom() * 1.4, (this.nextRandom() - 0.5) * 2)
    bit.vel.set(this.nextRandom() - 0.5, 0.4 + this.nextRandom(), this.nextRandom() - 0.5)
      .normalize()
      .multiplyScalar(2 + this.nextRandom() * 4)
      .add(inherit)
    const size0 = 2.2 + this.nextRandom() * 2.6
    mesh.scale.setScalar(size0)
    const life = 0.55 + this.nextRandom() * 0.45
    bit.life = life
    bit.maxLife = life
    bit.size0 = size0
    mesh.visible = true
    this.bits.push(bit)
  }

  private spawnSmoke(bit: Bit, inherit: Vector3): void {
    const mesh = bit.mesh
    mesh.position.set((this.nextRandom() - 0.5) * 3, this.nextRandom() * 2, (this.nextRandom() - 0.5) * 3)
    bit.vel.set(this.nextRandom() - 0.5, 0.6 + this.nextRandom(), this.nextRandom() - 0.5)
      .normalize()
      .multiplyScalar(2 + this.nextRandom() * 3)
      .addScaledVector(inherit, 0.4)
    const size0 = 2.4 + this.nextRandom() * 3
    mesh.scale.setScalar(size0)
    const life = 1.8 + this.nextRandom() * 2
    bit.life = life
    bit.maxLife = life
    bit.size0 = size0
    mesh.visible = true
    this.bits.push(bit)
  }

  private spawnBall(bit: Bit, yaw: number, pitch: number, speed: number, inherit: Vector3): void {
    const size0 = 0.7 + this.nextRandom() * 2.1
    const shell = bit.mesh
    const core = bit.core!
    const trail = bit.trail!
    core.scale.setScalar(0.42)
    trail.position.z = -0.85
    trail.scale.set(0.55, 0.55, 1.8)

    const cp = Math.cos(pitch)
    bit.vel.set(
      Math.sin(yaw) * cp * speed,
      Math.sin(pitch) * speed,
      Math.cos(yaw) * cp * speed,
    ).add(inherit)

    shell.position.set((this.nextRandom() - 0.5) * 1.2, 0.6 + this.nextRandom() * 1.4, (this.nextRandom() - 0.5) * 1.2)
    shell.scale.setScalar(size0)
    const life = 2.4 + this.nextRandom() * 2.8 + size0 * 0.35
    bit.life = life
    bit.maxLife = life
    bit.size0 = size0
    shell.visible = true
    this.bits.push(bit)
  }

  private clearBits(): void {
    for (const b of this.bits) {
      b.mesh.visible = false
    }
    this.bits.length = 0
  }

  private nextRandom(): number {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0
    return this.randomState / 0x100000000
  }

  private makeBloomBit(): Bit {
    const mesh = new Mesh(this.sphereGeo, this.fireHotMat.clone())
    mesh.visible = false
    this.root.add(mesh)
    return { mesh, vel: new Vector3(), life: 0, maxLife: 1, kind: 'bloom', size0: 1 }
  }

  private makeSmokeBit(): Bit {
    const mesh = new Mesh(this.sphereGeo, this.smokeMat.clone())
    mesh.visible = false
    this.root.add(mesh)
    return { mesh, vel: new Vector3(), life: 0, maxLife: 1, kind: 'smoke', size0: 1 }
  }

  private makeBallBit(): Bit {
    const shell = new Mesh(this.sphereGeo, this.fireMidMat.clone())
    const core = new Mesh(this.sphereGeo, this.fireHotMat.clone())
    const trail = new Mesh(this.trailGeo, this.fireMat.clone())
    shell.add(core, trail)
    shell.visible = false
    this.root.add(shell)
    return {
      mesh: shell,
      vel: new Vector3(),
      life: 0,
      maxLife: 1,
      kind: 'ball',
      size0: 1,
      core,
      trail,
    }
  }
}

function seedFromImpact(pos: Vector3, vel: Vector3): number {
  let state = 2166136261
  for (const value of [pos.x, pos.y, pos.z, vel.x, vel.y, vel.z]) {
    const quantized = Number.isFinite(value) ? Math.round(value * 1000) : 0
    state ^= quantized
    state = Math.imul(state, 16777619)
  }
  return state >>> 0 || 1
}
