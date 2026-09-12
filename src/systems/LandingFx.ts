import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three'
import { sampleGroundHeight } from '../world/ground'
import { disposeObjectTree } from '../core/dispose'

interface Puff {
  mesh: Mesh
  vel: Vector3
  life: number
  maxLife: number
  size0: number
  kind: 'dust' | 'smoke'
}

const POOL_DUST = 18
const POOL_SMOKE = 10
const _side = new Vector3()
const _fwd = new Vector3()

/**
 * Soft ground-contact scrub: pooled dust and tire smoke on touchdown / roll.
 * No per-landing geometry allocation.
 */
export class LandingFx {
  readonly root = new Group()
  private readonly dustPool: Puff[] = []
  private readonly smokePool: Puff[] = []
  private readonly active: Puff[] = []
  private readonly dustMat: MeshBasicMaterial
  private readonly smokeMat: MeshBasicMaterial
  private readonly sphereGeo: SphereGeometry
  private readonly discGeo: PlaneGeometry
  private scrubCooldown = 0
  private alive = false
  private randomState = 1

  constructor(scene: Scene) {
    this.root.name = 'LandingFx'
    this.root.visible = false
    scene.add(this.root)

    this.dustMat = new MeshBasicMaterial({
      color: 0xc4b59a,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: DoubleSide,
    })
    this.smokeMat = new MeshBasicMaterial({
      color: 0x6a6e74,
      transparent: true,
      opacity: 0.38,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.sphereGeo = new SphereGeometry(1, 8, 6)
    this.discGeo = new PlaneGeometry(1, 1)

    for (let i = 0; i < POOL_DUST; i++) this.dustPool.push(this.makeDust())
    for (let i = 0; i < POOL_SMOKE; i++) this.smokePool.push(this.makeSmoke())
  }

  get activeCount(): number {
    return this.active.length
  }

  /** Burst on airborne-to-ground contact. Intensity 0-1. */
  trigger(pos: Vector3, vel: Vector3, intensity = 1): void {
    const strength = clamp01(intensity)
    if (strength < 0.05) return
    this.randomState = seedFromLanding(pos, vel, strength)
    this.alive = true
    this.root.visible = true
    this.root.position.set(pos.x, sampleGroundHeight(pos.x, pos.z) + 0.15, pos.z)

    const gs = Math.hypot(vel.x, vel.z)
    _fwd.set(vel.x, 0, vel.z)
    if (gs > 0.4) _fwd.multiplyScalar(1 / gs)
    else _fwd.set(0, 0, 1)
    _side.set(_fwd.z, 0, -_fwd.x)

    const dustN = Math.min(POOL_DUST, 6 + Math.floor(strength * 8))
    for (let i = 0; i < dustN; i++) {
      const puff = this.nextIdle(this.dustPool)
      if (!puff) break
      this.spawnDust(puff, _fwd, _side, gs, strength, true)
    }

    const smokeN = Math.min(POOL_SMOKE, 3 + Math.floor(strength * 5))
    for (let i = 0; i < smokeN; i++) {
      const puff = this.nextIdle(this.smokePool)
      if (!puff) break
      this.spawnSmoke(puff, _fwd, _side, gs, strength)
    }
  }

  /** Continuous low-rate scrub while rolling above a soft ground-speed floor. */
  scrub(pos: Vector3, vel: Vector3, dt: number): void {
    const gs = Math.hypot(vel.x, vel.z)
    const rate = landingScrubRate(gs)
    if (rate <= 0) return
    this.scrubCooldown -= dt
    if (this.scrubCooldown > 0) return
    this.scrubCooldown = 1 / rate

    this.alive = true
    this.root.visible = true
    this.root.position.set(pos.x, sampleGroundHeight(pos.x, pos.z) + 0.12, pos.z)
    _fwd.set(vel.x, 0, vel.z)
    if (gs > 0.4) _fwd.multiplyScalar(1 / gs)
    else _fwd.set(0, 0, 1)
    _side.set(_fwd.z, 0, -_fwd.x)

    const dust = this.nextIdle(this.dustPool)
    if (dust) this.spawnDust(dust, _fwd, _side, gs, landingScrubIntensity(gs), false)
    if (gs > 38) {
      const smoke = this.nextIdle(this.smokePool)
      if (smoke) this.spawnSmoke(smoke, _fwd, _side, gs, landingScrubIntensity(gs) * 0.7)
    }
  }

  update(dt: number): void {
    if (!this.alive) return
    let any = false
    for (let i = this.active.length - 1; i >= 0; i--) {
      const puff = this.active[i]!
      puff.life -= dt
      if (puff.life <= 0) {
        puff.mesh.visible = false
        const last = this.active.pop()!
        if (i < this.active.length) this.active[i] = last
        continue
      }
      any = true
      const u = 1 - puff.life / puff.maxLife
      if (puff.kind === 'dust') {
        puff.vel.y += 1.2 * dt
        puff.vel.multiplyScalar(Math.exp(-1.6 * dt))
        puff.mesh.position.addScaledVector(puff.vel, dt)
        const s = puff.size0 * (1 + u * 2.4)
        puff.mesh.scale.set(s, s * 0.55, s)
        const mat = puff.mesh.material as MeshBasicMaterial
        mat.opacity = (1 - u) * 0.4
      } else {
        puff.vel.y += 3.4 * dt
        puff.vel.multiplyScalar(Math.exp(-0.7 * dt))
        puff.mesh.position.addScaledVector(puff.vel, dt)
        puff.mesh.scale.setScalar(puff.size0 * (1 + u * 3.2))
        const mat = puff.mesh.material as MeshBasicMaterial
        mat.opacity = (1 - u) * 0.34
      }
    }
    if (!any) {
      this.alive = false
      this.root.visible = false
    }
  }

  reset(): void {
    for (const puff of this.active) puff.mesh.visible = false
    this.active.length = 0
    this.scrubCooldown = 0
    this.alive = false
    this.randomState = 1
    this.root.visible = false
  }

  dispose(): void {
    this.reset()
    disposeObjectTree(this.root)
    this.root.removeFromParent()
    this.dustMat.dispose()
    this.smokeMat.dispose()
  }

  private nextIdle(pool: Puff[]): Puff | null {
    for (const puff of pool) {
      if (!puff.mesh.visible) return puff
    }
    return null
  }

  private spawnDust(
    puff: Puff,
    fwd: Vector3,
    side: Vector3,
    gs: number,
    strength: number,
    burst: boolean,
  ): void {
    const lateral = (this.nextRandom() - 0.5) * (burst ? 3.2 : 1.6)
    const aft = -0.4 - this.nextRandom() * (burst ? 2.4 : 1.1)
    puff.mesh.position
      .copy(side)
      .multiplyScalar(lateral)
      .addScaledVector(fwd, aft)
    puff.mesh.position.y = 0.05 + this.nextRandom() * 0.25
    puff.vel
      .copy(side)
      .multiplyScalar(lateral * 0.55)
      .addScaledVector(fwd, -1.2 - this.nextRandom() * 2.4)
    puff.vel.y = 0.6 + this.nextRandom() * 1.8
    if (gs > 1) puff.vel.addScaledVector(fwd, Math.min(8, gs * 0.08))
    const size0 = (burst ? 1.1 : 0.7) + this.nextRandom() * 1.2 * strength
    puff.size0 = size0
    puff.mesh.scale.set(size0, size0 * 0.5, size0)
    const life = (burst ? 0.55 : 0.35) + this.nextRandom() * 0.45
    puff.life = life
    puff.maxLife = life
    ;(puff.mesh.material as MeshBasicMaterial).opacity = 0.42 * strength
    puff.mesh.visible = true
    this.active.push(puff)
  }

  private spawnSmoke(
    puff: Puff,
    fwd: Vector3,
    side: Vector3,
    gs: number,
    strength: number,
  ): void {
    const lateral = (this.nextRandom() - 0.5) * 2.4
    puff.mesh.position
      .copy(side)
      .multiplyScalar(lateral)
      .addScaledVector(fwd, -0.8 - this.nextRandom() * 1.6)
    puff.mesh.position.y = 0.2 + this.nextRandom() * 0.4
    puff.vel
      .copy(side)
      .multiplyScalar(lateral * 0.35)
      .addScaledVector(fwd, -0.6 - this.nextRandom() * 1.4)
    puff.vel.y = 1.4 + this.nextRandom() * 2.2
    if (gs > 1) puff.vel.addScaledVector(fwd, Math.min(6, gs * 0.05))
    const size0 = 0.9 + this.nextRandom() * 1.4 * strength
    puff.size0 = size0
    puff.mesh.scale.setScalar(size0)
    const life = 0.7 + this.nextRandom() * 0.9
    puff.life = life
    puff.maxLife = life
    ;(puff.mesh.material as MeshBasicMaterial).opacity = 0.34 * strength
    puff.mesh.visible = true
    this.active.push(puff)
  }

  private makeDust(): Puff {
    const mesh = new Mesh(this.discGeo, this.dustMat.clone())
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    this.root.add(mesh)
    return { mesh, vel: new Vector3(), life: 0, maxLife: 1, size0: 1, kind: 'dust' }
  }

  private makeSmoke(): Puff {
    const mesh = new Mesh(this.sphereGeo, this.smokeMat.clone())
    mesh.visible = false
    this.root.add(mesh)
    return { mesh, vel: new Vector3(), life: 0, maxLife: 1, size0: 1, kind: 'smoke' }
  }

  private nextRandom(): number {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0
    return this.randomState / 0x100000000
  }
}

/** Continuous scrub intensity from ground speed (m/s). */
export function landingScrubIntensity(groundSpeed: number): number {
  if (!Number.isFinite(groundSpeed) || groundSpeed < 10) return 0
  return Math.min(1, (groundSpeed - 10) / 55)
}

/** Soft spawn rate (Hz) while rolling. */
export function landingScrubRate(groundSpeed: number): number {
  const intensity = landingScrubIntensity(groundSpeed)
  if (intensity <= 0) return 0
  return 2 + intensity * 6
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function seedFromLanding(pos: Vector3, vel: Vector3, intensity: number): number {
  let state = 2166136261
  for (const value of [pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, intensity]) {
    const quantized = Number.isFinite(value) ? Math.round(value * 1000) : 0
    state ^= quantized
    state = Math.imul(state, 16777619)
  }
  return state >>> 0 || 1
}
