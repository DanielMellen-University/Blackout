import { getTerrainProfile } from './TerrainProfile'
import { writeWeatherTransport } from './WeatherTransport'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  InstancedBufferAttribute,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Scene,
  Vector3,
} from 'three'
import { deriveSkyCloudDeckInto, SkyDome, type SkyCloudDeck } from './SkyDome'
import { SnowField } from './SnowField'
import { RainField, precipitationAtAltitude } from './RainField'
import { createCloudMaterial, cloudInteriorDensity } from './CloudMaterial'
import { RainShafts } from './RainShafts'
import { StormEvents, type StormSource } from './StormEvents'
import { disposeObjectTree } from '../core/dispose'
import { nightWeatherReadability } from '../core/SceneExposure'
import { FOG_FAR, STREAM_RADIUS_M } from './TerrainSystem'
import { createRegionalWeatherSample, populateWeatherStructure, weatherLayerExposure, RegionalWeather,
  WEATHER_STRUCTURE_KEYS, type RegionalWeatherSample } from './RegionalWeather'
import { CloudCells, CLOUD_CELL_SIZE, CLOUD_PUFFS_PER_FORMATION, cloudCellRandom, shapeCloudFormation,
  type CloudLayer } from './CloudFormations'
import {
  WEATHER_LABELS,
  WEATHER_ORDER,
  PROFILE_KEYS,
  WeatherDirector,
  normalizeWeatherId,
  timeOfDayForSeed,
  weatherIdForSeed,
  type WeatherId,
  type WeatherSnapshot,
} from './WeatherDirector'

export { WEATHER_LABELS, WEATHER_ORDER, type WeatherId } from './WeatherDirector'
export { lightningCooldown, lightningFlashEnvelope } from './StormEvents'

/**
 * Cloud streaming envelope - match terrain load radius.
 * Deterministic cells fade at the same distance chunks unload.
 */
const CLOUD_DESPAWN = STREAM_RADIUS_M // match terrain stream edge
/** Full opacity inside this range; fade 1→0 from here to despawn. */
const CLOUD_FADE_FULL = FOG_FAR * 0.5
const CLOUD_FADE_OUT = CLOUD_DESPAWN
const CLOUD_FADE_FULL_SQUARED = CLOUD_FADE_FULL ** 2
const CLOUD_FADE_OUT_SQUARED = CLOUD_FADE_OUT ** 2

/** Fade pooled cloud clusters without roots outside the transition band. */
export function cloudDistanceFade(distanceSquared: number): number {
  if (!Number.isFinite(distanceSquared) || distanceSquared < 0) return Number.NaN
  if (distanceSquared <= CLOUD_FADE_FULL_SQUARED) return 1
  if (distanceSquared >= CLOUD_FADE_OUT_SQUARED) return 0
  return 1 - MathUtils.smoothstep(Math.sqrt(distanceSquared), CLOUD_FADE_FULL, CLOUD_FADE_OUT)
}

type RandomSource = () => number

interface CloudPuffLayout {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  rotationY: number
}

interface CloudClusterLayout {
  puffs: CloudPuffLayout[]
  instanceOffset: number
  height: number
}

/**
 * Cloud formations are authored once per atmosphere instance, so their
 * silhouette should not change just because the page was reloaded. Keep the
 * seeded stream local to cloud layout generation; weather and precipitation
 * retain their intentionally live randomness.
 */
