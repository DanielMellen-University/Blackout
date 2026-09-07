import { MathUtils } from 'three'

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
  cloudy: 'SCATTERED CLOUDS',
  overcast: 'OVERCAST',
  fog: 'LOW FOG',
  rain: 'RAIN FRONT',
  storm: 'THUNDERSTORM',
  snow: 'SNOW SHOWERS',
  blizzard: 'BLIZZARD',
}

export interface WeatherProfile {
  fogNearMul: number
  fogFarMul: number
  sunMul: number
  hemiMul: number
  ambientMul: number
  rain: number
  snow: number
  haze: number
  lowClouds: number
  midClouds: number
  highClouds: number
  windMps: number
  gust: number
  lightning: number
}

export interface WeatherSnapshot extends WeatherProfile {
  windX: number
  windZ: number
}

export const WEATHER_PROFILES: Record<WeatherId, WeatherProfile> = {
  clear: {
    fogNearMul: 1.15, fogFarMul: 1.12, sunMul: 1, hemiMul: 1, ambientMul: 1,
    rain: 0, snow: 0, haze: 0.02, lowClouds: 0.03, midClouds: 0.04,
    highClouds: 0.22, windMps: 4, gust: 0.08, lightning: 0,
  },
  cloudy: {
    fogNearMul: 0.9, fogFarMul: 0.94, sunMul: 0.72, hemiMul: 0.9, ambientMul: 0.95,
    rain: 0, snow: 0, haze: 0.16, lowClouds: 0.48, midClouds: 0.64,
    highClouds: 0.52, windMps: 8, gust: 0.18, lightning: 0,
  },
  overcast: {
    fogNearMul: 0.6, fogFarMul: 0.7, sunMul: 0.35, hemiMul: 0.75, ambientMul: 0.85,
    rain: 0, snow: 0, haze: 0.38, lowClouds: 0.86, midClouds: 0.96,
    highClouds: 0.74, windMps: 11, gust: 0.22, lightning: 0,
  },
  fog: {
    fogNearMul: 0.2, fogFarMul: 0.32, sunMul: 0.22, hemiMul: 0.5, ambientMul: 0.68,
    rain: 0, snow: 0, haze: 0.82, lowClouds: 0.72, midClouds: 0.2,
    highClouds: 0.08, windMps: 2, gust: 0.04, lightning: 0,
  },
  rain: {
    fogNearMul: 0.44, fogFarMul: 0.58, sunMul: 0.32, hemiMul: 0.62, ambientMul: 0.75,
    rain: 0.76, snow: 0, haze: 0.5, lowClouds: 0.9, midClouds: 0.94,
    highClouds: 0.55, windMps: 15, gust: 0.38, lightning: 0.04,
  },
  storm: {
    fogNearMul: 0.3, fogFarMul: 0.43, sunMul: 0.14, hemiMul: 0.48, ambientMul: 0.58,
    rain: 1, snow: 0, haze: 0.68, lowClouds: 1, midClouds: 1,
    highClouds: 0.82, windMps: 27, gust: 0.85, lightning: 1,
  },
  snow: {
    fogNearMul: 0.5, fogFarMul: 0.63, sunMul: 0.45, hemiMul: 0.7, ambientMul: 0.8,
    rain: 0, snow: 0.66, haze: 0.42, lowClouds: 0.72, midClouds: 0.82,
    highClouds: 0.5, windMps: 10, gust: 0.3, lightning: 0,
  },
  blizzard: {
    fogNearMul: 0.18, fogFarMul: 0.3, sunMul: 0.12, hemiMul: 0.45, ambientMul: 0.55,
    rain: 0, snow: 1, haze: 0.84, lowClouds: 0.96, midClouds: 1,
    highClouds: 0.62, windMps: 31, gust: 1, lightning: 0,
  },
}

/** Plausible front progression. Automatic weather cannot teleport clear skies into a blizzard. */
export const WEATHER_NEIGHBORS: Record<WeatherId, readonly WeatherId[]> = {
  clear: ['cloudy', 'cloudy', 'fog'],
  cloudy: ['clear', 'overcast', 'overcast', 'fog', 'rain', 'snow'],
  overcast: ['cloudy', 'rain', 'rain', 'storm', 'snow'],
  fog: ['clear', 'cloudy', 'rain', 'snow'],
  rain: ['cloudy', 'overcast', 'overcast', 'storm'],
  storm: ['rain', 'rain', 'overcast'],
  snow: ['cloudy', 'overcast', 'overcast', 'blizzard'],
  blizzard: ['snow', 'snow', 'overcast'],
}

const PROFILE_KEYS: readonly (keyof WeatherProfile)[] = [
  'fogNearMul', 'fogFarMul', 'sunMul', 'hemiMul', 'ambientMul', 'rain', 'snow',
  'haze', 'lowClouds', 'midClouds', 'highClouds', 'windMps', 'gust', 'lightning',
]

