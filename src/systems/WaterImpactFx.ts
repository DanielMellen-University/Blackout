import {
  DoubleSide, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3, type Scene,
} from 'three'
import { normalizeRenderQuality, type RenderQuality } from '../core/RenderQuality'

const DURATION = 3.6
const CAPACITY = 64
const finite = (value: number): number => Number.isFinite(value) ? value : 0

/** One pooled spray batch and two foam rings, anchored to the actual water level. */
export class WaterImpactFx {
  readonly root = new Group()
  private readonly geometry = new SphereGeometry(1, 6, 4)
  private readonly foamGeometry = new RingGeometry(0.82, 1, 48)
  private readonly sprayMaterial = new MeshBasicMaterial({
    color: 0xc6e4f5, transparent: true, opacity: 0, depthWrite: false,
  })
  private readonly foamMaterial = new MeshBasicMaterial({
    color: 0xd8edf7, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide,
  })
  private readonly spray = new InstancedMesh(this.geometry, this.sprayMaterial, CAPACITY)
  private readonly rings: Mesh[] = []
  private readonly matrix = new Matrix4()
  private readonly point = new Vector3()
  private readonly inherited = new Vector3()
  private age = 0
  private alive = false
  private low = false
  private reduced = false
  private disposed = false

  constructor(scene: Scene) {
    this.root.name = 'WaterImpactFx'
    this.root.visible = false
    this.spray.name = 'ImpactSpray'
    this.spray.frustumCulled = false
    this.spray.instanceMatrix.setUsage(DynamicDrawUsage)
    this.root.add(this.spray)
    for (let i = 0; i < 2; i++) {
      const ring = new Mesh(this.foamGeometry, this.foamMaterial)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.08 + i * 0.02
      this.root.add(ring)
      this.rings.push(ring)
    }
    scene.add(this.root)
  }

  get active(): boolean { return this.alive }
  get activeCount(): number { return this.alive ? this.spray.count : 0 }
  setRenderQuality(quality: RenderQuality): void {
    if (!this.disposed) this.low = normalizeRenderQuality(quality) === 'low'
  }
  setReducedMotion(reduced: boolean): void {
    if (!this.disposed) this.reduced = reduced === true
  }

  trigger(position: Vector3, velocity: Vector3, waterLevel: number): void {
    if (this.disposed) return
    this.root.position.set(finite(position.x), finite(waterLevel), finite(position.z))
    this.inherited.set(finite(velocity.x), 0, finite(velocity.z)).multiplyScalar(0.045).clampLength(0, 18)
    this.spray.count = this.low ? 24 : CAPACITY
    this.age = 0
    this.alive = true
    this.root.visible = true
    this.present()
  }

  update(dt: number): void {
    if (this.disposed || !this.alive || !Number.isFinite(dt) || dt <= 0) return
    this.age += dt
    if (this.age >= DURATION) { this.reset(); return }
    this.present()
  }

  reset(): void {
    this.alive = false
    this.age = 0
    this.root.visible = false
  }

  dispose(): void {
    if (this.disposed) return
    this.reset()
    this.disposed = true
    this.root.removeFromParent()
    this.geometry.dispose()
    this.foamGeometry.dispose()
    this.sprayMaterial.dispose()
    this.foamMaterial.dispose()
    this.spray.dispose()
  }

  private present(): void {
    const t = this.reduced ? 0.18 : this.age
    const fade = Math.max(0, 1 - this.age / DURATION)
    this.sprayMaterial.opacity = fade * 0.72
    this.foamMaterial.opacity = fade * 0.52
    for (let i = 0; i < this.spray.count; i++) {
      // Golden-angle distribution: irregular crown, central jets, then falling droplets.
      const angle = i * 2.3999632297
      const shape = ((i * 17) % 31) / 31
      const radial = 4 + shape * 17
      const launch = i % 4 === 0 ? 25 + shape * 9 : 11 + shape * 13
      const spread = 0.6 + radial * t
      const height = Math.max(0.1, 0.5 + launch * t - 9.8 * t * t)
      this.point.set(Math.cos(angle) * spread + this.inherited.x * t,
        height, Math.sin(angle) * spread + this.inherited.z * t)
      const size = (0.3 + shape * 0.7) * fade
      this.matrix.makeScale(size, size * (i % 4 === 0 ? 4 : 1.8), size)
      this.matrix.setPosition(this.point)
      this.spray.setMatrixAt(i, this.matrix)
    }
    this.spray.instanceMatrix.needsUpdate = true
    for (let i = 0; i < this.rings.length; i++) {
      const radius = this.reduced ? 7 + i * 4 : 2 + Math.max(0, this.age - i * 0.18) * (15 - i * 3)
      this.rings[i]!.scale.set(radius, radius * (1.08 + i * 0.12), 1)
    }
  }
}
