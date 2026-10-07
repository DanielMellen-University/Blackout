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
import { stormAirframeWobble, stormBuffetViewScale } from '../systems/StormBuffet'
import { disposeObjectTree } from '../core/dispose'
import { createDefaultControls, type ControlState } from '../core/types'
import { createF35Model } from './createF35Model'
import { groundSamplerRevision, undercarriageClearance } from '../world/ground'
import {
  createEngineState,
  resolveEngineState,
  type EngineState,
} from './EngineState'
import { flightConfig } from './flightConfig'
import { FlightModel, runwayGripForWeather } from './FlightModel'
import { normalizeRenderQuality, type RenderQuality } from '../core/RenderQuality'
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
const EXTERNAL_MODEL_LENGTH = 15.7
/** Re-sample grounded slopes after a short taxi distance or terrain swap. */
const GROUNDED_NORMAL_REFRESH_DISTANCE = 4
const GROUNDED_NORMAL_REFRESH_DISTANCE_SQ = GROUNDED_NORMAL_REFRESH_DISTANCE ** 2

/**
 * Contract for optional GLB replacements: nose points +Z, up is +Y, units are
 * metres, and the undercarriage is anchored 1.4 m below the aircraft origin.
 * The loader normalizes scale and the origin anchor, while preserving the
 * authored hierarchy for animated gear/control nodes.
 */
export const EXTERNAL_AIRCRAFT_MODEL_CONTRACT = {
  forwardAxis: '+Z',
  upAxis: '+Y',
  lengthMeters: EXTERNAL_MODEL_LENGTH,
  gearBottomY: -flightConfig.gearHeight,
} as const

export type AircraftStatus = 'ok' | 'crashed' | 'landed'

export type ContactSurfaceKind = 'land' | 'water'

