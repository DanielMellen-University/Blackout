import { BufferAttribute, BufferGeometry, DynamicDrawUsage, LineBasicMaterial, LineSegments, MathUtils } from 'three'
import { precipitationParticleCount } from './SnowField'

const COUNT = 1800
const WIDTH = 180
const HEIGHT = 120
/** Fade precipitation above its source deck instead of raining in the upper sky. */
export function precipitationAtAltitude(altitude: number, storm: number): number {
  if (!Number.isFinite(altitude)) return 0
  const top = 3100 + MathUtils.clamp(Number.isFinite(storm) ? storm : 0, 0, 1) * 3600
  return 1 - MathUtils.smoothstep(altitude, top - 600, top + 250)
}
function wrap(value: number, span: number): number { return ((value % span) + span) % span }

/** Stable integer mixer for seeded rain placement without touching world RNG state. */
function rainHash(seed: number, index: number, salt: number): number {
  let value = (Math.trunc(seed) | 0) ^ Math.imul(index + 1, 0x9e3779b9) ^ Math.imul(Math.trunc(salt) | 0, 0x85ebca6b)
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d)
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b)
  return (value ^ (value >>> 16)) >>> 0
}

function rainRandom(seed: number, index: number, salt: number): number {
  return rainHash(seed, index, salt) / 0x1_0000_0000
}

/** One pooled line draw. Rain remains in world space as the observer moves. */
export class RainField {
  readonly mesh: LineSegments
  private readonly particles = new Float32Array(COUNT * 3)
  private readonly speeds = new Float32Array(COUNT)
  private readonly positions = new Float32Array(COUNT * 6)
  // Keep storm streaks present without turning every pass through a cloud into
  // a wall of white cards. The pooled line draw stays unchanged.
  private readonly material = new LineBasicMaterial({ color: 0x9eb9c7, transparent: true, opacity: .24, depthWrite: false })
  private x = 0
  private y = 0
  private z = 0
  private anchored = false
  private count = COUNT
  private seedValue = 0
  private disposed = false
  constructor() {
    this.setSeed(0)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage))
    this.mesh = new LineSegments(geometry, this.material)
    this.mesh.name = 'RainStreaks'
    this.mesh.frustumCulled = false
    this.mesh.visible = false
  }
  /** Re-key the pooled streaks when a deterministic world is committed. */
  setSeed(seed: number): void {
    if (this.disposed) return
    this.seedValue = Number.isFinite(seed) ? Math.trunc(seed) : 0
    for (let i = 0; i < COUNT; i++) {
      const j = i * 3
      this.particles[j] = (rainRandom(this.seedValue, i, 11) - .5) * WIDTH
      this.particles[j + 1] = (rainRandom(this.seedValue, i, 23) - .5) * HEIGHT
      this.particles[j + 2] = (rainRandom(this.seedValue, i, 37) - .5) * WIDTH
      this.speeds[i] = 34 + rainRandom(this.seedValue, i, 53) * 48
    }
    this.anchored = false
  }
  setDensityScale(scale: number): void {
    this.count = scale <= 0 ? 0 : precipitationParticleCount(COUNT, scale)
    this.mesh.geometry.setDrawRange(0, this.count * 2)
  }
  update(dt: number, x: number, y: number, z: number, intensity: number, windX: number, windZ: number): void {
    if (this.disposed) return
    const rain = MathUtils.clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1)
    this.mesh.visible = rain > .015 && this.count > 0
    const safeX = Number.isFinite(x) ? x : this.x
    const safeY = Number.isFinite(y) ? y : this.y
    const safeZ = Number.isFinite(z) ? z : this.z
    const dx = this.anchored ? safeX - this.x : 0
    const dy = this.anchored ? safeY - this.y : 0
    const dz = this.anchored ? safeZ - this.z : 0
    this.x = safeX; this.y = safeY; this.z = safeZ; this.anchored = true
    this.mesh.position.set(safeX, safeY, safeZ)
    if (!this.mesh.visible) return
    const step = Number.isFinite(dt) ? MathUtils.clamp(dt, 0, .1) : 0
    const wx = Number.isFinite(windX) ? windX : 0
    const wz = Number.isFinite(windZ) ? windZ : 0
    this.material.opacity = rain * .28
    const count = Math.floor(this.count * (.2 + rain * .8))
    this.mesh.geometry.setDrawRange(0, count * 2)
    for (let i = 0; i < count; i++) {
      const j = i * 3, k = i * 6
      const speed = this.speeds[i]! * (1 + rain * .3)
      const px = wrap(this.particles[j]! - dx + wx * step + WIDTH / 2, WIDTH) - WIDTH / 2
      const py = wrap(this.particles[j + 1]! - dy - speed * step + HEIGHT / 2, HEIGHT) - HEIGHT / 2
      const pz = wrap(this.particles[j + 2]! - dz + wz * step + WIDTH / 2, WIDTH) - WIDTH / 2
      this.particles[j] = px; this.particles[j + 1] = py; this.particles[j + 2] = pz
      const exposure = .016 + rain * .018
      this.positions[k] = px; this.positions[k + 1] = py; this.positions[k + 2] = pz
      this.positions[k + 3] = px - wx * exposure
      this.positions[k + 4] = py + speed * exposure
      this.positions[k + 5] = pz - wz * exposure
    }
    this.mesh.geometry.attributes.position!.needsUpdate = true
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