function copyProfile(source: WeatherProfile): WeatherProfile {
  return { ...source }
}

export function blendWeatherProfile(
  from: WeatherProfile,
  to: WeatherProfile,
  amount: number,
): WeatherProfile {
  const t = MathUtils.smoothstep(MathUtils.clamp(amount, 0, 1), 0, 1)
  const result = {} as WeatherProfile
  for (const key of PROFILE_KEYS) result[key] = MathUtils.lerp(from[key], to[key], t)
  return result
}

/** Stateful, seeded weather fronts. Rendering consumes its continuous snapshot. */
export class WeatherDirector {
  currentId: WeatherId = 'clear'
  targetId: WeatherId = 'clear'
  private from = copyProfile(WEATHER_PROFILES.clear)
  private to = copyProfile(WEATHER_PROFILES.clear)
  private transitionT = 1
  private transitionSec = 24
  private holdSec = 100
  private windFrom = { x: 3.7, z: 1.5 }
  private windTo = { x: 3.7, z: 1.5 }
  private rngState = 0x12345678

  get transitioning(): boolean {
    return this.transitionT < 1
  }

  get progress(): number {
    return this.transitionT
  }

  randomize(seed: number, forcedId?: WeatherId): void {
    this.rngState = (Math.floor(seed) ^ 0x9e3779b9) >>> 0
    const roll = this.random()
    let id: WeatherId
    if (forcedId) id = forcedId
    else if (roll < 0.3) id = 'clear'
    else if (roll < 0.52) id = 'cloudy'
    else if (roll < 0.68) id = 'overcast'
    else if (roll < 0.77) id = 'fog'
    else if (roll < 0.87) id = 'rain'
    else if (roll < 0.92) id = 'storm'
    else if (roll < 0.98) id = 'snow'
    else id = 'blizzard'

    this.currentId = id
    this.targetId = id
    this.from = copyProfile(WEATHER_PROFILES[id])
    this.to = copyProfile(WEATHER_PROFILES[id])
    this.transitionT = 1
    const wind = this.makeWind(this.to.windMps)
    this.windFrom = wind
    this.windTo = { ...wind }
    this.holdSec = this.nextHold()
  }

  setWeather(id: WeatherId, instant = false): void {
    if (id === this.targetId && !this.transitioning) return
    if (instant) {
      this.currentId = id
      this.targetId = id
      this.from = copyProfile(WEATHER_PROFILES[id])
      this.to = copyProfile(WEATHER_PROFILES[id])
      this.transitionT = 1
      const wind = this.makeWind(this.to.windMps)
      this.windFrom = wind
      this.windTo = { ...wind }
      this.holdSec = this.nextHold()
      return
    }
    const current = this.snapshot()
    this.from = this.profileFromSnapshot(current)
    this.windFrom = { x: current.windX, z: current.windZ }
    this.to = copyProfile(WEATHER_PROFILES[id])
    this.windTo = this.makeWind(this.to.windMps)
    this.currentId = this.targetId
    this.targetId = id
    this.transitionT = 0
    this.transitionSec = 18 + this.random() * 18
  }

  cycle(): WeatherId {
    const index = WEATHER_ORDER.indexOf(this.targetId)
    const next = WEATHER_ORDER[(index + 1) % WEATHER_ORDER.length]!
    this.setWeather(next)
    return next
  }

  update(dt: number): void {
    if (dt <= 0) return
    if (this.transitionT < 1) {
      this.transitionT = Math.min(1, this.transitionT + dt / this.transitionSec)
      if (this.transitionT >= 1) {
        this.currentId = this.targetId
        this.from = copyProfile(this.to)
        this.windFrom = { ...this.windTo }
        this.holdSec = this.nextHold()
      }
      return
    }

    this.holdSec -= dt
    if (this.holdSec <= 0) {
      const choices = WEATHER_NEIGHBORS[this.targetId]
      this.setWeather(choices[Math.floor(this.random() * choices.length)]!)
    }
  }

  snapshot(): WeatherSnapshot {
    const profile = blendWeatherProfile(this.from, this.to, this.transitionT)
    const t = MathUtils.smoothstep(this.transitionT, 0, 1)
    return {
      ...profile,
      windX: MathUtils.lerp(this.windFrom.x, this.windTo.x, t),
      windZ: MathUtils.lerp(this.windFrom.z, this.windTo.z, t),
    }
  }

  private profileFromSnapshot(snapshot: WeatherSnapshot): WeatherProfile {
    const { windX: _windX, windZ: _windZ, ...profile } = snapshot
    return profile
  }

  private makeWind(speed: number): { x: number; z: number } {
    const angle = this.random() * Math.PI * 2
    const variedSpeed = speed * (0.82 + this.random() * 0.36)
    return { x: Math.cos(angle) * variedSpeed, z: Math.sin(angle) * variedSpeed }
  }

  private nextHold(): number {
    return 75 + this.random() * 105
  }

  private random(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) >>> 0
    let t = this.rngState
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
