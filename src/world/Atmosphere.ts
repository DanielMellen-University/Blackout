import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
} from 'three'
import { SkyDome } from './SkyDome'
import { FOG_FAR, STREAM_RADIUS_M } from './TerrainSystem'

/**
 * Cloud streaming envelope — match terrain load radius.
 * Spawn near the fog rim; despawn at the same distance chunks unload.
 */
const CLOUD_DESPAWN = STREAM_RADIUS_M // ~4200 m (terrain stream edge)
const CLOUD_SPAWN_MIN = FOG_FAR * 0.78 // ~3120 m — appear deep in fog
const CLOUD_SPAWN_MAX = FOG_FAR * 0.98 // ~3920 m
/** Full opacity inside this range; fade 1→0 from here to despawn. */
const CLOUD_FADE_FULL = FOG_FAR * 0.55 // ~2200 m
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

export type WeatherId =
  | 'clear'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'blizzard'

export const WEATHER_ORDER: readonly WeatherId[] = [
  'clear',
  'cloudy',
  'overcast',
  'fog',
  'rain',
  'storm',
  'snow',
  'blizzard',
] as const

export const WEATHER_LABELS: Record<WeatherId, string> = {
  clear: 'CLEAR',
  cloudy: 'CLOUDY',
  overcast: 'OVERCAST',
  fog: 'FOG',
  rain: 'RAIN',
  storm: 'STORM',
  snow: 'SNOW',
  blizzard: 'BLIZZARD',
}

interface WeatherProfile {
  fogNearMul: number
  fogFarMul: number
  sunMul: number
  hemiMul: number
  ambientMul: number
  rain: number
  snow: number
  haze: number
  clouds: number
}

const WEATHER: Record<WeatherId, WeatherProfile> = {
  clear: {
    fogNearMul: 1.15,
    fogFarMul: 1.12,
    sunMul: 1,
    hemiMul: 1,
    ambientMul: 1,
    rain: 0,
    snow: 0,
    haze: 0,
    clouds: 0.12,
  },
  cloudy: {
    fogNearMul: 0.88,
    fogFarMul: 0.92,
    sunMul: 0.72,
    hemiMul: 0.9,
    ambientMul: 0.95,
    rain: 0,
    snow: 0,
    haze: 0.18,
    clouds: 0.55,
  },
  overcast: {
    fogNearMul: 0.55,
    fogFarMul: 0.65,
    sunMul: 0.35,
    hemiMul: 0.75,
    ambientMul: 0.85,
    rain: 0,
    snow: 0,
    haze: 0.4,
    clouds: 0.92,
  },
  fog: {
    fogNearMul: 0.2,
    fogFarMul: 0.32,
    sunMul: 0.22,
    hemiMul: 0.5,
    ambientMul: 0.68,
    rain: 0,
    snow: 0,
    haze: 0.78,
    clouds: 0.45,
  },
  rain: {
    fogNearMul: 0.42,
    fogFarMul: 0.55,
    sunMul: 0.32,
    hemiMul: 0.62,
    ambientMul: 0.75,
    rain: 0.75,
    snow: 0,
    haze: 0.48,
    clouds: 0.8,
  },
  storm: {
    fogNearMul: 0.28,
    fogFarMul: 0.4,
    sunMul: 0.14,
    hemiMul: 0.48,
    ambientMul: 0.58,
    rain: 1,
    snow: 0,
    haze: 0.68,
    clouds: 1,
  },
  snow: {
    fogNearMul: 0.48,
    fogFarMul: 0.6,
    sunMul: 0.45,
    hemiMul: 0.7,
    ambientMul: 0.8,
    rain: 0,
    snow: 0.65,
    haze: 0.4,
    clouds: 0.7,
  },
  blizzard: {
    fogNearMul: 0.18,
    fogFarMul: 0.3,
    sunMul: 0.12,
    hemiMul: 0.45,
    ambientMul: 0.55,
    rain: 0,
    snow: 1,
    haze: 0.82,
    clouds: 0.95,
  },
}

