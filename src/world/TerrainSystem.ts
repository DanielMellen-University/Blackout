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
  terrainSurfaceFromClimate,
  opsPadBlend,
  getOpsPad,
  type TerrainSurface,
} from './terrainSample'
import { createVegetationFactory, vegetationDensity, vegetationInstanceCount } from './vegetation'
import {
  setContactHeightSampler,
  setGroundHeightSampler,
  setGroundSurfaceSampler,
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
import { planTerrainTiles, terrainBuildPriority, tileKey, tileDistance } from './TerrainLayout'
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
const UPLOAD_BUDGET_MS = 2
const MAX_UPLOADS_PER_FRAME = 16
export const STREAM_RADIUS_M = VIEW_RADIUS * CHUNK_SIZE
/**
 * Fog fully opaque at this range, eight chunks inside the stream edge
 * (VIEW_RADIUS - FOG_MARGIN) * CHUNK_SIZE.
 */
export const FOG_FAR = (VIEW_RADIUS - FOG_MARGIN_CHUNKS) * CHUNK_SIZE
/** Clear air near the jet; linear fog ramps out to FOG_FAR. */
export const FOG_NEAR = Math.round(FOG_FAR * 0.34)

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
): number {
  const stride = segs + 1
  const u = ((x - originX) / CHUNK_SIZE) * segs
  const v = ((z - originZ) / CHUNK_SIZE) * segs
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
  materials: MeshStandardMaterial[]
}

interface PendingChunk {
  size: number
  cx: number
  cz: number
  dist: number
  rebuild: boolean
}

/**
 * Infinite streaming terrain with amortized chunk generation.
 */
export class TerrainSystem {
  readonly root = new Group()
  private readonly chunks = new Map<string, Chunk>()
  private readonly pending: PendingChunk[] = []
  private readonly pendingKeys = new Set<string>()
  private readonly ready: { job: TerrainBuildRequest; data: TerrainGeometryData }[] = []
  private readonly activeKeys = new Set<string>()
  private readonly retiring: Chunk[] = []
  /** Reused fade-removal list keeps the per-frame stream path allocation-free. */
  private readonly fadeRemovals: string[] = []
  private generation = 0
  private nextRequest = 0
  private disposed = false
  private readonly workers: TerrainWorkerPool
  private desiredTiles = new Map<string, { cx: number; cz: number; size: number; dist: number }>()
  private readonly replacementKeys = new Map<string, string[]>()
  private readonly scene: Scene
  private lastCx = Number.NaN
  private lastCz = Number.NaN
  private focusX = 0
  private focusZ = 0
  private readonly waterClock = { value: 0 }
  private readonly waterRain = { value: 0 }
  private readonly waterSnow = { value: 0 }
  private readonly waterWindX = { value: 0 }
  private readonly waterWindZ = { value: 0 }

  /** Near tiles: double-sided so steep cliffs don't punch holes. */
  private readonly groundMatNear: MeshStandardMaterial
  /** Mid/far tiles: single-sided (half the fill rate). */
  private readonly groundMatFar: MeshStandardMaterial
  private readonly weatherRain = { value: 0 }
  private readonly weatherSnow = { value: 0 }
  private readonly weatherClouds = { value: 0 }
  private readonly weatherWind = new Vector2()
  private vegFactory: ReturnType<typeof createVegetationFactory> | null = null
  private vegetationScale = 1

  constructor(scene: Scene) {
    this.scene = scene
    this.workers = new TerrainWorkerPool((job, data) => {
      if (this.disposed || job.generation !== this.generation) return
      this.ready.push({ job, data })
      this.dispatchWorkers()
    }, job => {
      if (this.disposed || job.generation !== this.generation) return
      const key = tileKey(job.cx, job.cz, job.size)
      this.activeKeys.delete(key)
      const tile = this.desiredTiles.get(key)
      if (tile && !this.pendingKeys.has(key) && !this.activeKeys.has(key)) {
        this.pending.push({ ...tile, rebuild: this.chunks.has(key) })
        this.pendingKeys.add(key)
        this.sortPending()
      }
    })
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
    this.configureWeatherMaterial(this.groundMatNear)
    this.configureWeatherMaterial(this.groundMatFar)
    this.applyFog()
    setContactHeightSampler((x, z) => this.sampleMeshSurface(x, z))
    setGroundHeightSampler((x, z) => this.sampleMeshHeight(x, z))
    setGroundSurfaceSampler((x, z, out) => this.sampleMeshSurfaceInto(x, z, out))
  }

