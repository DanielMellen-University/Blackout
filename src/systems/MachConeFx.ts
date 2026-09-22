import {
  AdditiveBlending,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Scene,
} from 'three'
import type { RenderQuality } from '../core/RenderQuality'

export const MACH_CONE_MIN_SPEED_MPS = 340
export const MACH_CONE_MAX_SPEED_MPS = 520

/** Normalize supersonic speed into a finite, presentation-safe intensity. */
export function machConeIntensity(speedMps: number): number {
  if (!Number.isFinite(speedMps)) return 0
  return Math.max(0, Math.min(1, (speedMps - MACH_CONE_MIN_SPEED_MPS) /
    (MACH_CONE_MAX_SPEED_MPS - MACH_CONE_MIN_SPEED_MPS)))
}

/** Keep the cone out of ground, cockpit, and non-supersonic presentations. */
export function machConeActive(
  speedMps: number,
  onGround: boolean,
  externalView: boolean,
): boolean {
  return Number.isFinite(speedMps) && speedMps >= MACH_CONE_MIN_SPEED_MPS &&
    onGround !== true && externalView === true && machConeIntensity(speedMps) > 0
}

/** One pooled cone is enough for the aircraft's supersonic silhouette. */
export class MachConeFx {
  readonly root = new Group()
  private readonly geometry: ConeGeometry
  private readonly material: MeshBasicMaterial
  private readonly cone: Mesh
  private readonly localRotation = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    Math.PI / 2,
  )
  private readonly scale = new Vector3()
  private active = false
  private enabled = true
  private reducedMotion = false
  private disposed = false

  constructor(scene: Scene) {
    this.root.name = 'MachConeFx'
    this.root.visible = false
    scene.add(this.root)
    this.geometry = new ConeGeometry(1, 7, 18, 1, true)
    this.material = new MeshBasicMaterial({
      color: 0xa9e6f2,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
    this.cone = new Mesh(this.geometry, this.material)
    this.cone.name = 'MachCone'
    this.cone.frustumCulled = false
    this.root.add(this.cone)
  }

  get isActive(): boolean {
    return this.active
  }

  setRenderQuality(quality: RenderQuality): void {
    if (this.disposed) return
    this.enabled = quality !== 'low'
    if (!this.enabled) this.reset()
  }

  setReducedMotion(enabled: boolean): void {
    if (this.disposed) return
    this.reducedMotion = enabled === true
    if (this.reducedMotion) this.reset()
  }

  update(
    position: Vector3,
    orientation: Quaternion,
    speedMps: number,
    onGround: boolean,
    externalView: boolean,
  ): void {
    if (this.disposed || !this.enabled || this.reducedMotion) {
      this.reset()
      return
    }
    const intensity = machConeActive(speedMps, onGround, externalView)
      ? machConeIntensity(speedMps)
      : 0
    if (intensity <= 0) {
      this.reset()
      return
    }

    this.active = true
    this.root.visible = true
    this.root.position.copy(position)
    this.root.quaternion.copy(orientation)
    this.root.quaternion.multiply(this.localRotation)
    this.scale.set(
      0.72 + intensity * 0.9,
      0.72 + intensity * 0.9,
      0.82 + intensity * 1.3,
    )
    this.root.scale.copy(this.scale)
    this.material.opacity = Math.min(0.16, 0.035 + intensity * 0.11)
  }

  reset(): void {
    if (this.disposed) return
    this.active = false
    this.root.visible = false
    this.material.opacity = 0
    this.root.scale.setScalar(1)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.remove(this.cone)
    this.geometry.dispose()
    this.material.dispose()
    this.root.removeFromParent()
  }
}
