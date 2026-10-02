import {
  Color,
  DoubleSide,
  Fog,
  FrontSide,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector2,
} from 'three'
import { getWorldSeed, hash2 } from './noise'
import {
  sampleClimate,
  sampleClimateInto,
  waterBodyFromClimate,
  opsPadBlend,
  getOpsPadInto,
  type OpsPadSnapshot,
  type TerrainSurface,
} from './terrainSample'
import { createClimateSample } from './Geography'
import {
  createVegetationFactory,
  vegetationClusterFactor,
  vegetationDensity,
  vegetationInstanceCount,
} from './vegetation'
import {
  clearTerrainSamplers,
  invalidateGroundSamplerCaches,
  registerTerrainSamplers,
  type GroundSurfaceSample,
} from './ground'
import { makeWaterMaterial } from './WaterSystem'
import {
  CHUNK_SIZE, deserializeTerrainGeometry, generateTerrainGeometry,
  type TerrainGeometryData, type TerrainLod,
} from './TerrainGeometry'
import { TerrainWorkerPool, type TerrainBuildRequest } from './TerrainWorkerPool'
export { CHUNK_SIZE, segsForLod, waterSegsForLod, pondIntersectsBounds,
  buildTerrainSkirtGeometry, type TerrainLod } from './TerrainGeometry'
import { planTerrainTiles, terrainBuildPriority, tileKey, tileDistance, TERRAIN_ROOT_SIZE,
  type TerrainTile } from './TerrainLayout'
import { disposeObjectTree } from '../core/dispose'

/**
 * Streaming envelope.
 * Terrain is generated past the fog wall so new chunks never appear
 * in clear view. Fog covers eight chunk rings before the stream edge.
 * Distance LOD + cheap far tiles keep the wider ring affordable.
 */
/**
 * Stream half-width in chunks (diameter ~2× this).
 * Twice the previous 40-cell radius, with coarse distant tiles.
 */
export const VIEW_RADIUS = 80
/**
 * Chunk rings kept past the fog horizon. Generation / fade happens
 * inside this hidden margin so you never watch tiles pop in.
 */
export const FOG_MARGIN_CHUNKS = 8
/** Stylized instanced vegetation v2 stays inside the near-field budget. */
export const ENABLE_VEGETATION = true
/** Detailed props only near the jet (cells). */
const PROP_RADIUS = 2
/** Soft opacity fade across the fog margin. */
const FADE_CELLS = FOG_MARGIN_CHUNKS + 0.4
/** Short smoothstep appearance transition, independent of frame rate. */
const FADE_SECONDS = .65
/** Main-thread mesh attachment stays bounded, even when workers complete together. */
const DEFAULT_UPLOAD_BUDGET_MS = 2
const DEFAULT_MAX_UPLOADS_PER_FRAME = 16
/** Keep coarse-tile ownership lookups cheap without retaining an unbounded map. */
const SAMPLE_LOOKUP_LIMIT = 512
export const STREAM_RADIUS_M = VIEW_RADIUS * CHUNK_SIZE
/** Re-evaluate existing tile LOD before a full stream-cell crossing. */
const LOD_RECHECK_DISTANCE_M = CHUNK_SIZE * 0.5
/**
 * Fog fully opaque at this range, eight chunks inside the stream edge
 * (VIEW_RADIUS - FOG_MARGIN) * CHUNK_SIZE.
 */
export const FOG_FAR = (VIEW_RADIUS - FOG_MARGIN_CHUNKS) * CHUNK_SIZE
/** Clear air near the jet; linear fog ramps out to FOG_FAR. */
export const FOG_NEAR = Math.round(FOG_FAR * 0.34)

/** Resolve the fog edge for a quality-specific terrain stream radius. */
export function fogFarForViewRadius(radius: number): number {
  const safeRadius = Math.max(FOG_MARGIN_CHUNKS + 2, Number.isFinite(radius) ? radius : VIEW_RADIUS)
  return Math.max(CHUNK_SIZE * 2, (safeRadius - FOG_MARGIN_CHUNKS) * CHUNK_SIZE)
}

export function fogNearForViewRadius(radius: number): number {
  return Math.round(fogFarForViewRadius(radius) * 0.34)
}

/** Fade tiles against the active quality radius instead of the High preset. */
export function terrainFadeTargetAlpha(cellDist: number, viewRadius: number): number {
  const safeRadius = Math.max(
    FOG_MARGIN_CHUNKS + 2,
    Number.isFinite(viewRadius) ? viewRadius : VIEW_RADIUS,
  )
  const safeDistance = Number.isFinite(cellDist) ? Math.max(0, cellDist) : 0
  const fadeStart = safeRadius - FADE_CELLS
  return 1 - MathUtils.smoothstep(safeDistance, fadeStart, safeRadius + 0.35)
}

function finiteWeather01(value: number): number {
  return Number.isFinite(value) ? MathUtils.clamp(value, 0, 1) : 0
}

function finiteWeatherWind(value: number): number {
  return Number.isFinite(value) ? MathUtils.clamp(value, -40, 40) : 0
}

export function lodFromDist(dist: number): TerrainLod {
  if (dist <= 3) return 0
  if (dist <= 11) return 1
  return 2
}

/**
 * Promote as soon as the inner band is entered; demote only after leaving
 * a wider outer band so tiles do not thrash on the 3/11 cell rings.
 */
export function lodWithHysteresis(dist: number, current: TerrainLod): TerrainLod {
  const desired = lodFromDist(dist)
  if (desired === current) return current
  if (desired < current) {
    if (current === 2 && dist <= 10) return desired
    if (current === 1 && dist <= 2.5) return 0
    return current
  }
  if (current === 0 && dist >= 4.5) return desired
  if (current === 1 && dist >= 12.5) return 2
  return current
}

/** Snow settles on exposed, upward-facing ground before it reaches cliffs. */
export function terrainSnowCoverage(snow: number, height: number, normalY: number): number {
  const altitudeSnow = MathUtils.smoothstep(height, 1400, 3200)
  const slopeExposure = MathUtils.smoothstep(normalY, .42, .94)
  return MathUtils.clamp(snow, 0, 1) * slopeExposure * (.32 + altitudeSnow * .48)
}

/**
 * Sample a chunk height grid the same way Three.js triangulates PlaneGeometry
 * (diagonal from (0,1) to (1,0)).
 */
export function interpolateGridHeight(
  heights: Float32Array,
  segs: number,
  originX: number,
  originZ: number,
  x: number,
  z: number,
  span = CHUNK_SIZE,
): number {
  const stride = segs + 1
  const safeSpan = Number.isFinite(span) && span > 0 ? span : CHUNK_SIZE
  const u = ((x - originX) / safeSpan) * segs
  const v = ((z - originZ) / safeSpan) * segs
  const ix = Math.min(segs - 1, Math.max(0, Math.floor(u)))
  const iy = Math.min(segs - 1, Math.max(0, Math.floor(v)))
  const fu = Math.min(1, Math.max(0, u - ix))
  const fv = Math.min(1, Math.max(0, v - iy))
  const ha = heights[iy * stride + ix]!
  const hb = heights[(iy + 1) * stride + ix]!
  const hc = heights[(iy + 1) * stride + ix + 1]!
  const hd = heights[iy * stride + ix + 1]!
  if (fu + fv <= 1) return (1 - fu - fv) * ha + fv * hb + fu * hd
  return (fu + fv - 1) * hc + (1 - fu) * hb + (1 - fv) * hd
}

