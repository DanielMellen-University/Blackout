import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  MathUtils,
  Points,
  PointsMaterial,
  Scene,
} from 'three'

export type WeatherId =
  | 'clear'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'storm'

export const WEATHER_ORDER: readonly WeatherId[] = [
  'clear',
  'cloudy',
  'overcast',
  'fog',
  'rain',
  'storm',
] as const

export const WEATHER_LABELS: Record<WeatherId, string> = {
  clear: 'CLEAR',
  cloudy: 'CLOUDY',
  overcast: 'OVERCAST',
  fog: 'FOG',
  rain: 'RAIN',
  storm: 'STORM',
}

interface WeatherProfile {
  fogNearMul: number
  fogFarMul: number
  sunMul: number
  hemiMul: number
  ambientMul: number
  rain: number
  haze: number
}

const WEATHER: Record<WeatherId, WeatherProfile> = {
  clear: {
    fogNearMul: 1.15,
    fogFarMul: 1.1,
    sunMul: 1,
    hemiMul: 1,
    ambientMul: 1,
    rain: 0,
    haze: 0,
  },
  cloudy: {
    fogNearMul: 0.85,
    fogFarMul: 0.9,
    sunMul: 0.7,
    hemiMul: 0.9,
    ambientMul: 0.95,
    rain: 0,
    haze: 0.15,
  },
  overcast: {
    fogNearMul: 0.55,
    fogFarMul: 0.65,
    sunMul: 0.35,
    hemiMul: 0.75,
    ambientMul: 0.85,
    rain: 0,
    haze: 0.35,
  },
  fog: {
    fogNearMul: 0.22,
    fogFarMul: 0.35,
    sunMul: 0.25,
    hemiMul: 0.55,
    ambientMul: 0.7,
    rain: 0,
    haze: 0.7,
  },
  rain: {
    fogNearMul: 0.4,
    fogFarMul: 0.55,
    sunMul: 0.3,
    hemiMul: 0.65,
    ambientMul: 0.75,
    rain: 0.7,
    haze: 0.45,
  },
  storm: {
    fogNearMul: 0.28,
    fogFarMul: 0.42,
    sunMul: 0.15,
    hemiMul: 0.5,
    ambientMul: 0.6,
    rain: 1,
    haze: 0.65,
  },
}

const _c = new Color()
const _c2 = new Color()

/**
 * Day/night cycle + weather: drives sun, sky, fog, and simple rain FX.
 * Full day ~8 real minutes (arcade pace).
 */
export class Atmosphere {
  /** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  timeOfDay = 0.32
  /** Real seconds for a full 24h cycle. */
  dayLengthSec = 480

  weather: WeatherId = 'clear'
  private weatherFrom: WeatherId = 'clear'
  private weatherTo: WeatherId = 'clear'
  private weatherT = 1

  private autoWeatherTimer = 0
  private readonly autoWeatherInterval = 90

  private readonly hemi: HemisphereLight
  private readonly ambient: AmbientLight
  private readonly sun: DirectionalLight
  private readonly fill: DirectionalLight
  private readonly scene: Scene
  private readonly rain: Points
  private readonly rainVel: Float32Array
  private readonly rainRoot = new Group()

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

    // Start mid-morning, clear
    this.timeOfDay = 0.34
    this.weather = 'clear'
    this.weatherFrom = 'clear'
    this.weatherTo = 'clear'
    this.weatherT = 1

