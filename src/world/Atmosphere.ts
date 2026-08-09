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

/**
 * Day/night cycle + weather: sky, fog, lights, clouds, rain/snow.
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

  private readonly hemi: HemisphereLight
  private readonly ambient: AmbientLight
  private readonly sun: DirectionalLight
  private readonly fill: DirectionalLight
  private readonly scene: Scene

  private readonly precipRoot = new Group()
  private readonly rain: Points
  private readonly snow: Points
  private readonly rainVel: Float32Array
  private readonly snowVel: Float32Array
  private readonly rainMat: PointsMaterial
  private readonly snowMat: PointsMaterial

  private readonly cloudRoot = new Group()
  private readonly cloudPuffs: Mesh[] = []
  private readonly cloudOffsets: Vector3[] = []
  private cloudDrift = 0

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

    // --- Cloud puffs (soft low-poly blobs) ---
    this.cloudRoot.name = 'Clouds'
    const puffGeo = new IcosahedronGeometry(1, 1)
    const puffMat = new MeshBasicMaterial({
      color: 0xe8f0f8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const clusterCount = 28
    for (let c = 0; c < clusterCount; c++) {
      const cluster = new Group()
      const ox = (Math.random() - 0.5) * 900
      const oy = 180 + Math.random() * 220
      const oz = (Math.random() - 0.5) * 900
      this.cloudOffsets.push(new Vector3(ox, oy, oz))
      const nPuffs = 4 + ((Math.random() * 4) | 0)
      for (let p = 0; p < nPuffs; p++) {
        const mesh = new Mesh(puffGeo, puffMat.clone())
        mesh.position.set(
          (Math.random() - 0.5) * 48,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 48,
        )
        const s = 18 + Math.random() * 32
        mesh.scale.set(s * (0.9 + Math.random() * 0.5), s * 0.45, s * (0.9 + Math.random() * 0.5))
        cluster.add(mesh)
        this.cloudPuffs.push(mesh)
      }
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
    this.cloudDrift += dt * 6

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
    const elev = Math.sin((t - 0.25) * Math.PI * 2)
    // Three.js: smoothstep(x, min, max)
    const dayFactor = MathUtils.smoothstep(elev, -0.12, 0.28)
    const nightFactor = 1 - dayFactor
    const dusk =
      MathUtils.smoothstep(t, 0.18, 0.28) * (1 - MathUtils.smoothstep(t, 0.28, 0.38)) +
      MathUtils.smoothstep(t, 0.68, 0.78) * (1 - MathUtils.smoothstep(t, 0.78, 0.88))

    const w = this.blendedProfile()

    const daySky = new Color(0x6eb4d8)
    const noonSky = new Color(0x87c4e8)
    const nightSky = new Color(0x060a14)
    const duskSky = new Color(0xc47848)
    const dawnSky = new Color(0xd4a070)

    _c.copy(nightSky).lerp(daySky, dayFactor)
    if (t > 0.2 && t < 0.35) _c.lerp(dawnSky, dusk * 0.85)
    if (t > 0.65 && t < 0.85) _c.lerp(duskSky, dusk * 0.9)
    if (dayFactor > 0.7) _c.lerp(noonSky, (dayFactor - 0.7) / 0.3)

    // Haze / snow sky pull
    _c2.setHex(w.snow > 0.3 ? 0x9aabbc : 0x6a7888)
    _c.lerp(_c2, w.haze * 0.55 + w.snow * 0.15)
    if (w.rain > 0.5) _c.multiplyScalar(1 - w.rain * 0.18)
    if (w.snow > 0.7) _c.lerp(new Color(0xc8d4e0), 0.25)

    const fogNear = this.baseFogNear * w.fogNearMul
    const fogFar = this.baseFogFar * w.fogFarMul
    this.scene.background = _c.clone()
    if (this.scene.fog instanceof Fog) {
      this.scene.fog.color.copy(_c)
      this.scene.fog.near = fogNear
      this.scene.fog.far = fogFar
    } else {
      this.scene.fog = new Fog(_c.getHex(), fogNear, fogFar)
    }

    // Sun / moon
    const azim = (t - 0.25) * Math.PI * 2
    const sunDist = 420
    const sunY = Math.max(-80, elev * 320)
    const sunX = Math.cos(azim) * sunDist
    const sunZ = Math.sin(azim) * sunDist * 0.85
    this.sun.position.set(ax + sunX, ay + sunY, az + sunZ)
    this.sun.target.position.set(ax, ay * 0.2, az)
    this.sun.target.updateMatrixWorld()

    if (elev > 0.05) {
      _c2.setHex(0xfff2d8)
      if (dusk > 0.2) _c2.lerp(new Color(0xff8844), dusk)
      this.sun.color.copy(_c2)
      this.sun.intensity = (0.4 + dayFactor * 1.4) * w.sunMul
      this.sun.castShadow = elev > 0.12 && w.clouds < 0.85
    } else {
      this.sun.color.setHex(0x8899bb)
      this.sun.intensity = 0.14 * w.sunMul
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
    this.fill.position.set(ax - sunX * 0.3, ay + 80, az - sunZ * 0.3)

    // Clouds follow player + drift
    this.updateClouds(ax, ay, az, w.clouds, dayFactor, w.snow)

    // Rain / snow
    this.updatePrecip(ax, ay, az, dt, w.rain, w.snow)
  }

  private updateClouds(
    ax: number,
    ay: number,
    az: number,
    cover: number,
    dayFactor: number,
    snowAmt: number,
  ): void {
    this.cloudRoot.visible = cover > 0.05
    if (!this.cloudRoot.visible) return

    const brightness = 0.45 + dayFactor * 0.5 - snowAmt * 0.1
    const opacity = MathUtils.clamp(0.2 + cover * 0.55, 0.15, 0.78)

    for (let i = 0; i < this.cloudRoot.children.length; i++) {
      const cluster = this.cloudRoot.children[i] as Group
      const off = this.cloudOffsets[i]!
      // Slow wind drift
      const driftX = Math.sin(this.cloudDrift * 0.02 + i) * 40
      const driftZ = Math.cos(this.cloudDrift * 0.015 + i * 0.7) * 40
      cluster.position.set(
        ax + off.x + driftX,
        Math.max(ay + 40, off.y + ay * 0.05),
        az + off.z + driftZ,
      )
      // Hide some clusters when cover is low
      const show = i / this.cloudRoot.children.length < cover * 1.05
      cluster.visible = show
      if (!show) continue
      for (const child of cluster.children) {
        const m = child as Mesh
        const mat = m.material as MeshBasicMaterial
        mat.opacity = opacity * (0.75 + (i % 5) * 0.05)
        mat.color.setRGB(brightness, brightness * 1.02, brightness * 1.05)
      }
    }
  }

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
        arr[ix]! += Math.sin(this.cloudDrift * 0.4 + i * 0.3) * wind * dt
        arr[iz]! += Math.cos(this.cloudDrift * 0.35 + i * 0.2) * wind * 0.7 * dt
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