interface Chunk {
  size: number
  waterLevels: Float32Array
  key: string
  cx: number
  cz: number
  root: Group
  lod: TerrainLod
  segs: number
  hasProps: boolean
  originX: number
  originZ: number
  heights: Float32Array
  /** Current opacity 0–1 (lerped each frame). */
  alpha: number
  fadeAge: number
  /** Desired opacity (distance fade or 0 while unloading). */
  targetAlpha: number
  /** Marked for removal after fade-out completes. */
  fadingOut: boolean
  /** Last applied opacity — skip material walks when unchanged. */
  appliedAlpha: number
  /** Cached near-field props root and meshes; avoids scene-tree searches every frame. */
  props: Group | null
  propMeshes: Mesh[]
  /** Terrain and water meshes are cached so settled materials can be swapped without tree searches. */
  terrainMesh: Mesh
  waterMesh: Mesh | null
  /** Settled chunks use shared opaque materials until they need to fade again. */
  settled: boolean
  materials: MeshStandardMaterial[]
}

interface PendingChunk {
  size: number
  cx: number
  cz: number
  dist: number
  rebuild: boolean
}

interface DesiredTile {
  cx: number
  cz: number
  size: number
  dist: number
}

/** Read-only stream pressure snapshot used by the opt-in debug inspector. */
export interface TerrainStreamingStats {
  loaded: number
  pending: number
  inFlight: number
  ready: number
  workers: number
}

/**
 * Infinite streaming terrain with amortized chunk generation.
 */
export class TerrainSystem {
  readonly root = new Group()
  private readonly chunks = new Map<string, Chunk>()
  private readonly pending: PendingChunk[] = []
  /** Pending work stays reverse-prioritized so dispatch can pop without shifts. */
  private pendingSorted = false
  private readonly pendingKeys = new Set<string>()
  private readonly ready: { job: TerrainBuildRequest; data: TerrainGeometryData; key?: string; dist?: number }[] = []
  /** Completed results retain their nearest-first order between stream reschedules. */
  private readySorted = false
  private readonly activeKeys = new Set<string>()
  /** Chunks that still need per-frame opacity or prop-distance work. */
  private readonly fadeKeys = new Set<string>()
  /** Reused schedule membership set avoids churn during rapid focus changes. */
  private readonly neededKeys = new Set<string>()
  private readonly retiring: Chunk[] = []
  /** Reused fade-removal list keeps the per-frame stream path allocation-free. */
  private readonly fadeRemovals: string[] = []
  private generation = 0
  private nextRequest = 0
  private disposed = false
  private readonly workers: TerrainWorkerPool
  private uploadBudgetMs = DEFAULT_UPLOAD_BUDGET_MS
  private maxUploadsPerFrame = DEFAULT_MAX_UPLOADS_PER_FRAME
  private desiredTiles = new Map<string, DesiredTile>()
  /** Reused quadtree output keeps cell-crossing schedules allocation-light. */
  private readonly plannedTiles: TerrainTile[] = []
  /** Desired leaves grouped by their aligned 32-cell quadtree root. */
  private readonly desiredTileBuckets = new Map<string, DesiredTile[]>()
  /** Reuse bucket arrays across stream-cell schedules to avoid churn. */
  private readonly desiredTileBucketPool: DesiredTile[][] = []
  private readonly replacementKeys = new Map<string, string[]>()
  private readonly scene: Scene
  private lastCx = Number.NaN
  private lastCz = Number.NaN
  private lastLodFocusX = Number.NaN
  private lastLodFocusZ = Number.NaN
  /** Settled far chunks only need a fade-target refresh after a stream/LOD move. */
  private fadeTargetsDirty = true
  /** Detect direct desired-tile invalidation before the next fade pass. */
  private lastDesiredTileCount = -1
  /** Reuse the common near-cell lookup used by collision and contact probes. */
  private sampledChunk: Chunk | null = null
  private sampledChunkCx = Number.NaN
  private sampledChunkCz = Number.NaN
  /** Cell -> smallest resident tile covering that cell, or null while unloaded. */
  private readonly sampledChunkLookup = new Map<string, Chunk | null>()
  private focusX = 0
  private focusZ = 0
  private viewRadius = VIEW_RADIUS
  private readonly waterClock = { value: 0 }
  private readonly waterRain = { value: 0 }
  private readonly waterSnow = { value: 0 }
  private readonly waterWindX = { value: 0 }
  private readonly waterWindZ = { value: 0 }
  private readonly waterDetailScale = { value: 1 }
  private readonly terrainDetailScale = { value: 1 }
  /** Reused rich climate record for the occasional rendered-surface query. */
  private readonly surfaceClimate = createClimateSample()
  /** Reused climate record for the bounded near-field vegetation sample loop. */
  private readonly propsClimate = createClimateSample()
  /** Structured-clone staging record for worker requests. */
  private readonly streamPadSnapshot: OpsPadSnapshot = { x: 0, z: 0, y: 0, yaw: 0 }

  /** Near tiles: double-sided so steep cliffs don't punch holes. */
  private readonly groundMatNear: MeshStandardMaterial
  /** Mid/far tiles: single-sided (half the fill rate). */
  private readonly groundMatFar: MeshStandardMaterial
  /** One shared opaque water material for settled streamed tiles. */
  private readonly waterMat: MeshStandardMaterial
  private readonly weatherRain = { value: 0 }
  private readonly weatherSnow = { value: 0 }
  private readonly weatherClouds = { value: 0 }
  private readonly weatherWind = new Vector2()
  /** Stable read-only snapshot for diagnostics and HUD integrations. */
  private readonly weatherEffectsState = { rain: 0, snow: 0 }
  private vegFactory: ReturnType<typeof createVegetationFactory> | null = null
  private vegetationScale = 1

  constructor(scene: Scene, workerLimit = 6) {
    this.scene = scene
    this.workers = new TerrainWorkerPool((job, data) => {
      if (this.disposed || job.generation !== this.generation) return
      const key = tileKey(job.cx, job.cz, job.size)
      this.ready.push({ job, data, key, dist: this.desiredTiles.get(key)?.dist ?? Infinity })
      this.readySorted = false
      this.dispatchWorkers()
    }, job => {
      if (this.disposed || job.generation !== this.generation) return
      const key = tileKey(job.cx, job.cz, job.size)
      this.activeKeys.delete(key)
      const tile = this.desiredTiles.get(key)
      if (tile && !this.pendingKeys.has(key) && !this.activeKeys.has(key)) {
        this.pending.push({ ...tile, rebuild: this.chunks.has(key) })
        this.pendingKeys.add(key)
        this.pendingSorted = false
        this.sortPending()
      }
    }, workerLimit)
    this.root.name = 'TerrainSystem'
    scene.add(this.root)

    const matBase = {
      vertexColors: true as const,
      roughness: 0.94,
      metalness: 0.04,
      flatShading: false,
    }
    this.groundMatNear = new MeshStandardMaterial({
      ...matBase,
      side: DoubleSide,
    })
    this.groundMatFar = new MeshStandardMaterial({
      ...matBase,
      side: FrontSide,
    })
    this.waterMat = makeWaterMaterial(this.waterClock, {
      rain: this.waterRain,
      snow: this.waterSnow,
      windX: this.waterWindX,
      windZ: this.waterWindZ,
    }, -2, this.waterDetailScale)
    this.configureWeatherMaterial(this.groundMatNear)
    this.configureWeatherMaterial(this.groundMatFar)
    this.applyFog()
    registerTerrainSamplers(
      this,
      (x, z) => this.sampleMeshSurface(x, z),
      (x, z) => this.sampleMeshHeight(x, z),
      (x, z, out) => this.sampleMeshSurfaceInto(x, z, out),
    )
  }

