import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
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
  ember?: Mesh
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
  private readonly debrisDarkMat: MeshStandardMaterial
  private readonly debrisHotMat: MeshStandardMaterial
  private readonly ringMat: MeshBasicMaterial
  private readonly sphereGeo: SphereGeometry
  private readonly boxGeo: BoxGeometry
  private readonly panelGeo: BoxGeometry
  private readonly rodGeo: CylinderGeometry
  private readonly shardGeo: ConeGeometry
  private readonly sparkGeo: BoxGeometry
  private readonly emberGeo: SphereGeometry
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
      color: 0x9aa2aa,
      roughness: 0.55,
      metalness: 0.28,
    })
    this.debrisDarkMat = new MeshStandardMaterial({
      color: 0x2e3238,
      roughness: 0.7,
      metalness: 0.18,
    })
    this.debrisHotMat = new MeshStandardMaterial({
      color: 0xff6a22,
      emissive: 0xff3a08,
      emissiveIntensity: 1.8,
      roughness: 0.4,
      metalness: 0.35,
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
    this.panelGeo = new BoxGeometry(2.4, 0.08, 0.9)
    this.rodGeo = new CylinderGeometry(0.06, 0.08, 2.1, 5)
    this.shardGeo = new ConeGeometry(0.28, 1.4, 4)
    this.sparkGeo = new BoxGeometry(0.12, 0.12, 0.9)
    this.emberGeo = new SphereGeometry(0.22, 6, 5)

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

    const inherit = vel.clone().multiplyScalar(0.42)

    for (let i = 0; i < 12; i++) {
      this.spawnBit('fire', inherit, 1.2 + Math.random() * 3.5, 0.7 + Math.random() * 0.55)
    }
    for (let i = 0; i < 16; i++) {
      this.spawnBit('smoke', inherit, 1.6 + Math.random() * 3.2, 2.0 + Math.random() * 1.8)
    }
    for (let i = 0; i < 36; i++) {
      this.spawnBit('spark', inherit, 14 + Math.random() * 38, 0.45 + Math.random() * 0.7)
    }
    for (let i = 0; i < 42; i++) {
      this.spawnBit('debris', inherit, 16 + Math.random() * 42, 3.5 + Math.random() * 4.5)
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
      const grav = b.kind === 'smoke' ? 2.2 : b.kind === 'debris' ? 22 : 18
      b.vel.y -= grav * dt
      if (b.kind === 'smoke') {
        b.vel.multiplyScalar(Math.exp(-0.55 * dt))
        b.vel.y += 7 * dt
      } else if (b.kind === 'fire') {
        b.vel.multiplyScalar(Math.exp(-1.1 * dt))
        b.vel.y += 4 * dt
      } else if (b.kind === 'debris') {
        b.vel.multiplyScalar(Math.exp(-0.12 * dt))
      } else {
        b.vel.multiplyScalar(Math.exp(-0.28 * dt))
      }

      b.mesh.position.addScaledVector(b.vel, dt)
      const gy = sampleGroundHeight(this.root.position.x + b.mesh.position.x, this.root.position.z + b.mesh.position.z)
      const worldY = this.root.position.y + b.mesh.position.y
      if (worldY < gy + 0.25) {
        b.mesh.position.y = gy + 0.25 - this.root.position.y
        if (b.vel.y < 0) b.vel.y *= b.kind === 'debris' ? -0.42 : -0.12
        b.vel.x *= b.kind === 'debris' ? 0.82 : 0.7
        b.vel.z *= b.kind === 'debris' ? 0.82 : 0.7
        if (b.kind === 'debris') b.spin.multiplyScalar(0.65)
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
        mat.opacity = Math.max(0.2, 1 - u * 0.4)
        if (mat instanceof MeshStandardMaterial && mat.emissiveIntensity > 0) {
          mat.emissiveIntensity = 1.8 * (1 - u)
        }
        if (b.ember) {
          const em = b.ember.material as MeshBasicMaterial
          em.opacity = (1 - u) * 0.9
          const es = 0.35 + (1 - u) * 0.55
          b.ember.scale.setScalar(es)
        }
      }
    }

    if (this.age > 9) this.stop()
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
    let ember: Mesh | undefined
    if (kind === 'debris') {
      const roll = Math.random()
      const geo = roll < 0.38 ? this.panelGeo : roll < 0.68 ? this.shardGeo : roll < 0.88 ? this.rodGeo : this.boxGeo
      const hot = Math.random() > 0.55
      const mat = hot ? this.debrisHotMat.clone() : Math.random() > 0.5 ? this.debrisMat.clone() : this.debrisDarkMat.clone()
      mesh = new Mesh(geo, mat)
      const s = 0.55 + Math.random() * 1.35
      mesh.scale.set(s * (0.7 + Math.random() * 0.8), s * (0.35 + Math.random() * 0.7), s)
      mesh.castShadow = true
      if (hot) {
        ember = new Mesh(this.emberGeo, this.fireHotMat.clone())
        ember.position.set(0, 0.15, 0)
        mesh.add(ember)
      }
    } else if (kind === 'spark') {
      mesh = new Mesh(this.sparkGeo, this.sparkMat.clone())
    } else if (kind === 'smoke') {
      mesh = new Mesh(this.sphereGeo, this.smokeMat.clone())
    } else {
      mesh = new Mesh(this.sphereGeo, (Math.random() > 0.45 ? this.fireHotMat : this.fireMat).clone())
    }
    mesh.position.set(
      (Math.random() - 0.5) * (kind === 'debris' ? 4.5 : 2.2),
      (Math.random() * 2.4),
      (Math.random() - 0.5) * (kind === 'debris' ? 4.5 : 2.2),
    )
    const upBias = kind === 'debris' ? 0.55 : 0.15
    const dir = new Vector3(
      Math.random() - 0.5,
      Math.random() * 0.9 + upBias,
      Math.random() - 0.5,
    ).normalize()
    const vel = dir.multiplyScalar(speed).add(inherit)
    if (kind === 'smoke') vel.y += 3
    if (kind === 'debris') vel.y += 8 + Math.random() * 14
    this.root.add(mesh)
    const size0 = kind === 'fire' ? 1.6 + Math.random() * 2.2 : kind === 'smoke' ? 2.2 + Math.random() * 2.8 : 1
    if (kind === 'fire' || kind === 'smoke') mesh.scale.setScalar(size0)
    this.bits.push({
      mesh,
      vel,
      spin: new Vector3(
        (Math.random() - 0.5) * (kind === 'debris' ? 18 : 8),
        (Math.random() - 0.5) * (kind === 'debris' ? 18 : 8),
        (Math.random() - 0.5) * (kind === 'debris' ? 18 : 8),
      ),
      life,
      maxLife: life,
      kind,
      size0,
      ember,
    })
  }

  private clearBits(): void {
    for (const b of this.bits) {
      this.root.remove(b.mesh)
      const mat = b.mesh.material
      if (b.ember) {
        const em = b.ember.material
        if (em && em !== this.fireHotMat) (em as MeshBasicMaterial).dispose()
      }
      if (
        mat &&
        mat !== this.fireMat &&
        mat !== this.fireHotMat &&
        mat !== this.smokeMat &&
        mat !== this.sparkMat &&
        mat !== this.debrisMat &&
        mat !== this.debrisDarkMat &&
        mat !== this.debrisHotMat
      ) {
        ;(mat as MeshBasicMaterial).dispose()
      }
    }
    this.bits.length = 0
  }
}
