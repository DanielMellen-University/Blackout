import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  Scene,
} from 'three'
import { flightConfig } from '../aircraft/flightConfig'
import { Atmosphere, type WeatherId } from './Atmosphere'
import type { WeatherSnapshot, WindSide } from './WeatherDirector'
import {
  AIRFIELD_COLLIDERS,
  AIRFIELD_COLLISION_PADDING,
  setAirfieldPapi,
  setAirfieldWind,
} from './Airfield'
import { randomizeWorldSeed, setWorldSeed } from './noise'
import { createRunway, setRunwayDaylight } from './Runway'
import {
  clearOpsPad,
  findPlayableSpawn,
  getOpsPad,
  getOpsPadInto,
  setOpsPad,
  type FlatSpawn,
  type OpsPadSnapshot,
} from './terrainSample'
import { fogFarForViewRadius, fogNearForViewRadius, FOG_FAR, FOG_NEAR, TerrainSystem } from './TerrainSystem'
import { MissionSystem, type MissionRouteProfile } from '../systems/Mission'
import { SettlementSystem } from './SettlementSystem'
import { disposeObjectTree } from '../core/dispose'
import { AirTrafficSystem } from './AirTrafficSystem'
import { normalizeRenderQuality, renderQualityProfile, type RenderQuality } from '../core/RenderQuality'

const OBSTACLE_SWEEP_SPACING = 8
const OBSTACLE_SWEEP_MAX_STEPS = 32