  /** Update visual weather response without rebuilding streamed terrain. */
  setWeatherEffects(rain: number, snow: number, windX = 0, windZ = 0, cloudCover = 0): void {
    const safeRain = finiteWeather01(rain)
    const safeSnow = finiteWeather01(snow)
    const safeCloudCover = finiteWeather01(cloudCover)
    const safeWindX = finiteWeatherWind(windX)
    const safeWindZ = finiteWeatherWind(windZ)
    this.weatherRain.value = safeRain
    this.weatherSnow.value = safeSnow
    this.weatherClouds.value = safeCloudCover
    this.weatherWind.set(safeWindX, safeWindZ)
    this.weatherEffectsState.rain = safeRain
    this.weatherEffectsState.snow = safeSnow
    this.waterRain.value = safeRain
    this.waterSnow.value = safeSnow
    this.waterWindX.value = safeWindX
    this.waterWindZ.value = safeWindZ
    this.vegFactory?.setWeather(safeRain, safeSnow, safeWindX, safeWindZ)
  }

  get weatherEffects(): Readonly<{ rain: number; snow: number }> {
    return this.weatherEffectsState
  }

  /** Scale near-field vegetation batches without rebuilding terrain geometry. */
  setVegetationScale(scale: number): void {
    const safe = Number.isFinite(scale) ? MathUtils.clamp(scale, 0, 1) : 1
    if (safe === this.vegetationScale) return
    this.vegetationScale = safe
    for (const chunk of this.chunks.values()) this.applyVegetationScale(chunk.props)
  }

  /** Trim or restore the streamed terrain envelope when a quality preset changes. */
  setViewRadius(radius: number): void {
    if (this.disposed) return
    const safe = MathUtils.clamp(
      Number.isFinite(radius) ? radius : VIEW_RADIUS,
      FOG_MARGIN_CHUNKS + 2,
      VIEW_RADIUS,
    )
    if (Math.abs(safe - this.viewRadius) < 0.001) return
    this.viewRadius = safe
    this.applyFog(fogNearForViewRadius(safe), fogFarForViewRadius(safe))
    if (Number.isFinite(this.lastCx) && Number.isFinite(this.lastCz)) {
      this.scheduleAround(this.lastCx, this.lastCz)
    }
  }

  /** Keep terrain generation concurrency aligned with the active quality preset. */
  setWorkerLimit(limit: number): void {
    if (this.disposed) return
    this.workers.setWorkerLimit(limit)
  }

  /** Keep main-thread terrain attachment inside the active quality budget. */
  setUploadBudget(budgetMs: number, maxUploads: number): void {
    if (this.disposed) return
    this.uploadBudgetMs = MathUtils.clamp(
      Number.isFinite(budgetMs) ? budgetMs : DEFAULT_UPLOAD_BUDGET_MS,
      0.25,
      4,
    )
    this.maxUploadsPerFrame = MathUtils.clamp(
      Number.isFinite(maxUploads) ? Math.floor(maxUploads) : DEFAULT_MAX_UPLOADS_PER_FRAME,
      1,
      32,
    )
  }

  /** Reduce high-frequency water shading on Low without rebuilding surfaces. */
  setWaterDetailScale(scale: number): void {
    if (this.disposed) return
    this.waterDetailScale.value = MathUtils.clamp(
      Number.isFinite(scale) ? scale : 1,
      0,
      1,
    )
  }

  /** Reduce high-frequency terrain weather shading on Low without rebuilding surfaces. */
  setTerrainDetailScale(scale: number): void {
    if (this.disposed) return
    this.terrainDetailScale.value = MathUtils.clamp(
      Number.isFinite(scale) ? scale : 1,
      0,
      1,
    )
  }