  /** Update visual weather response without rebuilding streamed terrain. */
  setWeatherEffects(rain: number, snow: number, windX = 0, windZ = 0, cloudCover = 0): void {
    this.weatherRain.value = MathUtils.clamp(rain, 0, 1)
    this.weatherSnow.value = MathUtils.clamp(snow, 0, 1)
    this.weatherClouds.value = MathUtils.clamp(cloudCover, 0, 1)
    this.weatherWind.set(windX, windZ)
    this.waterRain.value = this.weatherRain.value
    this.waterSnow.value = this.weatherSnow.value
    this.waterWindX.value = windX
    this.waterWindZ.value = windZ
    this.vegFactory?.setWeather(this.weatherRain.value, this.weatherSnow.value, windX, windZ)
  }

  get weatherEffects(): { rain: number; snow: number } {
    return { rain: this.weatherRain.value, snow: this.weatherSnow.value }
  }

  /** Scale near-field vegetation batches without rebuilding terrain geometry. */
  setVegetationScale(scale: number): void {
    const safe = Number.isFinite(scale) ? MathUtils.clamp(scale, 0, 1) : 1
    if (safe === this.vegetationScale) return
    this.vegetationScale = safe
    for (const chunk of this.chunks.values()) this.applyVegetationScale(chunk.props)
  }