export interface ControlSurfaceTargets {
  flaperonLeftX: number
  flaperonRightX: number
  stabilatorLeftX: number
  stabilatorRightX: number
  rudderY: number
}

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
  /** Cached rain / snow intensities for airframe storm buffet. */
  weatherRain = 0
  weatherSnow = 0
  /** Gated 0..1 storm buffet drive supplied by the render loop. */
  private stormBuffet = 0
  private stormBuffetPhase = 0
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
  /** Upward component of the resolved ground normal during grounded contact. */
  groundNormalY = 1
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
  private readonly controlSurfaceTarget: ControlSurfaceTargets = {
    flaperonLeftX: 0,
    flaperonRightX: 0,
    stabilatorLeftX: 0,
    stabilatorRightX: 0,
    rudderY: 0,
  }
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
  private groundCacheRevision = 0
  /** Bounded slope cache for grounded landing classification. */
  private groundNormalCacheValid = false
  private groundNormalCacheX = Number.NaN
  private groundNormalCacheZ = Number.NaN
  private groundNormalCacheRevision = 0
  private antiCollisionBeacon: Object3D | null = null
  private antiCollisionBeaconMaterial: MeshBasicMaterial | null = null
  private readonly plumeMaterials: Array<{ name: string; material: MeshBasicMaterial }> = []
  private readonly lowQualityPlumeNodes: Object3D[] = []
  private readonly plumeDiamonds: Array<{
    node: Object3D
    x: number
    y: number
    z: number
  }> = []
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
    let loadedModel: Object3D | null = null
    try {
      // Keep the optional asset pipeline out of the initial game bundle. The
      // procedural F-35 is already playable, so only fetch the GLB loader when
      // a model replacement is actually requested.
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
      const gltf = await new GLTFLoader().loadAsync(url)
      const model = gltf.scene
      loadedModel = model
      model.name = 'model'

      if (this.disposed || loadToken !== this.modelLoadToken) {
        disposeAircraftObject(model)
        loadedModel = null
        return false
      }

      if (!normalizeExternalAircraftModel(model)) {
        throw new Error('External aircraft model has no finite geometry')
      }

      model.traverse(enableShadows)

      const old = this.mesh.getObjectByName('model')
      if (old) {
        this.mesh.remove(old)
        disposeAircraftObject(old)
      }
      this.mesh.add(model)
      loadedModel = null
      this.cacheVisualNodes()
      this.usingPlaceholder = false
      return true
    } catch {
      // Loading can succeed before normalization, shadow setup, or scene
      // replacement fails. Release the still-owned subtree so a rejected
      // optional asset cannot leak geometry, materials, or textures.
      if (loadedModel) disposeAircraftObject(loadedModel)
      return false
    }
  }

  /**
   * Reset to runway. Pass world spawn pose so airfield can move with flat-biome search.
   */
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
    this.groundNormalY = 1
    this.groundCacheValid = false
    this.groundNormalCacheValid = false
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
    this.weatherRain = 0
    this.weatherSnow = 0
    this.stormBuffet = 0
    this.stormBuffetPhase = 0
    this.thermalLift = 0
    this.flight.reset()
    this.wheelSpin = 0
    this.visualTimeMs = 0
    this.navLightOpacity = Number.NaN
    this.nightReadabilityValue = Number.NaN
    this.canopyGlassIntensityValue = Number.NaN
    this.nozzleFlareValue = Number.NaN
    this.resetPlumeCache()
    for (const wheel of this.wheels) wheel.rotation.x = 0
    if (this.gearNose) this.gearNose.rotation.y = 0
    resolveEngineState(this.controls, this.engineState, this.fuel.fraction, this.engineHeat.afterburnerLocked)
    this.status = 'ok'
    this.mesh.visible = true
    this.snapDisplay()
  }

  /** Store the pose from before this physics step for render interpolation. */
  capturePrevious(): void {
    if (this.disposed) return
    this.prevPosition.copy(this.position)
    this.prevOrientation.copy(this.orientation)
  }

  /** Read-only physics position from the start of the current step. */
  get previousPosition(): Readonly<Vector3> {
    return this.prevPosition
  }

  /**
   * Blend the visible mesh/camera pose between the last two physics states.
   * `alpha` 0 = previous step, 1 = current step.
   */
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
    this.applyStormAirframeBuffet()
  }

  /** Copy physics pose to the display pose (reset, pause, crash). */
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
    // Terrain chunks can be replaced between simulation steps, so never carry
    // a contact result across a new physics update.
    this.groundCacheValid = false
    this.prevVelocity.copy(this.velocity)
    this.normalizeControls()
    updateFuel(this.fuel, dt, this.controls.throttle, this.controls.boost)
    resolveEngineState(this.controls, this.engineState, this.fuel.fraction, this.engineHeat.afterburnerLocked)
    updateEngineHeat(this.engineHeat, dt, this.controls.throttle, this.engineState.afterburnerActive)
    this.flight.step(this, dt)
    if (this.impact) {
      this.groundNormalY = Number.isFinite(this.impact.surfaceNormal.y)
        ? MathUtils.clamp(this.impact.surfaceNormal.y, -1, 1)
        : 1
      this.groundNormalCacheValid = true
      this.groundNormalCacheX = this.position.x
      this.groundNormalCacheZ = this.position.z
      this.groundNormalCacheRevision = groundSamplerRevision()
    } else if (dt > 0 && this.onGround) {
      const revision = groundSamplerRevision()
      const dx = this.position.x - this.groundNormalCacheX
      const dz = this.position.z - this.groundNormalCacheZ
      const moved = !Number.isFinite(dx) || !Number.isFinite(dz) ||
        dx * dx + dz * dz > GROUNDED_NORMAL_REFRESH_DISTANCE_SQ
      if (!this.groundNormalCacheValid || moved || this.groundNormalCacheRevision !== revision) {
        this.groundNormalY = this.flight.contactNormalY(this)
        this.groundNormalCacheValid = true
        this.groundNormalCacheX = this.position.x
        this.groundNormalCacheZ = this.position.z
        this.groundNormalCacheRevision = revision
      }
    } else {
      this.groundNormalY = 1
      this.groundNormalCacheValid = false
    }
    this.updateLoadFactor(dt)
    this.autoGear()
    this.updateVisuals(dt, nowMs)
  }

  /** Fail closed at the physics boundary when a stale input object is malformed. */
  private normalizeControls(): void {
    const c = this.controls
    c.pitch = Number.isFinite(c.pitch) ? MathUtils.clamp(c.pitch, -1, 1) : 0
    c.roll = Number.isFinite(c.roll) ? MathUtils.clamp(c.roll, -1, 1) : 0
    c.yaw = Number.isFinite(c.yaw) ? MathUtils.clamp(c.yaw, -1, 1) : 0
    c.throttle = Number.isFinite(c.throttle) ? MathUtils.clamp(c.throttle, 0, 1) : 0
    c.gearDown = c.gearDown === true
    c.boost = c.boost === true
    c.airbrake = c.airbrake === true
    c.stabilityAssist = c.stabilityAssist === true
  }

  /** Feed the current front's gust strength into the fixed-step flight model. */
  setWeatherGust(gust: number): void {
    const safe = Number.isFinite(gust) ? MathUtils.clamp(gust, 0, 1) : 0
    if (Math.abs(safe - this.weatherGust) < 0.002) return
    this.weatherGust = safe
  }

  /** Feed the bounded horizontal wind vector into the fixed-step flight model. */
  setWeatherWind(windX: number, windZ: number): void {
    this.weatherWindX = Number.isFinite(windX) ? MathUtils.clamp(windX, -40, 40) : 0
    this.weatherWindZ = Number.isFinite(windZ) ? MathUtils.clamp(windZ, -40, 40) : 0
  }

  /** Feed blended rain and snow into the forgiving ground-roll grip model. */
  setWeatherSurface(rain: number, snow: number): void {
    const safeRain = Number.isFinite(rain) ? MathUtils.clamp(rain, 0, 1) : 0
    const safeSnow = Number.isFinite(snow) ? MathUtils.clamp(snow, 0, 1) : 0
    if (
      Math.abs(safeRain - this.weatherRain) >= 0.002 ||
      Math.abs(safeSnow - this.weatherSnow) >= 0.002
    ) {
      this.weatherRain = safeRain
      this.weatherSnow = safeSnow
    }
    const next = runwayGripForWeather(safeRain, safeSnow)
    if (Math.abs(next - this.weatherSurfaceGrip) < 0.002) return
    this.weatherSurfaceGrip = next
  }

  /**
   * Feed the gated storm-buffet drive for a readable airframe wobble.
   * Pass 0 on pause / title / results so the jet settles.
   */
  setStormBuffet(intensity: number): void {
    if (this.disposed) return
    if (this.reducedMotion || !Number.isFinite(intensity)) {
      this.stormBuffet = 0
      return
    }
    this.stormBuffet = MathUtils.clamp(intensity, 0, 1)
  }

  /** Feed the fixed-step flight model a finite, normalized thermal envelope. */
  setThermalLift(intensity: number): void {
    this.thermalLift = Number.isFinite(intensity) ? MathUtils.clamp(intensity, 0, 1) : 0
  }

  crash(): void {
    if (this.disposed) return
    this.status = 'crashed'
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    this.prevVelocity.copy(this.velocity)
    this.loadFactor = 0
    this.thermalLift = 0
    this.impactVy = 0
    this.impact = null
    this.groundNormalY = 1
    this.groundCacheValid = false
    this.groundNormalCacheValid = false
    this.controls.throttle = 0
    this.controls.boost = false
    resolveEngineState(this.controls, this.engineState, this.fuel.fraction)
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
    if (this.disposed) return
    if (this.status === 'ok') this.status = 'landed'
  }

  /** After a landing, going airborne again is a new flight. */
  clearLanded(): void {
    if (this.disposed) return
    if (this.status === 'landed') this.status = 'ok'
  }

  /** Toggle the landing gear, retaining automatic low-altitude protection. */
  toggleGear(): boolean {
    if (this.disposed || this.status === 'crashed') return this.controls.gearDown
    if (this.onGround) {
      this.controls.gearDown = true
      this.manualGearOverride = false
      return true
    }
    this.manualGearOverride = true
    this.controls.gearDown = !this.controls.gearDown
    return this.controls.gearDown
  }

  /** Gear down near the surface, up once you have height. */
  private autoGear(): void {
    if (this.status === 'crashed') return
    if (this.onGround) {
      this.controls.gearDown = true
      this.manualGearOverride = false
      return
    }
    const agl = Math.max(0, this.position.y - this.flight.contactMinYAt(
      this.position.x,
      this.position.z,
      this.controls.gearDown,
    ))
    if (agl < 16) {
      this.controls.gearDown = true
      this.manualGearOverride = false
    } else if (agl > 30 && !this.manualGearOverride) {
      this.controls.gearDown = false
    }
  }

  syncMesh(): void {
    if (this.disposed) return
    this.mesh.position.copy(this.position)
    this.mesh.quaternion.copy(this.orientation)
  }

  /**
   * Add a restrained cool fill to dark airframe panels at night and under
   * heavy cloud cover. This keeps the existing silhouette readable without
   * adding lights, meshes, or draw calls.
   */
  setNightReadability(daylight: number, weatherContrast = 0): void {
    if (this.disposed) return
    this.presentationDaylight = Number.isFinite(daylight)
      ? MathUtils.clamp(daylight, 0, 1)
      : 0
    const intensity = Math.min(
      0.56,
      nightAirframeEmissiveIntensity(this.presentationDaylight, weatherContrast) +
        stormAirframeFillIntensity(this.presentationDaylight, weatherContrast),
    )
    if (!Number.isFinite(this.nightReadabilityValue) || Math.abs(intensity - this.nightReadabilityValue) >= 0.005) {
      this.nightReadabilityValue = intensity
      for (const material of this.readabilityMaterials) {
        material.emissiveIntensity = intensity
      }
    }
    if (this.canopyGlassMaterial) {
      const canopyIntensity = canopyGlassEmissiveIntensity(this.presentationDaylight)
      if (
        !Number.isFinite(this.canopyGlassIntensityValue) ||
        Math.abs(canopyIntensity - this.canopyGlassIntensityValue) >= 0.005
      ) {
        this.canopyGlassIntensityValue = canopyIntensity
        this.canopyGlassMaterial.emissiveIntensity = canopyIntensity
      }
    }
  }

  /** Apply the shared render preset to aircraft-only visual detail. */
  setRenderQuality(quality: RenderQuality): void {
    if (this.disposed) return
    this.visualQuality = normalizeRenderQuality(quality)
    this.applyVisualQuality()
  }

  /** Disable continuous aircraft-only visual motion for motion-sensitive play. */
  setReducedMotion(enabled: boolean): void {
    if (this.disposed) return
    this.reducedMotion = enabled === true
    if (this.reducedMotion) this.stormBuffet = 0
  }

  /** Tiny pooled airframe wobble while precipitation or strong gusts buffet the jet. */
  private applyStormAirframeBuffet(): void {
    if (this.reducedMotion || this.stormBuffet <= 0.001 || this.status === 'crashed') return
    const scale = stormBuffetViewScale(false, this.visualQuality === 'low')
    const intensity = this.stormBuffet * scale
    if (intensity <= 0.001) return
    this.stormBuffetPhase = (this.stormBuffetPhase + 0.11 + intensity * 0.08) % (Math.PI * 2)
    const wobble = stormAirframeWobble(this.stormBuffetPhase, intensity)
    this.mesh.rotateX(wobble.x)
    this.mesh.rotateY(wobble.y)
    this.mesh.rotateZ(wobble.z)
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
      if (this.gearDoorNose) this.gearDoorNose.rotation.x = folded * 0.72
      if (this.gearDoorLeft) this.gearDoorLeft.rotation.z = -folded * 0.52
      if (this.gearDoorRight) this.gearDoorRight.rotation.z = folded * 0.52
    }

    this.updateControlSurfaces(dt)
    this.updateWheelSpin(dt)
    this.updateNoseGearSteering(dt)

    if (this.antiCollisionBeacon && this.antiCollisionBeaconMaterial) {
      const opacity = antiCollisionBeaconOpacity(now, this.reducedMotion)
      this.antiCollisionBeacon.visible = opacity > 0.01
      this.antiCollisionBeaconMaterial.opacity = opacity
    }

    const navOpacity = navigationLightOpacity(
      this.reducedMotion ? Number.NaN : now,
      this.presentationDaylight,
    )
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
    const plumeVisible = throttlePower > 0.015
    const boostChanged = boost !== this.plumeBoostValue
    const responseChanged = boostChanged ||
      !Number.isFinite(this.plumeResponseValue) ||
      Math.abs(plumeResponse - this.plumeResponseValue) > 0.001
    if (plumeVisible !== this.plumeVisibleValue) {
      this.plumeVisibleValue = plumeVisible
      ab.visible = plumeVisible
    }
    if (responseChanged) {
      this.plumeResponseValue = plumeResponse
      this.plumeBoostValue = boost
      ab.userData.powerPercent = throttlePower * 100
    }

    // Stretch aft from the nozzle lip. Military power retains a compact hot
    // exhaust; afterburner grows to a long, wide plume at full engine power.
    const pulseAnimated = boost && dt > 0 && !this.reducedMotion
    const pulseModeChanged = pulseAnimated !== this.plumePulseAnimatedValue
    this.plumePulseAnimatedValue = pulseAnimated
    const pulse =
      pulseAnimated ? 1 + Math.sin(now * 0.028) * 0.08 : 1
    const len = (
      0.12 + plumeResponse * (boost ? 2.8 : 1.25)
    ) * pulse
    const fat = 0.68 + plumeResponse * (boost ? 0.62 : 0.32)
    if (pulseAnimated || pulseModeChanged || responseChanged ||
      Math.abs(fat - this.plumeFatValue) > 0.001 ||
      Math.abs(len - this.plumeLengthValue) > 0.001) {
      this.plumeFatValue = fat
      this.plumeLengthValue = len
      ab.scale.set(fat, fat, len)
    }

    if (responseChanged) {
      const boostGlow = boost ? 1 : 0.55
      for (const plume of this.plumeMaterials) {
        if (plume.name === 'abCore') plume.material.opacity = (boost ? 1 : 0.16 + plumeResponse * 0.28) * (boost ? 1 : boostGlow)
        else if (plume.name === 'abMid') plume.material.opacity = (boost ? 0.82 : 0.08 + plumeResponse * 0.22) * (boost ? 1 : boostGlow)
        else if (plume.name === 'abOuter') plume.material.opacity = (boost ? 0.42 : 0.03 + plumeResponse * 0.12)
      }
    }
    if (pulseAnimated || pulseModeChanged || responseChanged) {
      for (let i = 0; i < this.plumeDiamonds.length; i++) {
        const diamond = this.plumeDiamonds[i]!
        if (this.visualQuality === 'low' && i > 0) continue
        const scale = afterburnerDiamondPulse(i, now, pulseAnimated, plumeResponse)
        diamond.node.scale.set(diamond.x * scale, diamond.y * scale, diamond.z * scale)
      }
    }
    const nozzleIntensity = MathUtils.lerp(0, boost ? 8 : 2.1, plumeResponse)
    if (responseChanged || !Number.isFinite(this.nozzleIntensityValue) ||
      Math.abs(nozzleIntensity - this.nozzleIntensityValue) > 0.002) {
      this.nozzleIntensityValue = nozzleIntensity
      for (const glow of this.nozzleGlows) glow.emissiveIntensity = nozzleIntensity
    }
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

  /** Smooth body-up acceleration into an arcade-readable pilot G estimate. */
  private updateLoadFactor(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return
    _loadAcceleration.subVectors(this.velocity, this.prevVelocity).multiplyScalar(1 / dt)
    _loadUp.set(0, 1, 0).applyQuaternion(this.orientation)
    const target = resolveLoadFactor(_loadAcceleration, _loadUp, flightConfig.gravity)
    this.loadFactor = MathUtils.damp(this.loadFactor, target, 8, dt)
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
    const targets = controlSurfaceTargetsInto(
      this.controlSurfaceTarget,
      this.controls.pitch,
      this.controls.roll,
      this.controls.yaw,
      this.controls.airbrake,
    )
    // Snappier chase-readable throws; boards dump hard when B is held.
    setSurfaceAngle(this.flaperonLeft, 'x', targets.flaperonLeftX, 16, dt)
    setSurfaceAngle(this.flaperonRight, 'x', targets.flaperonRightX, 16, dt)
    setSurfaceAngle(this.stabilatorLeft, 'x', targets.stabilatorLeftX, 13, dt)
    setSurfaceAngle(this.stabilatorRight, 'x', targets.stabilatorRightX, 13, dt)
    // Both rudders deflect together for yaw; the canted fins remain fixed.
    setSurfaceAngle(this.tailLeft, 'y', targets.rudderY, 12, dt)
    setSurfaceAngle(this.tailRight, 'y', targets.rudderY, 12, dt)
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
    this.plumeMaterials.length = 0
    this.plumeDiamonds.length = 0
    this.lowQualityPlumeNodes.length = 0
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
    const canopy = this.mesh.getObjectByName('GoldCanopy')
    if (canopy instanceof Mesh && canopy.material instanceof MeshPhysicalMaterial) {
      this.canopyGlassMaterial = canopy.material
    }
    this.applyVisualQuality()
  }

  /** Hide only secondary aircraft effects on Low; core power cues stay visible. */
  private applyVisualQuality(): void {
    const low = this.visualQuality === 'low'
    for (const node of this.lowQualityPlumeNodes) node.visible = !low
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

  /** Radio altitude backed by the current fixed-step contact cache. */
  get altitudeAgl(): number {
    if (this.disposed) return 0
    const floor = this.flight.contactMinYAt(this.position.x, this.position.z, this.controls.gearDown)
    return Math.max(0, this.position.y - floor)
  }

  /** Current resolved ground height, reusing the fixed-step contact cache. */
  get groundHeight(): number {
    if (this.disposed) return 0
    const floor = this.flight.contactMinYAt(this.position.x, this.position.z, this.controls.gearDown)
    return floor - undercarriageClearance(this.controls.gearDown)
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
      this.groundCacheGearDown === gearDown &&
      this.groundCacheRevision === groundSamplerRevision()
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
    this.groundCacheRevision = groundSamplerRevision()
    this.groundCacheValid = true
    return this.groundCacheValue
  }
}

