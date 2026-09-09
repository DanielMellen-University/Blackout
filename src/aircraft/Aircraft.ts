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
import { disposeObjectTree } from '../core/dispose'
import { createDefaultControls, type ControlState } from '../core/types'
import { createF35Model } from './createF35Model'
import { altitudeAgl } from '../world/ground'
import {
  createEngineState,
  resolveEngineState,
  type EngineState,
} from './EngineState'
import { flightConfig } from './flightConfig'
import { FlightModel } from './FlightModel'

const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()
const _spawnQuat = new Quaternion()
const _Y_UP = new Vector3(0, 1, 0)

export type AircraftStatus = 'ok' | 'crashed' | 'landed'

export type ContactSurfaceKind = 'land' | 'water'

/** Immutable snapshot of a newly detected terrain contact. */
export interface AircraftImpact {
  /** Aircraft-origin position at the first detected contact. */
  point: Vector3
  /** Terrain point directly below the aircraft origin. */
  surfacePoint: Vector3
  /** Unit surface normal pointing out of the terrain. */
  surfaceNormal: Vector3
  /** Velocity immediately before contact resolution. */
  preImpactVelocity: Vector3
  /** Negative when travelling into the terrain surface. */
  normalVelocity: number
  verticalVelocity: number
  tangentialSpeed: number
  surface: ContactSurfaceKind
  gearDown: boolean
  startedAirborne: boolean
}

/**
 * Aircraft entity: sim state + Three.js mesh.
 */
export class Aircraft {
  readonly mesh: Group
  readonly position = new Vector3()
  readonly velocity = new Vector3()
  readonly orientation = new Quaternion()
  readonly angularVelocity = new Vector3()
  /** Pose shown this video frame (interpolated between physics steps). */
  readonly displayPosition = new Vector3()
  readonly displayOrientation = new Quaternion()
  private readonly prevPosition = new Vector3()
  private readonly prevOrientation = new Quaternion()
  readonly engineState: EngineState = createEngineState()
  /** Reused contact snapshot. `impact` points here when a new hit occurs. */
  readonly impactState: AircraftImpact = {
    point: new Vector3(),
    surfacePoint: new Vector3(),
    surfaceNormal: new Vector3(),
    preImpactVelocity: new Vector3(),
    normalVelocity: 0,
    verticalVelocity: 0,
    tangentialSpeed: 0,
    surface: 'land',
    gearDown: true,
    startedAirborne: false,
  }
  /** First terrain contact produced by the latest simulation step. */
  impact: AircraftImpact | null = null
  /**
   * Vertical speed at the moment we touched this frame (negative = downward).
   * 0 if we did not newly contact. Collision reads this, not post-clamp vy.
   */
  impactVy = 0
  controls: ControlState = createDefaultControls()

  mass = flightConfig.mass
  usingPlaceholder = true
  status: AircraftStatus = 'ok'

  private readonly flight = new FlightModel()
  private gearExtension = 1
  private landingGear: Object3D | null = null
  private gearNose: Object3D | null = null
  private gearLeft: Object3D | null = null
  private gearRight: Object3D | null = null
  private flaperonLeft: Object3D | null = null
  private flaperonRight: Object3D | null = null
  private stabilatorLeft: Object3D | null = null
  private stabilatorRight: Object3D | null = null
  private tailLeft: Object3D | null = null
  private tailRight: Object3D | null = null
  private afterburner: Object3D | null = null
  private antiCollisionBeacon: Object3D | null = null
  private antiCollisionBeaconMaterial: MeshBasicMaterial | null = null
  private readonly plumeMaterials: Array<{ name: string; material: MeshBasicMaterial }> = []
  private readonly plumeDiamonds: Array<{
    node: Object3D
    x: number
    y: number
    z: number
  }> = []
  private readonly nozzleGlows: MeshStandardMaterial[] = []

  constructor() {
    this.mesh = new Group()
    this.mesh.name = 'Aircraft'
    const placeholder = createF35Model()
    placeholder.name = 'model'
    this.mesh.add(placeholder)
    this.cacheVisualNodes()
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
      if (old) {
        this.mesh.remove(old)
        disposeAircraftObject(old)
      }
      this.mesh.add(model)
      this.cacheVisualNodes()
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
    this.impactVy = 0
    this.impact = null
    _spawnQuat.setFromAxisAngle(_Y_UP, yaw)
    this.orientation.copy(_spawnQuat)
    this.controls = createDefaultControls()
    this.controls.gearDown = true
    this.controls.throttle = s.throttle
    resolveEngineState(this.controls, this.engineState)
    this.status = 'ok'
    this.mesh.visible = true
    this.snapDisplay()
  }

  /** Store the pose from before this physics step for render interpolation. */
  capturePrevious(): void {
    this.prevPosition.copy(this.position)
    this.prevOrientation.copy(this.orientation)
  }