    const count = 2800
    const positions = new Float32Array(count * 3)
    this.rainVel = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120
      positions[i * 3 + 1] = Math.random() * 80
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120
      this.rainVel[i] = 28 + Math.random() * 40
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))
    const mat = new PointsMaterial({
      color: 0xa8c8e0,
      size: 0.35,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.rain = new Points(geo, mat)
    this.rain.frustumCulled = false
    this.rain.visible = false
    this.rainRoot.add(this.rain)
    this.rainRoot.name = 'WeatherFX'
    scene.add(this.rainRoot)

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

  /** Pick weather from seed (on world reseed). */
  randomizeWeather(seed: number): void {
    const pick = WEATHER_ORDER[Math.abs(seed | 0) % WEATHER_ORDER.length]!
    // Bias clear/cloudy a bit more than storm
    const roll = Math.abs(Math.sin(seed * 12.9898)) % 1
    let w: WeatherId = 'clear'
    if (roll < 0.35) w = 'clear'
    else if (roll < 0.55) w = 'cloudy'
    else if (roll < 0.7) w = 'overcast'
    else if (roll < 0.82) w = 'fog'
    else if (roll < 0.93) w = 'rain'
    else w = 'storm'
    void pick
    this.weatherFrom = w
    this.weatherTo = w
    this.weatherT = 1
    this.weather = w
    // Random time of day too
    this.timeOfDay = (Math.abs(Math.sin(seed * 78.233)) % 1)
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

  /**
   * Advance clock + weather, update lights/fog/rain around the aircraft.
   */
  update(dt: number, ax: number, ay: number, az: number): void {
    this.timeOfDay = (this.timeOfDay + dt / this.dayLengthSec) % 1

    // Slow auto weather drift
    this.autoWeatherTimer += dt
    if (this.autoWeatherTimer > this.autoWeatherInterval) {
      this.autoWeatherTimer = 0
      if (this.weatherT >= 1 && Math.random() < 0.55) {
        const next =
          WEATHER_ORDER[Math.floor(Math.random() * WEATHER_ORDER.length)]!
        this.setWeather(next)
      }
    }

    if (this.weatherT < 1) {
      this.weatherT = Math.min(1, this.weatherT + dt * 0.12)
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
      haze: MathUtils.lerp(a.haze, b.haze, t),
    }
  }

  private apply(ax: number, ay: number, az: number, dt: number): void {
    const t = this.timeOfDay
    // Sun elevation: -1 night, +1 noon
    const elev = Math.sin((t - 0.25) * Math.PI * 2)
    const dayFactor = MathUtils.smoothstep(-0.15, 0.35, elev)
    const nightFactor = 1 - dayFactor
    const dusk =
      MathUtils.smoothstep(0.18, 0.28, t) * (1 - MathUtils.smoothstep(0.28, 0.38, t)) +
      MathUtils.smoothstep(0.68, 0.78, t) * (1 - MathUtils.smoothstep(0.78, 0.88, t))

    const w = this.blendedProfile()

    // Sky / fog colors
    const daySky = new Color(0x6eb4d8)
    const noonSky = new Color(0x87c4e8)
    const nightSky = new Color(0x060a14)
    const duskSky = new Color(0xc47848)
    const dawnSky = new Color(0xd4a070)

    _c.copy(nightSky).lerp(daySky, dayFactor)
    if (t > 0.2 && t < 0.35) _c.lerp(dawnSky, dusk * 0.85)
    if (t > 0.65 && t < 0.85) _c.lerp(duskSky, dusk * 0.9)
    if (dayFactor > 0.7) _c.lerp(noonSky, (dayFactor - 0.7) / 0.3)

    // Weather haze pulls sky toward grey
    _c2.setHex(0x6a7888)
    _c.lerp(_c2, w.haze * 0.55)
    // Storm darken
    if (w.rain > 0.5) _c.multiplyScalar(1 - w.rain * 0.2)

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

    // Sun orbit around player
    const azim = (t - 0.25) * Math.PI * 2
    const sunDist = 420
    const sunY = Math.max(-80, elev * 320)
    const sunX = Math.cos(azim) * sunDist
    const sunZ = Math.sin(azim) * sunDist * 0.85
    this.sun.position.set(ax + sunX, ay + sunY, az + sunZ)
    this.sun.target.position.set(ax, ay * 0.2, az)
    this.sun.target.updateMatrixWorld()

    // Sun color + intensity
    if (elev > 0.05) {
      _c2.setHex(0xfff2d8)
      if (dusk > 0.2) _c2.lerp(new Color(0xff8844), dusk)
      this.sun.color.copy(_c2)
      this.sun.intensity = (0.4 + dayFactor * 1.4) * w.sunMul
      this.sun.visible = true
      this.sun.castShadow = elev > 0.12
    } else {
      // Moon light
      this.sun.color.setHex(0x8899bb)
      this.sun.intensity = 0.12 * w.sunMul
      this.sun.castShadow = false
      this.sun.visible = true
    }

    // Hemisphere / ambient
    const hemiSky = new Color().copy(_c).lerp(new Color(0xd0e8ff), 0.25)
    const hemiGround = new Color(0x3a4a38).lerp(new Color(0x1a2030), nightFactor)
    this.hemi.color.copy(hemiSky)
    this.hemi.groundColor.copy(hemiGround)
    this.hemi.intensity = (0.35 + dayFactor * 0.55) * w.hemiMul

    this.ambient.color.setHex(dayFactor > 0.3 ? 0xffffff : 0x6688aa)
    this.ambient.intensity = (0.18 + dayFactor * 0.32) * w.ambientMul

    this.fill.intensity = (0.15 + dayFactor * 0.28) * w.sunMul
    this.fill.position.set(ax - sunX * 0.3, ay + 80, az - sunZ * 0.3)

    // Rain particles
    const rainAmt = w.rain
    this.rain.visible = rainAmt > 0.05
    if (this.rain.visible) {
      ;(this.rain.material as PointsMaterial).opacity = 0.25 + rainAmt * 0.5
      this.rainRoot.position.set(ax, ay, az)
      const pos = this.rain.geometry.attributes.position as BufferAttribute
      const arr = pos.array as Float32Array
      const stormBoost = rainAmt > 0.85 ? 1.35 : 1
      for (let i = 0; i < this.rainVel.length; i++) {
        const iy = i * 3 + 1
        arr[iy]! -= this.rainVel[i]! * stormBoost * dt
        // Wind drift
        arr[i * 3]! += Math.sin(az * 0.01 + i) * 2 * rainAmt * dt
        if (arr[iy]! < -15) {
          arr[iy] = 40 + Math.random() * 50
          arr[i * 3] = (Math.random() - 0.5) * 120
          arr[i * 3 + 2] = (Math.random() - 0.5) * 120
        }
      }
      pos.needsUpdate = true
    }
  }
}
