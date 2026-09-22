import {
  AdditiveBlending,
  BoxGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Scene,
} from 'three'
import type { RenderQuality } from '../core/RenderQuality'

export const SPEED_STREAK_MAX_COUNT = 12
export const SPEED_STREAK_MIN_SPEED_MPS = 140
export const SPEED_STREAK_MAX_SPEED_MPS = 520

/** Convert airspeed into a restrained, finite-safe airflow intensity. */
export function speedStreakIntensity(speedMps: number, afterburner = false): number {
  if (!Number.isFinite(speedMps)) return 0
  const speedT = Math.max(0, Math.min(1, (speedMps - SPEED_STREAK_MIN_SPEED_MPS) /
    (SPEED_STREAK_MAX_SPEED_MPS - SPEED_STREAK_MIN_SPEED_MPS)))
  const boost = afterburner === true ? 0.16 : 0
  return Math.max(0, Math.min(1, speedT * 0.84 + boost))
}

/** Keep external streaks out of cockpit, ground, and non-flight presentation. */
export function speedStreakActive(
  speedMps: number,
  afterburner: boolean,
  onGround: boolean,
  externalView: boolean,
): boolean {
  return Number.isFinite(speedMps) && speedMps >= SPEED_STREAK_MIN_SPEED_MPS &&
    onGround !== true && externalView === true &&
    speedStreakIntensity(speedMps, afterburner) > 0.02
}

/** Quality-aware pool sizing with no allocations when the preset changes. */
export function speedStreakCount(quality: RenderQuality): number {
  if (quality === 'low') return 0
  return quality === 'high' ? SPEED_STREAK_MAX_COUNT : 8
}

const STREAK_LAYOUT = [
  [-2.8, 0.15, -3.2, 0.18, 0.32],
  [2.8, 0.15, -3.2, 0.18, 0.32],
  [-2.1, 0.5, -4.7, 0.15, 0.28],
  [2.1, 0.5, -4.7, 0.15, 0.28],
  [-3.7, -0.05, -5.8, 0.13, 0.24],
  [3.7, -0.05, -5.8, 0.13, 0.24],
  [-1.2, 0.9, -6.3, 0.11, 0.21],
  [1.2, 0.9, -6.3, 0.11, 0.21],
  [-4.4, 0.25, -7.2, 0.1, 0.2],
  [4.4, 0.25, -7.2, 0.1, 0.2],
  [-2.7, -0.3, -8.3, 0.09, 0.18],
  [2.7, -0.3, -8.3, 0.09, 0.18],
] as const

const _matrix = new Matrix4()
const _position = new Vector3()
const _scale = new Vector3()
const _identity = new Quaternion()

/**
 * One fixed instanced batch of airflow streaks. The mesh is parented at the
 * interpolated aircraft pose, so the effect follows the visible jet without
 * adding world objects or per-frame allocations.
 */
export class SpeedStreakFx {
  readonly root = new Group()
  private readonly geometry: BoxGeometry
  private readonly material: MeshBasicMaterial
  private readonly mesh: InstancedMesh
  private activeCount = 0
  private enabled = true
  private reducedMotion = false
  private active = false
  private disposed = false

  constructor(scene: Scene) {
    this.root.name = 'SpeedStreakFx'
    this.root.visible = false
    scene.add(this.root)
    this.geometry = new BoxGeometry(1, 1, 1)
    this.material = new MeshBasicMaterial({
      color: 0xbdefff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    this.mesh = new InstancedMesh(this.geometry, this.material, SPEED_STREAK_MAX_COUNT)
    this.mesh.name = 'SpeedStreakBatch'
    this.mesh.frustumCulled = false
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.root.add(this.mesh)
    this.hideInstances()
    this.mesh.instanceMatrix.needsUpdate = true
  }

  get count(): number {
    return this.activeCount
  }

  get isActive(): boolean {
    return this.active
  }

  setRenderQuality(quality: RenderQuality): void {
    if (this.disposed) return
    this.activeCount = speedStreakCount(quality)
    this.mesh.count = this.activeCount
    if (this.activeCount === 0) this.reset()
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
    afterburner: boolean,
    onGround: boolean,
    externalView: boolean,
  ): void {
    if (this.disposed || !this.enabled || this.reducedMotion || this.activeCount === 0) {
      this.reset()
      return
    }
    const intensity = speedStreakActive(speedMps, afterburner, onGround, externalView)
      ? speedStreakIntensity(speedMps, afterburner)
      : 0
    if (intensity <= 0) {
      this.reset()
      return
    }

    this.active = true
    this.root.visible = true
    this.root.position.copy(position)
    this.root.quaternion.copy(orientation)
    this.material.opacity = Math.min(0.26, 0.045 + intensity * 0.2)

    for (let index = 0; index < SPEED_STREAK_MAX_COUNT; index += 1) {
      if (index >= this.activeCount) {
        _matrix.makeScale(0, 0, 0)
        this.mesh.setMatrixAt(index, _matrix)
        continue
      }
      const [x, y, z, width, baseLength] = STREAK_LAYOUT[index]!
      _position.set(x, y, z)
      _scale.set(width, width, baseLength * (0.65 + intensity * 1.9))
      _matrix.compose(_position, _identity, _scale)
      this.mesh.setMatrixAt(index, _matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
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

  private hideInstances(): void {
    _matrix.makeScale(0, 0, 0)
    for (let index = 0; index < SPEED_STREAK_MAX_COUNT; index += 1) {
      this.mesh.setMatrixAt(index, _matrix)
    }
  }
}