  /**
   * Blend the visible mesh/camera pose between the last two physics states.
   * `alpha` 0 = previous step, 1 = current step.
   */
  present(alpha: number): void {
    const t = alpha >= 1 ? 1 : alpha <= 0 ? 0 : alpha
    if (t === 1) {
      this.displayPosition.copy(this.position)
      this.displayOrientation.copy(this.orientation)
    } else if (t === 0) {
      this.displayPosition.copy(this.prevPosition)
      this.displayOrientation.copy(this.prevOrientation)
    } else {
      this.displayPosition.lerpVectors(this.prevPosition, this.position, t)
      this.displayOrientation.copy(this.prevOrientation).slerp(this.orientation, t)
    }
    this.mesh.position.copy(this.displayPosition)
    this.mesh.quaternion.copy(this.displayOrientation)
  }

  /** Copy physics pose to the display pose (reset, pause, crash). */
  snapDisplay(): void {
    this.prevPosition.copy(this.position)
    this.prevOrientation.copy(this.orientation)
    this.present(1)
    this.updateVisuals(0)
  }

  step(dt: number): void {
    if (this.status === 'crashed') {
      this.updateVisuals(dt)
      return
    }
    resolveEngineState(this.controls, this.engineState)
    this.flight.step(this, dt)
    this.autoGear()
    this.updateVisuals(dt)
  }

  crash(): void {
    this.status = 'crashed'
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.impactVy = 0
    this.impact = null
    this.controls.throttle = 0
    this.controls.boost = false
    resolveEngineState(this.controls, this.engineState)
    this.mesh.visible = false
    this.snapDisplay()
  }

  markLanded(): void {
    if (this.status === 'ok') this.status = 'landed'
  }

  /** After a landing, going airborne again is a new flight. */
  clearLanded(): void {
    if (this.status === 'landed') this.status = 'ok'
  }

  /** Gear down near the surface, up once you have height. */
  private autoGear(): void {
    if (this.status === 'crashed') return
    const agl = altitudeAgl(
      this.position.x,
      this.position.y,
      this.position.z,
      this.controls.gearDown,
    )
    if (this.onGround || agl < 16) this.controls.gearDown = true
    else if (agl > 30) this.controls.gearDown = false
  }

