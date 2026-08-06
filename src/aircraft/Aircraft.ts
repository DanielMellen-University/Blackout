import { Box3, Group, Mesh, Quaternion, Vector3, type Object3D, type Scene } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDefaultControls, type ControlState } from '../core/types'
import { createPlaceholderF35 } from './createPlaceholderF35'

const SPAWN = new Vector3(0, 8, 0)
const _move = new Vector3()
const _forward = new Vector3()
const _up = new Vector3(0, 1, 0)
const _nose = new Vector3(0, 0, 1)
const _yawQuat = new Quaternion()
const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()

/**
 * Aircraft entity: sim state + Three.js mesh.
 * Phase 0 free-fly is snappy; FlightModel takes over in Phase 1.
 */
export class Aircraft {
  readonly mesh: Group
  readonly position = SPAWN.clone()
  readonly velocity = new Vector3()
  readonly orientation = new Quaternion()
  /** Reserved for Phase 1 flight model. */
  readonly angularVelocity = new Vector3()
  controls: ControlState = createDefaultControls()

  /** Reserved for Phase 1 flight model. */
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
   * Optional real GLB at `/models/f35.glb`. Falls back to procedural mesh.
   */
  async tryLoadModel(url = '/models/f35.glb'): Promise<boolean> {
    try {
      const gltf = await new GLTFLoader().loadAsync(url)
      const model = gltf.scene
      model.name = 'model'

      _box.setFromObject(model)
      _box.getSize(_size)
      const maxDim = Math.max(_size.x, _size.y, _size.z)
      if (maxDim > 0.001) {
        model.scale.multiplyScalar(15.7 / maxDim)
      }
      _box.setFromObject(model)
      model.position.sub(_box.getCenter(_center))
      _box.setFromObject(model)
      model.position.y -= _box.min.y

      model.traverse(enableShadows)

      const old = this.mesh.getObjectByName('model')
      if (old) this.mesh.remove(old)
      this.mesh.add(model)
      this.usingPlaceholder = false
      return true
    } catch {
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
   * Phase 0 free-fly: body-relative W/S, A/D yaw, Q/E vertical, Shift boost.
   */
  freeFlyStep(dt: number): void {
    if (dt <= 0) return

    const baseSpeed = 36
    const boostMul = this.controls.boost ? 2.4 : 1
    const speed = baseSpeed * (0.35 + this.controls.throttle) * boostMul
    const yawSpeed = 2.4

    const inputFwd = this.controls.pitch
    const inputYaw = this.controls.roll
    const inputUp = this.controls.yaw

    if (inputYaw !== 0) {
      _yawQuat.setFromAxisAngle(_up, -inputYaw * yawSpeed * dt)
      this.orientation.premultiply(_yawQuat).normalize()
    }

    _forward.copy(_nose).applyQuaternion(this.orientation)
    _forward.y = 0
    if (_forward.lengthSq() < 1e-6) {
      _forward.set(0, 0, 1)
    } else {
      _forward.normalize()
    }

    _move.set(0, 0, 0)
    _move.addScaledVector(_forward, inputFwd * speed)
    _move.y = inputUp * speed

    if (_move.lengthSq() > 0) {
      this.velocity.lerp(_move, 1 - Math.exp(-18 * dt))
    } else {
      this.velocity.multiplyScalar(Math.exp(-10 * dt))
      if (this.velocity.lengthSq() < 0.01) this.velocity.set(0, 0, 0)
    }

    this.position.addScaledVector(this.velocity, dt)

    // Soft floor until CollisionSystem is live
    if (this.position.y < 1.5) {
      this.position.y = 1.5
      this.velocity.y = Math.max(0, this.velocity.y)
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

function enableShadows(obj: Object3D): void {
  if (obj instanceof Mesh) {
    obj.castShadow = true
    obj.receiveShadow = true
  }
}
