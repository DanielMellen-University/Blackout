import {
  Box3,
  Group,
  Quaternion,
  Vector3,
  type Camera,
  type Scene,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDefaultControls, type ControlState } from '../core/types'
import { createPlaceholderF35 } from './createPlaceholderF35'

const SPAWN = new Vector3(0, 8, 0)
const _flat = new Vector3()
const _move = new Vector3()
const _forward = new Vector3()
const _up = new Vector3(0, 1, 0)
const _nose = new Vector3(0, 0, 1)
const _targetQuat = new Quaternion()
const _yawQuat = new Quaternion()

/**
 * Aircraft entity: simulation state + Three.js mesh.
 * Phase 0 uses free-fly translation; FlightModel hooks in at Phase 1.
 */
export class Aircraft {
  readonly mesh: Group
  readonly position = SPAWN.clone()
  readonly velocity = new Vector3()
  readonly orientation = new Quaternion()
  readonly angularVelocity = new Vector3()
  controls: ControlState = createDefaultControls()

  mass = 15_000
  usingPlaceholder = true

  private readonly spawnPosition = SPAWN.clone()

  constructor() {
    this.mesh = new Group()
    this.mesh.name = 'Aircraft'
    const placeholder = createPlaceholderF35()
    placeholder.name = 'model'
    this.mesh.add(placeholder)
    this.syncMesh()
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh)
  }

  /**
   * Try to load a real F-35 GLB from `/models/f35.glb`.
   * Falls back silently to the procedural F-35.
   */
  async tryLoadModel(url = '/models/f35.glb'): Promise<boolean> {
    const loader = new GLTFLoader()
    try {
      const gltf = await loader.loadAsync(url)
      const model = gltf.scene
      model.name = 'model'

      // Normalize: center, scale to ~15 m length
      const box = new Box3().setFromObject(model)
      const size = box.getSize(new Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0.001) {
        model.scale.multiplyScalar(15.7 / maxDim)
      }
      box.setFromObject(model)
      model.position.sub(box.getCenter(new Vector3()))
      box.setFromObject(model)
      model.position.y -= box.min.y

      model.traverse((obj) => {
        if ((obj as { isMesh?: boolean }).isMesh) {
          obj.castShadow = true
          obj.receiveShadow = true
        }
      })

      const old = this.mesh.getObjectByName('model')
      if (old) this.mesh.remove(old)
      this.mesh.add(model)
      this.usingPlaceholder = false
      console.info('[Blackout] Loaded aircraft model:', url)
      return true
    } catch {
      console.info('[Blackout] No GLB at', url, '— using procedural F-35')
      return false
    }
  }

  reset(): void {
    this.position.copy(this.spawnPosition)
    this.velocity.set(0, 0, 0)
    this.orientation.identity()
    this.angularVelocity.set(0, 0, 0)
    this.controls = createDefaultControls()
    this.syncMesh()
  }

  /**
   * Phase 0 free-fly: body-relative (nose-first), not camera-relative.
   * W/S = along the nose, A/D = yaw turn, Q/E = down/up, Shift = boost.
   * This avoids the “slides backwards” feel of camera-relative orbit freefly.
   */
  freeFlyStep(dt: number, _camera?: Camera): void {
    const baseSpeed = 28
    const boostMul = this.controls.boost ? 2.4 : 1
    const speed = baseSpeed * (0.35 + this.controls.throttle) * boostMul
    const yawSpeed = 1.8 // rad/s

    const inputFwd = this.controls.pitch // W = +1, S = -1
    const inputYaw = this.controls.roll // D = +1 (yaw right), A = -1
    const inputUp = this.controls.yaw // E = +1, Q = -1

    // Yaw around world up (A/D turn the jet)
    if (inputYaw !== 0) {
      _yawQuat.setFromAxisAngle(_up, -inputYaw * yawSpeed * dt)
      this.orientation.premultiply(_yawQuat)
      this.orientation.normalize()
    }

    // Local nose (+Z) and right (+X) on the horizontal plane
    _forward.copy(_nose).applyQuaternion(this.orientation)
    _forward.y = 0
    if (_forward.lengthSq() < 1e-6) {
      _forward.set(0, 0, 1)
    } else {
      _forward.normalize()
    }

    _move.set(0, 0, 0)
    _move.addScaledVector(_forward, inputFwd)
    _move.y = inputUp

    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(speed)
      this.velocity.lerp(_move, 1 - Math.exp(-6 * dt))
    } else {
      this.velocity.multiplyScalar(Math.exp(-3 * dt))
    }

    this.position.addScaledVector(this.velocity, dt)

    if (this.position.y < 1.5) {
      this.position.y = 1.5
      this.velocity.y = Math.max(0, this.velocity.y)
    }

    // Keep nose aligned with horizontal travel when moving forward/back
    _flat.set(this.velocity.x, 0, this.velocity.z)
    if (_flat.lengthSq() > 0.4 && Math.abs(inputFwd) > 0.1) {
      _flat.normalize()
      // Map model +Z (nose) → travel direction
      _targetQuat.setFromUnitVectors(_nose, _flat)
      this.orientation.slerp(_targetQuat, 1 - Math.exp(-10 * dt))
    }

    this.syncMesh()
  }

  syncMesh(): void {
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.orientation)
  }

  get speed(): number {
    return this.velocity.length()
  }
}
