import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  DynamicDrawUsage,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LinearFilter,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Points,
  PointsMaterial,
  RGBAFormat,
  Scene,
  Vector3,
  UnsignedByteType,
} from 'three'
import { deriveSkyCloudDeck, SkyDome } from './SkyDome'
import { SnowField } from './SnowField'
import { disposeObjectTree } from '../core/dispose'
import { FOG_FAR, STREAM_RADIUS_M } from './TerrainSystem'
import {
  WEATHER_LABELS,
  WeatherDirector,
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

function cloudAltitude(layer: CloudLayer): number {
  const s = CLOUD_LAYER[layer]
  return s.yMin + Math.random() * (s.yMax - s.yMin)
}

/**
 * Formation size multiplier. Most clouds are modest; a long tail hits ~10×.
 * Power curve: u^2.4 keeps giants rare (~5% above 5×, ~1% near 10×).
 */
function cloudSizeMul(): number {
  const u = Math.random()
  // 0.45× … 10× — small puffs through continental-scale banks
  return 0.45 + Math.pow(u, 2.4) * 9.55
}

/** Horizontal spawn in stream disk around (0,0) or offset later. */
function cloudSpawnXZ(radiusScale = 0.92): { x: number; z: number } {
  const ang = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * CLOUD_DESPAWN * radiusScale
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
  private elapsed = 0
  private lightningCharge = 0
  private lightningFlash = 0
  private lightningFlashAge = Infinity
  private lightningFlashPeak = 0
  private gustPhase = 0
  private readonly lastAnchor: AtmosphereAnchor = { x: 0, y: 0, z: 0 }
  private hasLastAnchor = false
  private dirty = true

  private readonly hemi: HemisphereLight
  private readonly ambient: AmbientLight
  private readonly sun: DirectionalLight
  private readonly moon: DirectionalLight
  private readonly fill: DirectionalLight
  private readonly scene: Scene
  private readonly sky: SkyDome

  private readonly precipRoot = new Group()
  private readonly rain: Points
  private readonly rainVel: Float32Array
  private readonly rainMat: PointsMaterial
  private readonly rainTex: DataTexture
  private readonly snowField: SnowField

  private readonly cloudRoot = new Group()
  private readonly cloudClusters: Group[] = []
  private readonly cloudInstances = {} as Record<CloudLayer, InstancedMesh>
  /** Absolute world positions (clouds do NOT follow the jet). */
  private readonly cloudWorld: Vector3[] = []
  /** Soft opacity 0–1 per cluster (fade in/out, not hard pop). */
  private readonly cloudAlpha: number[] = []
  private readonly cloudLayers: CloudLayer[] = []
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

    // --- Precipitation ---
    const rainCount = 3200
    const rainPos = new Float32Array(rainCount * 3)
    this.rainVel = new Float32Array(rainCount)
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 140
      rainPos[i * 3 + 1] = Math.random() * 90
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 140
      this.rainVel[i] = 32 + Math.random() * 48
    }
    const rainGeo = new BufferGeometry()
    rainGeo.setAttribute('position', new BufferAttribute(rainPos, 3))
    this.rainTex = makeRainStreakTexture()
    this.rainMat = new PointsMaterial({
      color: 0xb0cce0,
      map: this.rainTex,
      size: 1.15,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
      alphaTest: 0.03,
    })
    this.rainMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        '#include <fog_vertex>\n\tgl_PointSize = min(gl_PointSize, 9.0);',
      )
    }
    this.rain = new Points(rainGeo, this.rainMat)
    this.rain.frustumCulled = false
    this.rain.visible = false

    this.precipRoot.name = 'PrecipFX'
    this.precipRoot.add(this.rain)
    scene.add(this.precipRoot)

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

    // Mix: mostly mid/low heaps + broad decks + sparse high cirrus
    const layerPlan: CloudLayer[] = [
      ...Array(20).fill('cumulus' as CloudLayer),
      ...Array(16).fill('stratus' as CloudLayer),
      ...Array(10).fill('cirrus' as CloudLayer),
    ]
    for (let i = layerPlan.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0
      const tmp = layerPlan[i]!
      layerPlan[i] = layerPlan[j]!
      layerPlan[j] = tmp
    }

    const puffCounts: Record<CloudLayer, number> = {
      cumulus: 0,
      stratus: 0,
      cirrus: 0,
    }
    for (const layer of layerPlan) {
      const cluster = this.buildCloudCluster(layer, puffGeo, puffMat)
      const xz = cloudSpawnXZ()
      this.cloudWorld.push(new Vector3(xz.x, cloudAltitude(layer), xz.z))
      this.cloudAlpha.push(0)
      this.cloudLayers.push(layer)
      this.cloudClusters.push(cluster)
      puffCounts[layer] += cluster.children.length
    }

    // Three deck-wide batches replace hundreds of individual cloud draw calls.
    for (const layer of ['cumulus', 'stratus', 'cirrus'] as const) {
      const mat = puffMat.clone()
      mat.name = `Cloud-${layer}`
      const instances = new InstancedMesh(puffGeo, mat, puffCounts[layer])
      instances.name = `CloudBatch-${layer}`
      instances.frustumCulled = false
      instances.instanceMatrix.setUsage(DynamicDrawUsage)
      for (let i = 0; i < puffCounts[layer]; i++) {
        instances.setMatrixAt(i, _hiddenCloudMatrix)
      }
      instances.instanceMatrix.needsUpdate = true
      this.cloudInstances[layer] = instances
      this.cloudRoot.add(instances)
    }

    const offsets: Record<CloudLayer, number> = { cumulus: 0, stratus: 0, cirrus: 0 }
    for (let i = 0; i < this.cloudClusters.length; i++) {
      const layer = this.cloudLayers[i]!
      this.cloudClusters[i]!.userData.instanceOffset = offsets[layer]
      offsets[layer] += this.cloudClusters[i]!.children.length
    }
    scene.add(this.cloudRoot)

    this.weatherDirector.snapshotInto(this.weatherState)
    this.apply(0, 0, 0, 0, 0, this.weatherState)
  }

  /** Cycle weather type (N key). */
  cycleWeather(): WeatherId {
    const next = this.weatherDirector.cycle()
    this.weather = next
    this.dirty = true
    return next
  }

  setWeather(id: WeatherId, instant = false): void {
    this.weatherDirector.setWeather(id, instant)
    this.weather = id
    this.dirty = true
  }

  /** Fully random time of day + weighted weather (on world reseed). */
  randomizeWeather(seed: number): void {
    // Full 0–1 clock (any hour equally likely)
    const tRoll = Math.abs(Math.sin(seed * 78.233) * 43758.5453)
    this.timeOfDay = tRoll - Math.floor(tRoll)

    // Weather chances: clear common, precip/fog/snow all possible
    const roll = Math.abs(Math.sin(seed * 12.9898) * 23421.631) % 1
    let w: WeatherId
    if (roll < 0.28) w = 'clear'
    else if (roll < 0.48) w = 'cloudy'
    else if (roll < 0.62) w = 'overcast'
    else if (roll < 0.74) w = 'fog'
    else if (roll < 0.84) w = 'rain'
    else if (roll < 0.9) w = 'storm'
    else if (roll < 0.96) w = 'snow'
    else w = 'blizzard'

    // Night slightly more fog/snow chance
    if ((this.timeOfDay < 0.2 || this.timeOfDay > 0.8) && roll > 0.55 && roll < 0.7) {
      const nightRoll = Math.abs(Math.sin(seed * 7.139)) % 1
      w = nightRoll < 0.5 ? 'fog' : 'snow'
    }

    this.weatherDirector.randomize(seed, w)
    this.weather = w
    this.reseedCloudField(seed)
    this.lightningCharge = LIGHTNING_MIN_CHARGE + this.seededPulse(seed) * LIGHTNING_CHARGE_RANGE
    this.lightningFlash = 0
    this.lightningFlashAge = Infinity
    this.lightningFlashPeak = 0
    this.dirty = true
  }

  get clockLabel(): string {
    const hours = this.timeOfDay * 24
    const h = Math.floor(hours) % 24
    const m = Math.floor((hours - Math.floor(hours)) * 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  get weatherLabel(): string {
    const suffix = this.weatherDirector.transitioning ? ' / SHIFTING' : ''
    return `${WEATHER_LABELS[this.weatherDirector.targetId]}${suffix}`
  }

  /** Continuous precipitation values for terrain surface shading. */
  get weatherSnapshot(): WeatherSnapshot {
    return this.weatherDirector.snapshotInto(this.weatherState)
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
    this.precipRoot.removeFromParent()
    disposeObjectTree(this.precipRoot)
    this.snowField.points.removeFromParent()
    this.snowField.dispose()
    this.sky.dispose()

    const cloudResources = new Group()
    cloudResources.add(this.cloudRoot)
    for (const cluster of this.cloudClusters) cloudResources.add(cluster)
    disposeObjectTree(cloudResources)
    this.cloudClusters.length = 0
    this.cloudWorld.length = 0
    this.cloudAlpha.length = 0
    this.cloudLayers.length = 0
  }

  update(dt: number, ax: number, ay: number, az: number, visualDt = dt): void {
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
    const skyCloudDeck = deriveSkyCloudDeck(w)
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

    const fogNear = this.baseFogNear * w.fogNearMul
    const fogFar = Math.min(this.baseFogFar * w.fogFarMul, STREAM_RADIUS_M * .9)
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
      skyCloudDeck,
      this.elapsed,
    )

    // World-space clouds (fly past them) + local precip FX
    this.updateClouds(ax, ay, az, dt, w, dayFactor)
    this.updatePrecip(ax, ay, az, visualDt, w)
    this.snowField.update(visualDt, ax, ay, az, w.snow, w.windX, w.windZ)
  }

  /**
   * Build one formation for the given deck.
   * Size mul ~0.45–10× so you get small puffs and rare giant banks.
   */
  private buildCloudCluster(
    layer: CloudLayer,
    puffGeo: IcosahedronGeometry,
    baseMat: MeshBasicMaterial,
  ): Group {
    const cluster = new Group()
    const size = cloudSizeMul()
    cluster.userData.layer = layer
    cluster.userData.sizeMul = size

    // Larger formations get a few more puffs so they read as banks, not one blob
    const puffBonus = size > 3 ? 4 : size > 1.5 ? 2 : 0

    if (layer === 'cumulus') {
      // Heaps grow *up* from the cloud base — never hang below cluster Y
      // (big 10× banks used to bury mountains under their undersides)
      const nPuffs = 10 + ((Math.random() * 8) | 0) + puffBonus
      for (let p = 0; p < nPuffs; p++) {
        const mesh = new Mesh(puffGeo, baseMat)
        const edge = p / nPuffs
        const radial =
          (0.15 + edge * 0.85) * (180 + Math.random() * 220) * size
        const ang = Math.random() * Math.PI * 2
        const elev = Math.random() * Math.PI * 0.5 // upper hemisphere only
        const sx = ((edge < 0.35 ? 110 : 70) + Math.random() * 90) * size
        const sy = sx * (0.5 + Math.random() * 0.4)
        const sz = sx * (0.85 + Math.random() * 0.55)
        mesh.scale.set(sx * (0.85 + Math.random() * 0.55), sy, sz)
        // Icosahedron ±scale from center → put center so underside ≈ bulkY
        const bulkY =
          Math.sin(elev) * radial * 0.65 + Math.random() * 50 * size
        mesh.position.set(
          Math.cos(ang) * Math.cos(elev) * radial,
          bulkY + sy,
          Math.sin(ang) * Math.cos(elev) * radial,
        )
        cluster.add(mesh)
      }
    } else if (layer === 'stratus') {
      // Flat deck sitting on its base; thickness grows upward only
      const nPuffs = 14 + ((Math.random() * 10) | 0) + puffBonus
      const span = 700 * size
      for (let p = 0; p < nPuffs; p++) {
        const mesh = new Mesh(puffGeo, baseMat)
        const s = (140 + Math.random() * 160) * size
      const sy =
        s * (0.26 + Math.random() * 0.2) * Math.min(1.2, 0.78 + size * 0.08)
        mesh.scale.set(
          s * (1.1 + Math.random() * 0.7),
          sy,
          s * (1.1 + Math.random() * 0.7),
        )
        const bulkY = Math.random() * 40 * Math.min(size, 2.5)
        mesh.position.set(
          (Math.random() - 0.5) * span,
          bulkY + sy,
          (Math.random() - 0.5) * span,
        )
        cluster.add(mesh)
      }
    } else {
      // Cirrus: thin high streaks — also base-aligned (very thin anyway)
      const nPuffs = 5 + ((Math.random() * 5) | 0) + Math.min(4, puffBonus)
      const streakAng = Math.random() * Math.PI * 2
      const dirX = Math.cos(streakAng)
      const dirZ = Math.sin(streakAng)
      const length = 900 * size
      for (let p = 0; p < nPuffs; p++) {
        const mesh = new Mesh(puffGeo, baseMat)
        const along = (p / Math.max(1, nPuffs - 1) - 0.5) * length
        const side = (Math.random() - 0.5) * 80 * Math.sqrt(size)
        const s = (90 + Math.random() * 120) * size
        const sy = s * 0.12
        mesh.scale.set(s * 2.4, sy, s * 0.55)
        mesh.rotation.y = -streakAng
        mesh.position.set(
          dirX * along - dirZ * side,
          sy + Math.random() * 30,
          dirZ * along + dirX * side,
        )
        cluster.add(mesh)
      }
    }

    return cluster
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
      const target = densityRoll < layerCover ? distFade : 0
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
    }
    this.cloudRoot.visible = anyVisible
  }

  private setCloudClusterMatrices(
    cluster: Group,
    layer: CloudLayer,
    worldPosition: Vector3,
    scaleMul: number,
  ): void {
    const instances = this.cloudInstances[layer]
    const offset = cluster.userData.instanceOffset as number
    for (let i = 0; i < cluster.children.length; i++) {
      if (scaleMul <= 0) {
        instances.setMatrixAt(offset + i, _hiddenCloudMatrix)
        continue
      }
      const puff = cluster.children[i] as Mesh
      _cloudObject.position.set(
        worldPosition.x + puff.position.x,
        worldPosition.y + puff.position.y,
        worldPosition.z + puff.position.z,
      )
      _cloudObject.rotation.set(0, puff.rotation.y, 0)
      _cloudObject.scale.copy(puff.scale).multiplyScalar(scaleMul)
      _cloudObject.updateMatrix()
      instances.setMatrixAt(offset + i, _cloudObject.matrix)
    }
  }

  /** Rain stays in a box around the jet; snow is a separate world-space field. */
  private updatePrecip(
    ax: number,
    ay: number,
    az: number,
    dt: number,
    weather: WeatherSnapshot,
  ): void {
    this.precipRoot.position.set(ax, ay, az)

    const rainAmt = weather.rain
    this.rain.visible = rainAmt > 0.05
    if (!this.rain.visible || dt <= 0) return

    this.rainMat.opacity = 0.22 + rainAmt * 0.55
    const pos = this.rain.geometry.attributes.position as BufferAttribute
    const arr = pos.array as Float32Array
    const boost = rainAmt > 0.85 ? 1.4 : 1
    for (let i = 0; i < this.rainVel.length; i++) {
      const iy = i * 3 + 1
      arr[iy]! -= this.rainVel[i]! * boost * dt
      arr[i * 3]! +=
        (weather.windX * 0.38 + Math.sin(i + az * 0.01) * 3 * rainAmt) * dt
      arr[i * 3 + 2]! += weather.windZ * 0.38 * dt
      if (arr[iy]! < -18) {
        arr[iy] = 45 + Math.random() * 55
        arr[i * 3] = (Math.random() - 0.5) * 140
        arr[i * 3 + 2] = (Math.random() - 0.5) * 140
      }
    }
    pos.needsUpdate = true
  }

  private updateLightning(dt: number, weather: WeatherSnapshot): void {
    if (dt <= 0) return

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

function makeRainStreakTexture(): DataTexture {
  const width = 32
  const height = 64
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const vy = y / (height - 1)
    const taper = Math.sin(vy * Math.PI)
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - (width - 1) * 0.5) / (width * 0.5)
      const alpha = Math.pow(Math.max(0, 1 - dx * 7), 2) * Math.pow(taper, 0.35)
      const i = (y * width + x) * 4
      data[i] = 205
      data[i + 1] = 226
      data[i + 2] = 242
      data[i + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
