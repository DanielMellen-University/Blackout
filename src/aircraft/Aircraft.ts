import {
  Box3,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
  type Scene,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createDefaultControls, type ControlState } from '../core/types'
import { createPlaceholderF35 } from './createPlaceholderF35'
import { flightConfig } from './flightConfig'
import { FlightModel } from './FlightModel'

const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()
const _spawnQuat = new Quaternion()

export type AircraftStatus = 'ok' | 'crashed' | 'landed'

/**
 * Aircraft entity: sim state + Three.js mesh.
 */
export class Aircraft {
  readonly mesh: Group
  readonly position = new Vector3()
  readonly velocity = new Vector3()
  readonly orientation = new Quaternion()
  readonly angularVelocity = new Vector3()
  controls: ControlState = createDefaultControls()

  mass = flightConfig.mass
  usingPlaceholder = true
  status: AircraftStatus = 'ok'

  private readonly flight = new FlightModel()

  constructor() {
    this.mesh = new Group()
    this.mesh.name = 'Aircraft'
    const placeholder = createPlaceholderF35()
    placeholder.name = 'model'
    this.mesh.add(placeholder)
    this.reset()
  }

  addTo(scene: Scene): void {
    scene.add(this.mesh)
  }

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

  /**
   * Reset to runway. Pass world spawn pose so airfield can move with flat-biome search.
   */
  reset(spawn?: { x: number; y: number; z: number; yaw: number }): void {
    const s = flightConfig.spawn
    const x = spawn?.x ?? s.position.x
    const y = spawn?.y ?? s.position.y
    const z = spawn?.z ?? s.position.z
    const yaw = spawn?.yaw ?? s.yaw
    this.position.set(x, y, z)
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    _spawnQuat.setFromAxisAngle(new Vector3(0, 1, 0), yaw)
    this.orientation.copy(_spawnQuat)
    this.controls = createDefaultControls()
    this.controls.gearDown = true
    this.controls.throttle = s.throttle
    this.status = 'ok'
    this.mesh.visible = true
    this.syncMesh()
  }

  step(dt: number): void {
    if (this.status === 'crashed') {
      this.updateVisuals(dt)
      return
    }
    this.flight.step(this, dt)
    this.updateVisuals(dt)
  }

  crash(): void {
    this.status = 'crashed'
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.controls.throttle = 0
    this.controls.boost = false
    this.updateVisuals(0)
  }

  markLanded(): void {
    if (this.status === 'ok') this.status = 'landed'
  }

  syncMesh(): void {
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.orientation)
    this.updateVisuals(0)
  }

  /**
   * Gear visibility + afterburner plume (placeholder model).
   * Safe no-ops if nodes missing (GLB path).
   */
  private updateVisuals(dt: number): void {
    const gear = this.mesh.getObjectByName('landingGear')
    if (gear) gear.visible = this.controls.gearDown

    const ab = this.mesh.getObjectByName('afterburner')
    if (!ab) return

    // Idle: tiny; throttle: glow; boost: full plume
    const thr = this.controls.throttle
    const boost = this.controls.boost && thr > 0.05
    const power = this.status === 'crashed' ? 0 : boost ? 1 : thr * 0.22
    ab.visible = power > 0.04

    if (!ab.visible) return

    // Stretch plume aft with power (group origin is nozzle lip — scale keeps flame at tail)
    const pulse =
      boost && dt > 0 ? 1 + Math.sin(performance.now() * 0.028) * 0.08 : 1
    const len = (0.45 + power * 1.55) * pulse
    const fat = 0.65 + power * 0.55
    ab.scale.set(fat, fat, len)

    ab.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      const mat = obj.material
      if (mat instanceof MeshBasicMaterial) {
        if (mat.name === 'abCore') mat.opacity = 0.55 + power * 0.45
        else if (mat.name === 'abMid') mat.opacity = 0.25 + power * 0.5
        else if (mat.name === 'abOuter') mat.opacity = 0.12 + power * 0.35
      }
      if (mat instanceof MeshStandardMaterial && mat.name === 'nozzleGlow') {
        mat.emissiveIntensity = MathUtils.lerp(0.25, 2.8, power)
      }
    })

    // Nozzle core on the airframe (sibling of afterburner group)
    this.mesh.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      const mat = obj.material
      if (mat instanceof MeshStandardMaterial && mat.name === 'nozzleGlow') {
        mat.emissiveIntensity = MathUtils.lerp(0.25, 3.2, power)
      }
    })
  }

  get speed(): number {
    return this.velocity.length()
  }

  get onGround(): boolean {
    return this.flight.isOnGround(this)
  }
}

function enableShadows(obj: Object3D): void {
  if (obj instanceof Mesh) {
    obj.castShadow = true
    obj.receiveShadow = true
  }
}
