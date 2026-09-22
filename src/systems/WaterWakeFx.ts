import {
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type Scene,
} from 'three'
import type { RenderQuality } from '../core/RenderQuality'

export const WATER_WAKE_MAX_ALTITUDE_M = 180
export const WATER_WAKE_MIN_SPEED_MPS = 30

/** Keep water-skim wake intensity finite and bounded for the pooled batch. */
export function waterWakeIntensity(speedMps: number, clearanceM: number): number {
  if (!Number.isFinite(speedMps) || !Number.isFinite(clearanceM)) return 0
  const speed = Math.max(0, speedMps)
  const clearance = Math.max(0, clearanceM)
  if (speed < WATER_WAKE_MIN_SPEED_MPS || clearance > WATER_WAKE_MAX_ALTITUDE_M) return 0
  const speedT = Math.min(1, (speed - WATER_WAKE_MIN_SPEED_MPS) / 250)
  const altitudeT = 1 - Math.min(1, Math.max(0, clearance - 8) / WATER_WAKE_MAX_ALTITUDE_M)
  return Math.max(0, Math.min(1, speedT * (0.35 + altitudeT * 0.65)))
}

/** Require airborne water flight before the wake can become visible. */
export function waterWakeActive(
  isWater: boolean,
  onGround: boolean,
  speedMps: number,
  clearanceM: number,
): boolean {
  return isWater === true && onGround !== true && waterWakeIntensity(speedMps, clearanceM) > 0
}

/** One instanced three-strip wake keeps low passes readable without particles. */
export class WaterWakeFx {
  readonly root = new Group()
  private readonly geometry: PlaneGeometry
  private readonly material: MeshBasicMaterial
  private readonly mesh: InstancedMesh
  private readonly matrix = new Matrix4()
  private readonly scratch = new Vector3()
  private active = false
  private enabled = true
  private reducedMotion = false
  private disposed = false

  constructor(scene: Scene) {
    this.root.name = 'WaterWakeFx'
    this.root.visible = false
    scene.add(this.root)
    this.geometry = new PlaneGeometry(1, 1)
    this.material = new MeshBasicMaterial({
      color: 0xc3e9f0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    })
    this.mesh = new InstancedMesh(this.geometry, this.material, 3)
    this.mesh.name = 'WaterWakeStrips'
    this.mesh.frustumCulled = false
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.root.add(this.mesh)
    this.writeStrip(0, -0.72, 0.65, 0.34, 5.4)
    this.writeStrip(1, 0.72, 0.65, 0.34, 5.4)
    this.writeStrip(2, 0, 1.5, 0.2, 4.2)
    this.mesh.instanceMatrix.needsUpdate = true
  }

  setRenderQuality(quality: RenderQuality): void {
    this.enabled = quality !== 'low'
    if (!this.enabled) this.reset()
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled === true
  }

  update(
    dt: number,
    position: Vector3,
    velocity: Vector3,
    clearanceM: number,
    isWater: boolean,
    onGround: boolean,
  ): void {
    if (this.disposed || !this.enabled || !Number.isFinite(dt) || dt <= 0) return
    const speed = Math.hypot(velocity.x, velocity.z)
    const intensity = waterWakeActive(isWater, onGround, speed, clearanceM)
      ? waterWakeIntensity(speed, clearanceM)
      : 0
    if (intensity <= 0) {
      this.reset()
      return
    }

    this.active = true
    this.root.visible = true
    const safeClearance = Number.isFinite(clearanceM) ? Math.max(0, clearanceM) : 0
    this.root.position.set(position.x, position.y - safeClearance + 0.08, position.z)
    const heading = Math.atan2(velocity.x, velocity.z)
    this.root.rotation.y = Number.isFinite(heading) ? heading : 0
    const pulse = this.reducedMotion ? 1 : 0.92 + Math.sin(position.x * 0.01 + position.z * 0.007) * 0.08
    this.material.opacity = Math.max(0, Math.min(0.42, intensity * 0.42 * pulse))
  }

  reset(): void {
    this.active = false
    this.root.visible = false
    this.material.opacity = 0
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.remove(this.mesh)
    this.geometry.dispose()
    this.material.dispose()
    this.root.removeFromParent()
  }

  get isActive(): boolean {
    return this.active
  }

  private writeStrip(index: number, x: number, z: number, width: number, length: number): void {
    this.scratch.set(x, 0, z)
    this.matrix.makeScale(width, length, 1)
    this.matrix.setPosition(this.scratch)
    this.mesh.setMatrixAt(index, this.matrix)
  }
}