  private configureWeatherMaterial(material: MeshStandardMaterial): void {
    material.onBeforeCompile = shader => {
      shader.uniforms.terrainRain = this.weatherRain
      shader.uniforms.terrainSnow = this.weatherSnow
      shader.uniforms.terrainClouds = this.weatherClouds
      shader.uniforms.terrainTime = this.waterClock
      shader.uniforms.terrainWind = { value: this.weatherWind }
      shader.uniforms.terrainDetailScale = this.terrainDetailScale
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying float terrainHeight;\nvarying vec3 terrainWorld;\n',
      ).replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nterrainHeight = transformed.y;\nterrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n',
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nuniform float terrainRain;\nuniform float terrainSnow;\nuniform float terrainClouds;\nuniform float terrainTime;\nuniform vec2 terrainWind;\nuniform float terrainDetailScale;\nvarying float terrainHeight;\nvarying vec3 terrainWorld;\n',
      ).replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        // Normal is initialized by normal_fragment_begin immediately before
        // this hook. Applying weather after that chunk avoids reading an
        // undefined normal during color_fragment on Three.js 0.185+.
        float terrainDetail = clamp(terrainDetailScale, 0.0, 1.0);
        float wetGround = terrainRain * 0.18;
        diffuseColor.rgb *= 1.0 - wetGround;
        // Rain darkens the whole world slightly, but low, level ground should
        // also catch a cool wet sheen. Keep the response restrained so hills
        // and mountains do not turn into a uniform blue wash.
        float wetLowland = terrainRain * (1.0 - smoothstep(520.0, 1700.0, terrainHeight)) *
          smoothstep(.78, .985, normal.y);
        diffuseColor.rgb = mix(diffuseColor.rgb,
          diffuseColor.rgb * vec3(.82, .92, .98), wetLowland * .2);
        float altitudeSnow = smoothstep(1400.0, 3200.0, terrainHeight);
        float slopeExposure = smoothstep(0.42, 0.94, normal.y);
        float snowCover = terrainSnow * slopeExposure * (0.44 + altitudeSnow * 0.52);
        if (terrainDetail > .5) {
          float windLength = max(length(terrainWind), .001);
          vec2 windDir = terrainWind / windLength;
          float windExposure = .5 + .5 * dot(normal.xz, windDir);
          snowCover *= .84 + windExposure * .16;
        }
        // Low-frequency moving bands fake soft cloud shadows without adding
        // a light, shadow map, or terrain draw. The field is world-space, so
        // adjacent streamed tiles share one continuous shadow pattern.
        vec2 cloudDrift = terrainWind * terrainTime * .018;
        float cloudShadow = .5;
        if (terrainDetail > .5) {
          float cloudBandA = .5 + .5 * sin((terrainWorld.x + cloudDrift.x * 900.0) / 1700.0 +
            sin((terrainWorld.z + cloudDrift.y * 900.0) / 2300.0) * 1.2);
          float cloudBandB = .5 + .5 * sin((terrainWorld.z + cloudDrift.y * 900.0) / 3200.0 -
            sin((terrainWorld.x + cloudDrift.x * 900.0) / 2100.0) * .8);
          cloudShadow = smoothstep(.34, .78, cloudBandA * .62 + cloudBandB * .38);
        }
        diffuseColor.rgb *= 1.0 - terrainClouds * cloudShadow * .12;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.83, 0.91), snowCover);`,
      )
    }
    material.customProgramCacheKey = () => 'terrain-weather-v6'
  }

  applyFog(near = FOG_NEAR, far = FOG_FAR): void {
    const fogColor = 0x8eabc4
    this.scene.background = new Color(fogColor)
    this.scene.fog = new Fog(fogColor, near, far)
  }

  clearAll(): void {
    // A reseed invalidates every queued generation. Terminate stale worker
    // jobs before rebuilding so the new world's near-field tiles do not wait
    // behind geometry that can no longer be installed.
    if (!this.disposed) this.workers.cancelJobs()
    this.generation++
    invalidateGroundSamplerCaches()
    this.ready.length = 0
    this.readySorted = false
    this.activeKeys.clear()
    this.fadeKeys.clear()
    for (const chunk of this.retiring) {
      chunk.root.removeFromParent()
      this.disposeChunk(chunk)
    }
    this.retiring.length = 0
    for (const chunk of this.chunks.values()) {
      this.root.remove(chunk.root)
      this.disposeChunk(chunk)
    }
    this.chunks.clear()
    this.pending.length = 0
    this.pendingKeys.clear()
    this.pendingSorted = false
    this.desiredTiles.clear()
    for (const bucket of this.desiredTileBuckets.values()) bucket.length = 0
    this.desiredTileBuckets.clear()
    this.desiredTileBucketPool.length = 0
    this.neededKeys.clear()
    this.replacementKeys.clear()
    this.lastCx = Number.NaN
    this.lastCz = Number.NaN
    this.lastLodFocusX = Number.NaN
    this.lastLodFocusZ = Number.NaN
    this.fadeTargetsDirty = true
    this.lastDesiredTileCount = -1
    this.invalidateSampleChunk()
  }

  /** Release streamed geometry and the shared near-field prop factory. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.workers.dispose()
    this.clearAll()
    this.vegFactory?.disposeShared()
    this.vegFactory = null
    this.groundMatNear.dispose()
    this.groundMatFar.dispose()
    this.waterMat.dispose()
    disposeObjectTree(this.root)
    this.root.removeFromParent()
    clearTerrainSamplers(this)
  }

  /**
   * Call every frame. Schedules needed chunks when the cell changes,
   * builds a small budget, and eases chunk/prop opacity in and out.
   */
  update(worldX: number, worldZ: number, dt = 1 / 60): void {
    if (this.disposed) return
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .1)) : 0
    const safeX = Number.isFinite(worldX) ? worldX : this.focusX
    const safeZ = Number.isFinite(worldZ) ? worldZ : this.focusZ
    this.waterClock.value += dt
    this.focusX = safeX
    this.focusZ = safeZ
    const cx = Math.floor(safeX / CHUNK_SIZE)
    const cz = Math.floor(safeZ / CHUNK_SIZE)

    const crossedStreamCell = cx !== this.lastCx || cz !== this.lastCz
    const movedForLodSquared = Number.isFinite(this.lastLodFocusX) && Number.isFinite(this.lastLodFocusZ)
      ? (safeX - this.lastLodFocusX) ** 2 + (safeZ - this.lastLodFocusZ) ** 2
      : Infinity
    if (crossedStreamCell || movedForLodSquared >= LOD_RECHECK_DISTANCE_M ** 2) {
      this.lastCx = cx
      this.lastCz = cz
      this.lastLodFocusX = safeX
      this.lastLodFocusZ = safeZ
      this.scheduleAround(cx, cz)
    }

    this.drainBuildQueue()
    this.updateFades(cx, cz, dt)
  }

  get streamingStats(): TerrainStreamingStats {
    return this.streamingStatsInto({ loaded: 0, pending: 0, inFlight: 0, ready: 0, workers: 0 })
  }

  /** Fill a caller-owned stream snapshot for debug and diagnostics hot paths. */
  streamingStatsInto(out: TerrainStreamingStats): TerrainStreamingStats {
    out.loaded = this.chunks.size
    out.pending = this.pending.length
    out.inFlight = this.workers.busy
    out.ready = this.ready.length
    out.workers = this.workers.size
    return out
  }

  /** Test/debug: current LOD and grid density for a cell. */
  chunkStats(cx: number, cz: number): {
    lod: TerrainLod
    segs: number
    vertices: number
  } | null {
    let chunk: Chunk | undefined
    // The common near-field case is an exact size-one key. Keep this debug
    // inspector allocation-free instead of spreading every resident chunk
    // into a temporary array on each probe.
    const direct = this.chunks.get(tileKey(cx, cz))
    if (direct && this.desiredTiles.has(direct.key)) {
      chunk = direct
    } else {
      for (const candidate of this.chunks.values()) {
        if (!this.desiredTiles.has(candidate.key) ||
          cx < candidate.cx || cx >= candidate.cx + candidate.size ||
          cz < candidate.cz || cz >= candidate.cz + candidate.size) continue
        // LOD replacements can overlap while fading. Prefer the smallest
        // containing tile so stats follow the active near-field surface.
        if (!chunk || candidate.size < chunk.size) chunk = candidate
      }
    }
    if (!chunk) return null
    return {
      lod: chunk.lod,
      segs: chunk.segs,
      vertices: chunk.heights.length,
    }
  }

  sampleMeshHeight(x: number, z: number): number | null {
    const chunk = this.sampledChunkAt(x, z)
    if (!chunk || chunk.heights.length !== (chunk.segs + 1) * (chunk.segs + 1)) return null
    const bed = interpolateGridHeight(
      chunk.heights,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
      CHUNK_SIZE * chunk.size,
    )
    const level = interpolateGridHeight(
      chunk.waterLevels,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
      CHUNK_SIZE * chunk.size,
    )
    return Math.max(bed, level)
  }

  sampleMeshSurface(x: number, z: number): TerrainSurface | null {
    const chunk = this.sampledChunkAt(x, z)
    if (!chunk || chunk.heights.length !== (chunk.segs + 1) * (chunk.segs + 1)) {
      return null
    }
    const bed = interpolateGridHeight(
      chunk.heights,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
      CHUNK_SIZE * chunk.size,
    )
    const level = interpolateGridHeight(
      chunk.waterLevels,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
      CHUNK_SIZE * chunk.size,
    )
    const wet = bed < level
    const climate = sampleClimate(x, z, this.surfaceClimate)
    const biome = wet ? (level <= 0 ? 'ocean' : 'water') : climate.biome
    return {
      height: Math.max(bed, level),
      kind: wet ? 'water' : 'land',
      biome,
      waterBody: wet ? waterBodyFromClimate({ biome, features: climate.features }) : undefined,
    }
  }

  /** Fill only the contact fields needed by physics and collision checks. */
  sampleMeshSurfaceInto(x: number, z: number, out: GroundSurfaceSample): boolean {
    const chunk = this.sampledChunkAt(x, z)
    if (!chunk || chunk.heights.length !== (chunk.segs + 1) * (chunk.segs + 1)) {
      return false
    }
    const bed = interpolateGridHeight(
      chunk.heights,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
      CHUNK_SIZE * chunk.size,
    )
    const level = interpolateGridHeight(
      chunk.waterLevels,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
      CHUNK_SIZE * chunk.size,
    )
    out.height = Math.max(bed, level)
    out.kind = bed < level ? 'water' : 'land'
    return true
  }

  private sampledChunkAt(x: number, z: number): Chunk | null {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    if (cx === this.sampledChunkCx && cz === this.sampledChunkCz) return this.sampledChunk
    const key = `${cx},${cz}`
    const cached = this.sampledChunkLookup.get(key)
    // `null` is a meaningful cached miss. Only `undefined` means the cell
    // has not been inspected yet, so one Map lookup handles both cases.
    if (cached !== undefined) {
      this.sampledChunkCx = cx
      this.sampledChunkCz = cz
      this.sampledChunk = cached
      return this.sampledChunk
    }
    this.sampledChunkCx = cx
    this.sampledChunkCz = cz
    this.sampledChunk = this.chunks.get(key) ?? null
    if (!this.sampledChunk) {
      // Horizon tiles are power-of-two, quadtree-aligned leaves. Probe their
      // owning keys from fine to coarse instead of scanning every resident
      // tile on the first contact query in a cell. During an LOD transition
      // both keys can be resident, so the first hit preserves the smallest
      // containing-tile preference of the old scan.
      for (let size = 2; size <= 32; size *= 2) {
        const tileCx = Math.floor(cx / size) * size
        const tileCz = Math.floor(cz / size) * size
        const candidate = this.chunks.get(tileKey(tileCx, tileCz, size))
        if (candidate) {
          this.sampledChunk = candidate
          break
        }
      }
    }
    if (this.sampledChunkLookup.size >= SAMPLE_LOOKUP_LIMIT) {
      const oldest = this.sampledChunkLookup.keys().next().value
      if (typeof oldest === 'string') this.sampledChunkLookup.delete(oldest)
    }
    this.sampledChunkLookup.set(key, this.sampledChunk)
    return this.sampledChunk
  }

  private invalidateSampleChunk(): void {
    this.sampledChunk = null
    this.sampledChunkCx = Number.NaN
    this.sampledChunkCz = Number.NaN
    this.sampledChunkLookup.clear()
  }

  private scheduleAround(cx: number, cz: number): void {
    this.fadeTargetsDirty = true
    this.readySorted = false
    const needed = this.neededKeys
    needed.clear()
    this.desiredTiles.clear()
    for (const bucket of this.desiredTileBuckets.values()) {
      bucket.length = 0
      this.desiredTileBucketPool.push(bucket)
    }
    this.desiredTileBuckets.clear()
    for (const tile of planTerrainTiles(cx + .5, cz + .5, this.viewRadius, this.plannedTiles)) {
        const { cx: kx, cz: kz, size, dist } = tile
        const key = tileKey(kx, kz, size)
        this.desiredTiles.set(key, tile)
        const rootCx = Math.floor(kx / TERRAIN_ROOT_SIZE) * TERRAIN_ROOT_SIZE
        const rootCz = Math.floor(kz / TERRAIN_ROOT_SIZE) * TERRAIN_ROOT_SIZE
        const rootKey = tileKey(rootCx, rootCz, TERRAIN_ROOT_SIZE)
        let bucket = this.desiredTileBuckets.get(rootKey)
        if (!bucket) {
          bucket = this.desiredTileBucketPool.pop() ?? []
          this.desiredTileBuckets.set(rootKey, bucket)
        }
        bucket.push(tile)
        needed.add(key)
        const existing = this.chunks.get(key)
        if (existing) {
          existing.fadingOut = false
          const lod = lodWithHysteresis(dist, existing.lod)
          const wantProps = ENABLE_VEGETATION && dist <= PROP_RADIUS + (existing.hasProps ? 1 : 0)
          const needsRebuild =
            lod !== existing.lod || wantProps !== existing.hasProps
          if (needsRebuild && !this.pendingKeys.has(key) && !this.activeKeys.has(key)) {
            this.pending.push({ cx: kx, cz: kz, size, dist, rebuild: true })
            this.pendingKeys.add(key)
            this.pendingSorted = false
          }
        } else if (!this.pendingKeys.has(key) && !this.activeKeys.has(key)) {
          this.pending.push({
            cx: kx,
            cz: kz,
            size,
            dist,
            rebuild: false,
          })
          this.pendingKeys.add(key)
          this.pendingSorted = false
        }
    }

    for (const p of this.pending) {
      p.dist = Math.hypot(p.cx + p.size / 2 - cx - .5, p.cz + p.size / 2 - cz - .5)
    }
    this.sortPending()

    // Soft unload: mark out-of-range chunks to fade, don't hard-delete
    this.replacementKeys.clear()
    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        if (!chunk.fadingOut) this.prepareChunkForFade(chunk)
        chunk.fadingOut = true
        chunk.targetAlpha = 0
        this.fadeKeys.add(key)
        // The layout only changes on cell crossings. Cache dependencies here
        // instead of scanning every desired tile for every fallback each frame.
        const replacements: string[] = []
        const minRootCx = Math.floor(chunk.cx / TERRAIN_ROOT_SIZE) * TERRAIN_ROOT_SIZE
        const maxRootCx = Math.floor((chunk.cx + chunk.size - 1) / TERRAIN_ROOT_SIZE) * TERRAIN_ROOT_SIZE
        const minRootCz = Math.floor(chunk.cz / TERRAIN_ROOT_SIZE) * TERRAIN_ROOT_SIZE
        const maxRootCz = Math.floor((chunk.cz + chunk.size - 1) / TERRAIN_ROOT_SIZE) * TERRAIN_ROOT_SIZE
        for (let rootCx = minRootCx; rootCx <= maxRootCx; rootCx += TERRAIN_ROOT_SIZE) {
          for (let rootCz = minRootCz; rootCz <= maxRootCz; rootCz += TERRAIN_ROOT_SIZE) {
            const bucket = this.desiredTileBuckets.get(tileKey(rootCx, rootCz, TERRAIN_ROOT_SIZE))
            if (!bucket) continue
            for (const next of bucket) {
              if (next.cx >= chunk.cx + chunk.size || next.cx + next.size <= chunk.cx
                || next.cz >= chunk.cz + chunk.size || next.cz + next.size <= chunk.cz) continue
              replacements.push(tileKey(next.cx, next.cz, next.size))
            }
          }
        }
        this.replacementKeys.set(key, replacements)
      }
    }

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!
      const key = tileKey(p.cx, p.cz, p.size)
      if (!needed.has(key)) {
        this.pending.splice(i, 1)
        this.pendingKeys.delete(key)
      }
    }
  }

  private sortPending(): void {
    this.pending.sort((a, b) => terrainBuildPriority(b) - terrainBuildPriority(a) || b.dist - a.dist)
    this.pendingSorted = true
  }

  private requestFor(job: PendingChunk): TerrainBuildRequest | null {
    const key = tileKey(job.cx, job.cz, job.size)
    const tile = this.desiredTiles.get(key)
    if (!tile) return null
    const existing = this.chunks.get(key)
    const lod = existing ? lodWithHysteresis(tile.dist, existing.lod) : lodFromDist(tile.dist)
    const withProps = ENABLE_VEGETATION && tile.dist <= PROP_RADIUS + (existing?.hasProps ? 1 : 0)
    if (existing && lod === existing.lod && withProps === existing.hasProps) return null
    // Worker postMessage clones this record synchronously. Reusing the staging
    // object removes one short-lived pad allocation per terrain dispatch.
    return { id: ++this.nextRequest, generation: this.generation, seed: getWorldSeed(), pad: getOpsPadInto(this.streamPadSnapshot),
      cx: job.cx, cz: job.cz, size: job.size, lod, withProps,
      skirtEdges: this.skirtEdgesForTile(job.cx, job.cz, job.size, lod) }
  }

  private install(job: TerrainBuildRequest, data: TerrainGeometryData): void {
    const key = tileKey(job.cx, job.cz, job.size)
    this.activeKeys.delete(key)
    if (job.generation !== this.generation || !this.desiredTiles.has(key)) return
    const tile = this.desiredTiles.get(key)!
    const previous = this.chunks.get(key)
    const lod = previous ? lodWithHysteresis(tile.dist, previous.lod) : lodFromDist(tile.dist)
    const withProps = ENABLE_VEGETATION && tile.dist <= PROP_RADIUS + (previous?.hasProps ? 1 : 0)
    if (previous && lod === previous.lod && withProps === previous.hasProps) return
    if (lod !== job.lod || withProps !== job.withProps) {
      const tile = this.desiredTiles.get(key)!
      this.pending.push({ ...tile, rebuild: this.chunks.has(key) })
      this.pendingKeys.add(key)
      this.pendingSorted = false
      this.sortPending()
      return
    }
    const existing = this.chunks.get(key)
    const chunk = this.buildChunk(job, data)
    if (existing) {
      // Keep the previous surface until its replacement has faded fully in.
      if (existing.props) existing.props.visible = false
      this.prepareChunkForFade(existing)
      this.retiring.push(existing)
      this.offsetFallback(existing)
    }
    this.chunks.set(key, chunk)
    this.fadeKeys.add(key)
    this.invalidateSampleChunk()
    invalidateGroundSamplerCaches()
  }

  private drainBuildQueue(): void {
    const deadline = performance.now() + this.uploadBudgetMs
    let uploads = 0
    // Completion order varies between workers; uploads follow current proximity.
    // Sort farthest-first so pop() removes the nearest result without shifting
    // every remaining ready item on each upload.
    if (this.ready.length > 1 && !this.readySorted) {
      for (const result of this.ready) {
        const key = result.key ?? tileKey(result.job.cx, result.job.cz, result.job.size)
        result.key = key
        result.dist = this.desiredTiles.get(key)?.dist ?? Infinity
      }
      this.ready.sort((a, b) => (b.dist ?? Infinity) - (a.dist ?? Infinity))
      this.readySorted = true
    }
    while (this.ready.length && uploads < this.maxUploadsPerFrame &&
      (uploads === 0 || performance.now() < deadline)) {
      const result = this.ready.pop()!
      this.install(result.job, result.data)
      uploads++
    }
    this.dispatchWorkers()
    if (this.workers.size > 0) return
    // Unsupported/failed workers retain deterministic streaming with a strict
    // inter-build deadline. Browser workers are the normal generation path.
    while (this.pending.length && uploads < this.maxUploadsPerFrame &&
      (uploads === 0 || performance.now() < deadline)) {
      const pending = this.pending.pop()!
      this.pendingKeys.delete(tileKey(pending.cx, pending.cz, pending.size))
      const job = this.requestFor(pending)
      if (!job) continue
      const quality = pending.dist > 8 ? 'fallback' : 'full'
      this.install(job, generateTerrainGeometry(job.cx * CHUNK_SIZE, job.cz * CHUNK_SIZE,
        job.lod, job.size, job.skirtEdges, quality))
      uploads++
    }
  }

  private dispatchWorkers(): void {
    // Never queue more than one request per worker. Fast turns reprioritize all
    // unstarted work on the next cell crossing rather than draining an old FIFO.
    if (this.pending.length > 1 && !this.pendingSorted) this.sortPending()
    while (this.pending.length && this.workers.available && this.ready.length < this.maxUploadsPerFrame) {
      const pending = this.pending.pop()!
      const key = tileKey(pending.cx, pending.cz, pending.size)
      this.pendingKeys.delete(key)
      const job = this.requestFor(pending)
      if (!job) continue
      this.activeKeys.add(key)
      if (!this.workers.submit(job)) {
        this.activeKeys.delete(key)
        // A synchronous worker failure already routes every in-flight job,
        // including this one, through the pool retry callback. Re-adding it
        // here would duplicate the fallback queue entry. A false return with
        // surviving workers still means the slot was unavailable, so retain
        // the old local requeue path for that case.
        if (this.workers.size > 0) {
          this.pending.push(pending)
          this.pendingKeys.add(key)
          this.pendingSorted = false
        }
        break
      }
    }
  }

  private offsetFallback(chunk: Chunk): void {
    for (const mesh of chunk.root.children) {
      if (!(mesh instanceof Mesh)) continue
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        material.polygonOffset = true
        material.polygonOffsetFactor = 2
        material.polygonOffsetUnits = 2
      }
    }
  }

  /**
   * Fade new coverage in and keep fallback geometry through the transition.
   * Settled tiles skip material updates.
   */
  private updateFades(_pcx: number, _pcz: number, dt: number): void {
    const fadeK = 1 - Math.exp(-dt * 6)
    const toRemove = this.fadeRemovals
    toRemove.length = 0
    const refreshTargets = this.fadeTargetsDirty
    this.fadeTargetsDirty = false
    const desiredTileCountChanged = this.lastDesiredTileCount !== this.desiredTiles.size
    this.lastDesiredTileCount = this.desiredTiles.size
    if (refreshTargets) {
      // A focus move changes distance fade targets for every resident tile.
      // Mark the set once, then settle opaque far chunks back out of the
      // per-frame path as soon as their target is stable.
      for (const chunk of this.chunks.values()) this.fadeKeys.add(chunk.key)
    } else if (desiredTileCountChanged) {
      // Keep the lifecycle robust if a caller invalidates a desired tile
      // between stream schedules, such as a failed replacement or teardown.
      for (const chunk of this.chunks.values()) {
        if (!this.desiredTiles.has(chunk.key)) this.fadeKeys.add(chunk.key)
      }
    }

    for (const key of this.fadeKeys) {
      const chunk = this.chunks.get(key)
      if (!chunk) {
        this.fadeKeys.delete(key)
        continue
      }
      this.fadeProps(chunk)
      // Keep old coverage until every replacement leaf has finished building.
      // This handles both splitting a distant tile and merging near tiles.
      if (chunk.fadingOut) {
        const replacements = this.replacementKeys.get(key)
        let waiting = false
        if (replacements) {
          // Avoid a per-frame callback allocation for every retiring tile.
          for (const nextKey of replacements) {
            if ((this.chunks.get(nextKey)?.fadeAge ?? 0) < FADE_SECONDS) {
              waiting = true
              break
            }
          }
        }
        if (waiting) { this.offsetFallback(chunk); continue }
        // Replacement coverage has completed its fade; retire the old surface.
        if (replacements?.length) {
          toRemove.push(key)
          continue
        }
        chunk.alpha *= 1 - fadeK
        this.applyChunkAlpha(chunk)
        if (chunk.alpha <= .01) toRemove.push(key)
        continue
      }
      chunk.fadeAge += dt
      if (!chunk.fadingOut && (refreshTargets || !chunk.settled)) {
        const cellDist = tileDistance(chunk.cx, chunk.cz, chunk.size, this.focusX / CHUNK_SIZE, this.focusZ / CHUNK_SIZE)
        chunk.targetAlpha = terrainFadeTargetAlpha(cellDist, this.viewRadius)
      } else if (chunk.fadingOut) {
        chunk.targetAlpha = 0
      }

      // Already stable fully opaque — no per-frame material work
      if (
        !chunk.fadingOut &&
        chunk.alpha >= 0.995 &&
        chunk.targetAlpha >= 0.995 &&
        chunk.appliedAlpha >= 0.995
      ) {
        this.settleChunk(chunk)
        continue
      }

      if (chunk.settled && chunk.targetAlpha < 0.995) this.prepareChunkForFade(chunk)

      chunk.alpha = MathUtils.smoothstep(chunk.fadeAge, 0, FADE_SECONDS) * chunk.targetAlpha
      if (Math.abs(chunk.alpha - chunk.targetAlpha) < 0.008) {
        chunk.alpha = chunk.targetAlpha
      }

      if (Math.abs(chunk.alpha - chunk.appliedAlpha) > 0.004) {
        this.applyChunkAlpha(chunk)
      }

      if (
        !chunk.fadingOut &&
        chunk.alpha >= 0.995 &&
        chunk.targetAlpha >= 0.995 &&
        chunk.appliedAlpha >= 0.995
      ) {
        this.settleChunk(chunk)
      }

      if (chunk.fadingOut && chunk.alpha <= 0.01) {
        toRemove.push(key)
      }
    }

    // Every retiring chunk invalidates the same bounded contact lookup. Track
    // whether this pass actually disposes anything, then clear it once for
    // the batch instead of once per disposed tile or once per waiting frame.
    let retiredAny = false
    let retiringIndex = this.retiring.length - 1
    while (retiringIndex >= 0) {
      const i = retiringIndex
      const old = this.retiring[i]!
      const replacement = this.chunks.get(old.key)
      if (replacement && replacement.fadeAge < FADE_SECONDS && this.desiredTiles.has(old.key)) {
        retiringIndex--
        continue
      }
      // The lookup can retain this chunk for a different streamed cell even
      // when the last queried cell points elsewhere. The batch invalidation
      // below runs before the next contact solve, so dead LOD data cannot be
      // resurrected after this geometry is released.
      old.root.removeFromParent()
      this.disposeChunk(old)
      retiredAny = true
      // Retiring chunks are walked backwards, so swap-pop avoids shifting the
      // remaining fade records. Keep the index on a swapped-in record so a
      // mixed waiting/disposable batch cannot skip cleanup until a later frame.
      const last = this.retiring.pop()
      if (last && i < this.retiring.length) this.retiring[i] = last
      if (i >= this.retiring.length) retiringIndex--
    }
    if (retiredAny) this.invalidateSampleChunk()

    // The removal batch shares one sampler invalidation for the same reason
    // as the retiring batch above.
    let removedAny = false
    for (const key of toRemove) {
      const chunk = this.chunks.get(key)
      if (!chunk) continue
      // A removed chunk may still be referenced by a cached coarse-cell key.
      this.root.remove(chunk.root)
      this.disposeChunk(chunk)
      this.chunks.delete(key)
      this.replacementKeys.delete(key)
      this.fadeKeys.delete(key)
      removedAny = true
    }
    if (removedAny) this.invalidateSampleChunk()
  }

  private applyChunkAlpha(chunk: Chunk): void {
    const a = MathUtils.clamp(chunk.alpha, 0, 1)
    chunk.appliedAlpha = a
    chunk.root.visible = a > 0.005
    if (!chunk.root.visible) return

    for (const material of chunk.materials) material.opacity = a
    const props = chunk.props
    if (props) props.userData.alpha = -1
    this.fadeProps(chunk)
  }

  /** Props fade on actual distance, independently of their opaque ground. */
  private fadeProps(chunk: Chunk): void {
    const props = chunk.props
    if (!props) return
    const distance = Math.hypot(
      chunk.originX + CHUNK_SIZE / 2 - this.focusX,
      chunk.originZ + CHUNK_SIZE / 2 - this.focusZ,
    ) / CHUNK_SIZE
    const alpha = chunk.alpha * (1 - MathUtils.smoothstep(distance, 2, PROP_RADIUS + .7))
    props.visible = alpha > .01
    if (Math.abs((props.userData.alpha ?? -1) - alpha) < .02) return
    props.userData.alpha = alpha
    for (const obj of chunk.propMeshes) {
      if (Array.isArray(obj.material)) {
        for (const material of obj.material) {
          material.opacity = alpha
          material.transparent = false
          if (!material.alphaHash) {
            material.alphaHash = true
            material.needsUpdate = true
          }
          material.depthWrite = true
        }
      } else {
        const material = obj.material
        material.opacity = alpha
        material.transparent = false
        if (!material.alphaHash) {
          material.alphaHash = true
          material.needsUpdate = true
        }
        material.depthWrite = true
      }
    }
  }

  private collectPropMeshes(props: Group): Mesh[] {
    const meshes: Mesh[] = []
    props.traverse(obj => {
      if (obj instanceof Mesh) meshes.push(obj)
    })
    return meshes
  }

  /** Only cover edges where this tile is the coarse side of a LOD boundary. */
  private skirtEdgesForTile(
    cx: number,
    cz: number,
    size: number,
    lod: TerrainLod,
  ): readonly [boolean, boolean, boolean, boolean] {
    // Terrain leaves are power-of-two quadtree tiles. Query only the aligned
    // leaves that can touch this edge instead of walking every desired tile
    // four times during a stream refresh. The largest tile checks 63 keys per
    // edge, while the previous map scan scaled with the whole horizon.
    const finerAt = (edge: 'north' | 'east' | 'south' | 'west'): boolean => {
      for (let neighborSize = 1; neighborSize <= size; neighborSize *= 2) {
        for (let offset = 0; offset < size; offset += neighborSize) {
          let neighborCx = cx + offset
          let neighborCz = cz + offset
          if (edge === 'north') {
            neighborCx = cx + offset
            neighborCz = cz - neighborSize
          } else if (edge === 'east') {
            neighborCx = cx + size
            neighborCz = cz + offset
          } else if (edge === 'south') {
            neighborCx = cx + offset
            neighborCz = cz + size
          } else {
            neighborCx = cx - neighborSize
            neighborCz = cz + offset
          }
          const tile = this.desiredTiles.get(tileKey(neighborCx, neighborCz, neighborSize))
          if (!tile) continue
          const neighborLod = lodFromDist(tile.dist)
          if (tile.size < size || (tile.size === size && neighborLod < lod)) return true
        }
      }
      return false
    }
    return [finerAt('north'), finerAt('east'), finerAt('south'), finerAt('west')]
  }

  private buildChunk(job: TerrainBuildRequest, data: TerrainGeometryData): Chunk {
    const { cx, cz, size, lod, withProps } = job
    const root = new Group()
    root.name = `chunk_${cx}_${cz}`
    const originX = cx * CHUNK_SIZE
    const originZ = cz * CHUNK_SIZE
    const mesh = new Mesh(deserializeTerrainGeometry(data.ground), lod === 0 ? this.groundMatNear : this.groundMatFar)
    mesh.name = 'TerrainChunk'
    mesh.position.set(originX + CHUNK_SIZE * size / 2, 0, originZ + CHUNK_SIZE * size / 2)
    mesh.receiveShadow = lod === 0
    root.add(mesh)
    let water: Mesh | null = null
    if (data.water) {
      water = new Mesh(deserializeTerrainGeometry(data.water), makeWaterMaterial(this.waterClock,
        { rain: this.waterRain, snow: this.waterSnow, windX: this.waterWindX, windZ: this.waterWindZ },
        -2,
        this.waterDetailScale))
      water.name = 'WaterSurface'
      water.position.copy(mesh.position)
      root.add(water)
    }
    const props = withProps ? this.buildProps(originX, originZ, cx, cz, data.heights, data.segs) : null
    if (props) { props.name = 'TerrainProps'; root.add(props) }
    this.stampChunkMeshes(root, 0)
    // Once a tile is opaque, skip fragment hash work without a shader recompile.
    for (const child of root.children) {
      if (!(child instanceof Mesh)) continue
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        if (!material.alphaHash) continue
        const configure = material.onBeforeCompile
        const cacheKey = material.customProgramCacheKey()
        material.onBeforeCompile = (shader: Parameters<MeshStandardMaterial['onBeforeCompile']>[0],
          renderer: Parameters<MeshStandardMaterial['onBeforeCompile']>[1]) => {
          configure.call(material, shader, renderer)
          shader.fragmentShader = shader.fragmentShader.replace('#include <alphahash_fragment>',
            'if (diffuseColor.a < 1.0) {\n#include <alphahash_fragment>\n}')
        }
        material.customProgramCacheKey = () => `${cacheKey}-stream-fade-v1`
      }
    }
    root.matrixAutoUpdate = false
    root.updateMatrix()
    root.updateMatrixWorld(true)
    this.root.add(root)
    const chunk: Chunk = {
      key: tileKey(cx, cz, size), size, waterLevels: data.waterLevels,
      cx, cz, root, lod, segs: data.segs, hasProps: withProps, originX, originZ,
      heights: data.heights, alpha: 0, fadeAge: 0, targetAlpha: 1, fadingOut: false, appliedAlpha: -1,
      props, propMeshes: props ? this.collectPropMeshes(props) : [], terrainMesh: mesh, waterMesh: water, settled: false,
      materials: root.children.flatMap(child => child instanceof Mesh
        ? (Array.isArray(child.material) ? child.material : [child.material])
          .filter((material): material is MeshStandardMaterial => material instanceof MeshStandardMaterial)
        : []),
    }
    this.applyChunkAlpha(chunk)
    return chunk
  }

  /** Replace private fade materials with shared opaque variants once a tile is stable. */
  private settleChunk(chunk: Chunk): void {
    if (chunk.settled || chunk.fadingOut) {
      // Retiring fallbacks use the replacement's fade age as their disposal
      // fence. Keep one short tail in the active set so that fence advances
      // even after the replacement has become visually opaque.
      if (chunk.settled && !chunk.props && chunk.fadeAge >= FADE_SECONDS && this.desiredTiles.has(chunk.key)) {
        this.fadeKeys.delete(chunk.key)
      }
      return
    }
    const previous = chunk.materials
    chunk.terrainMesh.material = chunk.lod === 0 ? this.groundMatNear : this.groundMatFar
    if (chunk.waterMesh) chunk.waterMesh.material = this.waterMat
    for (const material of previous) {
      if (material !== this.groundMatNear && material !== this.groundMatFar && material !== this.waterMat) {
        material.dispose()
      }
    }
    chunk.materials = [chunk.terrainMesh.material as MeshStandardMaterial]
    if (chunk.waterMesh) chunk.materials.push(this.waterMat)
    chunk.settled = true
    if (!chunk.props && chunk.fadeAge >= FADE_SECONDS && this.desiredTiles.has(chunk.key)) {
      this.fadeKeys.delete(chunk.key)
    }
  }

  /** Rehydrate unique fade materials before a settled tile changes opacity or is retired. */
  private prepareChunkForFade(chunk: Chunk): void {
    this.fadeKeys.add(chunk.key)
    if (!chunk.settled) return
    const clone = (source: MeshStandardMaterial): MeshStandardMaterial => {
      const material = source.clone()
      // Ground and water are broad opaque surfaces. Alpha-hash dithering on
      // them reads as white/black static during every streamed fade, while a
      // short smooth blend is both cleaner and cheaper for the GPU.
      material.transparent = true
      material.alphaHash = false
      material.opacity = MathUtils.clamp(chunk.alpha, 0, 1)
      material.depthWrite = false
      return material
    }
    const terrainMaterial = clone(chunk.lod === 0 ? this.groundMatNear : this.groundMatFar)
    chunk.terrainMesh.material = terrainMaterial
    const materials: MeshStandardMaterial[] = [terrainMaterial]
    if (chunk.waterMesh) {
      const waterMaterial = clone(this.waterMat)
      chunk.waterMesh.material = waterMaterial
      materials.push(waterMaterial)
    }
    chunk.materials = materials
    chunk.settled = false
  }

  private stampChunkMeshes(root: Group | Mesh, opacity: number): void {
    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      if (obj.name === 'WaterSurface') {
        obj.material.opacity = opacity
        obj.material.transparent = true
        obj.material.alphaHash = false
        obj.material.depthWrite = false
        obj.matrixAutoUpdate = false
        obj.updateMatrix()
        return
      }
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => {
          const c = m.clone()
          c.transparent = false
        c.alphaHash = true
          c.opacity = opacity
          if (c instanceof MeshStandardMaterial) {
            c.depthWrite = true
          }
          return c
        })
      } else {
        const c = obj.material.clone()
        const smoothGroundFade = obj.name === 'TerrainChunk'
        c.transparent = smoothGroundFade
        c.alphaHash = !smoothGroundFade
        c.opacity = opacity
        if (c instanceof MeshStandardMaterial) {
          c.depthWrite = !smoothGroundFade
          if (obj.name === 'TerrainChunk') this.configureWeatherMaterial(c)
        }
        obj.material = c
      }
      obj.matrixAutoUpdate = false
      obj.updateMatrix()
    })
  }

  private buildProps(
    originX: number, originZ: number, cx: number, cz: number,
    heights: Float32Array, segs: number,
  ): Group {
    this.vegFactory ??= createVegetationFactory(this.waterClock)
    this.vegFactory.setWeather(this.weatherRain.value, this.weatherSnow.value,
      this.weatherWind.x, this.weatherWind.y)
    const veg = this.vegFactory.createBuckets()
    const samples = 72

    for (let i = 0; i < samples; i++) {
      const u = hash2(cx * 31 + i, cz * 17 + i * 3)
      const v = hash2(cz * 13 + i * 7, cx * 19 - i)
      const wx = originX + u * CHUNK_SIZE
      const wz = originZ + v * CHUNK_SIZE
      // The runway can be anywhere in any seed.
      if (opsPadBlend(wx, wz) > .01) continue

      const climate = sampleClimateInto(this.propsClimate, wx, wz)
      const h = interpolateGridHeight(heights, segs, originX, originZ, wx, wz)
      const f = climate.features
      if (climate.biome === 'ocean' || climate.biome === 'runway') continue
      if (climate.biome === 'water') continue
      const hx = interpolateGridHeight(heights, segs, originX, originZ, wx + 3, wz)
      const hz = interpolateGridHeight(heights, segs, originX, originZ, wx, wz + 3)
      if (Math.hypot(hx - h, hz - h) / 3 > .65) continue
      if (f.river > 0.82) continue
      if (f.ravine > 0.55) continue

      const density = vegetationDensity(climate.biome, climate.moisture, f)
      const cluster = vegetationClusterFactor(wx, wz)
      if (hash2(i + cx, cz - i) > Math.min(1, density * cluster)) continue

      const nearWater =
        f.lake > 0.35 ||
        f.pond > 0.5 ||
        (f.river > 0.25 && f.river < 0.75) ||
        f.stream > 0.5

      veg.place(climate.biome, wx, h, wz, i * 97 + cx * 13 + cz, nearWater)
    }

    veg.finalize()
    this.applyVegetationScale(veg.group)
    return veg.group
  }

  private applyVegetationScale(props: Group | null): void {
    if (!props) return
    props.traverse(obj => {
      if (!(obj instanceof InstancedMesh)) return
      const fullCount = obj.userData.fullCount
      if (!Number.isFinite(fullCount)) return
      obj.count = vegetationInstanceCount(fullCount, this.vegetationScale)
      // A zero draw range still costs a renderer submission. Hide empty
      // batches while retaining their authored matrices for instant quality
      // changes back to a denser preset.
      obj.visible = obj.count > 0
    })
  }

  private disposeChunk(chunk: Chunk): void {
    chunk.root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      if (obj instanceof InstancedMesh) obj.dispose()
      // Terrain geometry is unique; vegetation geos are factory-shared — don't dispose those
      if (obj.name === 'TerrainChunk' || obj.name === 'WaterSurface') {
        obj.geometry.dispose()
      }
      // Materials were cloned per chunk for fade — free them
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        if (m === this.groundMatNear || m === this.groundMatFar || m === this.waterMat) continue
        if (this.vegFactory?.isSharedMaterial(m)) continue
        m.dispose()
      }
    })
    chunk.root.clear()
  }
}
