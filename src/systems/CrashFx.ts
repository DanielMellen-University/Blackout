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

/**
 * Crash boom: central flash plus ballistic fireballs that arc out.
 */
export class CrashFx {
  readonly root = new Group()
  private readonly bits: Bit[] = []
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

    this.ring = new Mesh(new RingGeometry(0.4, 1.15, 32), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.root.add(this.ring)

    this.flash = new Mesh(this.sphereGeo, this.fireHotMat.clone())
    this.root.add(this.flash)
  }

  get active(): boolean {
    return this.alive
  }

  get shake(): number {
    return this.punch
  }

  get bloom(): number {
    if (!this.alive) return 0
    return Math.max(0, 1 - this.age * 3.6)
  }

  trigger(pos: Vector3, vel: Vector3): void {
    this.clearBits()
    this.alive = true
    this.age = 0
    this.punch = 1
    this.root.position.copy(pos)
    this.root.visible = true
    this.ring.scale.setScalar(2)
    this.ringMat.opacity = 0.9
    this.flash.scale.setScalar(8)
    ;(this.flash.material as MeshBasicMaterial).opacity = 1

    const inherit = vel.clone().multiplyScalar(0.22)

    for (let i = 0; i < 8; i++) {
      this.spawnBloom(inherit)
    }
    for (let i = 0; i < 14; i++) {
      this.spawnSmoke(inherit)
    }
    // The show: burning globes on real arcs
    const n = 22
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.45
      const pitch = 0.28 + Math.random() * 0.72
      const speed = 22 + Math.random() * 38
      this.spawnBall(yaw, pitch, speed, inherit)
    }
    for (let i = 0; i < 10; i++) {
      const yaw = Math.random() * Math.PI * 2
      const pitch = 0.15 + Math.random() * 0.5
      this.spawnBall(yaw, pitch, 14 + Math.random() * 22, inherit)
    }
  }

  update(dt: number): void {
    if (!this.alive) return
    this.age += dt
    this.punch = Math.max(0, this.punch - dt * 1.55)

    const flashMat = this.flash.material as MeshBasicMaterial
    const flashT = Math.max(0, 1 - this.age * 4.2)
    flashMat.opacity = flashT
    this.flash.scale.setScalar(7 + this.age * 36)
    this.flash.visible = flashT > 0.02

    const ringT = Math.max(0, 1 - this.age * 1.2)
    this.ring.scale.setScalar(4 + this.age * 48)
    this.ringMat.opacity = 0.7 * ringT
    this.ring.visible = ringT > 0.02

    for (const b of this.bits) {
      b.life -= dt
      if (b.life <= 0) {
        b.mesh.visible = false
        continue
      }
      const u = 1 - b.life / b.maxLife

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

      const gy = sampleGroundHeight(
        this.root.position.x + b.mesh.position.x,
        this.root.position.z + b.mesh.position.z,
      )
      const worldY = this.root.position.y + b.mesh.position.y
      const floor = gy + 0.4
      if (worldY < floor) {
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

    if (this.age > 7.5) this.stop()
  }

  reset(): void {
    this.stop()
  }

  private stop(): void {
    this.alive = false
    this.punch = 0
    this.root.visible = false
    this.clearBits()
  }

  private spawnBloom(inherit: Vector3): void {
    const mesh = new Mesh(this.sphereGeo, (Math.random() > 0.4 ? this.fireHotMat : this.fireMat).clone())
    mesh.position.set((Math.random() - 0.5) * 2, Math.random() * 1.4, (Math.random() - 0.5) * 2)
    const vel = new Vector3(Math.random() - 0.5, 0.4 + Math.random(), Math.random() - 0.5)
      .normalize()
      .multiplyScalar(2 + Math.random() * 4)
      .add(inherit)
    const size0 = 2.2 + Math.random() * 2.6
    mesh.scale.setScalar(size0)
    this.root.add(mesh)
    const life = 0.55 + Math.random() * 0.45
    this.bits.push({ mesh, vel, life, maxLife: life, kind: 'bloom', size0 })
  }

  private spawnSmoke(inherit: Vector3): void {
    const mesh = new Mesh(this.sphereGeo, this.smokeMat.clone())
    mesh.position.set((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3)
    const vel = new Vector3(Math.random() - 0.5, 0.6 + Math.random(), Math.random() - 0.5)
      .normalize()
      .multiplyScalar(2 + Math.random() * 3)
      .addScaledVector(inherit, 0.4)
    const size0 = 2.4 + Math.random() * 3
    mesh.scale.setScalar(size0)
    this.root.add(mesh)
    const life = 1.8 + Math.random() * 2
    this.bits.push({ mesh, vel, life, maxLife: life, kind: 'smoke', size0 })
  }

  private spawnBall(yaw: number, pitch: number, speed: number, inherit: Vector3): void {
    const size0 = 0.7 + Math.random() * 2.1
    const shell = new Mesh(this.sphereGeo, this.fireMidMat.clone())
    const core = new Mesh(this.sphereGeo, this.fireHotMat.clone())
    core.scale.setScalar(0.42)
    const trail = new Mesh(this.trailGeo, this.fireMat.clone())
    trail.position.z = -0.85
    trail.scale.set(0.55, 0.55, 1.8)
    shell.add(core, trail)

    const cp = Math.cos(pitch)
    const vel = new Vector3(
      Math.sin(yaw) * cp * speed,
      Math.sin(pitch) * speed,
      Math.cos(yaw) * cp * speed,
    ).add(inherit)

    shell.position.set((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 1.4, (Math.random() - 0.5) * 1.2)
    shell.scale.setScalar(size0)
    this.root.add(shell)
    const life = 2.4 + Math.random() * 2.8 + size0 * 0.35
    this.bits.push({
      mesh: shell,
      vel,
      life,
      maxLife: life,
      kind: 'ball',
      size0,
      core,
      trail,
    })
  }

  private clearBits(): void {
    for (const b of this.bits) {
      this.root.remove(b.mesh)
      const mats = [b.mesh.material, b.core?.material, b.trail?.material]
      for (const mat of mats) {
        if (!mat) continue
        if (
          mat !== this.fireMat &&
          mat !== this.fireHotMat &&
          mat !== this.fireMidMat &&
          mat !== this.smokeMat
        ) {
          ;(mat as MeshBasicMaterial).dispose()
        }
      }
    }
    this.bits.length = 0
  }
}