/** Dispose a removed aircraft subtree without double-disposing shared slots. */
export function disposeAircraftObject(root: Object3D): void {
  disposeObjectTree(root)
}

/** Normalize an optional GLB to the same origin and scale as the procedural F-35. */
export function normalizeExternalAircraftModel(model: Object3D): boolean {
  model.updateMatrixWorld(true)
  _box.setFromObject(model)
  _box.getSize(_size)
  const maxDim = Math.max(_size.x, _size.y, _size.z)
  if (!Number.isFinite(maxDim) || maxDim <= 0.001) return false

  model.scale.multiplyScalar(EXTERNAL_AIRCRAFT_MODEL_CONTRACT.lengthMeters / maxDim)
  model.updateMatrixWorld(true)

  _box.setFromObject(model)
  _box.getCenter(_center)
  if (!Number.isFinite(_box.min.x) || !Number.isFinite(_box.min.y) || !Number.isFinite(_box.min.z)
    || !Number.isFinite(_box.max.x) || !Number.isFinite(_box.max.y) || !Number.isFinite(_box.max.z)
    || !Number.isFinite(_center.x) || !Number.isFinite(_center.y) || !Number.isFinite(_center.z)) {
    return false
  }
  // Keep the aircraft origin over the model's centerline. The vertical anchor
  // intentionally is not centered: flight/contact code measures gear height
  // from the origin and expects the wheels to touch at local Y=-1.4 m.
  model.position.x -= _center.x
  model.position.z -= _center.z
  model.position.y += EXTERNAL_AIRCRAFT_MODEL_CONTRACT.gearBottomY - _box.min.y
  model.updateMatrixWorld(true)
  return true
}

