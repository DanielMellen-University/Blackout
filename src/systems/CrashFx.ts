import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three'
import { sampleGroundHeight } from '../world/ground'

interface Bit {
  mesh: Mesh
  vel: Vector3
  spin: Vector3
  life: number
  maxLife: number
  kind: 'fire' | 'smoke' | 'spark' | 'debris'
  size0: number
}

/**
 * Crash boom: fireball, smoke, sparks, debris. World keeps ticking.
 */
export class CrashFx {
  readonly root = new Group()
  private readonly bits: Bit[] = []
  private readonly fireMat: MeshBasicMaterial
  private readonly fireHotMat: MeshBasicMaterial
  private readonly smokeMat: MeshBasicMaterial
  private readonly sparkMat: MeshBasicMaterial
  private readonly debrisMat: MeshStandardMaterial
  private readonly ringMat: MeshBasicMaterial
  private readonly sphereGeo: SphereGeometry
  private readonly boxGeo: BoxGeometry
  private readonly sparkGeo: BoxGeometry
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
      color: 0xff7a18,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.fireHotMat = new MeshBasicMaterial({
      color: 0xfff2c8,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.smokeMat = new MeshBasicMaterial({
      color: 0x2a2c30,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    this.sparkMat = new MeshBasicMaterial({
      color: 0xffe080,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.debrisMat = new MeshStandardMaterial({
      color: 0x8a9098,
      roughness: 0.62,
      metalness: 0.22,
    })
    this.ringMat = new MeshBasicMaterial({
      color: 0xffc070,
      transparent: true,
      opacity: 0.7,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })

    this.sphereGeo = new SphereGeometry(1, 10, 8)
    this.boxGeo = new BoxGeometry(1, 1, 1)
    this.sparkGeo = new BoxGeometry(0.12, 0.12, 0.7)

    this.ring = new Mesh(new RingGeometry(0.4, 1.1, 28), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.root.add(this.ring)

    this.flash = new Mesh(this.sphereGeo, this.fireHotMat.clone())
    this.flash.scale.setScalar(4)
    this.root.add(this.flash)
  }

  get active(): boolean {
    return this.alive
  }

  /** 0-1 camera punch. */
  get shake(): number {
    return this.punch
  }

  /** Extra exposure for the first frames. */
  get bloom(): number {
    if (!this.alive) return 0
    return Math.max(0, 1 - this.age * 4.2)
  }

  trigger(pos: Vector3, vel: Vector3): void {
    this.clearBits()
    this.alive = true
    this.age = 0
    this.punch = 1
    this.root.position.copy(pos)
    this.root.visible = true
    this.ring.scale.setScalar(2)
    this.ringMat.opacity = 0.85
    this.flash.scale.setScalar(6)
    const flashMat = this.flash.material as MeshBasicMaterial
    flashMat.opacity = 1

    const inherit = vel.clone().multiplyScalar(0.18)

    for (let i = 0; i < 10; i++) {
      this.spawnBit('fire', inherit, 0.8 + Math.random() * 1.8, 0.55 + Math.random() * 0.45)
    }
    for (let i = 0; i < 14; i++) {
      this.spawnBit('smoke', inherit, 1.2 + Math.random() * 2.4, 1.6 + Math.random() * 1.4)
    }
    for (let i = 0; i < 22; i++) {
      this.spawnBit('spark', inherit, 8 + Math.random() * 22, 0.35 + Math.random() * 0.45)
    }
    for (let i = 0; i < 16; i++) {
      this.spawnBit('debris', inherit, 6 + Math.random() * 16, 2.2 + Math.random() * 2.5)
    }
  }

  update(dt: number): void {
    if (!this.alive) return
    this.age += dt
    this.punch = Math.max(0, this.punch - dt * 1.7)

    const flashMat = this.flash.material as MeshBasicMaterial
    const flashT = Math.max(0, 1 - this.age * 5)
    flashMat.opacity = flashT
    const fs = 5 + this.age * 28
    this.flash.scale.setScalar(fs)
    this.flash.visible = flashT > 0.02

    const ringT = Math.max(0, 1 - this.age * 1.35)
    this.ring.scale.setScalar(3 + this.age * 42)
    this.ringMat.opacity = 0.65 * ringT
    this.ring.visible = ringT > 0.02

    for (const b of this.bits) {
      b.life -= dt
      if (b.life <= 0) {
        b.mesh.visible = false
        continue
      }
      const u = 1 - b.life / b.maxLife
      b.vel.y -= (b.kind === 'smoke' ? 2.2 : 18) * dt
      if (b.kind === 'smoke') {
        b.vel.multiplyScalar(Math.exp(-0.55 * dt))
        b.vel.y += 7 * dt
      } else if (b.kind === 'fire') {
        b.vel.multiplyScalar(Math.exp(-1.1 * dt))
        b.vel.y += 4 * dt
      } else {
        b.vel.multiplyScalar(Math.exp(-0.35 * dt))
      }

      b.mesh.position.addScaledVector(b.vel, dt)
      const gy = sampleGroundHeight(this.root.position.x + b.mesh.position.x, this.root.position.z + b.mesh.position.z)
      const worldY = this.root.position.y + b.mesh.position.y
      if (worldY < gy + 0.3) {
        b.mesh.position.y = gy + 0.3 - this.root.position.y
        if (b.vel.y < 0) b.vel.y *= b.kind === 'debris' ? -0.28 : -0.12
        b.vel.x *= 0.7
        b.vel.z *= 0.7
      }

      b.mesh.rotation.x += b.spin.x * dt
      b.mesh.rotation.y += b.spin.y * dt
      b.mesh.rotation.z += b.spin.z * dt

      const mat = b.mesh.material as MeshBasicMaterial | MeshStandardMaterial
      if (b.kind === 'fire') {
        const s = b.size0 * (1.2 + u * 2.8)
        b.mesh.scale.setScalar(s)
        mat.opacity = (1 - u) * (u < 0.2 ? u / 0.2 : 1) * 0.95
        ;(mat as MeshBasicMaterial).color.setHex(u < 0.35 ? 0xfff0c0 : 0xff6a12)
      } else if (b.kind === 'smoke') {
        const s = b.size0 * (1 + u * 4.5)
        b.mesh.scale.setScalar(s)
        mat.opacity = (1 - u) * 0.5
      } else if (b.kind === 'spark') {
        mat.opacity = 1 - u
        const s = b.size0 * (1 - u * 0.4)
        b.mesh.scale.set(s, s, s * (1.4 + u))
      } else {
        mat.opacity = Math.max(0.15, 1 - u * 0.55)
      }
    }

    if (this.age > 5.5) this.stop()
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

  private spawnBit(kind: Bit['kind'], inherit: Vector3, speed: number, life: number): void {
    let mesh: Mesh
    if (kind === 'debris') {
      mesh = new Mesh(this.boxGeo, this.debrisMat.clone())
      const s = 0.25 + Math.random() * 0.7
      mesh.scale.set(s, s * (0.4 + Math.random()), s * (0.5 + Math.random() * 0.8))
      mesh.castShadow = true
    } else if (kind === 'spark') {
      mesh = new Mesh(this.sparkGeo, this.sparkMat.clone())
    } else if (kind === 'smoke') {
      mesh = new Mesh(this.sphereGeo, this.smokeMat.clone())
    } else {
      mesh = new Mesh(this.sphereGeo, (Math.random() > 0.45 ? this.fireHotMat : this.fireMat).clone())
    }
    mesh.position.set(
      (Math.random() - 0.5) * 2.2,
      (Math.random() - 0.2) * 1.6,
      (Math.random() - 0.5) * 2.2,
    )
    const dir = new Vector3(Math.random() - 0.5, Math.random() * 0.85 + 0.15, Math.random() - 0.5).normalize()
    const vel = dir.multiplyScalar(speed).add(inherit)
    if (kind === 'smoke') vel.y += 3
    this.root.add(mesh)
    const size0 = kind === 'fire' ? 1.6 + Math.random() * 2.2 : kind === 'smoke' ? 2.2 + Math.random() * 2.8 : 1
    if (kind === 'fire' || kind === 'smoke') mesh.scale.setScalar(size0)
    this.bits.push({
      mesh,
      vel,
      spin: new Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
      ),
      life,
      maxLife: life,
      kind,
      size0,
    })
  }

  private clearBits(): void {
    for (const b of this.bits) {
      this.root.remove(b.mesh)
      const mat = b.mesh.material
      if (mat && mat !== this.fireMat && mat !== this.fireHotMat && mat !== this.smokeMat && mat !== this.sparkMat && mat !== this.debrisMat) {
        ;(mat as MeshBasicMaterial).dispose()
      }
    }
    this.bits.length = 0
  }
}
