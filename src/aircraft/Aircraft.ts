import {
  Group,
  Object3D,
  Quaternion,
  Vector3,
  type Scene,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDefaultControls, type ControlState } from '../core/types'
import { createPlaceholderF35 } from './createPlaceholderF35'

const SPAWN = new Vector3(0, 8, 0)
const _lookHelper = new Object3D()
const _flat = new Vector3()
const _move = new Vector3()
const _up = new Vector3(0, 1, 0)
const _targetQuat = new Quaternion()
const _fixYaw = new Quaternion().setFromAxisAngle(_up, Math.PI)
const _lookAt = new Vector3()

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
  /** Using placeholder until a GLB loads successfully. */
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
   * Falls back silently to the procedural placeholder.
   */
  async tryLoadModel(url = '/models/f35.glb'): Promise<boolean> {
    const loader = new GLTFLoader()
    try {
      const gltf = await loader.loadAsync(url)
      const model = gltf.scene
      model.name = 'model'
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
      console.info('[Blackout] No GLB at', url, '— using procedural F-35 placeholder')
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
   * Phase 0 free-fly: WASD horizontal, QE vertical.
   * Replaced by FlightModel.step in Phase 1.
   */
  freeFlyStep(dt: number): void {
    const baseSpeed = 28
    const boostMul = this.controls.boost ? 2.4 : 1
    const speed = baseSpeed * (0.35 + this.controls.throttle) * boostMul

    // pitch = forward/back (+Z), roll = strafe (X), yaw = vertical (Y)
    _move.set(this.controls.roll, this.controls.yaw, this.controls.pitch)

    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(speed)
      this.velocity.lerp(_move, 1 - Math.exp(-6 * dt))
    } else {
      this.velocity.multiplyScalar(Math.exp(-3 * dt))
    }

    this.position.addScaledVector(this.velocity, dt)

    // Soft floor until real collision exists
    if (this.position.y < 1.5) {
      this.position.y = 1.5
      this.velocity.y = Math.max(0, this.velocity.y)
    }

    // Point nose along horizontal velocity when moving
    _flat.set(this.velocity.x, 0, this.velocity.z)
    if (_flat.lengthSq() > 0.4) {
      _lookHelper.position.copy(this.position)
      _lookHelper.up.copy(_up)
      _lookAt.copy(this.position).add(_flat)
      _lookHelper.lookAt(_lookAt)
      // lookAt faces -Z; rotate 180° so mesh +Z (nose) is forward
      _targetQuat.copy(_lookHelper.quaternion).multiply(_fixYaw)
      this.orientation.slerp(_targetQuat, 1 - Math.exp(-8 * dt))
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