/** Rare dorsal anti-collision strobe envelope, hidden between flashes. */
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

/** Slow daylight-aware nav-light breathing keeps the silhouette readable without strobing. */
export function navigationLightOpacity(timeMs: number, daylight = 0): number {
  const safeDaylight = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  const base = 0.34 + (1 - safeDaylight) * 0.45
  if (!Number.isFinite(timeMs)) return base + .03
  return base + (Math.sin(timeMs * .0038) + 1) * .03
}

/** Cool panel fill strength, zero in daylight and stronger through dusk. */
export function nightAirframeEmissiveIntensity(daylight: number, weatherContrast = 0): number {
  const safe = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  const weather = Number.isFinite(weatherContrast) ? MathUtils.clamp(weatherContrast, 0, 1) : 0
  // A dark stealth finish needs a little more separation from storm clouds
  // than a clear night does. Keep the fill additive-only and fully disabled
  // in daylight so the authored grey panels still own the daytime read.
  return (1 - safe) * (0.42 + weather * 0.14)
}

/**
 * Keep the stealth finish readable when dense cloud cover blocks the direct
 * sun, without adding any lift to a clear daytime scene.
 */
export function stormAirframeFillIntensity(daylight: number, weatherContrast = 0): number {
  const safeDaylight = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  const weather = Number.isFinite(weatherContrast) ? MathUtils.clamp(weatherContrast, 0, 1) : 0
  return safeDaylight * weather * 0.18
}