export function createCloudLayoutRandom(seed: number): RandomSource {
  let state = (seed >>> 0) || 0x9e3779b9
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CLOUD_LAYER: Record<CloudLayer, { opacityMul: number }> = {
  cumulus: { opacityMul: .95 }, stratus: { opacityMul: .75 }, cirrus: { opacityMul: .42 },
}

const _c = new Color()
const _c2 = new Color()
const _sunDir = new Vector3()
const _horizon = new Color()
const _hemiSky = new Color()
const _hemiGround = new Color()
const _cloudObject = new Object3D()
const _hiddenCloudMatrix = new Matrix4().makeScale(0, 0, 0)
const COL_DAY_SKY = new Color(0x4a9fd4)
const COL_NOON_SKY = new Color(0x5eb0e8)
const COL_NIGHT_SKY = new Color(0x040812)
const COL_DUSK_ZENITH = new Color(0x2a3a68)
const COL_DAY_HORIZ = new Color(0xa8d0ea)
const COL_NIGHT_HORIZ = new Color(0x0a1020)
const COL_DAWN_HORIZ = new Color(0xffb070)
const COL_DUSK_HORIZ = new Color(0xff7a40)
const COL_SNOW_SKY = new Color(0xc8d4e0)
const COL_SNOW_HORIZ = new Color(0xd0dce8)
const COL_SUN = new Color(0xfff4e0)
const COL_SUN_DUSK = new Color(0xff7a38)
const COL_SUN_LOW = new Color(0xffaa66)
const COL_HEMI_DAY = new Color(0xd8ecff)
const COL_HEMI_NIGHT = new Color(0x1a2848)
const COL_GROUND_DAY = new Color(0x3a4a38)
const COL_GROUND_NIGHT = new Color(0x0c1018)
/** Sample/select/rebuild at 5 Hz; the shader interpolates between updates. */
const CLOUD_UPDATE_STEP_SEC = .2
/** Stable pre-reseed clock used while the world is still booting. */
export const DEFAULT_ATMOSPHERE_TIME = 0.5

/** Clamp a cloud deck's instanced draw range to a safe quality budget. */
export function cloudPuffCount(total: number, scale: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  const safeScale = Number.isFinite(scale) ? MathUtils.clamp(scale, 0, 1) : 1
  return Math.max(1, Math.min(Math.floor(total), Math.round(total * safeScale)))
}

/** Snap a cloud budget to complete cluster boundaries so silhouettes stay intact. */
export function cloudPuffBudget(
  total: number,
  scale: number,
  cutoffs: readonly number[],
): number {
  const target = cloudPuffCount(total, scale)
  let budget = 0
  for (const cutoff of cutoffs) {
    if (!Number.isFinite(cutoff) || cutoff > target) break
    budget = Math.max(budget, Math.floor(cutoff))
  }
  if (target > 0 && budget === 0 && cutoffs.length > 0) {
    budget = Math.max(0, Math.floor(cutoffs[0]!))
  }
  return Math.min(Math.floor(total), budget)
}


export interface AtmosphereAnchor {
  x: number
  y: number
  z: number
}

function safeNonNegativeDelta(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function safeAnchorComponent(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

/** Static paused frames only need an atmosphere pass when the anchor moved. */
export function atmosphereNeedsUpdate(
  dt: number,
  visualDt: number,
  x: number,
  y: number,
  z: number,
  previous: AtmosphereAnchor | null,
): boolean {
  const safeDt = safeNonNegativeDelta(dt)
  const safeVisualDt = safeNonNegativeDelta(visualDt)
  if (safeDt > 0 || safeVisualDt > 0 || !previous) return true
  const safeX = safeAnchorComponent(x, previous.x)
  const safeY = safeAnchorComponent(y, previous.y)
  const safeZ = safeAnchorComponent(z, previous.z)
  return previous.x !== safeX || previous.y !== safeY || previous.z !== safeZ
}

/** Cheap per-streak lateral rain drift used by the pooled particle update. */
export function rainLateralVelocity(
  sway: number,
  windX: number,
  intensity: number,
): number {
  const streakSway = Number.isFinite(sway) ? sway : 0
  const wind = Number.isFinite(windX) ? windX : 0
  const rain = Number.isFinite(intensity) ? MathUtils.clamp(intensity, 0, 1) : 0
  return wind * 0.38 + streakSway * 3 * rain
}

/** Keep storm fog readable at night without touching clear skies or flashes. */
export function fogHorizonReadability(
  daylight: number,
  precipitation: number,
  cloudCover: number,
): number {
  return nightWeatherReadability(daylight, precipitation, cloudCover)
}

/**
 * Day/night cycle + weather: sky dome (sun/moon/stars), fog, lights, clouds, rain/snow.
 * Full day ~8 real minutes. Time fully random on reseed.
 */
export class Atmosphere {
  /** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  timeOfDay = DEFAULT_ATMOSPHERE_TIME
  /** Real seconds for a full 24h cycle. */
  dayLengthSec = 480
  /** Authored night courses can hold their clock while ordinary worlds cycle. */
  timeOfDayLocked = false

  weather: WeatherId = 'clear'
  private readonly weatherDirector = new WeatherDirector()
  private readonly weatherState = createRegionalWeatherSample()
  private readonly regionalWeather = new RegionalWeather()
  private readonly regionalTarget = createRegionalWeatherSample()
  private readonly regionalFrom = createRegionalWeatherSample()
  private regionalSampleTime = -Infinity
  private regionalSampleX = Infinity
  private regionalSampleY = Infinity
  private regionalSampleZ = Infinity
  private manualStructureBase = 1400
  private readonly cloudWeather = createRegionalWeatherSample()
  private readonly regionalBlendFrom = createRegionalWeatherSample()
  private regionalBlendRemaining = 0
  private readonly cloudSamples = Array.from({ length: 46 }, createRegionalWeatherSample)
  private readonly cloudSampleTimes = new Float64Array(46).fill(-Infinity)
  private readonly distantDecks = new Float32Array(45)
  private distantSampleTime = -Infinity
  private distantSampleX = Infinity
  private distantSampleZ = Infinity
  private automaticWeather = false
  private weatherLocked = false
  private regionalElapsed = 0
  /** Rebuild the pooled snapshot only after a weather mutation or update. */
  private weatherSnapshotDirty = true
  private readonly skyCloudDeck = {} as SkyCloudDeck
  private readonly distantCloudDeck = {} as SkyCloudDeck
  private elapsed = 0
  private readonly stormEvents = new StormEvents()
  private readonly stormSource: StormSource = { x: 0, y: 0, z: 0, strength: 0 }
  private reducedMotion = false
  private clockLabelMinute = -1
  private clockLabelValue = '00:00'
  private weatherLabelTarget: WeatherId | null = null
  private weatherLabelShifting = false
  private weatherLabelAutomatic = false
  private weatherLabelValue = ''
  private readonly lastAnchor: AtmosphereAnchor = { x: 0, y: 0, z: 0 }
  private hasLastAnchor = false
  private dirty = true
  private disposed = false

  private readonly hemi: HemisphereLight
  private readonly ambient: AmbientLight
  private readonly sun: DirectionalLight
  private readonly moon: DirectionalLight
  private readonly fill: DirectionalLight
  private readonly scene: Scene
  private readonly sky: SkyDome

  private readonly rainField = new RainField()
  private readonly snowField: SnowField
  private precipitationScale = 1
  private readonly cloudSun = { value: new Vector3(0, 1, 0) }
  private readonly cloudStorm = { value: 0 }
  private readonly cloudDrift = { value: new Vector3() }
  private readonly cloudFrameBlend = { value: 1 }
  private readonly cloudFlashPosition = { value: new Vector3() }
  private readonly cloudFlash = { value: 0 }
  private readonly weatherClock = { value: 0 }
  private readonly rainShafts = new RainShafts(this.cloudDrift, this.cloudFrameBlend, this.weatherClock)
  private cloudImmersion = 0
  private cloudImmersionTarget = 0
  private cloudBaseOffset = 0

  private readonly cloudRoot = new Group()
  private readonly cloudClusters: CloudClusterLayout[] = []
  private readonly cloudInstances = {} as Record<CloudLayer, InstancedMesh>
  private readonly cloudPuffCounts: Record<CloudLayer, number> = {
    cumulus: 0,
    stratus: 0,
    cirrus: 0,
  }
  private readonly cloudLayerCutoffs: Record<CloudLayer, number[]> = {
    cumulus: [],
    stratus: [],
    cirrus: [],
  }
  private readonly cloudDrawCounts: Record<CloudLayer, number> = {
    cumulus: 0,
    stratus: 0,
    cirrus: 0,
  }
  private cloudDensityScale = 1
  /** Absolute world positions (clouds do NOT follow the jet). */
  private readonly cloudWorld: Vector3[] = []
  /** Soft opacity 0–1 per cluster (fade in/out, not hard pop). */
  private readonly cloudAlpha: number[] = []
  private readonly cloudLayers: CloudLayer[] = []
  private readonly cloudCells: CloudCells
  /** Seeded cloud placement keeps a world reviewable after a reseed. */
  private cloudSeed = 1337
  private readonly cloudTransport = writeWeatherTransport({ x: 0, z: 0 }, 1337)
  private cloudUpdateAccumulator = 0
  private cloudMatrixTime = 0

  private baseFogNear = 1200
  private baseFogFar = 4000

  constructor(
    scene: Scene,
    lights: {
      sun: DirectionalLight
      moon: DirectionalLight
      hemi: HemisphereLight
      ambient: AmbientLight
      fill: DirectionalLight
    },
    fogNear: number,
    fogFar: number,
  ) {
    this.scene = scene
    this.sun = lights.sun
    this.moon = lights.moon
    this.hemi = lights.hemi
    this.ambient = lights.ambient
    this.fill = lights.fill
    this.baseFogNear = fogNear
    this.baseFogFar = fogFar

    this.timeOfDay = DEFAULT_ATMOSPHERE_TIME
    this.weather = 'clear'

    // Shader sky: gradient + sun/moon discs + stars
    this.sky = new SkyDome(scene)
    this.sky.setRegionalTransport(this.cloudTransport.x, this.cloudTransport.z)
    // Let the dome paint the backdrop (clear color stays dark night base)
    this.scene.background = new Color(0x02040a)

    // World-space pooled streaks preserve parallax through fast flight.
    scene.add(this.rainField.mesh)
    scene.add(this.rainShafts.mesh)

    this.snowField = new SnowField()
    scene.add(this.snowField.points)

    // --- Layered world-space clouds (real-world altitudes & scale) ---
    this.cloudRoot.name = 'Clouds'
    // A smoother shared puff keeps the instanced cloud batches volumetric
    // without multiplying draw calls. The old 20-face blob read as a stack
    // of flat discs when viewed from below.
    const puffGeo = new IcosahedronGeometry(1, 2)
    const cloudVertices = puffGeo.getAttribute('position')
    for (let i = 0; i < cloudVertices.count; i++) {
      const x = cloudVertices.getX(i), y = cloudVertices.getY(i), z = cloudVertices.getZ(i)
      const radius = 1 + Math.sin(x * 4.1 + z * 2.7) * Math.sin(y * 3.3 - z * 1.9) * .09 +
        Math.cos(z * 5.3 + x * 1.7) * .035
      cloudVertices.setXYZ(i, x * radius, y * radius, z * radius)
    }
    // Retain the smooth radial normals. This geometry is non-indexed, so
    // computeVertexNormals would give every triangle a hard faceted edge.
    // Mix: mostly mid/low heaps + broad decks + sparse high cirrus
    const layerPlan: CloudLayer[] = [
      ...Array(20).fill('cumulus' as CloudLayer),
      ...Array(16).fill('stratus' as CloudLayer),
      ...Array(10).fill('cirrus' as CloudLayer),
    ]
    const cloudRandom = createCloudLayoutRandom(0x434c4f55)
    for (let i = layerPlan.length - 1; i > 0; i--) {
      const j = (cloudRandom() * (i + 1)) | 0
      const tmp = layerPlan[i]!
      layerPlan[i] = layerPlan[j]!
      layerPlan[j] = tmp
    }

    for (const layer of layerPlan) {
      // Equal family capacities make a cell's silhouette independent of which
      // pool slot receives it. 320 + 288 + 80 = 688, below the 694 hard cap.
      const count = CLOUD_PUFFS_PER_FORMATION[layer]
      const cluster: CloudClusterLayout = { puffs: Array.from({ length: count }, () =>
        ({ x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, rotationY: 0 })), instanceOffset: 0, height: 1 }
      this.cloudWorld.push(new Vector3())
      this.cloudAlpha.push(0)
      this.cloudLayers.push(layer)
      this.cloudClusters.push(cluster)
      this.cloudPuffCounts[layer] += cluster.puffs.length
    }
    this.cloudCells = new CloudCells(this.cloudLayers)

    // Three deck-wide batches replace hundreds of individual cloud draw calls.
    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      const mat = createCloudMaterial(this.cloudSun, this.cloudStorm, this.cloudDrift, this.cloudFrameBlend,
        this.cloudFlashPosition, this.cloudFlash)
      mat.name = `Cloud-${layer}`
      const geometry = puffGeo.clone()
      geometry.setAttribute('cloudAlpha', new InstancedBufferAttribute(new Float32Array(this.cloudPuffCounts[layer]), 1).setUsage(DynamicDrawUsage))
      geometry.setAttribute('cloudAlphaFrom', new InstancedBufferAttribute(new Float32Array(this.cloudPuffCounts[layer]), 1).setUsage(DynamicDrawUsage))
      geometry.setAttribute('cloudTone', new InstancedBufferAttribute(new Float32Array(this.cloudPuffCounts[layer]), 1).setUsage(DynamicDrawUsage))
      const instances = new InstancedMesh(geometry, mat, this.cloudPuffCounts[layer])
      instances.name = `CloudBatch-${layer}`
      instances.frustumCulled = false
      instances.instanceMatrix.setUsage(DynamicDrawUsage)
      for (let i = 0; i < this.cloudPuffCounts[layer]; i++) {
        instances.setMatrixAt(i, _hiddenCloudMatrix)
      }
      instances.instanceMatrix.needsUpdate = true
      this.cloudInstances[layer] = instances
      this.cloudRoot.add(instances)
    }

    puffGeo.dispose()

    const offsets: Record<CloudLayer, number> = { cumulus: 0, stratus: 0, cirrus: 0 }
    for (let i = 0; i < this.cloudClusters.length; i++) {
      const layer = this.cloudLayers[i]!
      const cluster = this.cloudClusters[i]!
      cluster.instanceOffset = offsets[layer]
      offsets[layer] += cluster.puffs.length
      this.cloudLayerCutoffs[layer].push(offsets[layer])
    }
    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      this.cloudDrawCounts[layer] = this.cloudPuffCounts[layer]
    }
    scene.add(this.cloudRoot)

    this.weatherDirector.snapshotInto(this.weatherState)
    populateWeatherStructure(this.weatherState)
    this.weatherSnapshotDirty = false
    this.apply(0, 0, 0, 0, 0, this.weatherState)
  }

  /** Apply the selected graphics preset to both pooled precipitation fields. */
  setPrecipitationScale(scale: number): void {
    if (this.disposed) return
    const safe = Number.isFinite(scale) ? Math.max(0, Math.min(1, scale)) : 1
    if (safe === this.precipitationScale) return
    this.precipitationScale = safe
    this.rainField.setDensityScale(safe)
    this.rainShafts.setDensityScale(safe)
    this.snowField.setDensityScale(safe)
  }

  /** Apply a quality budget to the existing instanced cloud deck batches. */
  setCloudDensityScale(scale: number): void {
    if (this.disposed) return
    const safe = Number.isFinite(scale) ? MathUtils.clamp(scale, 0, 1) : 1
    if (safe === this.cloudDensityScale) return
    this.cloudDensityScale = safe
    this.sky.setCloudDetailScale(safe)
    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      const instances = this.cloudInstances[layer]
      const budget = cloudPuffBudget(
        this.cloudPuffCounts[layer],
        safe,
        this.cloudLayerCutoffs[layer],
      )
      this.cloudDrawCounts[layer] = budget
      instances.count = budget
    }
  }

  /** Keep atmosphere fog aligned with the active terrain quality envelope. */
  setFogRange(near: number, far: number): void {
    if (this.disposed) return
    const safeFar = Number.isFinite(far) ? Math.max(1000, far) : this.baseFogFar
    const safeNear = Number.isFinite(near)
      ? MathUtils.clamp(near, 25, Math.max(25, safeFar - 100))
      : this.baseFogNear
    this.baseFogNear = safeNear
    this.baseFogFar = safeFar
    if (this.scene.fog instanceof Fog) {
      this.scene.fog.near = safeNear
      this.scene.fog.far = safeFar
    }
  }

  /** Cycle weather type (N key). */
  cycleWeather(): WeatherId {
    if (this.disposed) return this.weather
    if (this.weatherLocked) return this.weather
    if (!this.automaticWeather && this.weatherDirector.targetId === 'blizzard') {
      this.setAutomaticWeather(true)
    } else {
      const index = this.automaticWeather ? -1 : WEATHER_ORDER.indexOf(this.weatherDirector.targetId)
      this.setWeather(WEATHER_ORDER[index + 1]!)
    }
    return this.weather
  }

  get weatherAutomatic(): boolean { return this.automaticWeather }
  get weatherSimulationTime(): number { return this.regionalElapsed }
  /** The same source-layer attenuation used by the rendered precipitation. */
  get precipitationVisibility(): number {
    const state = this.weatherSnapshot
    return precipitationAtAltitude(this.lastAnchor.y, state.lightning,
      this.weatherState.precipitationBase)
  }

  /** Local convective exposure shared by fog, buffet and weather audio. */
  get stormExposure(): number {
    this.weatherSnapshot
    return weatherLayerExposure(this.lastAnchor.y, this.weatherState.cloudTop)
  }

  /** Resume regional conditions without changing seed, clock, or flight state. */
  setAutomaticWeather(enabled: boolean, simulationTime?: number): void {
    if (this.disposed || (enabled && this.weatherLocked)) return
    if (enabled && !this.automaticWeather) Object.assign(this.regionalBlendFrom, this.weatherSnapshot)
    this.regionalBlendRemaining = enabled && !this.automaticWeather && !Number.isFinite(simulationTime) ? 5 : 0
    this.automaticWeather = enabled === true
    this.stormEvents.clearFlash(); this.cloudFlash.value = 0; this.stormSource.strength = 0
    if (Number.isFinite(simulationTime)) this.regionalElapsed = Math.max(0, simulationTime!)
    this.regionalSampleTime = -Infinity
    this.cloudUpdateAccumulator = CLOUD_UPDATE_STEP_SEC
    if (this.automaticWeather) this.weatherDirector.setWindHeading(null)
    this.cloudSampleTimes.fill(-Infinity)
    this.distantSampleTime = -Infinity
    this.weatherSnapshotDirty = true
    this.dirty = true
    this.weatherSnapshot
  }

  setWeatherLocked(locked: boolean): void {
    if (this.disposed) return
    this.weatherLocked = locked === true
    if (this.weatherLocked) this.automaticWeather = false
    this.weatherDirector.setLocked(locked)
    this.regionalSampleTime = -Infinity
    this.weatherSnapshotDirty = true
    this.dirty = true
  }

  setTimeOfDayLocked(locked: boolean): void {
    if (this.disposed) return
    this.timeOfDayLocked = locked === true
  }

  setWeather(id: WeatherId, instant = false): void {
    if (this.disposed) return
    const safeId = normalizeWeatherId(id)
    const initial = this.automaticWeather ? this.weatherSnapshot : undefined
    this.automaticWeather = false
    this.weatherDirector.setWeather(safeId, instant, initial)
    this.weather = safeId
    this.regionalSampleTime = -Infinity
    this.stormEvents.clearFlash(); this.cloudFlash.value = 0; this.stormSource.strength = 0
    this.cloudSampleTimes.fill(-Infinity)
    this.cloudUpdateAccumulator = CLOUD_UPDATE_STEP_SEC
    this.weatherSnapshotDirty = true
    this.dirty = true
  }

  /** Keep an authored course wind on a stable runway-relative side. */
  setWindHeading(heading: number | null): void {
    if (this.disposed) return
    this.weatherDirector.setWindHeading(heading)
    this.weatherSnapshotDirty = true
    this.dirty = true
  }

  get authoredWindHeading(): number | null {
    return this.weatherDirector.authoredWindHeading
  }

  /** Seed the day clock, preset fallback, and position-based Automatic weather. */
  randomizeWeather(seed: number, anchor?: AtmosphereAnchor): void {
    if (this.disposed) return
    this.timeOfDayLocked = false
    this.timeOfDay = timeOfDayForSeed(seed)
    const w = weatherIdForSeed(seed, this.timeOfDay)

    this.weatherDirector.randomize(seed, w)
    this.automaticWeather = true
    this.weatherLocked = false
    this.regionalElapsed = 0
    this.regionalSampleTime = -Infinity
    this.cloudUpdateAccumulator = CLOUD_UPDATE_STEP_SEC
    this.cloudDrift.value.set(0, 0, 0)
    this.regionalBlendRemaining = 0
    this.cloudSampleTimes.fill(-Infinity)
    this.distantSampleTime = -Infinity
    this.lastAnchor.x = Number.isFinite(anchor?.x) ? anchor!.x : 0
    this.lastAnchor.y = Number.isFinite(anchor?.y) ? anchor!.y : 0
    this.lastAnchor.z = Number.isFinite(anchor?.z) ? anchor!.z : 0
    this.hasLastAnchor = true
    this.rainField.setSeed(seed)
    this.snowField.setSeed(seed)
    this.weather = w
    this.reseedCloudField(seed)
    this.weatherSnapshotDirty = true
    this.cloudImmersion = this.cloudImmersionTarget = 0
    this.stormEvents.reset(seed)
    this.stormSource.strength = 0
    this.cloudFlash.value = 0
    this.rainShafts.reset()
    this.dirty = true
  }

  get clockLabel(): string {
    const minute = Math.floor(this.timeOfDay * 24 * 60) % 1440
    if (minute !== this.clockLabelMinute) {
      this.clockLabelMinute = minute
      const h = Math.floor(minute / 60)
      const m = minute % 60
      this.clockLabelValue = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    return this.clockLabelValue
  }

  get weatherLabel(): string {
    const target = this.automaticWeather ? this.weather : this.weatherDirector.targetId
    const shifting = !this.automaticWeather && this.weatherDirector.transitioning
    if (target !== this.weatherLabelTarget || shifting !== this.weatherLabelShifting ||
      this.automaticWeather !== this.weatherLabelAutomatic) {
      this.weatherLabelTarget = target
      this.weatherLabelShifting = shifting
      this.weatherLabelAutomatic = this.automaticWeather
      this.weatherLabelValue = `${this.automaticWeather ? 'AUTOMATIC / ' : ''}${WEATHER_LABELS[target]}${shifting ? ' / SHIFTING' : ''}`
    }
    return this.weatherLabelValue
  }

  /** Continuous precipitation values for terrain surface shading. */
  get weatherSnapshot(): WeatherSnapshot {
    if (this.weatherSnapshotDirty) {
      if (this.automaticWeather) {
        const gap = this.regionalElapsed - this.regionalSampleTime
        const moved = Math.hypot(this.lastAnchor.x - this.regionalSampleX, this.lastAnchor.z - this.regionalSampleZ) >= 500 ||
          Math.abs(this.lastAnchor.y - this.regionalSampleY) >= 100
        if (gap + 1e-8 >= .2 || moved) {
          Object.assign(this.regionalFrom, this.weatherState)
          this.regionalWeather.sampleInto(this.regionalTarget, this.lastAnchor.x, this.lastAnchor.y,
            this.lastAnchor.z, this.regionalElapsed)
          // First seed, explicit clock seek, teleport or large simulation jump
          // must resolve the requested position immediately, even while paused.
          if (!Number.isFinite(this.regionalSampleTime) || gap >= 1 || moved)
            Object.assign(this.regionalFrom, this.regionalTarget)
          this.regionalSampleTime = this.regionalElapsed
          this.regionalSampleX = this.lastAnchor.x; this.regionalSampleY = this.lastAnchor.y
          this.regionalSampleZ = this.lastAnchor.z
        }
        const presentation = MathUtils.clamp((this.regionalElapsed - this.regionalSampleTime) / .2, 0, 1)
        for (const key of PROFILE_KEYS)
          this.weatherState[key] = MathUtils.lerp(this.regionalFrom[key], this.regionalTarget[key], presentation)
        for (const key of WEATHER_STRUCTURE_KEYS)
          this.weatherState[key] = MathUtils.lerp(this.regionalFrom[key], this.regionalTarget[key], presentation)
        this.weatherState.windX = MathUtils.lerp(this.regionalFrom.windX, this.regionalTarget.windX, presentation)
        this.weatherState.windZ = MathUtils.lerp(this.regionalFrom.windZ, this.regionalTarget.windZ, presentation)
        this.weatherState.id = this.regionalTarget.id
        if (this.regionalBlendRemaining > 0) {
          const blend = MathUtils.smoothstep(1 - this.regionalBlendRemaining / 5, 0, 1)
          for (const key of PROFILE_KEYS)
            this.weatherState[key] = MathUtils.lerp(this.regionalBlendFrom[key], this.weatherState[key], blend)
          this.weatherState.windX = MathUtils.lerp(this.regionalBlendFrom.windX, this.weatherState.windX, blend)
          this.weatherState.windZ = MathUtils.lerp(this.regionalBlendFrom.windZ, this.weatherState.windZ, blend)
          for (const key of WEATHER_STRUCTURE_KEYS)
            this.weatherState[key] = MathUtils.lerp(this.regionalBlendFrom[key], this.weatherState[key], blend)
        }
        this.weather = this.weatherState.id
      } else {
        this.weatherDirector.snapshotInto(this.weatherState)
        this.weatherState.id = this.weatherDirector.targetId
        if (this.regionalElapsed - this.regionalSampleTime + 1e-8 >= .2 ||
          Math.hypot(this.lastAnchor.x - this.regionalSampleX, this.lastAnchor.z - this.regionalSampleZ) >= 500) {
          this.manualStructureBase = this.regionalWeather.cloudBaseAt(this.lastAnchor.x, this.lastAnchor.z)
          this.regionalSampleTime = this.regionalElapsed
          this.regionalSampleX = this.lastAnchor.x; this.regionalSampleZ = this.lastAnchor.z
        }
        populateWeatherStructure(this.weatherState, this.manualStructureBase - this.weatherState.haze * 220)
      }
      this.weatherSnapshotDirty = false
    }
    return this.weatherState
  }

  /** True while the current weather front is blending toward its target. */
  get weatherTransitioning(): boolean {
    return !this.automaticWeather && this.weatherDirector.transitioning
  }

  /** True while the current storm flash envelope is active. */
  get lightningActive(): boolean {
    return !this.disposed && this.stormEvents.active
  }

  /** Consume the sole arrived thunder event once. Zero means no audible event. */
  consumeThunder(): number { return this.disposed ? 0 : this.stormEvents.consumeThunder() }

  /** Respect the browser's reduced-motion preference for storm flashes. */
  setReducedMotion(enabled: boolean): void {
    if (this.disposed) return
    const reduced = enabled === true
    this.reducedMotion = reduced
    this.sky?.setReducedMotion(reduced)
    this.stormEvents.setReducedMotion(reduced)
    if (reduced) this.cloudFlash.value = 0
  }

  get prefersReducedMotion(): boolean {
    return this.reducedMotion
  }

  /** Smoothed 0–1 cloud density around the aircraft for HUD/audio cues. */
  get cloudImmersionLevel(): number {
    return Number.isFinite(this.cloudImmersion)
      ? MathUtils.clamp(this.cloudImmersion, 0, 1)
      : 0
  }

  /** Daylight factor shared by world materials (0 = night, 1 = full day). */
  get daylight(): number {
    const elevation = Math.sin((this.timeOfDay - 0.25) * Math.PI * 2)
    return MathUtils.smoothstep(elevation, -0.12, 0.28)
  }

  get phaseLabel(): string {
    const t = this.timeOfDay
    if (t < 0.2 || t >= 0.8) return 'NIGHT'
    if (t < 0.3) return 'DAWN'
    if (t < 0.7) return 'DAY'
    return 'DUSK'
  }

  /** Release pooled weather, cloud, sky, and precipitation resources. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.rainField.dispose()
    this.rainShafts.dispose()
    this.stormEvents.reset(0)
    this.snowField.points.removeFromParent()
    this.snowField.dispose()
    this.sky.dispose()

    disposeObjectTree(this.cloudRoot)
    this.cloudClusters.length = 0
    this.cloudWorld.length = 0
    this.cloudAlpha.length = 0
    this.cloudLayers.length = 0
  }

  update(dt: number, ax: number, ay: number, az: number, visualDt = dt): void {
    if (this.disposed) return
    const safeDt = safeNonNegativeDelta(dt)
    const safeVisualDt = safeNonNegativeDelta(visualDt)
    const previousAnchor = this.hasLastAnchor ? this.lastAnchor : null
    const safeX = safeAnchorComponent(ax, previousAnchor?.x ?? this.lastAnchor.x)
    const safeY = safeAnchorComponent(ay, previousAnchor?.y ?? this.lastAnchor.y)
    const safeZ = safeAnchorComponent(az, previousAnchor?.z ?? this.lastAnchor.z)
    if (!this.dirty && !atmosphereNeedsUpdate(safeDt, safeVisualDt, safeX, safeY, safeZ, previousAnchor)) return
    this.lastAnchor.x = safeX
    this.lastAnchor.y = safeY
    this.lastAnchor.z = safeZ
    this.hasLastAnchor = true
    if (!this.timeOfDayLocked) {
      this.timeOfDay = (this.timeOfDay + safeDt / this.dayLengthSec) % 1
    }
    this.elapsed += safeDt
    this.regionalElapsed += safeDt
    this.regionalBlendRemaining = Math.max(0, this.regionalBlendRemaining - safeDt)
    if (!this.automaticWeather) {
      this.weatherDirector.update(safeDt, false)
      this.weather = this.weatherDirector.targetId
    }
    this.weatherSnapshotDirty = true
    this.weatherSnapshot

    this.apply(safeX, safeY, safeZ, safeDt, safeVisualDt, this.weatherState)
    this.dirty = false
  }

  private apply(
    ax: number,
    ay: number,
    az: number,
    dt: number,
    visualDt: number,
    w: WeatherSnapshot,
  ): void {
    const t = this.timeOfDay
    // Sun elevation: -1 midnight-side, +1 noon
    const elev = Math.sin((t - 0.25) * Math.PI * 2)
    // Three.js: smoothstep(x, min, max)
    const dayFactor = MathUtils.smoothstep(elev, -0.12, 0.28)
    const nightFactor = 1 - dayFactor
    const dusk =
      MathUtils.smoothstep(t, 0.18, 0.28) * (1 - MathUtils.smoothstep(t, 0.28, 0.38)) +
      MathUtils.smoothstep(t, 0.68, 0.78) * (1 - MathUtils.smoothstep(t, 0.78, 0.88))

    this.stormEvents.update(dt, this.stormSource, this.lastAnchor)
    this.cloudFlashPosition.value.set(this.stormEvents.position.x, this.stormEvents.position.y, this.stormEvents.position.z)
    this.cloudFlash.value = this.stormEvents.flash
    this.weatherClock.value = this.regionalElapsed
    deriveSkyCloudDeckInto(this.skyCloudDeck, w)
    const totalClouds = Math.max(w.lowClouds, w.midClouds * 0.9, w.highClouds * 0.55)

    // Zenith color (top of sky dome)
    _c.copy(COL_NIGHT_SKY).lerp(COL_DAY_SKY, dayFactor)
    if (dayFactor > 0.7) _c.lerp(COL_NOON_SKY, (dayFactor - 0.7) / 0.3)
    if (dusk > 0.15) _c.lerp(COL_DUSK_ZENITH, dusk * 0.55)

    // Horizon band (warmer at dawn/dusk)
    _horizon.copy(COL_NIGHT_HORIZ).lerp(COL_DAY_HORIZ, dayFactor)
    if (t > 0.18 && t < 0.38) _horizon.lerp(COL_DAWN_HORIZ, dusk * 0.9)
    if (t > 0.62 && t < 0.88) _horizon.lerp(COL_DUSK_HORIZ, dusk * 0.95)

    if (getTerrainProfile()?.theme === 'desert-run') {
      _c2.setHex(0xc7a979)
      _horizon.lerp(_c2, dayFactor * .64)
      _c.lerp(_c2, dayFactor * .16)
    }
    if (getTerrainProfile()?.theme === 'mountain-valley-run') {
      _c2.setHex(0xb5cad6)
      _horizon.lerp(_c2, dayFactor * .3)
      _c.lerp(_c2, dayFactor * .08)
    }
    if (getTerrainProfile()?.theme === 'coastal-island-run') {
      _c2.setHex(0x9dc6cd)
      _horizon.lerp(_c2, dayFactor * .35)
      _c.lerp(_c2, dayFactor * .08)
    }
    if (getTerrainProfile()?.theme === 'volcanic-run') {
      _c2.setHex(0x8e8d98)
      _horizon.lerp(_c2, dayFactor * .76)
      _c.lerp(_c2, dayFactor * .34)
    }
    // Haze / snow sky pull
    _c2.setHex(w.snow > 0.3 ? 0x9aabbc : 0x6a7888)
    _c.lerp(_c2, w.haze * 0.4 + w.snow * 0.12)
    _horizon.lerp(_c2, w.haze * 0.55 + w.snow * 0.18)
    if (w.rain > 0.5) {
      _c.multiplyScalar(1 - w.rain * 0.18)
      _horizon.multiplyScalar(1 - w.rain * 0.14)
    }
    if (w.lightning > 0.05) {
      _c2.setHex(0x334052)
      _c.lerp(_c2, w.lightning * 0.34)
      _c2.setHex(0x465463)
      _horizon.lerp(_c2, w.lightning * 0.28)
    }
    if (w.snow > 0.7) {
      _c.lerp(COL_SNOW_SKY, 0.2)
      _horizon.lerp(COL_SNOW_HORIZ, 0.25)
    }
    const fogReadability = fogHorizonReadability(dayFactor, Math.max(w.rain, w.snow), totalClouds)
    if (fogReadability > 0) _horizon.multiplyScalar(1 + fogReadability * .12)

    const ceiling = this.weatherState.precipitationBase
    const source = precipitationAtAltitude(ay, w.lightning, ceiling)
    const aboveDeck = 1 - weatherLayerExposure(ay, this.weatherState.cloudTop)
    this.cloudImmersion = MathUtils.lerp(this.cloudImmersion, this.cloudImmersionTarget, 1 - Math.exp(-Math.max(0, visualDt) * 3))
    const cloudLight = (.46 + dayFactor * .36) * (1 - w.lightning * .22 - w.rain * .10)
    _c2.setRGB(cloudLight * .96, cloudLight, cloudLight * 1.03)
    _horizon.lerp(_c2, this.cloudImmersion)
    const fogNear = MathUtils.lerp(this.baseFogNear * MathUtils.lerp(w.fogNearMul, 1.1, aboveDeck), 25, this.cloudImmersion)
    const weatherFar = Math.min(this.baseFogFar * w.fogFarMul, this.weatherState.visibilityM)
    const fogFar = MathUtils.lerp(Math.min(MathUtils.lerp(weatherFar, this.baseFogFar, aboveDeck), STREAM_RADIUS_M * .9), 420, this.cloudImmersion)
    // Fog matches horizon so the stream edge blends into the sky
    if (this.scene.fog instanceof Fog) {
      this.scene.fog.color.copy(_horizon)
      this.scene.fog.near = fogNear
      this.scene.fog.far = fogFar
    } else {
      this.scene.fog = new Fog(_horizon.getHex(), fogNear, fogFar)
    }

    // Orbital sun direction (full arc, including under horizon)
    const azim = (t - 0.25) * Math.PI * 2
    _sunDir.set(Math.cos(azim), elev, Math.sin(azim) * 0.85).normalize()

    this.cloudSun.value.copy(_sunDir)
    this.cloudStorm.value = this.automaticWeather ? 0 : w.lightning

    // --- Sun + moon key lights (terrain MeshStandardMaterials receive both) ---
    // Cheap: one extra directional, moon never casts shadows.
    const lightDist = 900
    const clearMul = 1 - totalClouds * 0.55 - w.haze * 0.25
    const sunUp = MathUtils.smoothstep(elev, -0.08, 0.18)
    const moonUp = MathUtils.smoothstep(-elev, -0.06, 0.22)

    // Sun always from solar direction; fades under horizon
    this.sun.position.set(
      ax + _sunDir.x * lightDist,
      ay + _sunDir.y * lightDist,
      az + _sunDir.z * lightDist,
    )
    this.sun.target.position.set(ax, ay * 0.15, az)
    this.sun.target.updateMatrixWorld()
    _c2.copy(COL_SUN)
    if (dusk > 0.15) _c2.lerp(COL_SUN_DUSK, dusk * 0.85)
    if (elev < 0.12) _c2.lerp(COL_SUN_LOW, 1 - sunUp)
    if (getTerrainProfile()?.theme === 'desert-run') _c2.lerp(_hemiGround.setHex(0xffdbab), dayFactor * .12)
    if (getTerrainProfile()?.theme === 'mountain-valley-run') _c2.lerp(_hemiGround.setHex(0xe8f3ff), dayFactor * .1)
    if (getTerrainProfile()?.theme === 'volcanic-run') _c2.lerp(_hemiGround.setHex(0xe1d9cb), dayFactor * .13)
    this.sun.color.copy(_c2)
    this.sun.intensity =
      (0.25 + dayFactor * 1.55) * sunUp * clearMul * w.sunMul
    this.sun.castShadow = elev > 0.1 && totalClouds < 0.85 && sunUp > 0.35

    // Moon opposite the sun - cool fill that actually lights the world at night
    this.moon.position.set(
      ax - _sunDir.x * lightDist,
      ay - _sunDir.y * lightDist,
      az - _sunDir.z * lightDist,
    )
    this.moon.target.position.set(ax, ay * 0.1, az)
    this.moon.target.updateMatrixWorld()
    this.moon.color.setHex(0xb8c8f0)
    this.moon.intensity =
      (0.06 + nightFactor * 0.48) * moonUp * clearMul * (0.65 + w.sunMul * 0.35)

    // Sky-ish ambient: warm day, deep blue night (reads as atmospheric scatter)
    _hemiSky.copy(_c).lerp(COL_HEMI_DAY, dayFactor * 0.3).lerp(COL_HEMI_NIGHT, nightFactor * 0.45)
    _hemiGround.copy(COL_GROUND_DAY).lerp(COL_GROUND_NIGHT, nightFactor)
    this.hemi.color.copy(_hemiSky)
    this.hemi.groundColor.copy(_hemiGround)
    this.hemi.intensity = (0.28 + dayFactor * 0.52 + nightFactor * 0.12) * w.hemiMul

    this.ambient.color.setRGB(
      MathUtils.lerp(0.35, 1, dayFactor),
      MathUtils.lerp(0.42, 1, dayFactor),
      MathUtils.lerp(0.62, 1, dayFactor),
    )
    this.ambient.intensity =
      (0.1 + dayFactor * 0.28 + nightFactor * 0.06) * w.ambientMul

    // Soft bounce opposite the stronger key
    this.fill.color.setHex(dayFactor > 0.35 ? 0xc8e0ff : 0x6a7aaa)
    this.fill.intensity =
      (0.1 + dayFactor * 0.22 + moonUp * nightFactor * 0.12) * w.sunMul
    this.fill.position.set(
      ax - _sunDir.x * lightDist * 0.35,
      ay + 90,
      az - _sunDir.z * lightDist * 0.35,
    )
    this.fill.target.position.set(ax, ay * 0.15, az)
    this.fill.target.updateMatrixWorld()

    this.updateDistantWeather(ax, ay, az)
    if (this.automaticWeather) this.sky.setRegionalOrigin(ax, az, this.regionalElapsed)
    // Shader sky dome: sun, moon, stars, scatter gradient, and a far weather deck.
    this.sky.update(
      ax,
      ay,
      az,
      _sunDir,
      dayFactor,
      dusk,
      _c,
      _horizon,
      w.haze,
      this.skyCloudDeck,
      this.elapsed,
      ceiling,
      this.weatherState.cloudTop,
      this.cloudImmersion,
    )

    // World-space clouds (fly past them) + local precip FX
    this.updateClouds(ax, ay, az, visualDt, w, dayFactor)
    this.rainField.update(visualDt, ax, ay, az, w.rain * source, w.windX, w.windZ, ceiling)
    this.snowField.update(visualDt, ax, ay, az, w.snow * source, w.windX, w.windZ, ceiling)
  }

  /** Nine reusable samples drive one existing sky draw, not extra cloud meshes. */
  private updateDistantWeather(ax: number, ay: number, az: number): void {
    if (!this.automaticWeather) { this.sky.setRegionalWeather(null); return }
    if (this.regionalElapsed - this.distantSampleTime + 1e-8 < .25 &&
      Math.hypot(ax - this.distantSampleX, az - this.distantSampleZ) < 500) return
    this.distantSampleTime = this.regionalElapsed
    this.distantSampleX = ax; this.distantSampleZ = az
    for (let i = 0; i < 9; i++) {
      const angle = (i - 1) * Math.PI / 4
      const w = i === 0 ? this.weatherState : this.regionalWeather.sampleInto(this.cloudWeather,
        ax + Math.cos(angle) * 28000, ay, az + Math.sin(angle) * 28000, this.regionalElapsed)
      const deck = deriveSkyCloudDeckInto(this.distantCloudDeck, w)
      const offset = i * 5
      this.distantDecks[offset] = deck.broken; this.distantDecks[offset + 1] = deck.blanket
      this.distantDecks[offset + 2] = deck.cirrus; this.distantDecks[offset + 3] = deck.storm
      this.distantDecks[offset + 4] = deck.darkness
    }
    this.sky.setRegionalWeather(this.distantDecks, ax, az, this.regionalElapsed)
  }


  /**
   * World-space layered clouds, streamed like terrain:
   * Fixed world cells, shared source heights and three instanced batches.
   * Selection/sampling/matrices run at 5 Hz; shader drift and opacity blend
   * between those updates. Retirement fades old cells before replacement.
   */
  private updateClouds(
    ax: number,
    _ay: number,
    az: number,
    dt: number,
    weather: WeatherSnapshot,
    dayFactor: number,
  ): void {
    if (dt <= 0) return
    const transportX = this.cloudTransport.x
    const transportZ = this.cloudTransport.z
    this.cloudUpdateAccumulator += dt
    if (this.cloudUpdateAccumulator + 1e-8 < CLOUD_UPDATE_STEP_SEC) {
      const driftTime = Math.max(0, this.regionalElapsed - this.cloudMatrixTime)
      this.cloudDrift.value.set(driftTime ? driftTime * transportX : 0, 0, driftTime ? driftTime * transportZ : 0)
      this.cloudFrameBlend.value = this.cloudUpdateAccumulator / CLOUD_UPDATE_STEP_SEC
      return
    }
    const cloudDt = this.cloudUpdateAccumulator
    this.cloudUpdateAccumulator = 0
    this.cloudMatrixTime = this.regionalElapsed
    this.cloudDrift.value.set(0, 0, 0)
    this.cloudFrameBlend.value = 0
    const brightness =
      0.075 + dayFactor * 0.905 - weather.snow * (0.015 + dayFactor * .065)
    // MeshBasic clouds do not receive the scene lights. Tint the three shared
    // batches from the same continuous front values so rain and storms become
    // layered undercast rather than bright clear-weather puffs behind fog.
    const stormShade = MathUtils.smoothstep(weather.lightning, 0.22, 1)
    const cloudShade = MathUtils.clamp(
      weather.rain * 0.22 + stormShade * 0.38 + weather.snow * 0.08,
      0,
      0.6,
    )
    // ~0.8s ease for opacity (smooth appear / disappear)
    const fadeK = 1 - Math.exp(-cloudDt * 1.4)
    let anyVisible = false
    this.cloudImmersionTarget = 0
    this.cloudBaseOffset = 0
    this.cloudCells.select(this.cloudSeed, ax, az, this.regionalElapsed)
    this.rainShafts.begin()
    this.stormSource.strength = 0
    let stormScore = 0

    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      const mat = this.cloudInstances[layer].material as MeshBasicMaterial
      // Coverage selects formations below. Applying it again to their opacity
      // made fair-weather cumulus transparent discs instead of solid billows.
      mat.opacity = CLOUD_LAYER[layer].opacityMul
      let br = brightness
      if (layer === 'cirrus') br = Math.min(1, br + 0.11 * dayFactor)
      else if (layer === 'cumulus' && dayFactor > 0.4) br = Math.min(1, br + 0.04)
      const layerShade = this.automaticWeather ? 0 : cloudShade * (layer === 'cirrus' ? 0.48 : layer === 'cumulus' ? 0.86 : 1)
      br *= 1 - layerShade
      mat.color.setRGB(
        br * (0.96 - layerShade * 0.14),
        Math.min(1, br * (1.02 - layerShade * 0.05)),
        Math.min(1, br * (1.06 + layerShade * 0.08)),
      )
    }

    // Layer priority with cover: clear → cirrus only; storm → all decks
    // Indices are shuffled so gate by fraction of total still works; also
    // force cirrus more often in light cover, cumulus/stratus need more cover.
    for (let i = 0; i < this.cloudClusters.length; i++) {
      const cluster = this.cloudClusters[i]!
      const wpos = this.cloudWorld[i]!
      const layer = this.cloudLayers[i]!
      const instanceOffset = cluster.instanceOffset
      if (instanceOffset >= this.cloudDrawCounts[layer]) {
        this.cloudAlpha[i] = 0
        continue
      }

      const sample = this.cloudSamples[i]!
      if (!this.cloudCells.hasTarget(i)) {
        this.cloudAlpha[i] = 0
        this.setCloudClusterMatrices(cluster, layer, wpos, 0)
        continue
      }
      const replacing = this.cloudCells.moving(i)
      if (this.cloudCells.unassigned(i) || (replacing && this.cloudAlpha[i]! < .01)) {
        this.cloudCells.adopt(i)
        const cx = this.cloudCells.cellX[i]!, cz = this.cloudCells.cellZ[i]!
        shapeCloudFormation(cluster.puffs, layer, this.cloudSeed, cx, cz)
        cluster.height = 1
        for (const puff of cluster.puffs) cluster.height = Math.max(cluster.height, puff.y + puff.sy)
        this.cloudSampleTimes[i] = -Infinity
        this.cloudAlpha[i] = 0
      }
      const cx = this.cloudCells.cellX[i]!, cz = this.cloudCells.cellZ[i]!
      // Exact advection, not integrated drift: pause, revisit and frame cadence
      // cannot move a cloud into a different identity or change its shape.
      wpos.x = (cx + .5 + (cloudCellRandom(this.cloudSeed, cx, cz, 17) - .5) * .55) * CLOUD_CELL_SIZE + this.regionalElapsed * transportX
      wpos.z = (cz + .5 + (cloudCellRandom(this.cloudSeed, cx, cz, 19) - .5) * .55) * CLOUD_CELL_SIZE + this.regionalElapsed * transportZ
      if (this.regionalElapsed - this.cloudSampleTimes[i]! + 1e-8 >= .2) {
        if (this.automaticWeather)
          this.regionalWeather.sampleInto(sample, wpos.x, wpos.y, wpos.z, this.regionalElapsed)
        else {
          Object.assign(sample, this.weatherState)
          this.regionalWeather.structureInto(sample, wpos.x, wpos.z)
        }
        this.cloudSampleTimes[i] = this.regionalElapsed
      }
      const local = sample
      wpos.y = layer === 'cirrus' ? local.cloudTop + 1800 : local.cloudBase + (layer === 'stratus' ? 160 : 0)
      const dx = wpos.x - ax, dz = wpos.z - az
      const distSq = dx * dx + dz * dz

      // 3D distance for high decks so they don't pop when you're under them
      const dy = wpos.y - _ay
      const distFade = cloudDistanceFade(distSq + dy * dy)

      const layerCover =
        layer === 'cumulus'
          ? local.lowClouds
          : layer === 'stratus'
            ? local.midClouds
            : local.highClouds
      // Irrational stride distributes active clusters without obvious ordering.
      const densityRoll = cloudCellRandom(this.cloudSeed, cx, cz, 23)
      const target = this.cloudCells.moving(i) ? 0 : MathUtils.smoothstep(layerCover - densityRoll, -.06, .09) * distFade
      this.cloudAlpha[i] = MathUtils.lerp(this.cloudAlpha[i]!, target, fadeK)
      const a = this.cloudAlpha[i]!
      if (layer !== 'cirrus' && a > .05) {
        const phase = cloudCellRandom(this.cloudSeed, cx, cz, 41)
        this.rainShafts.offer(i, wpos.x, local.precipitationBase, wpos.z,
          2000 + local.midClouds * 1800 + local.convection * 800,
          local.rain * a, phase, ax, az)
        const sourceY = local.cloudBase + (local.cloudTop - local.cloudBase) * .4
        const distanceSquared = distSq + (sourceY - _ay) ** 2
        const score = local.lightning * a / (1 + distanceSquared / 36000000)
        if (a > .2 && local.lightning >= .35 && distanceSquared <= 400000000 && score > stormScore) {
          stormScore = score
          this.stormSource.x = wpos.x; this.stormSource.y = sourceY; this.stormSource.z = wpos.z
          this.stormSource.strength = local.lightning
        }
      }

      if (a < 0.01) {
        this.setCloudClusterMatrices(cluster, layer, wpos, 0)
        continue
      }
      anyVisible = true
      const opacityScale = MathUtils.smoothstep(a, 0, 1) * .94
      this.setCloudClusterMatrices(cluster, layer, wpos, opacityScale,
        this.automaticWeather ? Math.min(.65, local.rain * .22 + local.lightning * .38 + local.snow * .08) : 0,
        local)
    }

    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      this.cloudInstances[layer].instanceMatrix.needsUpdate = true
      this.cloudInstances[layer].geometry.getAttribute('cloudAlpha').needsUpdate = true
      this.cloudInstances[layer].geometry.getAttribute('cloudAlphaFrom').needsUpdate = true
      this.cloudInstances[layer].geometry.getAttribute('cloudTone').needsUpdate = true
    }
    this.cloudRoot.visible = anyVisible
    this.rainShafts.commit(cloudDt, ax, az, dayFactor)
  }

  private setCloudClusterMatrices(
    cluster: CloudClusterLayout,
    layer: CloudLayer,
    worldPosition: Vector3,
    opacity: number,
    shade = 0,
    regional?: RegionalWeatherSample,
  ): void {
    const instances = this.cloudInstances[layer]
    const offset = cluster.instanceOffset
    const alpha = instances.geometry.getAttribute('cloudAlpha') as InstancedBufferAttribute
    const from = instances.geometry.getAttribute('cloudAlphaFrom') as InstancedBufferAttribute
    const tone = instances.geometry.getAttribute('cloudTone') as InstancedBufferAttribute
    for (let i = 0; i < cluster.puffs.length; i++) {
      from.setX(offset + i, alpha.getX(offset + i))
      alpha.setX(offset + i, opacity)
      tone.setX(offset + i, shade)
      if (opacity <= 0) {
        instances.setMatrixAt(offset + i, _hiddenCloudMatrix)
        continue
      }
      const puff = cluster.puffs[i]!
      const bank = regional && layer === 'stratus' ? Math.max(regional.midClouds, regional.rain, regional.snow) : 0
      const convection = layer === 'cumulus' && regional ? regional.convection * (1 - regional.snow * .7) : 0
      const anvil = layer === 'cumulus' && i / Math.max(1, cluster.puffs.length - 1) > .79
      const horizontal = 1 + bank * .75 + (anvil ? convection * 2.2 : convection * .3)
      const depth = regional ? regional.cloudTop - regional.cloudBase : 1500
      // Fair cumulus spreads into a low, broad crown. Only convection grows
      // the full tower; ordinary cloudy fronts formerly made narrow columns.
      const fairCrown = layer === 'cumulus' ? .3 + convection * .7 : 1
      const heightScale = layer === 'cirrus' ? 1 : depth / cluster.height * (layer === 'stratus' ? .75 : 1)
      // Lift the tower centres through the deeper storm envelope without
      // stretching every billow into a kilometre-tall droplet. The upper
      // puffs spread laterally into the anvil rather than becoming needles.
      const billowHeight = layer === 'cumulus' ? Math.min(heightScale, 1 + convection * .35) : heightScale
      const vertical = billowHeight * (anvil ? 1 - convection * .45 : 1)
      // A shallow fair-weather envelope scales a cumulus billow uniformly.
      // Compressing only Y made small clouds into wide, stacked pancakes.
      // Deep storm towers retain the bounded billow/anvil treatment above.
      const billowWidth = layer === 'cumulus' ? Math.min(1, heightScale) : 1
      const centreWidth = layer === 'cumulus' ? (1.8 - convection * .8) * billowWidth : 1
      _cloudObject.position.set(
        worldPosition.x + puff.x * horizontal * centreWidth,
        worldPosition.y + (layer === 'cumulus'
          ? (puff.sy + (puff.y - puff.sy) * fairCrown) * heightScale
          : puff.y * heightScale) + this.cloudBaseOffset,
        worldPosition.z + puff.z * horizontal * centreWidth,
      )
      _cloudObject.rotation.set(0, puff.rotationY, 0)
      _cloudObject.scale.set(puff.sx * horizontal * billowWidth, puff.sy * vertical, puff.sz * horizontal * billowWidth)
      const dx = this.lastAnchor.x - _cloudObject.position.x
      const dz = this.lastAnchor.z - _cloudObject.position.z
      const cosine = Math.cos(puff.rotationY), sine = Math.sin(puff.rotationY)
      this.cloudImmersionTarget = Math.min(1, this.cloudImmersionTarget + cloudInteriorDensity(
        (dx * cosine - dz * sine) / (puff.sx * horizontal * billowWidth),
        (this.lastAnchor.y - _cloudObject.position.y) / (puff.sy * vertical),
        (dx * sine + dz * cosine) / (puff.sz * horizontal * billowWidth),
      ) * opacity * (layer === 'cirrus' ? .15 : 1))
      _cloudObject.updateMatrix()
      instances.setMatrixAt(offset + i, _cloudObject.matrix)
    }
  }


  /** Place the existing pooled clusters deterministically for the new world. */
  private reseedCloudField(seed: number): void {
    this.cloudSeed = seed
    writeWeatherTransport(this.cloudTransport, seed)
    this.sky.setRegionalTransport(this.cloudTransport.x, this.cloudTransport.z)
    this.cloudCells.reset()
    for (let i = 0; i < this.cloudWorld.length; i++) {
      const position = this.cloudWorld[i]!
      position.set(this.lastAnchor.x, 1400, this.lastAnchor.z)
      this.cloudAlpha[i] = 0
    }
  }

}