interface ObstaclePadding {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface ObstacleSweepPoint {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface SpawnPose {
  x: number
  y: number
  z: number
  yaw: number
  biome: string
}

export interface WeatherEffectState {
  rain: number
  snow: number
  windX: number
  windZ: number
  cloudCover: number
  daylight: number
}

function safeWorldDelta(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function safeWorldCoordinate(value: number, fallback: number): number {
  if (Number.isFinite(value)) return value
  return Number.isFinite(fallback) ? fallback : 0
}

function finiteWeather01(value: number): number {
  return Number.isFinite(value) ? MathUtils.clamp(value, 0, 1) : 0
}

function finiteWeatherWind(value: number): number {
  return Number.isFinite(value) ? MathUtils.clamp(value, -40, 40) : 0
}

/** Ignore sub-pixel weather drift while retaining responsive transitions. */
export function weatherEffectsChanged(
  previous: WeatherEffectState | null,
  next: WeatherEffectState,
  epsilon = 0.0005,
): boolean {
  if (!previous) return true
  return Math.abs(finiteWeather01(previous.rain) - finiteWeather01(next.rain)) > epsilon ||
    Math.abs(finiteWeather01(previous.snow) - finiteWeather01(next.snow)) > epsilon ||
    Math.abs(finiteWeatherWind(previous.windX) - finiteWeatherWind(next.windX)) > epsilon ||
    Math.abs(finiteWeatherWind(previous.windZ) - finiteWeatherWind(next.windZ)) > epsilon ||
    Math.abs(finiteWeather01(previous.cloudCover) - finiteWeather01(next.cloudCover)) > epsilon ||
    Math.abs(finiteWeather01(previous.daylight) - finiteWeather01(next.daylight)) > epsilon
}

/**
 * Scene graph: lights, runway, atmosphere, infinite terrain.
 */
export class World {
  readonly scene = new Scene()
  readonly terrain: TerrainSystem
  readonly settlements: SettlementSystem
  readonly traffic: AirTrafficSystem
  readonly sun: DirectionalLight
  /** Cool moonlight — no shadows (cheap second key light). */
  readonly moon: DirectionalLight
  readonly atmosphere: Atmosphere
  readonly mission: MissionSystem
  private seed = 0
  private readonly runway: Group
  private readonly hemi: HemisphereLight
  private readonly ambient: AmbientLight
  private readonly fill: DirectionalLight
  /** Reused collision snapshot; obstacle probes run every physics frame. */
  private readonly obstaclePad: OpsPadSnapshot = { x: 0, z: 0, y: 0, yaw: 0 }

  /** Current airfield spawn (flat biome pad). */
  spawn: SpawnPose = {
    x: 0,
    y: flightConfig.gearHeight,
    z: -45,
    yaw: 0,
    biome: 'plains',
  }
  private committed = false
  /** True when a requested replacement was rejected and the previous world stayed active. */
  private reseedFallback = false
  private disposed = false
  private renderQuality: RenderQuality | null = null
  /** Additional GPU detail scale applied by the adaptive pixel-resolution scaler. */
  private adaptiveDetailScale = 1
  private missionProfile: MissionRouteProfile | undefined
  /** Authored weather stays fixed against manual N-cycle changes. */
  private weatherLocked = false
  /** Front routes keep manual cycling locked while their automatic blend runs. */
  private weatherCycleLockedValue = false
  private appliedWeather: WeatherEffectState | null = null
  private readonly weatherCandidate: WeatherEffectState = {
    rain: 0,
    snow: 0,
    windX: 0,
    windZ: 0,
    cloudCover: 0,
    daylight: 0,
  }

  constructor(quality: RenderQuality = 'balanced') {
    const qualityProfile = renderQualityProfile(quality)
    this.sun = this.createSun()
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    this.moon = this.createMoon()
    this.scene.add(this.moon)
    this.scene.add(this.moon.target)

    this.hemi = new HemisphereLight(0xd0e4f8, 0x4a5540, 0.85)
    this.scene.add(this.hemi)

    this.ambient = new AmbientLight(0xffffff, 0.42)
    this.scene.add(this.ambient)

    this.fill = new DirectionalLight(0xb8d0ff, 0.4)
    this.fill.position.set(-100, 80, -60)
    this.scene.add(this.fill)
    this.scene.add(this.fill.target)

    this.terrain = new TerrainSystem(this.scene, qualityProfile.terrainWorkers)
    this.settlements = new SettlementSystem(this.scene)
    this.traffic = new AirTrafficSystem(this.scene)
    this.atmosphere = new Atmosphere(
      this.scene,
      {
        sun: this.sun,
        moon: this.moon,
        hemi: this.hemi,
        ambient: this.ambient,
        fill: this.fill,
      },
      FOG_NEAR,
      FOG_FAR,
    )

    this.runway = createRunway()
    this.scene.add(this.runway)
    this.mission = new MissionSystem(this.scene)
    this.setRenderQuality(quality)
    this.reseed()
  }

  get worldSeed(): number {
    return this.seed
  }

  /** Whether the most recent reseed kept the previously committed world. */
  get lastReseedUsedFallback(): boolean {
    return this.reseedFallback
  }

  get weatherCycleLocked(): boolean {
    return this.weatherCycleLockedValue
  }

  /** Stage the title screen without throwing away the nearby settlement cache. */
  setSettlementsVisible(visible: boolean): void {
    if (this.disposed) return
    this.settlements.setVisible(visible)
  }

  setTrafficVisible(visible: boolean): void {
    if (this.disposed) return
    this.traffic.setVisible(visible)
  }

  setTrafficQuality(quality: RenderQuality): void {
    if (this.disposed) return
    this.traffic.setRenderQuality(normalizeRenderQuality(quality))
  }

  /** Apply the shared quality envelope to terrain streaming and atmosphere fog. */
  setRenderQuality(quality: RenderQuality): void {
    if (this.disposed) return
    const safeQuality = normalizeRenderQuality(quality)
    if (this.renderQuality === safeQuality) return
    this.renderQuality = safeQuality
    const profile = renderQualityProfile(safeQuality)
    this.settlements.setRenderQuality(safeQuality)
    this.settlements.setDetailRadius(profile.settlementDetailRadius)
    this.settlements.setRoadDetailRadius(profile.settlementRoadRadius)
    this.traffic.setRenderQuality(safeQuality)
    this.terrain.setViewRadius(profile.terrainViewRadius)
    this.terrain.setWorkerLimit(profile.terrainWorkers)
    this.terrain.setUploadBudget(profile.terrainUploadBudgetMs, profile.terrainMaxUploadsPerFrame)
    this.terrain.setWaterDetailScale(profile.waterDetailScale * this.adaptiveDetailScale)
    this.terrain.setTerrainDetailScale(profile.terrainDetailScale * this.adaptiveDetailScale)
    this.terrain.setVegetationScale(profile.vegetationScale * this.adaptiveDetailScale)
    this.atmosphere.setPrecipitationScale(profile.precipitationScale * this.adaptiveDetailScale)
    this.atmosphere.setCloudDensityScale(profile.cloudScale * this.adaptiveDetailScale)
    this.atmosphere.setFogRange(
      fogNearForViewRadius(profile.terrainViewRadius),
      fogFarForViewRadius(profile.terrainViewRadius),
    )
  }

  /**
   * Let the renderer shed expensive moving detail while adaptive resolution
   * is below its selected ceiling. Geometry, visibility, and flight physics
   * remain unchanged, so recovery is instant when the GPU catches up.
   */
  setAdaptiveDetailScale(scale: number): void {
    if (this.disposed) return
    const safe = MathUtils.clamp(Number.isFinite(scale) ? scale : 1, .5, 1)
    if (Math.abs(safe - this.adaptiveDetailScale) < .01) return
    this.adaptiveDetailScale = safe
    const profile = renderQualityProfile(this.renderQuality ?? 'balanced')
    this.terrain.setWaterDetailScale(profile.waterDetailScale * safe)
    this.terrain.setTerrainDetailScale(profile.terrainDetailScale * safe)
    this.terrain.setVegetationScale(profile.vegetationScale * safe)
    this.atmosphere.setPrecipitationScale(profile.precipitationScale * safe)
    this.atmosphere.setCloudDensityScale(profile.cloudScale * safe)
  }

  /**
   * New random world seed, pick a flat-biome airfield, rebuild terrain there.
   * Search and validation run before the live world is replaced. If anything
   * throws after a world already exists, the previous seed/pad stay in place.
   */
  reseed(
    requestedSeed?: number,
    requestedProfile?: MissionRouteProfile,
    requestedWeather?: WeatherId,
    requestedTimeOfDay?: number,
    requestedWindSide?: WindSide,
    requestedWeatherShift?: WeatherId,
  ): number {
    if (this.disposed) return this.seed
    this.reseedFallback = false
    if (requestedSeed !== undefined && !Number.isFinite(requestedSeed)) {
      throw new Error('World seed must be finite')
    }
    const previousSeed = this.seed
    const previousProfile = this.missionProfile
    const previousPad = getOpsPad()
    const previousSpawn = { ...this.spawn }
    const previousWeather = this.atmosphere.weather
    const previousWindHeading = this.atmosphere.authoredWindHeading
    const previousTimeOfDay = this.atmosphere.timeOfDay
    const previousWeatherLocked = this.weatherLocked
    const previousWeatherCycleLocked = this.weatherCycleLockedValue
    const previousTimeOfDayLocked = this.atmosphere.timeOfDayLocked
    let liveWorldCleared = false
    const restore = (): void => {
      setWorldSeed(previousSeed)
      this.seed = previousSeed
      this.missionProfile = previousProfile
      this.spawn = previousSpawn
      this.weatherLocked = previousWeatherLocked
      this.weatherCycleLockedValue = previousWeatherCycleLocked
      this.atmosphere.setWeatherLocked(previousWeatherLocked)
      this.atmosphere.setTimeOfDayLocked(previousTimeOfDayLocked)
      if (previousPad) setOpsPad(previousPad.x, previousPad.z, previousPad.y, previousPad.yaw)
      else clearOpsPad()
    }

    try {
      for (let attempt = 0; attempt < (requestedSeed === undefined ? 8 : 1); attempt++) {
        const nextSeed = requestedSeed ?? randomizeWorldSeed()
        setWorldSeed(nextSeed)
        clearOpsPad()
        const pad = findPlayableSpawn()
        if (!pad) continue
        setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
        this.seed = nextSeed
        this.missionProfile = requestedProfile
        this.weatherLocked = requestedWeather !== undefined && requestedWeatherShift === undefined
        this.weatherCycleLockedValue = requestedWeather !== undefined || requestedWeatherShift !== undefined
        this.applySpawn(pad)
        liveWorldCleared = true
        this.terrain.clearAll()
        this.settlements.clearAll()
        this.traffic.reset(this.seed, this.spawn.x, this.spawn.y, this.spawn.z)
        // A fresh terrain and settlement stream starts with neutral weather
        // state, even when the seeded weather profile happens to match the
        // previous world. Force the first application after a reseed.
        this.appliedWeather = null
        this.terrain.update(this.spawn.x, this.spawn.z, 1 / 60)
        this.settlements.primeAnchors(this.spawn.x, this.spawn.z)
        // Kick off the protected city/village anchor jobs before the first
        // rendered frame. Without this warm start, a fresh world spent its
        // opening frames generating terrain while nearby landmarks waited for
        // the first movement-triggered settlement update.
        this.settlements.update(this.spawn.x, this.spawn.z)
        this.atmosphere.randomizeWeather(this.seed)
        if (requestedWeather) this.atmosphere.setWeather(requestedWeather, true)
        if (requestedWeatherShift && requestedWeatherShift !== requestedWeather) {
          this.atmosphere.setWeather(requestedWeatherShift)
        }
        if (requestedWindSide) {
          const side = requestedWindSide === 'right' ? 1 : -1
          this.atmosphere.setWindHeading(this.spawn.yaw + side * Math.PI / 2)
        }
        if (Number.isFinite(requestedTimeOfDay)) {
          const normalizedTime = requestedTimeOfDay! - Math.floor(requestedTimeOfDay!)
          this.atmosphere.timeOfDay = normalizedTime < 0 ? normalizedTime + 1 : normalizedTime
        }
        this.atmosphere.setWeatherLocked(this.weatherLocked)
        this.atmosphere.setTimeOfDayLocked(Number.isFinite(requestedTimeOfDay))
        const initialWeather = this.atmosphere.weatherSnapshot
        this.applyWeatherEffects(initialWeather, this.atmosphere.daylight)
        setAirfieldWind(this.runway, initialWeather.windX, initialWeather.windZ)
        setAirfieldPapi(this.runway, this.spawn.x, this.spawn.y, this.spawn.z, this.atmosphere.daylight)
        this.mission.start(this.spawn.x, this.spawn.y, this.spawn.z, this.spawn.yaw, this.missionProfile, undefined, this.spawn.biome)
        this.committed = true
        return this.seed
      }
      if (this.committed) {
        this.reseedFallback = true
        restore()
        return this.seed
      }
      throw new Error('reseed: no dry inland pad')
    } catch (err) {
      restore()
      if (this.committed && liveWorldCleared) {
        this.reseedFallback = true
        this.restoreCommittedWorld(
          previousSeed,
          previousProfile,
          previousPad,
          previousSpawn,
          previousWeather,
          previousWindHeading,
          previousTimeOfDay,
          previousWeatherLocked,
          previousWeatherCycleLocked,
          previousTimeOfDayLocked,
        )
        return this.seed
      }
      if (this.committed) {
        this.reseedFallback = true
        return this.seed
      }
      throw err
    }
  }

  /** Best-effort rollback after a replacement world fails mid-rebuild. */
  private restoreCommittedWorld(
    seed: number,
    profile: MissionRouteProfile | undefined,
    pad: { x: number; z: number; y: number; yaw?: number } | null,
    spawn: SpawnPose,
    weather: WeatherId,
    windHeading: number | null,
    timeOfDay: number,
    weatherLocked: boolean,
    weatherCycleLocked: boolean,
    timeOfDayLocked: boolean,
  ): void {
    try { setWorldSeed(seed) } catch { /* keep the previous process alive */ }
    try {
      this.seed = seed
      this.missionProfile = profile
      this.spawn = { ...spawn }
      this.weatherLocked = weatherLocked
      this.weatherCycleLockedValue = weatherCycleLocked
    } catch { /* state is already best effort */ }
    try {
      if (pad) {
        setOpsPad(pad.x, pad.z, pad.y, pad.yaw)
        this.runway.position.set(pad.x, pad.y + 0.05, pad.z)
        this.runway.rotation.y = pad.yaw ?? spawn.yaw
      } else {
        clearOpsPad()
      }
    } catch { /* runway restoration is cosmetic */ }
    try { this.terrain.clearAll() } catch { /* continue rebuilding other world layers */ }
    try { this.settlements.clearAll() } catch { /* continue rebuilding other world layers */ }
    try { this.traffic.reset(seed, spawn.x, spawn.y, spawn.z) } catch { /* traffic can rebuild on the next tick */ }
    try {
      this.appliedWeather = null
      this.terrain.update(spawn.x, spawn.z, 1 / 60)
    } catch { /* workerless terrain can retry from World.update */ }
    try {
      this.settlements.primeAnchors(spawn.x, spawn.z)
      this.settlements.update(spawn.x, spawn.z)
    } catch { /* settlement workers can retry from World.update */ }
    try {
      this.atmosphere.randomizeWeather(seed)
      this.atmosphere.timeOfDay = Number.isFinite(timeOfDay) ? timeOfDay : this.atmosphere.timeOfDay
      this.atmosphere.setWeather(weather, true)
      this.atmosphere.setWindHeading(windHeading)
      this.atmosphere.setWeatherLocked(weatherLocked)
      this.atmosphere.setTimeOfDayLocked(timeOfDayLocked)
      const restoredWeather = this.atmosphere.weatherSnapshot
      this.applyWeatherEffects(restoredWeather, this.atmosphere.daylight)
      setAirfieldWind(this.runway, restoredWeather.windX, restoredWeather.windZ)
      setAirfieldPapi(this.runway, spawn.x, spawn.y, spawn.z, this.atmosphere.daylight)
    } catch { /* atmosphere will reapply on its next update */ }
    try { this.mission.start(spawn.x, spawn.y, spawn.z, spawn.yaw, profile, undefined, spawn.biome) } catch { /* mission can be started by the next reset */ }
  }

  /** True if a world-space point overlaps hangar, tower, or shack. */
  hitObstacle(x: number, y: number, z: number, padding?: ObstaclePadding): boolean {
    if (this.disposed) return false
    if (this.settlements.hitObstacle(x, y, z, padding)) return true
    return this.hitAirfieldObstacle(x, y, z, padding)
  }

  /** Check only airfield boxes, optionally expanded for the aircraft body. */
  private hitAirfieldObstacle(
    x: number,
    y: number,
    z: number,
    padding?: ObstaclePadding,
  ): boolean {
    if (this.disposed || !this.obstaclePad || !this.spawn) return false
    const pad = getOpsPadInto(this.obstaclePad)
    if (!pad) return false
    const yaw = this.spawn.yaw
    const dx = x - pad.x
    const dz = z - pad.z
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    const lx = dx * rx + dz * rz
    const lz = dx * fx + dz * fz
    const ly = y - pad.y
    const paddingX = padding?.x ?? 0
    const paddingY = padding?.y ?? 0
    const paddingZ = padding?.z ?? 0
    for (const b of AIRFIELD_COLLIDERS) {
      if (
        Math.abs(lx - b.cx) <= b.hx + paddingX &&
        Math.abs(ly - b.cy) <= b.hy + paddingY &&
        Math.abs(lz - b.cz) <= b.hz + paddingZ
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Check the path between two physics poses so fast passes cannot tunnel
   * through a loaded settlement or airfield building. The endpoint is always
   * checked; only the bounded interior probes are added to the normal frame.
   */
  hitObstacleSegment(previous: ObstacleSweepPoint, current: ObstacleSweepPoint): boolean {
    if (this.disposed) return false
    const dx = current.x - previous.x
    const dy = current.y - previous.y
    const dz = current.z - previous.z
    const distance = Math.hypot(dx, dy, dz)
    if (!Number.isFinite(distance)) {
      return this.hitObstacle(current.x, current.y, current.z, AIRFIELD_COLLISION_PADDING)
    }
    const steps = Math.max(1, Math.min(OBSTACLE_SWEEP_MAX_STEPS, Math.ceil(distance / OBSTACLE_SWEEP_SPACING)))
    for (let step = 1; step < steps; step++) {
      const t = step / steps
      const x = previous.x + dx * t
      const y = previous.y + dy * t
      const z = previous.z + dz * t
      if (this.hitObstacle(x, y, z, AIRFIELD_COLLISION_PADDING)) return true
    }
    return this.hitObstacle(current.x, current.y, current.z, AIRFIELD_COLLISION_PADDING)
  }

  cycleWeather(): WeatherId {
    if (this.disposed) return this.atmosphere.weather
    if (this.weatherCycleLockedValue) return this.atmosphere.weather
    return this.atmosphere.cycleWeather()
  }

  /**
   * Stream terrain + advance day/night and weather.
   * Pass simDt=0 to freeze challenge conditions while still streaming tiles.
   */
  update(x: number, y: number, z: number, dt: number, simDt = dt, visualDt = simDt): void {
    if (this.disposed) return
    // Keep one malformed frame from leaking NaN/Infinity into every streamed
    // subsystem. The spawn pose is a stable fallback until the next valid
    // aircraft sample arrives.
    const safeX = safeWorldCoordinate(x, this.spawn.x)
    const safeY = safeWorldCoordinate(y, this.spawn.y)
    const safeZ = safeWorldCoordinate(z, this.spawn.z)
    const safeDt = safeWorldDelta(dt)
    const safeSimDt = safeWorldDelta(simDt)
    const safeVisualDt = safeWorldDelta(visualDt)
    this.terrain.update(safeX, safeZ, safeDt)
    this.settlements.update(safeX, safeZ)
    this.traffic.update(safeX, safeZ, safeVisualDt)
    this.atmosphere.update(safeSimDt, safeX, safeY, safeZ, safeVisualDt)
    setRunwayDaylight(this.runway, this.atmosphere.daylight)
    const weather = this.atmosphere.weatherSnapshot
    this.applyWeatherEffects(weather, this.atmosphere.daylight)
    setAirfieldWind(this.runway, weather.windX, weather.windZ)
    setAirfieldPapi(this.runway, safeX, safeY, safeZ, this.atmosphere.daylight)
  }

  /** Release all streamed and persistent world resources before renderer teardown. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.mission.dispose()
    this.terrain.dispose()
    this.settlements.dispose()
    this.traffic.dispose()
    this.atmosphere.dispose()
    disposeObjectTree(this.runway)
    this.runway.removeFromParent()
    this.scene.clear()
  }

  private applyWeatherEffects(weather: WeatherSnapshot, daylight: number): void {
    const next = this.weatherCandidate
    next.rain = finiteWeather01(weather.rain)
    next.snow = finiteWeather01(weather.snow)
    next.windX = finiteWeatherWind(weather.windX)
    next.windZ = finiteWeatherWind(weather.windZ)
    next.cloudCover = Math.max(
      finiteWeather01(weather.lowClouds),
      finiteWeather01(weather.midClouds) * .9,
    )
    next.daylight = finiteWeather01(daylight)
    if (!weatherEffectsChanged(this.appliedWeather, next)) return
    this.terrain.setWeatherEffects(
      next.rain,
      next.snow,
      next.windX,
      next.windZ,
      next.cloudCover,
    )
    this.settlements.setWeatherEffects(next.rain, next.snow, next.daylight)
    if (!this.appliedWeather) {
      this.appliedWeather = { ...next }
    } else {
      this.appliedWeather.rain = next.rain
      this.appliedWeather.snow = next.snow
      this.appliedWeather.windX = next.windX
      this.appliedWeather.windZ = next.windZ
      this.appliedWeather.cloudCover = next.cloudCover
      this.appliedWeather.daylight = next.daylight
    }
  }

  private applySpawn(pad: FlatSpawn): void {
    const yaw = pad.yaw
    const back = 45
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const x = pad.x - fx * back
    const z = pad.z - fz * back
    this.spawn = {
      x,
      y: pad.y + flightConfig.gearHeight,
      z,
      yaw,
      biome: pad.biome,
    }

    this.runway.position.set(pad.x, pad.y + 0.05, pad.z)
    this.runway.rotation.y = yaw
  }

  private createSun(): DirectionalLight {
    const sun = new DirectionalLight(0xfff5e6, 1.65)
    sun.name = 'SunLight'
    sun.position.set(180, 280, 120)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.near = 10
    sun.shadow.camera.far = 1200
    sun.shadow.camera.left = -450
    sun.shadow.camera.right = 450
    sun.shadow.camera.top = 450
    sun.shadow.camera.bottom = -450
    sun.shadow.bias = -0.0002
    return sun
  }

  /** Moon key light — directional only, no shadow map (keeps night cheap). */
  private createMoon(): DirectionalLight {
    const moon = new DirectionalLight(0xc8d4ff, 0)
    moon.name = 'MoonLight'
    moon.position.set(-180, 200, -120)
    moon.castShadow = false
    return moon
  }
}
