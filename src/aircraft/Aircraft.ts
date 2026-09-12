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
const AIRFRAME_NIGHT_EMISSIVE = 0x153244

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
  private readonly wheels: Object3D[] = []
  private wheelSpin = 0
  private readonly navLightMaterials: MeshBasicMaterial[] = []
  private navLightOpacity = Number.NaN
  /** Reuse repeated contact checks until the physics pose actually changes. */
  private groundCacheValid = false
  private groundCacheValue = false
  private groundCacheX = Number.NaN
  private groundCacheY = Number.NaN
  private groundCacheZ = Number.NaN
  private groundCacheVy = Number.NaN
  private groundCacheOx = Number.NaN
  private groundCacheOy = Number.NaN
  private groundCacheOz = Number.NaN
  private groundCacheOw = Number.NaN
  private groundCacheGearDown = false
  private antiCollisionBeacon: Object3D | null = null
  private antiCollisionBeaconMaterial: MeshBasicMaterial | null = null
  private readonly plumeMaterials: Array<{ name: string; material: MeshBasicMaterial }> = []
  private readonly plumeDiamonds: Array<{
    node: Object3D
    x: number
    y: number
    z: number
  }> = []
  private readonly nozzlePetals: Array<{ node: Object3D; angle: number }> = []
  private readonly nozzleGlows: MeshStandardMaterial[] = []
  private readonly readabilityMaterials: MeshStandardMaterial[] = []
  private readonly readabilityMaterialSet = new Set<MeshStandardMaterial>()
  private nightReadabilityValue = Number.NaN
  private nozzleFlareValue = Number.NaN
  /** Presentation clock in milliseconds, supplied by RAF when available. */
  private visualTimeMs = 0
  private modelLoadToken = 0
  private disposed = false

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
    if (this.disposed) return
    scene.add(this.mesh)
  }

  async tryLoadModel(url = '/models/f35.glb'): Promise<boolean> {
    if (this.disposed) return false
    const loadToken = ++this.modelLoadToken
    try {
      // Keep the optional asset pipeline out of the initial game bundle. The
      // procedural F-35 is already playable, so only fetch the GLB loader when
      // a model replacement is actually requested.
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
      const gltf = await new GLTFLoader().loadAsync(url)
      const model = gltf.scene
      model.name = 'model'

      if (this.disposed || loadToken !== this.modelLoadToken) {
        disposeAircraftObject(model)
        return false
      }

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
    this.groundCacheValid = false
    _spawnQuat.setFromAxisAngle(_Y_UP, yaw)
    this.orientation.copy(_spawnQuat)
    this.controls = createDefaultControls()
    this.controls.gearDown = true
    this.controls.throttle = s.throttle
    this.wheelSpin = 0
    this.visualTimeMs = 0
    this.navLightOpacity = Number.NaN
    this.nightReadabilityValue = Number.NaN
    this.nozzleFlareValue = Number.NaN
    for (const wheel of this.wheels) wheel.rotation.x = 0
    if (this.gearNose) this.gearNose.rotation.y = 0
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
  snapDisplay(nowMs?: number): void {
    this.prevPosition.copy(this.position)
    this.prevOrientation.copy(this.orientation)
    this.present(1)
    this.updateVisuals(0, nowMs)
  }

  step(dt: number, nowMs?: number): void {
    if (this.status === 'crashed') {
      return
    }
    // Terrain chunks can be replaced between simulation steps, so never carry
    // a contact result across a new physics update.
    this.groundCacheValid = false
    resolveEngineState(this.controls, this.engineState)
    this.flight.step(this, dt)
    this.autoGear()
    this.updateVisuals(dt, nowMs)
  }

  crash(): void {
    this.status = 'crashed'
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.impactVy = 0
    this.impact = null
    this.groundCacheValid = false
    this.controls.throttle = 0
    this.controls.boost = false
    resolveEngineState(this.controls, this.engineState)
    this.mesh.visible = false
    this.snapDisplay()
  }

  /** Cancel optional model hydration and release all aircraft resources. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.modelLoadToken++
    disposeAircraftObject(this.mesh)
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
    if (this.onGround) {
      this.controls.gearDown = true
      return
    }
    const agl = altitudeAgl(
      this.position.x,
      this.position.y,
      this.position.z,
      this.controls.gearDown,
    )
    if (agl < 16) this.controls.gearDown = true
    else if (agl > 30) this.controls.gearDown = false
  }

  syncMesh(): void {
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.orientation)
  }

  /**
   * Add a restrained cool fill to dark airframe panels at night. This keeps
   * the existing silhouette readable without adding lights or draw calls.
   */
  setNightReadability(daylight: number): void {
    const intensity = nightAirframeEmissiveIntensity(daylight)
    if (Math.abs(intensity - this.nightReadabilityValue) < 0.005) return
    this.nightReadabilityValue = intensity
    for (const material of this.readabilityMaterials) {
      material.emissiveIntensity = intensity
    }
  }

  /**
   * Articulated gear and power-driven exhaust for the procedural model.
   * Safe no-ops if nodes missing (GLB path).
   */
  private updateVisuals(dt: number, nowMs?: number): void {
    const now = this.resolveVisualTime(dt, nowMs)
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
    this.updateWheelSpin(dt)
    this.updateNoseGearSteering(dt)

    if (this.antiCollisionBeacon && this.antiCollisionBeaconMaterial) {
      const opacity = antiCollisionBeaconOpacity(now)
      this.antiCollisionBeacon.visible = opacity > 0.01
      this.antiCollisionBeaconMaterial.opacity = opacity
    }

    const navOpacity = navigationLightOpacity(now)
    if (Math.abs(navOpacity - this.navLightOpacity) > .01) {
      this.navLightOpacity = navOpacity
      for (const material of this.navLightMaterials) material.opacity = navOpacity
    }

    // Drive plume size from the same 0..100% lever shown on the HUD. Boost
    // changes the available exhaust envelope, but never replaces the lever's
    // contribution, so 30% power cannot produce a full-size afterburner.
    const engine = this.engineState
    const boost = engine.afterburnerActive
    const throttlePower = this.status === 'crashed' ? 0 : engine.lever
    this.updateNozzlePetals(throttlePower, boost)

    const ab = this.afterburner
    if (!ab) return

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

  /** Use the render timestamp when supplied, otherwise advance deterministically. */
  private resolveVisualTime(dt: number, nowMs?: number): number {
    if (Number.isFinite(nowMs)) {
      this.visualTimeMs = Math.max(this.visualTimeMs, nowMs!)
    } else if (Number.isFinite(dt) && dt > 0) {
      this.visualTimeMs += dt * 1000
    }
    return this.visualTimeMs
  }

  /** Flex the existing nozzle petals subtly with engine power. */
  private updateNozzlePetals(power: number, boost: boolean): void {
    if (this.nozzlePetals.length === 0) return
    const safePower = MathUtils.clamp(Number.isFinite(power) ? power : 0, 0, 1)
    const target = safePower * (boost ? 0.12 : 0.035)
    if (Math.abs(target - this.nozzleFlareValue) < 0.002) return
    this.nozzleFlareValue = target
    for (const petal of this.nozzlePetals) {
      petal.node.rotation.x = Math.cos(petal.angle) * target
      petal.node.rotation.y = Math.sin(petal.angle) * target
      petal.node.rotation.z = -petal.angle
    }
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

  /** Spin the existing wheel meshes during taxi and rollout without new parts. */
  private updateWheelSpin(dt: number): void {
    if (this.wheels.length === 0) return
    const deployed = this.gearExtension > 0.08
    if (dt > 0 && deployed) {
      const groundSpeed = Math.hypot(this.velocity.x, this.velocity.z)
      if (groundSpeed > 0.2) {
        this.wheelSpin = (this.wheelSpin + (groundSpeed * dt) / 0.32) % (Math.PI * 2)
      }
    }
    for (const wheel of this.wheels) wheel.rotation.x = this.wheelSpin
  }

  /** Turn the nose wheel with rudder input while the jet is rolling. */
  private updateNoseGearSteering(dt: number): void {
    const nose = this.gearNose
    if (!nose) return
    const grounded = this.onGround && this.gearExtension > 0.75
    const target = grounded ? MathUtils.clamp(this.controls.yaw, -1, 1) * 0.38 : 0
    nose.rotation.y = dt === 0
      ? target
      : MathUtils.damp(nose.rotation.y, target, 11, dt)
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
    this.wheels.length = 0
    for (const name of ['wheelNose', 'wheelLeft', 'wheelRight']) {
      const wheel = find(name)
      if (wheel) this.wheels.push(wheel)
    }
    this.navLightMaterials.length = 0
    for (const name of ['navLightLeft', 'navLightRight']) {
      const nav = find(name)
      if (nav instanceof Mesh && nav.material instanceof MeshBasicMaterial) {
        this.navLightMaterials.push(nav.material)
      }
    }
    this.antiCollisionBeacon = find('antiCollisionBeacon')
    this.antiCollisionBeaconMaterial =
      this.antiCollisionBeacon instanceof Mesh &&
      this.antiCollisionBeacon.material instanceof MeshBasicMaterial
        ? this.antiCollisionBeacon.material
        : null
    this.plumeMaterials.length = 0
    this.plumeDiamonds.length = 0
    this.nozzlePetals.length = 0
    this.nozzleGlows.length = 0
    this.readabilityMaterials.length = 0
    this.readabilityMaterialSet.clear()
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
      if (object.name.startsWith('nozzlePetal')) {
        const angle = object.userData.nozzleAngle
        this.nozzlePetals.push({
          node: object,
          angle: Number.isFinite(angle) ? angle : 0,
        })
      }
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return
      const material = object.material
      if (material.name === 'nozzleGlow') {
        this.nozzleGlows.push(material)
        return
      }
      // Physical canopy glass already carries its own emissive tint. Only
      // dark non-emissive panels receive the subtle night readability layer.
      if (material.emissive.getHex() !== 0 || this.readabilityMaterialSet.has(material)) return
      material.emissive.setHex(AIRFRAME_NIGHT_EMISSIVE)
      this.readabilityMaterialSet.add(material)
      this.readabilityMaterials.push(material)
    })
  }

  get speed(): number {
    return this.velocity.length()
  }

  get onGround(): boolean {
    const p = this.position
    const o = this.orientation
    const gearDown = this.controls.gearDown
    if (
      this.groundCacheValid &&
      this.groundCacheX === p.x &&
      this.groundCacheY === p.y &&
      this.groundCacheZ === p.z &&
      this.groundCacheVy === this.velocity.y &&
      this.groundCacheOx === o.x &&
      this.groundCacheOy === o.y &&
      this.groundCacheOz === o.z &&
      this.groundCacheOw === o.w &&
      this.groundCacheGearDown === gearDown
    ) {
      return this.groundCacheValue
    }

    this.groundCacheValue = this.flight.isOnGround(this)
    this.groundCacheX = p.x
    this.groundCacheY = p.y
    this.groundCacheZ = p.z
    this.groundCacheVy = this.velocity.y
    this.groundCacheOx = o.x
    this.groundCacheOy = o.y
    this.groundCacheOz = o.z
    this.groundCacheOw = o.w
    this.groundCacheGearDown = gearDown
    this.groundCacheValid = true
    return this.groundCacheValue
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

/** Slow nav-light breathing keeps the silhouette readable without strobing. */
export function navigationLightOpacity(timeMs: number): number {
  if (!Number.isFinite(timeMs)) return .82
  return .79 + (Math.sin(timeMs * .0038) + 1) * .03
}

/** Cool panel fill strength, zero in daylight and capped at night. */
export function nightAirframeEmissiveIntensity(daylight: number): number {
  const safe = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  return (1 - safe) * 0.32
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
