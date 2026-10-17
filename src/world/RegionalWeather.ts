import { clamp01, fbm, getWorldSeed, smoothstep, valueNoise } from './noise'
import { sampleLandformsInto, type LandformSample } from './Landforms'
import { writeWeatherTransport } from './WeatherTransport'
import { PROFILE_KEYS, WEATHER_PROFILES, type WeatherId, type WeatherSnapshot } from './WeatherDirector'

export interface RegionalWeatherSample extends WeatherSnapshot {
  id: WeatherId
  cloudBase: number
  cloudTop: number
  precipitationBase: number
  visibilityM: number
  convection: number
}
export const WEATHER_STRUCTURE_KEYS = ['cloudBase', 'cloudTop', 'precipitationBase', 'visibilityM', 'convection'] as const
export function createRegionalWeatherSample(): RegionalWeatherSample {
  return { ...WEATHER_PROFILES.clear, windX: 0, windZ: 0, id: 'clear', cloudBase: 1400,
    cloudTop: 2400, precipitationBase: 1400, visibilityM: 30240, convection: 0 }
}

/** Manual and regional weather share a physical vertical envelope. No observer
 * altitude enters the cloud or precipitation source heights. */
export function populateWeatherStructure(out: RegionalWeatherSample, base = 1400,
  convection = out.lightning): void {
  out.convection = clamp01(convection)
  out.cloudBase = Math.max(300, base)
  out.cloudTop = out.cloudBase + 650 + out.midClouds * 850 + out.convection * 3900
  out.precipitationBase = out.cloudBase
  const fog = smoothstep(.55, .85, out.haze) * (1 - Math.max(out.rain, out.snow))
  // Severe snow/fog should read through depth, not giant bright particles.
  // Keep a playable ground-visibility floor outside actual cloud interiors.
  out.visibilityM = Math.max(2600, 30240 * out.fogFarMul * (1 - out.snow * .72) * (1 - fog * .65))
}

/** Spatial fronts, independent of visitation order. No arrays, objects, cache
 * growth, wall-clock timers, or terrain/hydrology generation in the hot path. */
export class RegionalWeather {
  private readonly land = {} as LandformSample
  private readonly transport = { x: 0, z: 0 }

  /** Keep a manual profile intact while fitting its cloud envelope to the
   * regional ground. This is landform sampling, never hydrology generation. */
  structureInto(out: RegionalWeatherSample, x: number, z: number): RegionalWeatherSample {
    populateWeatherStructure(out, this.cloudBaseAt(x, z) - out.haze * 220)
    return out
  }

  /** Climate-dependent part of a manual envelope; cache at the weather cadence
   * while its cheap profile/haze adaptation continues to interpolate per frame. */
  cloudBaseAt(x: number, z: number): number {
    const land = sampleLandformsInto(this.land, Number.isFinite(x) ? x : 0, Number.isFinite(z) ? z : 0)
    return Math.max(950, land.height + 650) + (1 - land.moisture) * 350
  }

  sampleInto(out: RegionalWeatherSample, x: number, y: number, z: number, simulationSeconds: number): RegionalWeatherSample {
    x = Number.isFinite(x) ? x : 0; y = Number.isFinite(y) ? y : 0
    z = Number.isFinite(z) ? z : 0
    const time = Number.isFinite(simulationSeconds) ? Math.max(0, simulationSeconds) : 0
    const land = sampleLandformsInto(this.land, x, z)
    // The same seeded prevailing wind transports fronts, cloud identities,
    // interpolated cloud vertices and distant sky structure. Pause is exact.
    const transport = writeWeatherTransport(this.transport, getWorldSeed())
    const wx = x - time * transport.x, wz = z - time * transport.z
    const air = fbm(wx / 26000 + 919, wz / 26000 - 227, 3, 2, .5)
    const warp = valueNoise(wx / 17000 - 41, wz / 17000 + 63) * 1.8
    const band = .5 + .5 * Math.sin(wx / 6300 + wz / 24000 + warp)
    const exposure = 1 - smoothstep(.01, .17, Math.abs(land.coast!))
    // Coverage, available moisture and lift are different fields. Dry overcast
    // and warm showers without thunder must remain possible.
    const cover = clamp01((air - .30) * 1.65 + band * .29 +
      (land.moisture - .5) * .16 + exposure * .04)
    const moisture = fbm(wx / 34000 - 173, wz / 34000 + 587, 2) +
      (land.moisture - .5) * .18 + exposure * .06 + land.highlands * .04
    const broken = smoothstep(.13, .56, cover)
    const overcast = smoothstep(.54, .80, cover)
    const precip = smoothstep(.48, .70, moisture) * smoothstep(.40, .70, cover) *
      (.3 + smoothstep(.35, .85, band) * .7)
    const lift = fbm(wx / 7800 + 337, wz / 7800 - 719, 2)
    const convection = smoothstep(.57, .82, lift) * smoothstep(.48, .70, moisture) *
      smoothstep(.50, .76, cover)
    const storm = smoothstep(.20, .65, convection)
    for (const field of PROFILE_KEYS) {
      let value = WEATHER_PROFILES.clear[field] +
        (WEATHER_PROFILES.cloudy[field] - WEATHER_PROFILES.clear[field]) * broken
      value += (WEATHER_PROFILES.overcast[field] - value) * overcast
      value += (WEATHER_PROFILES.rain[field] - value) * precip
      out[field] = value + (WEATHER_PROFILES.storm[field] - value) * storm
    }
    out.id = cover < .27 ? 'clear' : cover < .65 ? 'cloudy' : 'overcast'
    // Precipitation belongs to the regional air mass, not the observer's
    // altitude. Flying above the source layer must not turn rain into snow.
    const cold = 1 - smoothstep(.21, .39, land.temperature - Math.max(0, land.height) / 10500)
    out.rain = precip * (1 - cold)
    out.snow = precip * cold
    const blizzard = smoothstep(.65, 1, out.snow)
    out.haze = Math.max(out.haze, blizzard * .78)
    out.fogNearMul *= 1 - blizzard * .35
    out.fogFarMul *= 1 - blizzard * .28
    if (out.rain > .22) out.id = storm > .30 ? 'storm' : 'rain'
    if (out.snow > .22) out.id = out.snow > .72 ? 'blizzard' : 'snow'
    out.lightning = storm * (1 - cold)
    const airHaze = out.haze
    const valley = 1 - smoothstep(100, 600, y - Math.max(0, land.height))
    const fog = smoothstep(.6, .82, land.moisture) * valley * (1 - smoothstep(.35, .65, air))
    out.haze = Math.max(out.haze, fog * .65)
    out.fogNearMul *= 1 - fog * .65; out.fogFarMul *= 1 - fog * .45
    if (fog > .6 && precip < .2) out.id = 'fog'
    out.windMps = Math.min(27, out.windMps)
    out.gust = Math.min(.85, out.gust)
    const heading = Math.atan2(transport.z, transport.x) +
      (valueNoise(wx / 48000 + 411, wz / 48000 - 73) - .5) * .6
    out.windX = Math.cos(heading) * out.windMps
    out.windZ = Math.sin(heading) * out.windMps
    populateWeatherStructure(out, Math.max(950, land.height + 650) +
      (1 - land.moisture) * 350 - airHaze * 220, convection)
    return out
  }
}