/** Keep the physical canopy readable at night without making it glow by day. */
export function canopyGlassEmissiveIntensity(daylight: number): number {
  const safe = Number.isFinite(daylight) ? MathUtils.clamp(daylight, 0, 1) : 0
  return 0.08 + (1 - safe) * 0.16
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

/** Convert world acceleration into a bounded body-up pilot-load estimate. */
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

/**
 * Arcade stick and speed-brake panel targets for the procedural F-35.
 * Throws stay chase-readable; holding B dumps the boards without new meshes.
 */
export function controlSurfaceTargetsInto(
  out: ControlSurfaceTargets,
  pitch: number,
  roll: number,
  yaw: number,
  airbrake: boolean,
): ControlSurfaceTargets {
  const p = MathUtils.clamp(Number.isFinite(pitch) ? pitch : 0, -1, 1)
  const r = MathUtils.clamp(Number.isFinite(roll) ? roll : 0, -1, 1)
  const y = MathUtils.clamp(Number.isFinite(yaw) ? yaw : 0, -1, 1)
  const b = airbrake ? 1 : 0
  out.flaperonLeftX = -p * 0.28 - r * 0.24 + b * 0.34
  out.flaperonRightX = -p * 0.28 + r * 0.24 + b * 0.34
  out.stabilatorLeftX = -p * 0.22 - r * 0.12 + b * 0.28
  out.stabilatorRightX = -p * 0.22 + r * 0.12 + b * 0.28
  out.rudderY = y * 0.22
  return out
}

/** Public convenience wrapper; the aircraft hot path uses the caller-owned form. */
export function controlSurfaceTargets(
  pitch: number,
  roll: number,
  yaw: number,
  airbrake: boolean,
): ControlSurfaceTargets {
  return controlSurfaceTargetsInto(
    { flaperonLeftX: 0, flaperonRightX: 0, stabilatorLeftX: 0, stabilatorRightX: 0, rudderY: 0 },
    pitch,
    roll,
    yaw,
    airbrake,
  )
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
