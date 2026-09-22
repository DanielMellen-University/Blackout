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
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Scene,
  Vector3,
} from 'three'
import { deriveSkyCloudDeckInto, SkyDome, type SkyCloudDeck } from './SkyDome'
import { SnowField } from './SnowField'
import { RainField, precipitationAtAltitude } from './RainField'
import { createCloudMaterial, cloudInteriorDensity } from './CloudMaterial'
import { disposeObjectTree } from '../core/dispose'
import { FOG_FAR, STREAM_RADIUS_M } from './TerrainSystem'
import {
  WEATHER_LABELS,
  WeatherDirector,
  timeOfDayForSeed,
  weatherIdForSeed,
  type WeatherId,
  type WeatherSnapshot,
} from './WeatherDirector'

export { WEATHER_LABELS, WEATHER_ORDER, type WeatherId } from './WeatherDirector'

/**
 * Cloud streaming envelope — match terrain load radius.
 * Spawn near the fog rim; despawn at the same distance chunks unload.
 */
const CLOUD_DESPAWN = STREAM_RADIUS_M // match terrain stream edge
const CLOUD_SPAWN_MIN = FOG_FAR * 0.82 // appear inside fog wall
const CLOUD_SPAWN_MAX = FOG_FAR * 0.98
/** Full opacity inside this range; fade 1→0 from here to despawn. */
const CLOUD_FADE_FULL = FOG_FAR * 0.5
const CLOUD_FADE_OUT = CLOUD_DESPAWN

/**
 * Cloud decks — altitude is the *base* (underside) of the formation.
 * Terrain peaks top out ~0.8–1.2 km; only the tallest summits should
 * pierce cumulus. Hills/mesas stay under the cloud floor.
 * - cumulus bases ~1.15–1.55 km (tops grow upward from there)
 * - stratus bases ~1.7–2.5 km
 * - cirrus bases ~3.6–5.6 km
 */
type CloudLayer = 'cumulus' | 'stratus' | 'cirrus'

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

interface CloudLayerSpec {
  yMin: number
  yMax: number
  /** Relative opacity vs base weather opacity. */
  opacityMul: number
  /** Wind speed multiplier (high clouds faster). */
  windMul: number
}

const CLOUD_LAYER: Record<CloudLayer, CloudLayerSpec> = {
  // Cluster Y = cloud base (underside). Only alpine peaks poke through.
  cumulus: { yMin: 1150, yMax: 1550, opacityMul: 0.95, windMul: 0.85 },
  stratus: { yMin: 1700, yMax: 2500, opacityMul: 0.75, windMul: 1.1 },
  cirrus: { yMin: 3600, yMax: 5600, opacityMul: 0.42, windMul: 1.8 },
}

function cloudAltitude(layer: CloudLayer, random: RandomSource): number {
  const s = CLOUD_LAYER[layer]
  return s.yMin + random() * (s.yMax - s.yMin)
}

/**
 * Formation size multiplier. Most clouds are modest; a long tail hits ~10×.
 * Power curve: u^2.4 keeps giants rare (~5% above 5×, ~1% near 10×).
 */
function cloudSizeMul(random: RandomSource): number {
  const u = random()
  // 0.45× … 10× — small puffs through continental-scale banks
  return 0.45 + Math.pow(u, 2.4) * 9.55
}