  syncMesh(): void {
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.orientation)
  }

  /**
   * Articulated gear and power-driven exhaust for the procedural model.
   * Safe no-ops if nodes missing (GLB path).
   */
  private updateVisuals(dt: number): void {
    const now = performance.now()
    const gear = this.landingGear
    const target = this.controls.gearDown ? 1 : 0
    this.gearExtension = dt === 0
      ? target
      : MathUtils.damp(this.gearExtension, target, 4, dt)
    if (gear) {
      gear.visible = this.gearExtension > 0.015
      const folded = 1 - this.gearExtension
      if (this.gearNose) this.gearNose.rotation.x = -folded * Math.PI * 0.5
      if (this.gearLeft) this.gearLeft.rotation.z = folded * Math.PI * 0.5
      if (this.gearRight) this.gearRight.rotation.z = -folded * Math.PI * 0.5
    }

    this.updateControlSurfaces(dt)

    if (this.antiCollisionBeacon && this.antiCollisionBeaconMaterial) {
      const opacity = antiCollisionBeaconOpacity(now)
      this.antiCollisionBeacon.visible = opacity > 0.01
      this.antiCollisionBeaconMaterial.opacity = opacity
    }

    const ab = this.afterburner
    if (!ab) return

    // Drive plume size from the same 0..100% lever shown on the HUD. Boost
    // changes the available exhaust envelope, but never replaces the lever's
    // contribution, so 30% power cannot produce a full-size afterburner.
    const engine = this.engineState
    const boost = engine.afterburnerActive
    const throttlePower = this.status === 'crashed' ? 0 : engine.lever
    const plumeResponse = Math.pow(throttlePower, 0.82)
    ab.visible = throttlePower > 0.015
    ab.userData.powerPercent = throttlePower * 100

    // Stretch aft from the nozzle lip. Military power retains a compact hot
    // exhaust; afterburner grows to a long, wide plume at full engine power.
    const pulse =
      boost && dt > 0 ? 1 + Math.sin(now * 0.028) * 0.08 : 1
    const len = (
      0.12 + plumeResponse * (boost ? 2.8 : 1.25)
    ) * pulse
    const fat = 0.68 + plumeResponse * (boost ? 0.62 : 0.32)
    ab.scale.set(fat, fat, len)

    const boostGlow = boost ? 1 : 0.72
    for (const plume of this.plumeMaterials) {
      if (plume.name === 'abCore') plume.material.opacity = (0.18 + plumeResponse * 0.5) * boostGlow
      else if (plume.name === 'abMid') plume.material.opacity = (0.09 + plumeResponse * 0.34) * boostGlow
      else if (plume.name === 'abOuter') plume.material.opacity = (0.035 + plumeResponse * 0.18) * boostGlow
    }
    for (let i = 0; i < this.plumeDiamonds.length; i++) {
      const diamond = this.plumeDiamonds[i]!
      const scale = afterburnerDiamondPulse(i, now, boost, plumeResponse)
      diamond.node.scale.set(diamond.x * scale, diamond.y * scale, diamond.z * scale)
    }
    const nozzleIntensity = MathUtils.lerp(0, boost ? 3.8 : 2.4, plumeResponse)
    for (const glow of this.nozzleGlows) glow.emissiveIntensity = nozzleIntensity
  }

  /** Animate the procedural F-35's hinged panels from the live stick input. */
  private updateControlSurfaces(dt: number): void {
    const pitch = MathUtils.clamp(this.controls.pitch, -1, 1)
    const roll = MathUtils.clamp(this.controls.roll, -1, 1)
    const yaw = MathUtils.clamp(this.controls.yaw, -1, 1)

    // Differential flaperons show roll while both sides contribute to pitch.
    setSurfaceAngle(this.flaperonLeft, 'x', -pitch * 0.16 - roll * 0.14, 14, dt)
    setSurfaceAngle(this.flaperonRight, 'x', -pitch * 0.16 + roll * 0.14, 14, dt)
    setSurfaceAngle(this.stabilatorLeft, 'x', -pitch * 0.12 - roll * 0.07, 11, dt)
    setSurfaceAngle(this.stabilatorRight, 'x', -pitch * 0.12 + roll * 0.07, 11, dt)
    // Canted tails move in opposite directions to sell yaw authority without
    // adding a separate rudder mesh or another render pass.
    setSurfaceAngle(this.tailLeft, 'y', yaw * 0.11, 10, dt)
    setSurfaceAngle(this.tailRight, 'y', -yaw * 0.11, 10, dt)
  }

  /** Cache the small set of nodes touched every physics step. */
  private cacheVisualNodes(): void {
    const find = (name: string): Object3D | null => this.mesh.getObjectByName(name) ?? null
    this.landingGear = find('landingGear')
    this.gearNose = find('gearNose')
    this.gearLeft = find('gearLeft')
    this.gearRight = find('gearRight')
    this.flaperonLeft = find('flaperonLeft')
    this.flaperonRight = find('flaperonRight')
    this.stabilatorLeft = find('stabilatorLeft')
    this.stabilatorRight = find('stabilatorRight')
    this.tailLeft = find('tailLeft')
    this.tailRight = find('tailRight')
    this.afterburner = find('afterburner')
    this.antiCollisionBeacon = find('antiCollisionBeacon')
    this.antiCollisionBeaconMaterial =
      this.antiCollisionBeacon instanceof Mesh &&
      this.antiCollisionBeacon.material instanceof MeshBasicMaterial
        ? this.antiCollisionBeacon.material
        : null
    this.plumeMaterials.length = 0
    this.plumeDiamonds.length = 0
    this.nozzleGlows.length = 0
    this.afterburner?.traverse((object) => {
      if (object.name.startsWith('abDiamond')) {
        this.plumeDiamonds.push({
          node: object,
          x: object.scale.x,
          y: object.scale.y,
          z: object.scale.z,
        })
      }
      if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial)) return
      if (object.material.name === 'abCore' || object.material.name === 'abMid' || object.material.name === 'abOuter') {
        this.plumeMaterials.push({ name: object.material.name, material: object.material })
      }
    })
    this.mesh.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return
      if (object.material.name === 'nozzleGlow') this.nozzleGlows.push(object.material)
    })
  }

  get speed(): number {
    return this.velocity.length()
  }

  get onGround(): boolean {
    return this.flight.isOnGround(this)
  }
}

/** Dispose a removed aircraft subtree without double-disposing shared slots. */
export function disposeAircraftObject(root: Object3D): void {
  disposeObjectTree(root)
}

/** Rare dorsal anti-collision strobe envelope, hidden between flashes. */
export function antiCollisionBeaconOpacity(timeMs: number): number {
  if (!Number.isFinite(timeMs)) return 0
  const period = 1400
  const flash = ((timeMs % period) + period) % period
  if (flash >= 128) return 0
  const attack = Math.min(1, flash / 18)
  const release = Math.max(0, 1 - Math.max(0, flash - 18) / 110)
  return attack * release
}

/** Small procedural Mach-diamond pulse used by the external exhaust plume. */
export function afterburnerDiamondPulse(
  index: number,
  timeMs: number,
  boost: boolean,
  response: number,
): number {
  const power = MathUtils.clamp(Number.isFinite(response) ? response : 0, 0, 1)
  if (!boost) return 0.9 + power * 0.1
  const phase = Number.isFinite(timeMs) ? timeMs * 0.034 + index * 1.35 : index * 1.35
  return 1 + Math.sin(phase) * 0.1 * power
}

function enableShadows(obj: Object3D): void {
  if (obj instanceof Mesh) {
    obj.castShadow = true
    obj.receiveShadow = true
  }
}

function setSurfaceAngle(
  node: Object3D | null,
  axis: 'x' | 'y',
  target: number,
  response: number,
  dt: number,
): void {
  if (!node) return
  node.rotation[axis] = dt === 0
    ? target
    : MathUtils.damp(node.rotation[axis], target, response, dt)
}
