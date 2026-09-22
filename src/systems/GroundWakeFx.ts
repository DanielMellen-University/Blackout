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

export const GROUND_WAKE_MAX_ALTITUDE_M = 120
export const GROUND_WAKE_MIN_SPEED_MPS = 45

/** Keep low land-pass wake intensity finite and clearance-aware. */
export function groundWakeIntensity(speedMps: number, clearanceM: number): number {
  if (!Number.isFinite(speedMps) || !Number.isFinite(clearanceM)) return 0
  const speed = Math.max(0, speedMps)
  const clearance = Math.max(0, clearanceM)
  if (speed < GROUND_WAKE_MIN_SPEED_MPS || clearance > GROUND_WAKE_MAX_ALTITUDE_M) return 0
  const speedT = Math.min(1, (speed - GROUND_WAKE_MIN_SPEED_MPS) / 250)
  const heightT = 1 - Math.min(1, Math.max(0, clearance - 6) / GROUND_WAKE_MAX_ALTITUDE_M)
  return Math.max(0, Math.min(1, speedT * (0.28 + heightT * 0.72)))
}

/** Require an airborne land pass before the pooled dust ribbon is visible. */
export function groundWakeActive(
  isWater: boolean,
  onGround: boolean,
  speedMps: number,
  clearanceM: number,
): boolean {
  return isWater !== true && onGround !== true &&
    groundWakeIntensity(speedMps, clearanceM) > 0
}

/** One fixed three-strip batch gives low land passes a readable ground cue. */
export class GroundWakeFx {
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
    this.root.name = 'GroundWakeFx'
    this.root.visible = false
    scene.add(this.root)
    this.geometry = new PlaneGeometry(1, 1)
    this.material = new MeshBasicMaterial({
      color: 0xb6a17e,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    })
    this.mesh = new InstancedMesh(this.geometry, this.material, 3)
    this.mesh.name = 'GroundWakeStrips'
    this.mesh.frustumCulled = false
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.root.add(this.mesh)
    this.writeStrip(0, -0.82, 0.8, 0.48, 6.4)
    this.writeStrip(1, 0.82, 0.8, 0.48, 6.4)
    this.writeStrip(2, 0, 1.65, 0.26, 5.4)
    this.mesh.instanceMatrix.needsUpdate = true
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
    velocity: Vector3,
    clearanceM: number,
    isWater: boolean,
    onGround: boolean,
    externalView: boolean,
  ): void {
    if (this.disposed || !this.enabled || this.reducedMotion || externalView !== true) {
      this.reset()
      return
    }
    const speed = Math.hypot(velocity.x, velocity.z)
    const intensity = groundWakeActive(isWater, onGround, speed, clearanceM)
      ? groundWakeIntensity(speed, clearanceM)
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
    const pulse = 0.9 + Math.sin(position.x * 0.012 + position.z * 0.008) * 0.1
    this.material.opacity = Math.max(0, Math.min(0.3, intensity * 0.3 * pulse))
  }

  reset(): void {
    if (this.disposed) return
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

  private writeStrip(index: number, x: number, z: number, width: number, length: number): void {
    this.scratch.set(x, 0, z)
    this.matrix.makeScale(width, length, 1)
    this.matrix.setPosition(this.scratch)
    this.mesh.setMatrixAt(index, this.matrix)
  }
}
