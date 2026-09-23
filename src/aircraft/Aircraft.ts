import {
  Box3,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
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
import { FlightModel, runwayGripForWeather } from './FlightModel'
import {
  controlSurfaceTargets,
  wingtipVaporIntensity,
} from './controlSurfaces'
import type { RenderQuality } from '../core/RenderQuality'
import { createFuelState, resetFuel, updateFuel, type FuelState } from './FuelSystem'
import { createEngineHeatState, resetEngineHeat, updateEngineHeat, type EngineHeatState } from './EngineHeatSystem'

const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()
const _spawnQuat = new Quaternion()
const _Y_UP = new Vector3(0, 1, 0)
const _loadAcceleration = new Vector3()
const _loadUp = new Vector3()
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
  /** Smoothed acceleration along the pilot's body-up axis, expressed in G. */
  loadFactor = 1
  /** Pose shown this video frame (interpolated between physics steps). */
  readonly displayPosition = new Vector3()
  readonly displayOrientation = new Quaternion()
  private readonly prevPosition = new Vector3()
  private readonly prevOrientation = new Quaternion()
  private readonly prevVelocity = new Vector3()
  readonly engineState: EngineState = createEngineState()
  readonly engineHeat: EngineHeatState = createEngineHeatState()
  readonly fuel: FuelState = createFuelState()
  /** Bounded weather gust strength supplied by the world before physics steps. */
  weatherGust = 0
  /** Horizontal wind vector supplied by the world before physics steps. */
  weatherWindX = 0
  weatherWindZ = 0
  /** Blended precipitation grip multiplier used only during ground rollout. */
  weatherSurfaceGrip = 1
  /** Bounded deterministic updraft supplied before physics steps. */
  thermalLift = 0
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
  private gearDoorNose: Object3D | null = null
  private gearDoorLeft: Object3D | null = null
  private gearDoorRight: Object3D | null = null
  private flaperonLeft: Object3D | null = null
  private flaperonRight: Object3D | null = null
  private stabilatorLeft: Object3D | null = null
  private stabilatorRight: Object3D | null = null
  private tailLeft: Object3D | null = null
  private tailRight: Object3D | null = null
  private afterburner: Object3D | null = null
  private readonly wheels: Object3D[] = []
  private wheelSpin = 0
  /** True after a pilot gear command until the safety envelope takes over. */
  private manualGearOverride = false
  private readonly navLightMaterials: MeshBasicMaterial[] = []
  private navLightOpacity = Number.NaN
  private presentationDaylight = 1
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
  private landingLightNose: Object3D | null = null
  private landingLightMaterial: MeshBasicMaterial | null = null
  private landingLightOpacityValue = Number.NaN
  private readonly plumeMaterials: Array<{ name: string; material: MeshBasicMaterial }> = []
  private readonly lowQualityPlumeNodes: Object3D[] = []
  private readonly plumeDiamonds: Array<{
    node: Object3D
    x: number
    y: number
    z: number
  }> = []
  private readonly vaporNodes: Object3D[] = []
  private vaporMaterial: MeshBasicMaterial | null = null
  private vaporOpacity = Number.NaN
  private readonly nozzlePetals: Array<{ node: Object3D; angle: number }> = []
  private readonly nozzleGlows: MeshStandardMaterial[] = []
  private plumeResponseValue = Number.NaN
  private plumeBoostValue: boolean | null = null
  private plumeVisibleValue: boolean | null = null
  private plumePulseAnimatedValue: boolean | null = null
  private plumeFatValue = Number.NaN
  private plumeLengthValue = Number.NaN
  private nozzleIntensityValue = Number.NaN
  private readonly readabilityMaterials: MeshStandardMaterial[] = []
  private readonly readabilityMaterialSet = new Set<MeshStandardMaterial>()
  private nightReadabilityValue = Number.NaN
  private canopyGlassMaterial: MeshPhysicalMaterial | null = null
  private canopyGlassIntensityValue = Number.NaN
  private nozzleFlareValue = Number.NaN
  /** Presentation clock in milliseconds, supplied by RAF when available. */
  private visualTimeMs = 0
  private modelLoadToken = 0
  private disposed = false
  private visualQuality: RenderQuality = 'balanced'
  private reducedMotion = false

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

  reset(spawn?: { x: number; y: number; z: number; yaw: number }): void {
    if (this.disposed) return
    const s = flightConfig.spawn
    const x = spawn?.x ?? s.position.x
    const y = spawn?.y ?? s.position.y
    const z = spawn?.z ?? s.position.z
    const yaw = spawn?.yaw ?? s.yaw
    this.position.set(x, y, z)
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.prevVelocity.copy(this.velocity)
    resetFuel(this.fuel)
    resetEngineHeat(this.engineHeat)
    this.loadFactor = 1
    this.impactVy = 0
    this.impact = null
    this.groundCacheValid = false
    _spawnQuat.setFromAxisAngle(_Y_UP, yaw)
    this.orientation.copy(_spawnQuat)
    this.controls = createDefaultControls()
    this.controls.gearDown = true
    this.manualGearOverride = false
    this.controls.throttle = s.throttle
    this.weatherGust = 0
    this.weatherWindX = 0
    this.weatherWindZ = 0
    this.weatherSurfaceGrip = 1
    this.thermalLift = 0
    this.flight.reset()
    this.wheelSpin = 0
    this.visualTimeMs = 0
    this.navLightOpacity = Number.NaN
    this.landingLightOpacityValue = Number.NaN
    this.nightReadabilityValue = Number.NaN
    this.canopyGlassIntensityValue = Number.NaN
    this.nozzleFlareValue = Number.NaN
    this.resetPlumeCache()
    this.vaporOpacity = Number.NaN
    for (const wheel of this.wheels) wheel.rotation.x = 0
    if (this.gearNose) this.gearNose.rotation.y = 0
    resolveEngineState(this.controls, this.engineState, this.fuel.fraction, this.engineHeat.afterburnerLocked)
    this.status = 'ok'
    this.mesh.visible = true
    this.snapDisplay()
  }

  capturePrevious(): void {
    if (this.disposed) return
    this.prevPosition.copy(this.position)
    this.prevOrientation.copy(this.orientation)
  }

  present(alpha: number): void {
    if (this.disposed) return
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

  snapDisplay(nowMs?: number): void {
    if (this.disposed) return
    this.prevPosition.copy(this.position)
    this.prevOrientation.copy(this.orientation)
    this.present(1)
    this.updateVisuals(0, nowMs)
  }

  step(dt: number, nowMs?: number): void {
    if (this.disposed || this.status === 'crashed' || !Number.isFinite(dt) || dt < 0) {
      return
    }
    this.groundCacheValid = false
    this.prevVelocity.copy(this.velocity)
    updateFuel(this.fuel, dt, this.controls.throttle, this.controls.boost)
    resolveEngineState(this.controls, this.engineState, this.fuel.fraction, this.engineHeat.afterburnerLocked)
    updateEngineHeat(this.engineHeat, dt, this.controls.throttle, this.engineState.afterburnerActive)
    this.flight.step(this, dt)
    this.updateLoadFactor(dt)
    this.autoGear()
    this.updateGear(dt)
    this.updateControlSurfaces(dt)
    this.updateWheels(dt)
    this.updateVisuals(dt, nowMs)
  }

  setWeatherGust(value: number): void {
    this.weatherGust = Number.isFinite(value) ? MathUtils.clamp(value, 0, 1) : 0
  }

  setWeatherWind(x: number, z: number): void {
    this.weatherWindX = Number.isFinite(x) ? x : 0
    this.weatherWindZ = Number.isFinite(z) ? z : 0
  }

  setWeatherSurfaceGrip(value: number): void {
    this.weatherSurfaceGrip = Number.isFinite(value)
      ? MathUtils.clamp(value, 0.72, 1)
      : 1
  }

  setThermalLift(value: number): void {
    this.thermalLift = Number.isFinite(value) ? MathUtils.clamp(value, 0, 1) : 0
  }

  setWeatherPrecipitation(rain: number, snow: number): void {
    this.setWeatherSurfaceGrip(runwayGripForWeather(rain, snow))
  }

  syncMesh(): void {
    if (this.disposed) return
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.orientation)
  }

  setManualGear(down: boolean): void {
    this.controls.gearDown = down
    this.manualGearOverride = true
  }

  setVisualQuality(quality: RenderQuality): void {
    this.visualQuality = quality
    this.applyVisualQuality()
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled
  }

  setPresentationDaylight(daylight: number): void {
    this.presentationDaylight = Number.isFinite(daylight)
      ? MathUtils.clamp(daylight, 0, 1)
      : 1
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.modelLoadToken += 1
    this.mesh.removeFromParent()
    disposeAircraftObject(this.mesh)
  }

  private updateLoadFactor(dt: number): void {
    if (dt <= 0) return
    _loadAcceleration
      .copy(this.velocity)
      .sub(this.prevVelocity)
      .multiplyScalar(1 / dt)
    _loadUp.set(0, 1, 0).applyQuaternion(this.orientation)
    const sample = resolveLoadFactor(_loadAcceleration, _loadUp)
    const k = 1 - Math.exp(-8 * dt)
    this.loadFactor += (sample - this.loadFactor) * k
  }

  private autoGear(): void {
    if (this.manualGearOverride) return
    const agl = altitudeAgl(this.position.x, this.position.y, this.position.z, this.controls.gearDown)
    if (agl > 80) this.controls.gearDown = false
    else if (agl < 35 && this.velocity.y < 2) this.controls.gearDown = true
  }

  private updateGear(dt: number): void {
    const target = this.controls.gearDown ? 1 : 0
    this.gearExtension = MathUtils.damp(this.gearExtension, target, 6, dt)
    if (this.landingGear) this.landingGear.visible = this.gearExtension > 0.02
    if (this.gearNose) this.gearNose.rotation.x = (1 - this.gearExtension) * 1.4
    if (this.gearLeft) this.gearLeft.rotation.x = (1 - this.gearExtension) * 1.25
    if (this.gearRight) this.gearRight.rotation.x = (1 - this.gearExtension) * 1.25
    if (this.gearDoorNose) this.gearDoorNose.rotation.x = this.gearExtension * -0.9
    if (this.gearDoorLeft) this.gearDoorLeft.rotation.z = this.gearExtension * 1.1
    if (this.gearDoorRight) this.gearDoorRight.rotation.z = this.gearExtension * -1.1
  }

  private updateControlSurfaces(dt: number): void {
    const targets = controlSurfaceTargets(
      this.controls.pitch,
      this.controls.roll,
      this.controls.yaw,
      this.controls.airbrake,
    )
    setSurfaceAngle(this.flaperonLeft, 'x', targets.flaperonLeftX, 16, dt)
    setSurfaceAngle(this.flaperonRight, 'x', targets.flaperonRightX, 16, dt)
    setSurfaceAngle(this.stabilatorLeft, 'x', targets.stabilatorLeftX, 13, dt)
    setSurfaceAngle(this.stabilatorRight, 'x', targets.stabilatorRightX, 13, dt)
    setSurfaceAngle(this.tailLeft, 'y', targets.rudderY, 12, dt)
    setSurfaceAngle(this.tailRight, 'y', targets.rudderY, 12, dt)
  }

  private updateWheels(dt: number): void {
    if (!this.onGround || this.wheels.length === 0) return
    const groundSpeed = Math.hypot(this.velocity.x, this.velocity.z)
    this.wheelSpin += groundSpeed * dt * 0.55
    for (const wheel of this.wheels) wheel.rotation.x = this.wheelSpin
  }

  private updateVisuals(dt: number, nowMs?: number): void {
    if (Number.isFinite(nowMs)) this.visualTimeMs = nowMs as number
    else this.visualTimeMs += dt * 1000
    this.updateNavLights()
    this.updateAntiCollision()
    this.updateLandingLight()
    this.updatePlume()
    this.updateVapor()
    this.updateNightReadability()
  }

  private updateNavLights(): void {
    const opacity = navigationLightOpacity(this.visualTimeMs, this.presentationDaylight)
    if (opacity === this.navLightOpacity) return
    this.navLightOpacity = opacity
    for (const material of this.navLightMaterials) material.opacity = opacity
  }

  private updateAntiCollision(): void {
    if (!this.antiCollisionBeacon || !this.antiCollisionBeaconMaterial) return
    const opacity = antiCollisionBeaconOpacity(this.visualTimeMs, this.reducedMotion)
    this.antiCollisionBeacon.visible = opacity > 0.01
    this.antiCollisionBeaconMaterial.opacity = opacity
  }

  private updateLandingLight(): void {
    if (!this.landingLightNose || !this.landingLightMaterial) return
    const opacity = landingLightOpacity(this.gearExtension)
    if (opacity === this.landingLightOpacityValue) return
    this.landingLightOpacityValue = opacity
    this.landingLightNose.visible = opacity > 0.02
    this.landingLightMaterial.opacity = opacity
  }

  private updatePlume(): void {
    const response = this.engineState.response
    const boost = this.engineState.afterburnerActive
    const visible = response > 0.02 || boost
    if (this.afterburner && visible !== this.plumeVisibleValue) {
      this.afterburner.visible = visible
      this.plumeVisibleValue = visible
    }
    if (!visible) return
    const fat = 0.85 + response * 0.35 + (boost ? 0.25 : 0)
    const length = 0.7 + response * 0.9 + (boost ? 0.55 : 0)
    if (fat !== this.plumeFatValue || length !== this.plumeLengthValue) {
      this.plumeFatValue = fat
      this.plumeLengthValue = length
      for (const diamond of this.plumeDiamonds) {
        diamond.node.scale.set(diamond.x * fat, diamond.y * fat, diamond.z * length)
      }
    }
    for (let i = 0; i < this.plumeDiamonds.length; i++) {
      const pulse = afterburnerDiamondPulse(i, this.visualTimeMs, boost, response)
      const diamond = this.plumeDiamonds[i]!
      diamond.node.scale.x = diamond.x * fat * pulse
      diamond.node.scale.y = diamond.y * fat * pulse
    }
    const nozzle = 0.2 + response * 0.8 + (boost ? 0.6 : 0)
    if (nozzle !== this.nozzleIntensityValue) {
      this.nozzleIntensityValue = nozzle
      for (const glow of this.nozzleGlows) glow.emissiveIntensity = nozzle
      for (const petal of this.nozzlePetals) {
        petal.node.rotation.z = petal.angle * (0.15 + response * 0.55 + (boost ? 0.25 : 0))
      }
    }
    this.plumeResponseValue = response
    this.plumeBoostValue = boost
  }

  private updateVapor(): void {
    if (!this.vaporMaterial || this.vaporNodes.length === 0) return
    const intensity = this.visualQuality === 'low'
      ? 0
      : wingtipVaporIntensity(this.speed, this.loadFactor)
    if (intensity === this.vaporOpacity) return
    this.vaporOpacity = intensity
    this.vaporMaterial.opacity = intensity
    for (const node of this.vaporNodes) node.visible = intensity > 0.01
  }

  private updateNightReadability(): void {
    const night = nightAirframeEmissiveIntensity(this.presentationDaylight)
    if (night !== this.nightReadabilityValue) {
      this.nightReadabilityValue = night
      for (const material of this.readabilityMaterials) material.emissiveIntensity = night
    }
    if (this.canopyGlassMaterial) {
      const canopy = canopyGlassEmissiveIntensity(this.presentationDaylight)
      if (canopy !== this.canopyGlassIntensityValue) {
        this.canopyGlassIntensityValue = canopy
        this.canopyGlassMaterial.emissiveIntensity = canopy
      }
    }
  }

  private cacheVisualNodes(): void {
    const find = (name: string): Object3D | null => this.mesh.getObjectByName(name) ?? null
    this.landingGear = find('landingGear')
    this.gearNose = find('gearNose')
    this.gearLeft = find('gearLeft')
    this.gearRight = find('gearRight')
    this.gearDoorNose = find('gearDoorNose')
    this.gearDoorLeft = find('gearDoorLeft')
    this.gearDoorRight = find('gearDoorRight')
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
    this.landingLightNose = find('landingLightNose')
    this.landingLightMaterial =
      this.landingLightNose instanceof Mesh &&
      this.landingLightNose.material instanceof MeshBasicMaterial
        ? this.landingLightNose.material
        : null
    this.plumeMaterials.length = 0
    this.plumeDiamonds.length = 0
    this.lowQualityPlumeNodes.length = 0
    this.vaporNodes.length = 0
    this.vaporMaterial = null
    this.nozzlePetals.length = 0
    this.nozzleGlows.length = 0
    this.resetPlumeCache()
    this.readabilityMaterials.length = 0
    this.readabilityMaterialSet.clear()
    this.canopyGlassMaterial = null
    this.afterburner?.traverse((object) => {
      if (object.name.startsWith('abDiamond')) {
        const index = Number(object.name.slice('abDiamond'.length))
        this.plumeDiamonds.push({
          node: object,
          x: object.scale.x,
          y: object.scale.y,
          z: object.scale.z,
        })
        if (Number.isFinite(index) && index > 0) this.lowQualityPlumeNodes.push(object)
      }
      if (!(object instanceof Mesh) || !(object.material instanceof MeshBasicMaterial)) return
      if (object.material.name === 'abCore' || object.material.name === 'abMid' || object.material.name === 'abOuter') {
        this.plumeMaterials.push({ name: object.material.name, material: object.material })
        if (object.material.name === 'abOuter') this.lowQualityPlumeNodes.push(object)
      }
    })
    for (const name of ['vaporTrailLeft', 'vaporTrailRight']) {
      const vapor = find(name)
      if (vapor) this.vaporNodes.push(vapor)
      if (vapor instanceof Mesh && vapor.material instanceof MeshBasicMaterial) {
        this.vaporMaterial = vapor.material
      }
    }
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
      if (material.emissive.getHex() !== 0 || this.readabilityMaterialSet.has(material)) return
      material.emissive.setHex(AIRFRAME_NIGHT_EMISSIVE)
      this.readabilityMaterialSet.add(material)
      this.readabilityMaterials.push(material)
    })
    const canopy = this.mesh.getObjectByName('GoldCanopy')
    if (canopy instanceof Mesh && canopy.material instanceof MeshPhysicalMaterial) {
      this.canopyGlassMaterial = canopy.material
    }
    this.applyVisualQuality()
  }

  private applyVisualQuality(): void {
    const low = this.visualQuality === 'low'
    for (const node of this.lowQualityPlumeNodes) node.visible = !low
    if (low) {
      for (const node of this.vaporNodes) node.visible = false
    }
  }

  private resetPlumeCache(): void {
    this.plumeResponseValue = Number.NaN
    this.plumeBoostValue = null
    this.plumeVisibleValue = null
    this.plumePulseAnimatedValue = null
    this.plumeFatValue = Number.NaN
    this.plumeLengthValue = Number.NaN
    this.nozzleIntensityValue = Number.NaN
  }

  get speed(): number {
    return this.velocity.length()
  }

  get onGround(): boolean {
    if (this.disposed) return false
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

export function disposeAircraftObject(root: Object3D): void {
  disposeObjectTree(root)
}

export function antiCollisionBeaconOpacity(timeMs: number, reducedMotion = false): number {
  if (reducedMotion) return 0.16
  if (!Number.isFinite(timeMs)) return 0
  const period = 1400
  const flash = ((timeMs % period) + period) % period
  if (flash >= 128) return 0
  const attack = Math.min(1, flash / 18)
  const release = Math.max(0, 1 - Math.max(0, flash - 18) / 110)
  return attack * release
}

export function navigationLightOpacity(timeMs: number, daylight = 0): number {
  const safeDaylight = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  const base = 0.34 + (1 - safeDaylight) * 0.45
  if (!Number.isFinite(timeMs)) return base + .03
  return base + (Math.sin(timeMs * .0038) + 1) * .03
}

export function nightAirframeEmissiveIntensity(daylight: number): number {
  const safe = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  return (1 - safe) * 0.42
}

export function canopyGlassEmissiveIntensity(daylight: number): number {
  const safe = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  return 0.08 + (1 - safe) * 0.16
}

export function landingLightOpacity(gearExtension: number): number {
  const t = Number.isFinite(gearExtension) ? MathUtils.clamp(gearExtension, 0, 1) : 0
  return MathUtils.smoothstep(t, 0.55, 0.9) * 0.95
}

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

export function resolveLoadFactor(
  acceleration: Vector3,
  bodyUp: Vector3,
  gravity = flightConfig.gravity,
): number {
  const safeGravity = Number.isFinite(gravity) && gravity > 0 ? gravity : flightConfig.gravity
  const axialValue = acceleration.dot(bodyUp)
  const axial = Number.isFinite(axialValue) ? axialValue : 0
  const up = Number.isFinite(bodyUp.y) ? bodyUp.y : 1
  return MathUtils.clamp((axial + safeGravity * up) / safeGravity, -4, 12)
}

export { controlSurfaceTargets, wingtipVaporIntensity } from './controlSurfaces'

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
