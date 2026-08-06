import {
  Box3,
  Group,
  Quaternion,
  Vector3,
  type Scene,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDefaultControls, type ControlState } from '../core/types'
import { createPlaceholderF35 } from './createPlaceholderF35'

const SPAWN = new Vector3(0, 8, 0)
const _move = new Vector3()
const _forward = new Vector3()
const _up = new Vector3(0, 1, 0)
const _nose = new Vector3(0, 0, 1)
const _yawQuat = new Quaternion()

/**
 * Aircraft entity: simulation state + Three.js mesh.
 * Phase 0 free-fly is intentionally snappy — no soft accel/orientation lag.
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

  async tryLoadModel(url = '/models/f35.glb'): Promise<boolean> {
    const loader = new GLTFLoader()
    try {
      const gltf = await loader.loadAsync(url)
      const model = gltf.scene
      model.name = 'model'

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
   * Phase 0 free-fly — body-relative, responsive.
   * W/S along nose, A/D yaw, Q/E vertical, Shift boost.
   */
  freeFlyStep(dt: number): void {
    if (dt <= 0) return

    const baseSpeed = 36
    const boostMul = this.controls.boost ? 2.4 : 1
    const speed = baseSpeed * (0.35 + this.controls.throttle) * boostMul
    const yawSpeed = 2.4 // rad/s

    const inputFwd = this.controls.pitch
    const inputYaw = this.controls.roll
    const inputUp = this.controls.yaw

    // Instant yaw response
    if (inputYaw !== 0) {
      _yawQuat.setFromAxisAngle(_up, -inputYaw * yawSpeed * dt)
      this.orientation.premultiply(_yawQuat)
      this.orientation.normalize()
    }

    // Horizontal forward from current nose
    _forward.copy(_nose).applyQuaternion(this.orientation)
    _forward.y = 0
    if (_forward.lengthSq() < 1e-6) {
      _forward.set(0, 0, 1)
    } else {
      _forward.normalize()
    }

    // Target velocity from input — snappy, not floaty
    _move.set(0, 0, 0)
    _move.addScaledVector(_forward, inputFwd * speed)
    _move.y = inputUp * speed

    if (_move.lengthSq() > 0) {
      // Very fast blend (~18) so it feels locked to input, not delayed
      const a = 1 - Math.exp(-18 * dt)
      this.velocity.lerp(_move, a)
    } else {
      // Quick stop when keys released
      this.velocity.multiplyScalar(Math.exp(-10 * dt))
      if (this.velocity.lengthSq() < 0.01) this.velocity.set(0, 0, 0)
    }

    this.position.addScaledVector(this.velocity, dt)

    if (this.position.y < 1.5) {
      this.position.y = 1.5
      this.velocity.y = Math.max(0, this.velocity.y)
    }

    // Mesh always matches sim state this frame (no deferred lag)
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