/** Horizontal spawn in stream disk around (0,0) or offset later. */
function cloudSpawnXZ(random: RandomSource, radiusScale = 0.92): { x: number; z: number } {
  const ang = random() * Math.PI * 2
  const r = Math.sqrt(random()) * CLOUD_DESPAWN * radiusScale
  return { x: Math.cos(ang) * r, z: Math.sin(ang) * r }
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
const LIGHTNING_ATTACK_SEC = 0.1
const LIGHTNING_DURATION_SEC = 0.6
const LIGHTNING_MIN_PEAK = 0.3
const LIGHTNING_MAX_PEAK = 0.44
const LIGHTNING_MIN_CHARGE = 9
const LIGHTNING_CHARGE_RANGE = 9
const LIGHTNING_MIN_STRENGTH = 0.35
/** Cloud matrices are large instanced batches; update them at a stable 30 Hz. */
const CLOUD_UPDATE_STEP_SEC = 1 / 30

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

/**
 * A single broad glow is readable as distant lightning without a hard white-frame cut.
 * The scalar is deliberately capped so all consumers can stay within a comfortable range.
 */
export function lightningFlashEnvelope(age: number, peak: number): number {
  if (age <= 0 || age >= LIGHTNING_DURATION_SEC) return 0
  const rise = MathUtils.smoothstep(age, 0, LIGHTNING_ATTACK_SEC)
  const release = 1 - MathUtils.smoothstep(age, LIGHTNING_ATTACK_SEC, LIGHTNING_DURATION_SEC)
  return MathUtils.clamp(peak, 0, LIGHTNING_MAX_PEAK) * rise * release
}

/**
 * Full storms receive a visible flash roughly every 8-16 seconds.
 * Developing fronts naturally wait longer, which avoids clustered strobing.
 */
export function lightningCooldown(weatherStrength: number, pulse: number): number {
  const strength = MathUtils.clamp(weatherStrength, LIGHTNING_MIN_STRENGTH, 1)
  const variation = MathUtils.clamp(pulse, 0, 1)
  return (LIGHTNING_MIN_CHARGE + variation * LIGHTNING_CHARGE_RANGE) /
    (0.25 + strength * 0.85)
}

export interface AtmosphereAnchor {
  x: number
  y: number
  z: number
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
  if (dt > 0 || visualDt > 0 || !previous) return true
  return previous.x !== x || previous.y !== y || previous.z !== z
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

/**
 * Day/night cycle + weather: sky dome (sun/moon/stars), fog, lights, clouds, rain/snow.
 * Full day ~8 real minutes. Time fully random on reseed.
 */
export class Atmosphere {
  /** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  timeOfDay = Math.random()
  /** Real seconds for a full 24h cycle. */
  dayLengthSec = 480

  weather: WeatherId = 'clear'
  private readonly weatherDirector = new WeatherDirector()
  private readonly weatherState = {} as WeatherSnapshot
  private readonly skyCloudDeck = {} as SkyCloudDeck
  private elapsed = 0
  private lightningCharge = 0
  private lightningFlash = 0
  private lightningFlashAge = Infinity
  private lightningFlashPeak = 0
  private reducedMotion = false
  private gustPhase = 0
  private clockLabelMinute = -1
  private clockLabelValue = '00:00'
  private weatherLabelTarget: WeatherId | null = null
  private weatherLabelShifting = false
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
  /** Base material used while authoring puff layouts; batches own the clones. */
  private cloudBaseMaterial: MeshBasicMaterial | null = null
  /** Seeded cloud placement keeps a world reviewable after a reseed. */
  private cloudSeed = 1337
  private cloudRecycle = 0
  private cloudUpdateAccumulator = 0

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

    this.timeOfDay = Math.random()
    this.weather = 'clear'

    // Shader sky: gradient + sun/moon discs + stars
    this.sky = new SkyDome(scene)
    // Let the dome paint the backdrop (clear color stays dark night base)
    this.scene.background = new Color(0x02040a)

    // World-space pooled streaks preserve parallax through fast flight.
    scene.add(this.rainField.mesh)

    this.snowField = new SnowField()
    scene.add(this.snowField.points)

    // --- Layered world-space clouds (real-world altitudes & scale) ---
    this.cloudRoot.name = 'Clouds'
    // A smoother shared puff keeps the instanced cloud batches volumetric
    // without multiplying draw calls. The old 20-face blob read as a stack
    // of flat discs when viewed from below.
    const puffGeo = new IcosahedronGeometry(1, 2)
    const puffMat = new MeshBasicMaterial({
      color: 0xe8f0f8,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
    this.cloudBaseMaterial = puffMat

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
      const authoredCluster = this.buildCloudCluster(layer, puffGeo, puffMat, cloudRandom)
      const cluster = this.flattenCloudCluster(authoredCluster)
      authoredCluster.clear()
      const xz = cloudSpawnXZ(cloudRandom)
      this.cloudWorld.push(new Vector3(xz.x, cloudAltitude(layer, cloudRandom), xz.z))
      this.cloudAlpha.push(0)
      this.cloudLayers.push(layer)
      this.cloudClusters.push(cluster)
      this.cloudPuffCounts[layer] += cluster.puffs.length
    }

    // Three deck-wide batches replace hundreds of individual cloud draw calls.
    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      const mat = createCloudMaterial(this.cloudSun, this.cloudStorm)
      mat.name = `Cloud-${layer}`
      const geometry = puffGeo.clone()
      geometry.setAttribute('cloudAlpha', new InstancedBufferAttribute(new Float32Array(this.cloudPuffCounts[layer]), 1).setUsage(DynamicDrawUsage))
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
    this.apply(0, 0, 0, 0, 0, this.weatherState)
  }

  /** Apply the selected graphics preset to both pooled precipitation fields. */
  setPrecipitationScale(scale: number): void {
    if (this.disposed) return
    const safe = Number.isFinite(scale) ? Math.max(0, Math.min(1, scale)) : 1
    if (safe === this.precipitationScale) return
    this.precipitationScale = safe
    this.rainField.setDensityScale(safe)
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

  /** Cycle weather type (N key). */
  cycleWeather(): WeatherId {
    if (this.disposed) return this.weather
    const next = this.weatherDirector.cycle()
    this.weather = next
    this.dirty = true
    return next
  }

  setWeather(id: WeatherId, instant = false): void {
    if (this.disposed) return
    this.weatherDirector.setWeather(id, instant)
    this.weather = id
    this.dirty = true
  }

  /** Fully random time of day + weighted weather (on world reseed). */
  randomizeWeather(seed: number): void {
    if (this.disposed) return
    this.timeOfDay = timeOfDayForSeed(seed)
    const w = weatherIdForSeed(seed, this.timeOfDay)

    this.weatherDirector.randomize(seed, w)
    this.weather = w
    this.reseedCloudField(seed)
    this.cloudImmersion = this.cloudImmersionTarget = 0
    this.lightningCharge = LIGHTNING_MIN_CHARGE + this.seededPulse(seed) * LIGHTNING_CHARGE_RANGE
    this.lightningFlash = 0
    this.lightningFlashAge = Infinity
    this.lightningFlashPeak = 0
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
    const target = this.weatherDirector.targetId
    const shifting = this.weatherDirector.transitioning
    if (target !== this.weatherLabelTarget || shifting !== this.weatherLabelShifting) {
      this.weatherLabelTarget = target
      this.weatherLabelShifting = shifting
      this.weatherLabelValue = `${WEATHER_LABELS[target]}${shifting ? ' / SHIFTING' : ''}`
    }
    return this.weatherLabelValue
  }

  /** Continuous precipitation values for terrain surface shading. */
  get weatherSnapshot(): WeatherSnapshot {
    return this.weatherDirector.snapshotInto(this.weatherState)
  }

  /** True while the current weather front is blending toward its target. */
  get weatherTransitioning(): boolean {
    return this.weatherDirector.transitioning
  }

  /** True while the current storm flash envelope is active. */
  get lightningActive(): boolean {
    return !this.reducedMotion && this.lightningFlashAge < LIGHTNING_DURATION_SEC
  }

  /** Respect the browser's reduced-motion preference for storm flashes. */
  setReducedMotion(enabled: boolean): void {
    if (this.disposed) return
    this.reducedMotion = enabled
    if (enabled) {
      this.lightningFlash = 0
      this.lightningFlashAge = Infinity
    }
  }

  get prefersReducedMotion(): boolean {
    return this.reducedMotion
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
    this.snowField.points.removeFromParent()
    this.snowField.dispose()
    this.sky.dispose()

    disposeObjectTree(this.cloudRoot)
    this.cloudBaseMaterial?.dispose()
    this.cloudBaseMaterial = null
    this.cloudClusters.length = 0
    this.cloudWorld.length = 0
    this.cloudAlpha.length = 0
    this.cloudLayers.length = 0
  }

  update(dt: number, ax: number, ay: number, az: number, visualDt = dt): void {
    if (this.disposed) return
    const previousAnchor = this.hasLastAnchor ? this.lastAnchor : null
    if (!this.dirty && !atmosphereNeedsUpdate(dt, visualDt, ax, ay, az, previousAnchor)) return
    this.lastAnchor.x = ax
    this.lastAnchor.y = ay
    this.lastAnchor.z = az
    this.hasLastAnchor = true
    this.timeOfDay = (this.timeOfDay + dt / this.dayLengthSec) % 1
    this.elapsed += dt
    this.weatherDirector.update(dt)
    this.weather = this.weatherDirector.targetId
    this.weatherDirector.snapshotInto(this.weatherState)

    this.apply(ax, ay, az, dt, visualDt, this.weatherState)
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

    this.updateLightning(dt, w)
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
    if (this.lightningFlash > 0.01) {
      _c2.setHex(0xcfe3ff)
      _c.lerp(_c2, this.lightningFlash * 0.28)
      _horizon.lerp(_c2, this.lightningFlash * 0.22)
    }

    const source = precipitationAtAltitude(ay, w.lightning)
    const aboveDeck = 1 - source
    this.cloudImmersion = MathUtils.lerp(this.cloudImmersion, this.cloudImmersionTarget, 1 - Math.exp(-Math.max(0, visualDt) * 3))
    const fogNear = MathUtils.lerp(this.baseFogNear * MathUtils.lerp(w.fogNearMul, 1.1, aboveDeck), 25, this.cloudImmersion)
    const fogFar = MathUtils.lerp(Math.min(this.baseFogFar * MathUtils.lerp(w.fogFarMul, 1, aboveDeck), STREAM_RADIUS_M * .9), 420, this.cloudImmersion)
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
    this.cloudStorm.value = w.lightning

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
    this.sun.color.copy(_c2)
    this.sun.intensity =
      (0.25 + dayFactor * 1.55) * sunUp * clearMul * w.sunMul
    this.sun.castShadow = elev > 0.1 && totalClouds < 0.85 && sunUp > 0.35

    // Moon opposite the sun — cool fill that actually lights the world at night
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
      (0.1 + dayFactor * 0.28 + nightFactor * 0.06) * w.ambientMul +
      this.lightningFlash * 0.55

    // Soft bounce opposite the stronger key
    this.fill.color.setHex(dayFactor > 0.35 ? 0xc8e0ff : 0x6a7aaa)
    this.fill.intensity =
      (0.1 + dayFactor * 0.22 + moonUp * nightFactor * 0.12) * w.sunMul +
      this.lightningFlash * 0.85
    this.fill.position.set(
      ax - _sunDir.x * lightDist * 0.35,
      ay + 90,
      az - _sunDir.z * lightDist * 0.35,
    )
    this.fill.target.position.set(ax, ay * 0.15, az)
    this.fill.target.updateMatrixWorld()

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
    )

    // World-space clouds (fly past them) + local precip FX
    this.updateClouds(ax, ay, az, dt, w, dayFactor)
    this.rainField.update(visualDt, ax, ay, az, w.rain * source, w.windX, w.windZ)
    this.snowField.update(visualDt, ax, ay, az, w.snow * source, w.windX, w.windZ)
  }

  /**
   * Build one formation for the given deck.
   * Size mul ~0.45–10× so you get small puffs and rare giant banks.
   */
  private buildCloudCluster(
    layer: CloudLayer,
    puffGeo: IcosahedronGeometry,
    baseMat: MeshBasicMaterial,
    random: RandomSource,
  ): Group {
    const cluster = new Group()
    const size = cloudSizeMul(random)

    // Larger formations get a few more puffs so they read as banks, not one blob
    const puffBonus = size > 3 ? 4 : size > 1.5 ? 2 : 0

    if (layer === 'cumulus') {
      // Heaps grow *up* from the cloud base — never hang below cluster Y
      // (big 10× banks used to bury mountains under their undersides)
      const nPuffs = 10 + ((random() * 8) | 0) + puffBonus
      for (let p = 0; p < nPuffs; p++) {
        const mesh = new Mesh(puffGeo, baseMat)
        const edge = p / nPuffs
        const radial =
          (0.15 + edge * 0.85) * (180 + random() * 220) * size
        const ang = random() * Math.PI * 2
        const elev = random() * Math.PI * 0.5 // upper hemisphere only
        const sx = ((edge < 0.35 ? 110 : 70) + random() * 90) * size
        const sy = sx * (0.5 + random() * 0.4)
        const sz = sx * (0.85 + random() * 0.55)
        mesh.scale.set(sx * (0.85 + random() * 0.55), sy, sz)
        // Icosahedron ±scale from center → put center so underside ≈ bulkY
        const bulkY =
          Math.sin(elev) * radial * 0.65 + random() * 50 * size
        mesh.position.set(
          Math.cos(ang) * Math.cos(elev) * radial,
          bulkY + sy,
          Math.sin(ang) * Math.cos(elev) * radial,
        )
        cluster.add(mesh)
      }
    } else if (layer === 'stratus') {
      // Flat deck sitting on its base; thickness grows upward only
      const nPuffs = 14 + ((random() * 10) | 0) + puffBonus
      const span = 700 * size
      for (let p = 0; p < nPuffs; p++) {
        const mesh = new Mesh(puffGeo, baseMat)
        const s = (140 + random() * 160) * size
      const sy =
        s * (0.26 + random() * 0.2) * Math.min(1.2, 0.78 + size * 0.08)
        mesh.scale.set(
          s * (1.1 + random() * 0.7),
          sy,
          s * (1.1 + random() * 0.7),
        )
        const bulkY = random() * 40 * Math.min(size, 2.5)
        mesh.position.set(
          (random() - 0.5) * span,
          bulkY + sy,
          (random() - 0.5) * span,
        )
        cluster.add(mesh)
      }
    } else {
      // Cirrus: thin high streaks — also base-aligned (very thin anyway)
      const nPuffs = 5 + ((random() * 5) | 0) + Math.min(4, puffBonus)
      const streakAng = random() * Math.PI * 2
      const dirX = Math.cos(streakAng)
      const dirZ = Math.sin(streakAng)
      const length = 900 * size
      for (let p = 0; p < nPuffs; p++) {
        const mesh = new Mesh(puffGeo, baseMat)
        const along = (p / Math.max(1, nPuffs - 1) - 0.5) * length
        const side = (random() - 0.5) * 80 * Math.sqrt(size)
        const s = (90 + random() * 120) * size
        const sy = s * 0.12
        mesh.scale.set(s * 2.4, sy, s * 0.55)
        mesh.rotation.y = -streakAng
        mesh.position.set(
          dirX * along - dirZ * side,
          sy + random() * 30,
          dirZ * along + dirX * side,
        )
        cluster.add(mesh)
      }
    }

    return cluster
  }

  /** Copy static authoring transforms into a compact layout and drop the hidden puff meshes. */
  private flattenCloudCluster(cluster: Group): CloudClusterLayout {
    const puffs = cluster.children.map((object): CloudPuffLayout => {
      const mesh = object as Mesh
      return {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        sx: mesh.scale.x,
        sy: mesh.scale.y,
        sz: mesh.scale.z,
        rotationY: mesh.rotation.y,
      }
    })
    return { puffs, instanceOffset: 0 }
  }

  /**
   * World-space layered clouds, streamed like terrain:
   * - High realistic altitudes (cumulus / stratus / cirrus decks)
   * - Spawn near fog rim, despawn at STREAM_RADIUS
   * - Soft distance fade; never parented to the jet
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
    this.cloudUpdateAccumulator += dt
    if (this.cloudUpdateAccumulator < CLOUD_UPDATE_STEP_SEC) return
    const cloudDt = this.cloudUpdateAccumulator
    this.cloudUpdateAccumulator = 0
    const maxCover = Math.max(
      weather.lowClouds,
      weather.midClouds,
      weather.highClouds,
    )
    const brightness =
      0.5 + dayFactor * 0.48 - weather.snow * 0.08 + this.lightningFlash * 0.16
    const baseOpacity = MathUtils.clamp(0.28 + maxCover * 0.5, 0.18, 0.82)
    // MeshBasic clouds do not receive the scene lights. Tint the three shared
    // batches from the same continuous front values so rain and storms become
    // layered undercast rather than bright clear-weather puffs behind fog.
    const stormShade = MathUtils.smoothstep(weather.lightning, 0.22, 1)
    const cloudShade = MathUtils.clamp(
      weather.rain * 0.22 + stormShade * 0.38 + weather.snow * 0.08,
      0,
      0.6,
    )
    const despawnSq = CLOUD_DESPAWN * CLOUD_DESPAWN
    // ~0.8s ease for opacity (smooth appear / disappear)
    const fadeK = 1 - Math.exp(-cloudDt * 1.4)
    let anyVisible = false
    this.cloudImmersionTarget = 0
    this.cloudBaseOffset = -weather.haze * 400 - weather.rain * 120
    this.gustPhase += cloudDt * (0.35 + weather.gust * 1.4)
    const gust = 1 + Math.sin(this.gustPhase) * weather.gust * 0.32

    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      const mat = this.cloudInstances[layer].material as MeshBasicMaterial
      const cover =
        layer === 'cumulus'
          ? weather.lowClouds
          : layer === 'stratus'
            ? weather.midClouds
            : weather.highClouds
      mat.opacity = MathUtils.clamp(0.2 + cover * 0.58, 0.15, 0.8) *
        CLOUD_LAYER[layer].opacityMul
      let br = brightness
      if (layer === 'cirrus') br = Math.min(1, br + 0.11)
      else if (layer === 'cumulus' && dayFactor > 0.4) br = Math.min(1, br + 0.04)
      const layerShade = cloudShade * (layer === 'cirrus' ? 0.48 : layer === 'cumulus' ? 0.86 : 1)
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
      const spec = CLOUD_LAYER[layer]
      const instanceOffset = cluster.instanceOffset
      if (instanceOffset >= this.cloudDrawCounts[layer]) {
        this.cloudAlpha[i] = 0
        continue
      }

      // Absolute wind (m/s) — high clouds drift faster
      wpos.x += weather.windX * spec.windMul * gust * cloudDt
      wpos.z += weather.windZ * spec.windMul * gust * cloudDt

      let dx = wpos.x - ax
      let dz = wpos.z - az
      let distSq = dx * dx + dz * dz

      // Past terrain unload range → recycle onto far spawn ring (in the fog)
      if (distSq > despawnSq) {
        const recycle = this.cloudRecycle++
        const ang = this.cloudPulse(i, recycle * 2 + 11) * Math.PI * 2
        const r =
          CLOUD_SPAWN_MIN + this.cloudPulse(i, recycle * 2 + 17) * (CLOUD_SPAWN_MAX - CLOUD_SPAWN_MIN)
        wpos.x = ax + Math.cos(ang) * r
        wpos.z = az + Math.sin(ang) * r
        wpos.y = this.seededCloudAltitude(layer, i, recycle + 23)
        this.cloudAlpha[i] = 0 // start invisible, fade in
        dx = wpos.x - ax
        dz = wpos.z - az
        distSq = dx * dx + dz * dz
      }

      // 3D distance for high decks so they don't pop when you're under them
      const dy = wpos.y - _ay
      const dist3 = Math.sqrt(distSq + dy * dy)
      const distFade =
        1 - MathUtils.smoothstep(dist3, CLOUD_FADE_FULL, CLOUD_FADE_OUT)

      const layerCover =
        layer === 'cumulus'
          ? weather.lowClouds
          : layer === 'stratus'
            ? weather.midClouds
            : weather.highClouds
      // Irrational stride distributes active clusters without obvious ordering.
      const densityRoll = (i * 0.61803398875 + (layer === 'cirrus' ? 0.17 : 0)) % 1
      const target = MathUtils.smoothstep(layerCover - densityRoll, -.06, .09) * distFade
      this.cloudAlpha[i] = MathUtils.lerp(this.cloudAlpha[i]!, target, fadeK)
      const a = this.cloudAlpha[i]!

      if (a < 0.01) {
        this.setCloudClusterMatrices(cluster, layer, wpos, 0)
        continue
      }
      anyVisible = true
      const opacityScale = MathUtils.smoothstep(a, 0, 1) *
        (0.9 + (i % 7) * 0.015) * MathUtils.lerp(0.8, 1, baseOpacity)
      this.setCloudClusterMatrices(cluster, layer, wpos, opacityScale)
    }

    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      this.cloudInstances[layer].instanceMatrix.needsUpdate = true
      this.cloudInstances[layer].geometry.getAttribute('cloudAlpha').needsUpdate = true
    }
    this.cloudRoot.visible = anyVisible
  }

  private setCloudClusterMatrices(
    cluster: CloudClusterLayout,
    layer: CloudLayer,
    worldPosition: Vector3,
    opacity: number,
  ): void {
    const instances = this.cloudInstances[layer]
    const offset = cluster.instanceOffset
    const alpha = instances.geometry.getAttribute('cloudAlpha') as InstancedBufferAttribute
    for (let i = 0; i < cluster.puffs.length; i++) {
      alpha.setX(offset + i, opacity)
      if (opacity <= 0) {
        instances.setMatrixAt(offset + i, _hiddenCloudMatrix)
        continue
      }
      const puff = cluster.puffs[i]!
      _cloudObject.position.set(
        worldPosition.x + puff.x,
        worldPosition.y + puff.y + this.cloudBaseOffset,
        worldPosition.z + puff.z,
      )
      _cloudObject.rotation.set(0, puff.rotationY, 0)
      _cloudObject.scale.set(puff.sx, puff.sy, puff.sz)
      const dx = this.lastAnchor.x - _cloudObject.position.x
      const dz = this.lastAnchor.z - _cloudObject.position.z
      const cosine = Math.cos(puff.rotationY), sine = Math.sin(puff.rotationY)
      this.cloudImmersionTarget = Math.min(1, this.cloudImmersionTarget + cloudInteriorDensity(
        (dx * cosine - dz * sine) / puff.sx,
        (this.lastAnchor.y - _cloudObject.position.y) / puff.sy,
        (dx * sine + dz * cosine) / puff.sz,
      ) * opacity)
      _cloudObject.updateMatrix()
      instances.setMatrixAt(offset + i, _cloudObject.matrix)
    }
  }

  private updateLightning(dt: number, weather: WeatherSnapshot): void {
    if (dt <= 0 || this.reducedMotion) {
      this.lightningFlash = 0
      this.lightningFlashAge = Infinity
      return
    }

    if (this.lightningFlashAge < LIGHTNING_DURATION_SEC) {
      this.lightningFlashAge += dt
      this.lightningFlash = lightningFlashEnvelope(
        this.lightningFlashAge,
        this.lightningFlashPeak,
      )
      if (this.lightningFlashAge >= LIGHTNING_DURATION_SEC) {
        this.lightningFlash = 0
        this.lightningFlashAge = Infinity
      }
    } else {
      this.lightningFlash = 0
    }

    if (weather.lightning < LIGHTNING_MIN_STRENGTH) return

    this.lightningCharge -= dt * (0.25 + weather.lightning * 0.85)
    if (this.lightningCharge > 0) return

    const pulse = this.seededPulse(this.elapsed * 7.31 + this.gustPhase)
    this.lightningFlashPeak = LIGHTNING_MIN_PEAK + pulse *
      (LIGHTNING_MAX_PEAK - LIGHTNING_MIN_PEAK)
    this.lightningFlashAge = 0
    this.lightningCharge = lightningCooldown(
      weather.lightning,
      this.seededPulse(this.elapsed * 2.17),
    ) * (0.25 + weather.lightning * 0.85)
  }

  private seededPulse(value: number): number {
    const n = Math.sin(value * 12.9898 + 78.233) * 43758.5453
    return n - Math.floor(n)
  }

  /** Place the existing pooled clusters deterministically for the new world. */
  private reseedCloudField(seed: number): void {
    this.cloudSeed = seed
    this.cloudRecycle = 0
    for (let i = 0; i < this.cloudWorld.length; i++) {
      const angle = this.cloudPulse(i, 101) * Math.PI * 2
      const radius = Math.sqrt(this.cloudPulse(i, 107)) * CLOUD_DESPAWN * .92
      const position = this.cloudWorld[i]!
      position.x = Math.cos(angle) * radius
      position.z = Math.sin(angle) * radius
      position.y = this.seededCloudAltitude(this.cloudLayers[i]!, i, 113)
      this.cloudAlpha[i] = 0
    }
  }

  private seededCloudAltitude(layer: CloudLayer, index: number, salt: number): number {
    const spec = CLOUD_LAYER[layer]
    return spec.yMin + this.cloudPulse(index, salt) * (spec.yMax - spec.yMin)
  }

  private cloudPulse(index: number, salt: number): number {
    const n = Math.sin(this.cloudSeed * .000173 + index * 12.9898 + salt * 78.233) * 43758.5453
    return n - Math.floor(n)
  }
}
