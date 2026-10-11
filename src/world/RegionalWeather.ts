import { fbm, smoothstep, valueNoise } from './noise'
import { sampleLandformsInto, type LandformSample } from './Landforms'
import { PROFILE_KEYS, WEATHER_PROFILES, type WeatherId, type WeatherSnapshot } from './WeatherDirector'
const SEQUENCE: readonly WeatherId[] = ['clear', 'cloudy', 'overcast', 'rain', 'storm']

export interface RegionalWeatherSample extends WeatherSnapshot {
  id: WeatherId
  cloudBase: number
}
export function createRegionalWeatherSample(): RegionalWeatherSample {
  return { ...WEATHER_PROFILES.clear, windX: 0, windZ: 0, id: 'clear', cloudBase: 1400 }
}

/** Spatial fronts, independent of visitation order. No arrays, objects, cache
 * growth, wall-clock timers, or terrain/hydrology generation in the hot path. */
export class RegionalWeather {
  private readonly land = {} as LandformSample

  sampleInto(out: RegionalWeatherSample, x: number, y: number, z: number, simulationSeconds: number): RegionalWeatherSample {
    x = Number.isFinite(x) ? x : 0; y = Number.isFinite(y) ? y : 0
    z = Number.isFinite(z) ? z : 0
    const time = Number.isFinite(simulationSeconds) ? Math.max(0, simulationSeconds) : 0
    const land = sampleLandformsInto(this.land, x, z)
    // A broad air mass carries narrower, warped rain bands eastwards. The
    // 12 m/s advection is simulation-time based and stops completely on pause.
    const wx = x - time * 12, wz = z - time * 3
    const air = fbm(wx / 26000 + 919, wz / 26000 - 227, 3, 2, .5)
    const warp = valueNoise(wx / 17000 - 41, wz / 17000 + 63) * 1.8
    const band = .5 + .5 * Math.sin(wx / 6300 + wz / 24000 + warp)
    const exposure = 1 - smoothstep(.01, .17, Math.abs(land.coast!))
    const severity = Math.max(0, Math.min(4, (air - .38) * 8 +
      smoothstep(.55, .9, band) * 1.35 + (land.moisture - .5) * 1.2 + exposure * .15))
    const index = Math.min(3, Math.floor(severity)), blend = smoothstep(0, 1, severity - index)
    const a = WEATHER_PROFILES[SEQUENCE[index]!], b = WEATHER_PROFILES[SEQUENCE[index + 1]!]
    for (const field of PROFILE_KEYS) out[field] = a[field] + (b[field] - a[field]) * blend
    out.id = SEQUENCE[Math.min(4, Math.round(severity))]!
    // Precipitation belongs to the regional air mass, not the observer's
    // altitude. Flying above the source layer must not turn rain into snow.
    const cold = 1 - smoothstep(.21, .39, land.temperature - Math.max(0, land.height) / 10500)
    const precip = out.rain
    out.rain *= 1 - cold
    out.snow = precip * cold
    const blizzard = smoothstep(.65, 1, out.snow)
    out.haze = Math.max(out.haze, blizzard * .78)
    out.fogNearMul *= 1 - blizzard * .35
    out.fogFarMul *= 1 - blizzard * .28
    if (out.snow > .25) out.id = out.snow > .82 ? 'blizzard' : 'snow'
    out.lightning *= 1 - cold
    out.cloudBase = Math.max(900, land.height + 550) - out.haze * 220
    const valley = 1 - smoothstep(100, 600, y - Math.max(0, land.height))
    const fog = smoothstep(.6, .82, land.moisture) * valley * (1 - smoothstep(.35, .65, air))
    out.haze = Math.max(out.haze, fog * .65)
    out.fogNearMul *= 1 - fog * .65; out.fogFarMul *= 1 - fog * .45
    if (fog > .6 && precip < .2) out.id = 'fog'
    out.windMps = Math.min(27, out.windMps)
    out.gust = Math.min(.85, out.gust)
    const heading = valueNoise(wx / 48000 + 411, wz / 48000 - 73) * Math.PI * 2
    out.windX = Math.cos(heading) * out.windMps
    out.windZ = Math.sin(heading) * out.windMps
    return out
  }
}
