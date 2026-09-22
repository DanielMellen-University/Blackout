import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three'
import type { RenderQuality } from '../core/RenderQuality'

export const SONIC_BOOM_DURATION_SEC = 0.72

/** Keep the shockwave age finite and inside its short presentation window. */
export function sonicBoomProgress(age: number, duration = SONIC_BOOM_DURATION_SEC): number {
  const safeAge = Number.isFinite(age) ? Math.max(0, age) : 0
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : SONIC_BOOM_DURATION_SEC
  return Math.min(1, safeAge / safeDuration)
}

/** Expand the ring smoothly without a visible jump at the Mach crossing. */
export function sonicBoomScale(progress: number, reducedMotion = false): number {
  const safe = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  if (reducedMotion) return 1.05
  const eased = 1 - Math.pow(1 - safe, 2)
  return 0.28 + eased * 2.2
}

/** Fade the shockwave quickly enough to stay exciting without flashing. */
export function sonicBoomOpacity(progress: number, reducedMotion = false): number {
  const safe = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const ceiling = reducedMotion ? 0.24 : 0.42
  return ceiling * Math.pow(1 - safe, reducedMotion ? 1 : 0.78)
}

/** One reusable ring keeps Mach-crossing feedback visual without scene growth. */
export class SonicBoomFx {
  readonly root = new Group()
  private readonly geometry: TorusGeometry
  private readonly material: MeshBasicMaterial
  private readonly ring: Mesh
  private age = 0
  private active = false
  private reducedMotion = false
  private visualQuality: RenderQuality = 'balanced'
  private disposed = false

  constructor(parent: Group | { add(object: Group): unknown }) {
    this.root.name = 'SonicBoomFx'
    this.root.visible = false
    this.geometry = new TorusGeometry(1.2, 0.035, 8, 28)
    this.material = new MeshBasicMaterial({
      color: 0xb9ecff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    })
    this.ring = new Mesh(this.geometry, this.material)
    this.ring.name = 'SonicBoomRing'
    this.ring.frustumCulled = false
    this.root.add(this.ring)
    parent.add(this.root)
  }

  setRenderQuality(quality: RenderQuality): void {
    this.visualQuality = quality
    if (!this.active) return
    this.updatePresentation()
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced === true
    if (!this.active) return
    this.updatePresentation()
  }

  trigger(position: Vector3, orientation: Quaternion): void {
    if (this.disposed) return
    this.age = 0
    this.active = true
    this.root.visible = true
    this.root.position.copy(position)
    this.root.quaternion.copy(orientation)
    this.updatePresentation()
  }

  update(dt: number): void {
    if (this.disposed || !this.active) return
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.12) : 0
    this.age += safeDt
    this.updatePresentation()
    if (this.age >= SONIC_BOOM_DURATION_SEC) {
      this.active = false
      this.root.visible = false
      this.material.opacity = 0
    }
  }

  reset(): void {
    this.age = 0
    this.active = false
    this.root.visible = false
    this.material.opacity = 0
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.remove(this.ring)
    this.geometry.dispose()
    this.material.dispose()
  }

  private updatePresentation(): void {
    const progress = sonicBoomProgress(this.age)
    const lowQualityScale = this.visualQuality === 'low' ? 0.82 : 1
    this.root.scale.setScalar(sonicBoomScale(progress, this.reducedMotion) * lowQualityScale)
    this.material.opacity = sonicBoomOpacity(progress, this.reducedMotion)
  }
}