  private configureWeatherMaterial(material: MeshStandardMaterial): void {
    material.onBeforeCompile = shader => {
      shader.uniforms.terrainRain = this.weatherRain
      shader.uniforms.terrainSnow = this.weatherSnow
      shader.uniforms.terrainClouds = this.weatherClouds
      shader.uniforms.terrainTime = this.waterClock
      shader.uniforms.terrainWind = { value: this.weatherWind }
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying float terrainHeight;\nvarying vec3 terrainWorld;\n',
      ).replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nterrainHeight = transformed.y;\nterrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n',
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nuniform float terrainRain;\nuniform float terrainSnow;\nuniform float terrainClouds;\nuniform float terrainTime;\nuniform vec2 terrainWind;\nvarying float terrainHeight;\nvarying vec3 terrainWorld;\n',
      ).replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        // Normal is initialized by normal_fragment_begin immediately before
        // this hook. Applying weather after that chunk avoids reading an
        // undefined normal during color_fragment on Three.js 0.185+.
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
        float windLength = max(length(terrainWind), .001);
        vec2 windDir = terrainWind / windLength;
        float windExposure = .5 + .5 * dot(normal.xz, windDir);
        snowCover *= .84 + windExposure * .16;
        // Low-frequency moving bands fake soft cloud shadows without adding
        // a light, shadow map, or terrain draw. The field is world-space, so
        // adjacent streamed tiles share one continuous shadow pattern.
        vec2 cloudDrift = terrainWind * terrainTime * .018;
        float cloudBandA = .5 + .5 * sin((terrainWorld.x + cloudDrift.x * 900.0) / 1700.0 +
          sin((terrainWorld.z + cloudDrift.y * 900.0) / 2300.0) * 1.2);
        float cloudBandB = .5 + .5 * sin((terrainWorld.z + cloudDrift.y * 900.0) / 3200.0 -
          sin((terrainWorld.x + cloudDrift.x * 900.0) / 2100.0) * .8);
        float cloudShadow = smoothstep(.34, .78, cloudBandA * .62 + cloudBandB * .38);
        diffuseColor.rgb *= 1.0 - terrainClouds * cloudShadow * .12;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.83, 0.91), snowCover);`,
      )
    }
    material.customProgramCacheKey = () => 'terrain-weather-v5'
  }

  applyFog(near = FOG_NEAR, far = FOG_FAR): void {
    const fogColor = 0x8eabc4
    this.scene.background = new Color(fogColor)
    this.scene.fog = new Fog(fogColor, near, far)
  }

  clearAll(): void {
    this.generation++
    this.ready.length = 0
    this.activeKeys.clear()
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
    this.desiredTiles.clear()
    this.replacementKeys.clear()
    this.lastCx = Number.NaN
    this.lastCz = Number.NaN
  }

  /** Release streamed geometry and the shared near-field prop factory. */
  dispose(): void {
    this.disposed = true
    this.workers.dispose()
    this.clearAll()
    this.vegFactory?.disposeShared()
    this.vegFactory = null
    this.groundMatNear.dispose()
    this.groundMatFar.dispose()
    disposeObjectTree(this.root)
    this.root.removeFromParent()
    setContactHeightSampler(null)
  }

  /**
   * Call every frame. Schedules needed chunks when the cell changes,
   * builds a small budget, and eases chunk/prop opacity in and out.
   */
  update(worldX: number, worldZ: number, dt = 1 / 60): void {
    if (this.disposed) return
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .1)) : 0
    this.waterClock.value += dt
    this.focusX = worldX
    this.focusZ = worldZ
    const cx = Math.floor(worldX / CHUNK_SIZE)
    const cz = Math.floor(worldZ / CHUNK_SIZE)

    if (cx !== this.lastCx || cz !== this.lastCz) {
      this.lastCx = cx
      this.lastCz = cz
      this.scheduleAround(cx, cz)
    }

    this.drainBuildQueue()
    this.updateFades(cx, cz, dt)
  }

  get streamingStats(): { loaded: number; pending: number; inFlight: number; ready: number; workers: number } {
    return { loaded: this.chunks.size, pending: this.pending.length,
      inFlight: this.workers.busy, ready: this.ready.length, workers: this.workers.size }
  }

  /** Test/debug: current LOD and grid density for a cell. */
  chunkStats(cx: number, cz: number): {
    lod: TerrainLod
    segs: number
    vertices: number
  } | null {
    const chunk = [...this.chunks.values()].find(c => this.desiredTiles.has(c.key)
      && cx >= c.cx && cx < c.cx + c.size && cz >= c.cz && cz < c.cz + c.size)
    if (!chunk) return null
    return {
      lod: chunk.lod,
      segs: chunk.segs,
      vertices: chunk.heights.length,
    }
  }

  sampleMeshHeight(x: number, z: number): number | null {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const chunk = this.chunks.get(`${cx},${cz}`)
    if (!chunk || chunk.heights.length !== (chunk.segs + 1) * (chunk.segs + 1)) return null
    const bed = interpolateGridHeight(
      chunk.heights,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
    )
    const level = interpolateGridHeight(
      chunk.waterLevels,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
    )
    return Math.max(bed, level)
  }

  sampleMeshSurface(x: number, z: number): TerrainSurface | null {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const chunk = this.chunks.get(`${cx},${cz}`)
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
    )
    const level = interpolateGridHeight(chunk.waterLevels, chunk.segs, chunk.originX, chunk.originZ, x, z)
    const wet = bed < level
    return {
      height: Math.max(bed, level), kind: wet ? 'water' : 'land',
      biome: wet ? (level <= 0 ? 'ocean' : 'water') : sampleClimate(x, z).biome,
    }
  }

  /** Fill only the contact fields needed by physics and collision checks. */
  sampleMeshSurfaceInto(x: number, z: number, out: GroundSurfaceSample): boolean {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cz = Math.floor(z / CHUNK_SIZE)
    const chunk = this.chunks.get(`${cx},${cz}`)
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
    )
    const level = interpolateGridHeight(
      chunk.waterLevels,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
    )
    out.height = Math.max(bed, level)
    out.kind = bed < level ? 'water' : 'land'
    return true
  }

  private scheduleAround(cx: number, cz: number): void {
    const needed = new Set<string>()
    this.desiredTiles.clear()
    for (const tile of planTerrainTiles(cx + .5, cz + .5, VIEW_RADIUS)) {
        const { cx: kx, cz: kz, size, dist } = tile
        const key = tileKey(kx, kz, size)
        this.desiredTiles.set(key, tile)
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
        chunk.fadingOut = true
        chunk.targetAlpha = 0
        // The layout only changes on cell crossings. Cache dependencies here
        // instead of scanning every desired tile for every fallback each frame.
        const replacements: string[] = []
        for (const [nextKey, next] of this.desiredTiles) {
          if (next.cx >= chunk.cx + chunk.size || next.cx + next.size <= chunk.cx
            || next.cz >= chunk.cz + chunk.size || next.cz + next.size <= chunk.cz) continue
          replacements.push(nextKey)
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
    this.pending.sort((a, b) => terrainBuildPriority(a) - terrainBuildPriority(b) || a.dist - b.dist)
  }

  private requestFor(job: PendingChunk): TerrainBuildRequest | null {
    const key = tileKey(job.cx, job.cz, job.size)
    const tile = this.desiredTiles.get(key)
    if (!tile) return null
    const existing = this.chunks.get(key)
    const lod = existing ? lodWithHysteresis(tile.dist, existing.lod) : lodFromDist(tile.dist)
    const withProps = ENABLE_VEGETATION && tile.dist <= PROP_RADIUS + (existing?.hasProps ? 1 : 0)
    if (existing && lod === existing.lod && withProps === existing.hasProps) return null
    return { id: ++this.nextRequest, generation: this.generation, seed: getWorldSeed(), pad: getOpsPad(),
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
      this.sortPending()
      return
    }
    const existing = this.chunks.get(key)
    const chunk = this.buildChunk(job, data)
    if (existing) {
      // Keep the previous surface until its replacement has faded fully in.
      if (existing.props) existing.props.visible = false
      this.retiring.push(existing)
      this.offsetFallback(existing)
    }
    this.chunks.set(key, chunk)
  }

  private drainBuildQueue(): void {
    const deadline = performance.now() + UPLOAD_BUDGET_MS
    let uploads = 0
    // Completion order varies between workers; uploads follow current proximity.
    this.ready.sort((a, b) => {
      const aDistance = this.desiredTiles.get(tileKey(a.job.cx, a.job.cz, a.job.size))?.dist ?? Infinity
      const bDistance = this.desiredTiles.get(tileKey(b.job.cx, b.job.cz, b.job.size))?.dist ?? Infinity
      return aDistance - bDistance
    })
    while (this.ready.length && uploads < MAX_UPLOADS_PER_FRAME &&
      (uploads === 0 || performance.now() < deadline)) {
      const result = this.ready.shift()!
      this.install(result.job, result.data)
      uploads++
    }
    this.dispatchWorkers()
    if (this.workers.size > 0) return
    // Unsupported/failed workers retain deterministic streaming with a strict
    // inter-build deadline. Browser workers are the normal generation path.
    while (this.pending.length && uploads < MAX_UPLOADS_PER_FRAME &&
      (uploads === 0 || performance.now() < deadline)) {
      const pending = this.pending.shift()!
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
    while (this.pending.length && this.workers.available && this.ready.length < MAX_UPLOADS_PER_FRAME) {
      const pending = this.pending.shift()!
      const key = tileKey(pending.cx, pending.cz, pending.size)
      this.pendingKeys.delete(key)
      const job = this.requestFor(pending)
      if (!job) continue
      this.activeKeys.add(key)
      if (!this.workers.submit(job)) break
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
    const fadeStart = VIEW_RADIUS - FADE_CELLS
    const toRemove = this.fadeRemovals
    toRemove.length = 0

    for (const [key, chunk] of this.chunks) {
      this.fadeProps(chunk)
      // Keep old coverage until every replacement leaf has finished building.
      // This handles both splitting a distant tile and merging near tiles.
      if (chunk.fadingOut) {
        const waiting = this.replacementKeys.get(key)?.some(nextKey => (this.chunks.get(nextKey)?.fadeAge ?? 0) < FADE_SECONDS)
        if (waiting) { this.offsetFallback(chunk); continue }
        // Replacement coverage has completed its fade; retire the old surface.
        if (this.replacementKeys.get(key)?.length) {
          toRemove.push(key)
          continue
        }
        chunk.alpha *= 1 - fadeK
        this.applyChunkAlpha(chunk)
        if (chunk.alpha <= .01) toRemove.push(key)
        continue
      }
      chunk.fadeAge += dt
      if (!chunk.fadingOut) {
        const cellDist = tileDistance(chunk.cx, chunk.cz, chunk.size, this.focusX / CHUNK_SIZE, this.focusZ / CHUNK_SIZE)
        chunk.targetAlpha =
          1 - MathUtils.smoothstep(cellDist, fadeStart, VIEW_RADIUS + 0.35)
      } else {
        chunk.targetAlpha = 0
      }

      // Already stable fully opaque — no per-frame material work
      if (
        !chunk.fadingOut &&
        chunk.alpha >= 0.995 &&
        chunk.targetAlpha >= 0.995 &&
        chunk.appliedAlpha >= 0.995
      ) {
        continue
      }

      chunk.alpha = MathUtils.smoothstep(chunk.fadeAge, 0, FADE_SECONDS) * chunk.targetAlpha
      if (Math.abs(chunk.alpha - chunk.targetAlpha) < 0.008) {
        chunk.alpha = chunk.targetAlpha
      }

      if (Math.abs(chunk.alpha - chunk.appliedAlpha) > 0.004) {
        this.applyChunkAlpha(chunk)
      }

      if (chunk.fadingOut && chunk.alpha <= 0.01) {
        toRemove.push(key)
      }
    }

    for (let i = this.retiring.length - 1; i >= 0; i--) {
      const old = this.retiring[i]!
      const replacement = this.chunks.get(old.key)
      if (replacement && replacement.fadeAge < FADE_SECONDS && this.desiredTiles.has(old.key)) continue
      old.root.removeFromParent()
      this.disposeChunk(old)
      this.retiring.splice(i, 1)
    }

    for (const key of toRemove) {
      const chunk = this.chunks.get(key)
      if (!chunk) continue
      this.root.remove(chunk.root)
      this.disposeChunk(chunk)
      this.chunks.delete(key)
      this.replacementKeys.delete(key)
    }
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
    const finerAt = (edge: 'north' | 'east' | 'south' | 'west'): boolean => {
      for (const tile of this.desiredTiles.values()) {
        const overlaps = edge === 'north' || edge === 'south'
          ? tile.cx < cx + size && tile.cx + tile.size > cx
          : tile.cz < cz + size && tile.cz + tile.size > cz
        if (!overlaps) continue
        const touches = edge === 'north'
          ? tile.cz + tile.size === cz
          : edge === 'east'
            ? tile.cx === cx + size
            : edge === 'south'
              ? tile.cz === cz + size
              : tile.cx + tile.size === cx
        if (!touches || (tile.cx === cx && tile.cz === cz && tile.size === size)) continue
        const neighborLod = lodFromDist(tile.dist)
        if (tile.size < size || (tile.size === size && neighborLod < lod)) return true
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
    if (data.water) {
      const water = new Mesh(deserializeTerrainGeometry(data.water), makeWaterMaterial(this.waterClock,
        { rain: this.waterRain, snow: this.waterSnow, windX: this.waterWindX, windZ: this.waterWindZ }))
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
      props, propMeshes: props ? this.collectPropMeshes(props) : [],
      materials: root.children.flatMap(child => child instanceof Mesh
        ? (Array.isArray(child.material) ? child.material : [child.material])
          .filter((material): material is MeshStandardMaterial => material instanceof MeshStandardMaterial)
        : []),
    }
    this.applyChunkAlpha(chunk)
    return chunk
  }

  private stampChunkMeshes(root: Group | Mesh, opacity: number): void {
    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      if (obj.name === 'WaterSurface') {
        obj.material.opacity = opacity
        obj.material.transparent = false
        obj.material.alphaHash = true
        obj.material.depthWrite = true
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
        c.transparent = false
        c.alphaHash = true
        c.opacity = opacity
        if (c instanceof MeshStandardMaterial) {
          c.depthWrite = true
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

      const climate = sampleClimate(wx, wz)
      const surface = terrainSurfaceFromClimate(climate)
      const h = interpolateGridHeight(heights, segs, originX, originZ, wx, wz)
      const f = climate.features
      if (climate.biome === 'ocean' || climate.biome === 'runway') continue
      if (surface.kind === 'water') continue
      const hx = interpolateGridHeight(heights, segs, originX, originZ, wx + 3, wz)
      const hz = interpolateGridHeight(heights, segs, originX, originZ, wx, wz + 3)
      if (Math.hypot(hx - h, hz - h) / 3 > .65) continue
      if (f.river > 0.82) continue
      if (f.ravine > 0.55) continue

      const density = vegetationDensity(climate.biome, climate.moisture, f)
      if (hash2(i + cx, cz - i) > density) continue

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
      for (const m of mats) m.dispose()
    })
    chunk.root.clear()
  }
}