const _c = new Color()
const _c2 = new Color()
const _v = new Vector3()
const _sunDir = new Vector3()
const _horizon = new Color()

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
  private weatherFrom: WeatherId = 'clear'
  private weatherTo: WeatherId = 'clear'
  private weatherT = 1

  private autoWeatherTimer = 0
  private readonly autoWeatherInterval = 75
  private elapsed = 0

  private readonly hemi: HemisphereLight
  private readonly ambient: AmbientLight
  private readonly sun: DirectionalLight
  private readonly fill: DirectionalLight
  private readonly scene: Scene
  private readonly sky: SkyDome

  private readonly precipRoot = new Group()
  private readonly rain: Points
  private readonly snow: Points
  private readonly rainVel: Float32Array
  private readonly snowVel: Float32Array
  private readonly rainMat: PointsMaterial
  private readonly snowMat: PointsMaterial

  private readonly cloudRoot = new Group()
  private readonly cloudClusters: Group[] = []
  /** Absolute world positions (clouds do NOT follow the jet). */
  private readonly cloudWorld: Vector3[] = []
  /** Soft opacity 0–1 per cluster (fade in/out, not hard pop). */
  private readonly cloudAlpha: number[] = []
  private readonly cloudLayers: CloudLayer[] = []
  private cloudWindT = 0

  private baseFogNear = 1200
  private baseFogFar = 4000

  constructor(
    scene: Scene,
    lights: {
      sun: DirectionalLight
      hemi: HemisphereLight
      ambient: AmbientLight
      fill: DirectionalLight
    },
    fogNear: number,
    fogFar: number,
  ) {
    this.scene = scene
    this.sun = lights.sun
    this.hemi = lights.hemi
    this.ambient = lights.ambient
    this.fill = lights.fill
    this.baseFogNear = fogNear
    this.baseFogFar = fogFar

    this.timeOfDay = Math.random()
    this.weather = 'clear'
    this.weatherFrom = 'clear'
    this.weatherTo = 'clear'
    this.weatherT = 1

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
    this.rainMat = new PointsMaterial({
      color: 0xb0cce0,
      size: 0.32,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.rain = new Points(rainGeo, this.rainMat)
    this.rain.frustumCulled = false
    this.rain.visible = false

    const snowCount = 2200
    const snowPos = new Float32Array(snowCount * 3)
    this.snowVel = new Float32Array(snowCount)
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 150
      snowPos[i * 3 + 1] = Math.random() * 90
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 150
      this.snowVel[i] = 6 + Math.random() * 12
    }
    const snowGeo = new BufferGeometry()
    snowGeo.setAttribute('position', new BufferAttribute(snowPos, 3))
    this.snowMat = new PointsMaterial({
      color: 0xffffff,
      size: 0.55,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.snow = new Points(snowGeo, this.snowMat)
    this.snow.frustumCulled = false
    this.snow.visible = false

    this.precipRoot.name = 'PrecipFX'
    this.precipRoot.add(this.rain, this.snow)
    scene.add(this.precipRoot)

    // --- Layered world-space clouds (real-world altitudes & scale) ---
    this.cloudRoot.name = 'Clouds'
    const puffGeo = new IcosahedronGeometry(1, 1)
    const puffMat = new MeshBasicMaterial({
      color: 0xe8f0f8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    // Mix: mostly mid/low heaps + broad decks + sparse high cirrus
    const layerPlan: CloudLayer[] = [
      ...Array(28).fill('cumulus' as CloudLayer),
      ...Array(22).fill('stratus' as CloudLayer),
      ...Array(14).fill('cirrus' as CloudLayer),
    ]
    for (let i = layerPlan.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0
      const tmp = layerPlan[i]!
      layerPlan[i] = layerPlan[j]!
      layerPlan[j] = tmp
    }

    for (const layer of layerPlan) {
      const cluster = this.buildCloudCluster(layer, puffGeo, puffMat)
      const xz = cloudSpawnXZ()
      this.cloudWorld.push(new Vector3(xz.x, cloudAltitude(layer), xz.z))
      this.cloudAlpha.push(0)
      this.cloudLayers.push(layer)
      this.cloudClusters.push(cluster)
      this.cloudRoot.add(cluster)
    }
    scene.add(this.cloudRoot)

    this.apply(0, 0, 0, 0)
  }

  /** Cycle weather type (N key). */
  cycleWeather(): WeatherId {
    const i = WEATHER_ORDER.indexOf(this.weatherTo)
    const next = WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length]!
    this.setWeather(next)
    return next
  }

  setWeather(id: WeatherId): void {
    if (id === this.weatherTo && this.weatherT >= 1) return
    this.weatherFrom = this.profileId()
    this.weatherTo = id
    this.weatherT = 0
    this.weather = id
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
      w = Math.random() < 0.5 ? 'fog' : 'snow'
    }

    this.weatherFrom = w
    this.weatherTo = w
    this.weatherT = 1
    this.weather = w
  }

  get clockLabel(): string {
    const hours = this.timeOfDay * 24
    const h = Math.floor(hours) % 24
    const m = Math.floor((hours - Math.floor(hours)) * 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  get weatherLabel(): string {
    return WEATHER_LABELS[this.weatherTo]
  }

  get phaseLabel(): string {
    const t = this.timeOfDay
    if (t < 0.2 || t >= 0.8) return 'NIGHT'
    if (t < 0.3) return 'DAWN'
    if (t < 0.7) return 'DAY'
    return 'DUSK'
  }

  update(dt: number, ax: number, ay: number, az: number): void {
    this.timeOfDay = (this.timeOfDay + dt / this.dayLengthSec) % 1
    this.elapsed += dt
    this.cloudWindT += dt

    this.autoWeatherTimer += dt
    if (this.autoWeatherTimer > this.autoWeatherInterval) {
      this.autoWeatherTimer = 0
      if (this.weatherT >= 1 && Math.random() < 0.6) {
        const next =
          WEATHER_ORDER[Math.floor(Math.random() * WEATHER_ORDER.length)]!
        this.setWeather(next)
      }
    }

    if (this.weatherT < 1) {
      this.weatherT = Math.min(1, this.weatherT + dt * 0.1)
      if (this.weatherT >= 1) this.weatherFrom = this.weatherTo
    }

    this.apply(ax, ay, az, dt)
  }

  private profileId(): WeatherId {
    return this.weatherT < 1 ? this.weatherFrom : this.weatherTo
  }

  private blendedProfile(): WeatherProfile {
    const a = WEATHER[this.weatherFrom]
    const b = WEATHER[this.weatherTo]
    const t = this.weatherT
    return {
      fogNearMul: MathUtils.lerp(a.fogNearMul, b.fogNearMul, t),
      fogFarMul: MathUtils.lerp(a.fogFarMul, b.fogFarMul, t),
      sunMul: MathUtils.lerp(a.sunMul, b.sunMul, t),
      hemiMul: MathUtils.lerp(a.hemiMul, b.hemiMul, t),
      ambientMul: MathUtils.lerp(a.ambientMul, b.ambientMul, t),
      rain: MathUtils.lerp(a.rain, b.rain, t),
      snow: MathUtils.lerp(a.snow, b.snow, t),
      haze: MathUtils.lerp(a.haze, b.haze, t),
      clouds: MathUtils.lerp(a.clouds, b.clouds, t),
    }
  }

  private apply(ax: number, ay: number, az: number, dt: number): void {
    const t = this.timeOfDay
    // Sun elevation: -1 midnight-side, +1 noon
    const elev = Math.sin((t - 0.25) * Math.PI * 2)
    // Three.js: smoothstep(x, min, max)
    const dayFactor = MathUtils.smoothstep(elev, -0.12, 0.28)
    const nightFactor = 1 - dayFactor
    const dusk =
      MathUtils.smoothstep(t, 0.18, 0.28) * (1 - MathUtils.smoothstep(t, 0.28, 0.38)) +
      MathUtils.smoothstep(t, 0.68, 0.78) * (1 - MathUtils.smoothstep(t, 0.78, 0.88))

    const w = this.blendedProfile()

    // Zenith color (top of sky dome)
    const daySky = new Color(0x4a9fd4)
    const noonSky = new Color(0x5eb0e8)
    const nightSky = new Color(0x040812)
    const duskZenith = new Color(0x2a3a68)
    _c.copy(nightSky).lerp(daySky, dayFactor)
    if (dayFactor > 0.7) _c.lerp(noonSky, (dayFactor - 0.7) / 0.3)
    if (dusk > 0.15) _c.lerp(duskZenith, dusk * 0.55)

    // Horizon band (warmer at dawn/dusk)
    const dayHoriz = new Color(0xa8d0ea)
    const nightHoriz = new Color(0x0a1020)
    const dawnHoriz = new Color(0xffb070)
    const duskHoriz = new Color(0xff7a40)
    _horizon.copy(nightHoriz).lerp(dayHoriz, dayFactor)
    if (t > 0.18 && t < 0.38) _horizon.lerp(dawnHoriz, dusk * 0.9)
    if (t > 0.62 && t < 0.88) _horizon.lerp(duskHoriz, dusk * 0.95)

    // Haze / snow sky pull
    _c2.setHex(w.snow > 0.3 ? 0x9aabbc : 0x6a7888)
    _c.lerp(_c2, w.haze * 0.4 + w.snow * 0.12)
    _horizon.lerp(_c2, w.haze * 0.55 + w.snow * 0.18)
    if (w.rain > 0.5) {
      _c.multiplyScalar(1 - w.rain * 0.18)
      _horizon.multiplyScalar(1 - w.rain * 0.14)
    }
    if (w.snow > 0.7) {
      _c.lerp(new Color(0xc8d4e0), 0.2)
      _horizon.lerp(new Color(0xd0dce8), 0.25)
    }

    const fogNear = this.baseFogNear * w.fogNearMul
    const fogFar = this.baseFogFar * w.fogFarMul
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

    // Directional light sits far along sun dir (and opposite for moonlight)
    const lightDist = 800
    if (elev > -0.05) {
      this.sun.position.set(
        ax + _sunDir.x * lightDist,
        ay + _sunDir.y * lightDist,
        az + _sunDir.z * lightDist,
      )
    } else {
      // Moonlight from opposite sky
      this.sun.position.set(
        ax - _sunDir.x * lightDist,
        ay - _sunDir.y * lightDist,
        az - _sunDir.z * lightDist,
      )
    }
    this.sun.target.position.set(ax, ay * 0.2, az)
    this.sun.target.updateMatrixWorld()

    if (elev > 0.05) {
      _c2.setHex(0xfff2d8)
      if (dusk > 0.2) _c2.lerp(new Color(0xff8844), dusk)
      this.sun.color.copy(_c2)
      this.sun.intensity = (0.4 + dayFactor * 1.4) * w.sunMul
      this.sun.castShadow = elev > 0.12 && w.clouds < 0.85
    } else {
      // Cool moon light
      this.sun.color.setHex(0xa8b8e0)
      this.sun.intensity = (0.12 + nightFactor * 0.18) * w.sunMul
      this.sun.castShadow = false
    }

    const hemiSky = new Color().copy(_c).lerp(new Color(0xd0e8ff), 0.25)
    const hemiGround = new Color(0x3a4a38).lerp(new Color(0x1a2030), nightFactor)
    this.hemi.color.copy(hemiSky)
    this.hemi.groundColor.copy(hemiGround)
    this.hemi.intensity = (0.35 + dayFactor * 0.55) * w.hemiMul

    this.ambient.color.setHex(dayFactor > 0.3 ? 0xffffff : 0x6688aa)
    this.ambient.intensity = (0.18 + dayFactor * 0.32) * w.ambientMul

    this.fill.intensity = (0.15 + dayFactor * 0.28) * w.sunMul
    this.fill.position.set(
      ax - _sunDir.x * lightDist * 0.3,
      ay + 80,
      az - _sunDir.z * lightDist * 0.3,
    )

    // Shader sky dome: sun, moon, stars, gradient
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
      w.clouds,
      this.elapsed,
    )

    // World-space clouds (fly past them) + local precip FX
    this.updateClouds(ax, ay, az, dt, w.clouds, dayFactor, w.snow)
    this.updatePrecip(ax, ay, az, dt, w.rain, w.snow)
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
        const mesh = new Mesh(puffGeo, baseMat.clone())
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
        const mesh = new Mesh(puffGeo, baseMat.clone())
        const s = (140 + Math.random() * 160) * size
        const sy =
          s * (0.18 + Math.random() * 0.14) * Math.min(1.3, 0.7 + size * 0.06)
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
        const mesh = new Mesh(puffGeo, baseMat.clone())
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
    cover: number,
    dayFactor: number,
    snowAmt: number,
  ): void {
    const brightness = 0.5 + dayFactor * 0.48 - snowAmt * 0.08
    const baseOpacity = MathUtils.clamp(0.28 + cover * 0.5, 0.18, 0.82)
    const despawnSq = CLOUD_DESPAWN * CLOUD_DESPAWN
    // ~0.8s ease for opacity (smooth appear / disappear)
    const fadeK = 1 - Math.exp(-dt * 1.4)
    let anyVisible = false

    // Layer priority with cover: clear → cirrus only; storm → all decks
    // Indices are shuffled so gate by fraction of total still works; also
    // force cirrus more often in light cover, cumulus/stratus need more cover.
    for (let i = 0; i < this.cloudClusters.length; i++) {
      const cluster = this.cloudClusters[i]!
      const wpos = this.cloudWorld[i]!
      const layer = this.cloudLayers[i]!
      const spec = CLOUD_LAYER[layer]

      // Absolute wind (m/s) — high clouds drift faster
      const windBase = 4.2 * spec.windMul
      wpos.x += windBase * dt
      wpos.z += windBase * 0.38 * dt

      let dx = wpos.x - ax
      let dz = wpos.z - az
      let distSq = dx * dx + dz * dz

      // Past terrain unload range → recycle onto far spawn ring (in the fog)
      if (distSq > despawnSq) {
        const ang = Math.random() * Math.PI * 2
        const r =
          CLOUD_SPAWN_MIN + Math.random() * (CLOUD_SPAWN_MAX - CLOUD_SPAWN_MIN)
        wpos.x = ax + Math.cos(ang) * r
        wpos.z = az + Math.sin(ang) * r
        wpos.y = cloudAltitude(layer)
        this.cloudAlpha[i] = 0 // start invisible, fade in
        dx = wpos.x - ax
        dz = wpos.z - az
        distSq = dx * dx + dz * dz
      }

      cluster.position.set(wpos.x, wpos.y, wpos.z)

      // 3D distance for high decks so they don't pop when you're under them
      const dy = wpos.y - _ay
      const dist3 = Math.sqrt(distSq + dy * dy)
      const distFade =
        1 - MathUtils.smoothstep(dist3, CLOUD_FADE_FULL, CLOUD_FADE_OUT)

      // Weather: more cover unlocks lower decks; cirrus can appear with little cover
      let layerNeed = 0.08
      if (layer === 'stratus') layerNeed = 0.35
      if (layer === 'cumulus') layerNeed = 0.22
      const coverOn = cover >= layerNeed && cover > 0.05
      // Density: only a fraction of each deck for partial cloud cover
      const densityGate =
        layer === 'cirrus'
          ? i / this.cloudClusters.length < 0.35 + cover * 0.5
          : i / this.cloudClusters.length < cover * 1.1

      const target = coverOn && densityGate ? distFade : 0
      this.cloudAlpha[i] = MathUtils.lerp(this.cloudAlpha[i]!, target, fadeK)
      const a = this.cloudAlpha[i]!

      if (a < 0.01) {
        cluster.visible = false
        continue
      }
      cluster.visible = true
      anyVisible = true

      // Slightly denser near core of each cluster's opacity range
      const op =
        baseOpacity * a * spec.opacityMul * (0.78 + (i % 7) * 0.03)
      // Cirrus colder / whiter; low cumulus warmer in day
      let br = brightness
      let bg = brightness * 1.02
      let bb = brightness * 1.06
      if (layer === 'cirrus') {
        br = Math.min(1, brightness + 0.08)
        bg = Math.min(1, brightness + 0.1)
        bb = Math.min(1, brightness + 0.14)
      } else if (layer === 'cumulus' && dayFactor > 0.4) {
        br = Math.min(1, brightness + 0.04)
      }

      for (const child of cluster.children) {
        const m = child as Mesh
        const mat = m.material as MeshBasicMaterial
        mat.opacity = op
        mat.color.setRGB(br, bg, bb)
      }
    }

    this.cloudRoot.visible = anyVisible
  }

  /** Rain/snow particles stay local to the jet (weather FX, not scenery). */
  private updatePrecip(
    ax: number,
    ay: number,
    az: number,
    dt: number,
    rainAmt: number,
    snowAmt: number,
  ): void {
    this.precipRoot.position.set(ax, ay, az)

    this.rain.visible = rainAmt > 0.05
    if (this.rain.visible) {
      this.rainMat.opacity = 0.22 + rainAmt * 0.55
      const pos = this.rain.geometry.attributes.position as BufferAttribute
      const arr = pos.array as Float32Array
      const boost = rainAmt > 0.85 ? 1.4 : 1
      for (let i = 0; i < this.rainVel.length; i++) {
        const iy = i * 3 + 1
        arr[iy]! -= this.rainVel[i]! * boost * dt
        arr[i * 3]! += Math.sin(i + az * 0.01) * 3 * rainAmt * dt
        if (arr[iy]! < -18) {
          arr[iy] = 45 + Math.random() * 55
          arr[i * 3] = (Math.random() - 0.5) * 140
          arr[i * 3 + 2] = (Math.random() - 0.5) * 140
        }
      }
      pos.needsUpdate = true
    }

    this.snow.visible = snowAmt > 0.05
    if (this.snow.visible) {
      this.snowMat.opacity = 0.35 + snowAmt * 0.5
      this.snowMat.size = 0.45 + snowAmt * 0.35
      const pos = this.snow.geometry.attributes.position as BufferAttribute
      const arr = pos.array as Float32Array
      const wind = 8 + snowAmt * 18
      for (let i = 0; i < this.snowVel.length; i++) {
        const ix = i * 3
        const iy = i * 3 + 1
        const iz = i * 3 + 2
        arr[iy]! -= this.snowVel[i]! * (0.7 + snowAmt * 0.8) * dt
        arr[ix]! += Math.sin(this.cloudWindT * 0.4 + i * 0.3) * wind * dt
        arr[iz]! += Math.cos(this.cloudWindT * 0.35 + i * 0.2) * wind * 0.7 * dt
        if (arr[iy]! < -20) {
          arr[iy] = 50 + Math.random() * 50
          arr[ix] = (Math.random() - 0.5) * 150
          arr[iz] = (Math.random() - 0.5) * 150
        }
      }
      pos.needsUpdate = true
    }

    void _v
  }
}
