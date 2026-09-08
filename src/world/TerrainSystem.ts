import {
  BufferAttribute,
  Color,
  DoubleSide,
  Fog,
  FrontSide,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  type Object3D,
} from 'three'
import { hash2 } from './noise'
import {
  applySlopeShading,
  biomeColor,
  sampleClimate,
  terrainSurfaceFromClimate,
  opsPadBlend,
  type TerrainSurface,
} from './terrainSample'
import { createVegetationFactory, vegetationDensity } from './vegetation'
import { setContactHeightSampler } from './ground'
import { buildWaterMesh } from './WaterSystem'
import { hydrologyIntersectsBounds } from './Hydrology'
import { planTerrainTiles, terrainBuildPriority, tileKey, tileDistance } from './TerrainLayout'

/**
 * Streaming envelope.
 * Terrain is generated past the fog wall so new chunks never appear
 * in clear view. Fog fully covers ~2 chunk rings before the stream edge.
 * Distance LOD + cheap far tiles keep the wider ring affordable.
 */
export const CHUNK_SIZE = 420
/**
 * Stream half-width in chunks (diameter ~2× this).
 * Twice the previous 20-cell radius, with coarse distant tiles.
 */
export const VIEW_RADIUS = 40
/**
 * Chunk rings kept past the fog horizon. Generation / fade happens
 * inside this hidden margin so you never watch tiles pop in.
 */
export const FOG_MARGIN_CHUNKS = 4
/** Temporary art hold: the current tree/rock kit is disabled until it is rebuilt. */
export const ENABLE_VEGETATION = false
/** Detailed props only near the jet (cells). */
const PROP_RADIUS = 3
/** Soft opacity fade across the fog margin. */
const FADE_CELLS = FOG_MARGIN_CHUNKS + 0.4
/** Seconds-ish ease for spawn/despawn opacity. */
const FADE_RATE = 1.6
/** Near-field mesh density (player ring). */
const SEGS_NEAR = 24
/** Mid ring — still readable through light fog. */
const SEGS_MID = 12
/** Far ring — silhouette only (heavy fog). */
const SEGS_FAR = 6
/** Keep shores smooth on merged far tiles without refining dry silhouettes. */
const WATER_TARGET_CELL_M = 110
/** Hard cap prevents a large sea from consuming the terrain build budget. */
const WATER_MAX_SEGS = 32
/** Build cost budget per frame (props cost more, far LODs cost less). */
const BUILD_BUDGET = 2.4
export const STREAM_RADIUS_M = VIEW_RADIUS * CHUNK_SIZE
/**
 * Fog fully opaque at this range — two chunks inside the stream edge
 * (VIEW_RADIUS - FOG_MARGIN) * CHUNK_SIZE.
 */
export const FOG_FAR = (VIEW_RADIUS - FOG_MARGIN_CHUNKS) * CHUNK_SIZE
/** Clear air near the jet; linear fog ramps out to FOG_FAR. */
export const FOG_NEAR = Math.round(FOG_FAR * 0.34)

/** 0 = near (player ring), 1 = mid, 2 = far silhouette. */
export type TerrainLod = 0 | 1 | 2

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

export function segsForLod(lod: TerrainLod): number {
  if (lod === 0) return SEGS_NEAR
  if (lod === 1) return SEGS_MID
  return SEGS_FAR
}

function buildCost(dist: number, withProps: boolean): number {
  if (withProps) return 2.2
  if (dist <= 5) return 1
  if (dist <= 11) return 0.45
  return 0.22
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
  /** Desired opacity (distance fade or 0 while unloading). */
  targetAlpha: number
  /** Marked for removal after fade-out completes. */
  fadingOut: boolean
  /** Last applied opacity — skip material walks when unchanged. */
  appliedAlpha: number
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
  private desiredTiles = new Map<string, { cx: number; cz: number; size: number }>()
  private readonly replacementKeys = new Map<string, string[]>()
  private readonly scene: Scene
  private lastCx = Number.NaN
  private lastCz = Number.NaN
  private focusX = 0
  private focusZ = 0
  private readonly waterClock = { value: 0 }
  private readonly waterRain = { value: 0 }
  private readonly waterSnow = { value: 0 }

  /** Near tiles: double-sided so steep cliffs don't punch holes. */
  private readonly groundMatNear: MeshStandardMaterial
  /** Mid/far tiles: single-sided (half the fill rate). */
  private readonly groundMatFar: MeshStandardMaterial
  private readonly weatherRain = { value: 0 }
  private readonly weatherSnow = { value: 0 }
  private vegFactory: ReturnType<typeof createVegetationFactory> | null = null

  constructor(scene: Scene) {
    this.scene = scene
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
  }

  /** Update visual weather response without rebuilding streamed terrain. */
  setWeatherEffects(rain: number, snow: number): void {
    this.weatherRain.value = MathUtils.clamp(rain, 0, 1)
    this.weatherSnow.value = MathUtils.clamp(snow, 0, 1)
    this.waterRain.value = this.weatherRain.value
    this.waterSnow.value = this.weatherSnow.value
  }

  get weatherEffects(): { rain: number; snow: number } {
    return { rain: this.weatherRain.value, snow: this.weatherSnow.value }
  }

  private configureWeatherMaterial(material: MeshStandardMaterial): void {
    material.onBeforeCompile = shader => {
      shader.uniforms.terrainRain = this.weatherRain
      shader.uniforms.terrainSnow = this.weatherSnow
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying float terrainHeight;\n',
      ).replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nterrainHeight = transformed.y;\n',
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nuniform float terrainRain;\nuniform float terrainSnow;\nvarying float terrainHeight;\n',
      ).replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wetGround = terrainRain * 0.18;
        diffuseColor.rgb *= 1.0 - wetGround;
        float altitudeSnow = smoothstep(1400.0, 3200.0, terrainHeight);
        float snowCover = terrainSnow * (0.08 + altitudeSnow * 0.38);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.79, 0.87), snowCover);`,
      )
    }
    material.customProgramCacheKey = () => 'terrain-weather-v1'
  }

  applyFog(near = FOG_NEAR, far = FOG_FAR): void {
    const fogColor = 0x8eabc4
    this.scene.background = new Color(fogColor)
    this.scene.fog = new Fog(fogColor, near, far)
  }

  clearAll(): void {
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

  /**
   * Call every frame. Schedules needed chunks when the cell changes,
   * builds a small budget, and eases chunk/prop opacity in and out.
   */
  update(worldX: number, worldZ: number, dt = 1 / 60): void {
    this.waterClock.value += Math.max(0, dt)
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
    return this.sampleMeshSurface(x, z)?.height ?? null
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
          if (needsRebuild && !this.pendingKeys.has(key)) {
            this.pending.push({ cx: kx, cz: kz, size, dist, rebuild: true })
            this.pendingKeys.add(key)
          }
        } else if (!this.pendingKeys.has(key)) {
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
    this.pending.sort((a, b) => terrainBuildPriority(a) - terrainBuildPriority(b) || a.dist - b.dist)

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

  private drainBuildQueue(): void {
    let spent = 0
    const deadline = performance.now() + 2
    while (spent < BUILD_BUDGET && this.pending.length > 0 && (spent === 0 || performance.now() < deadline)) {
      const job = this.pending.shift()!
      const key = tileKey(job.cx, job.cz, job.size)
      this.pendingKeys.delete(key)

      const pcx = Math.floor(this.focusX / CHUNK_SIZE)
      const pcz = Math.floor(this.focusZ / CHUNK_SIZE)
      const dist = Math.hypot(job.cx + job.size / 2 - pcx - .5, job.cz + job.size / 2 - pcz - .5)
      if (!this.desiredTiles.has(key)) continue

      const existing = this.chunks.get(key)
      const withProps = ENABLE_VEGETATION && dist <= PROP_RADIUS + (existing?.hasProps ? 1 : 0)
      if (existing) {
        if (!job.rebuild) continue
        const lod = lodWithHysteresis(dist, existing.lod)
        if (lod === existing.lod && withProps === existing.hasProps) continue
        this.rebuildChunk(existing, lod, withProps)
        spent += buildCost(dist, withProps)
        continue
      }

      this.chunks.set(key, this.buildChunk(job.cx, job.cz, withProps, dist, job.size))
      spent += job.size > 1 ? .65 : buildCost(dist, withProps)
    }
  }

  /**
   * Lerp opacity toward targets; dispose only after fade-out finishes.
   * Settled fully-opaque tiles skip material walks (big win with ~1k chunks).
   */
  private updateFades(pcx: number, pcz: number, dt: number): void {
    const fadeK = 1 - Math.exp(-dt * FADE_RATE)
    const fadeStart = VIEW_RADIUS - FADE_CELLS
    const toRemove: string[] = []

    for (const [key, chunk] of this.chunks) {
      this.fadeProps(chunk)
      // Keep old coverage until every replacement leaf has finished building.
      // This handles both splitting a distant tile and merging near tiles.
      if (chunk.fadingOut) {
        const waiting = this.replacementKeys.get(key)?.some(nextKey => !this.chunks.has(nextKey))
        if (waiting) continue
        // Coverage is complete. Retire the old tile atomically instead of
        // drawing two overlapping generations for several seconds in flight.
        toRemove.push(key)
        continue
      }
      if (!chunk.fadingOut) {
        const cellDist = tileDistance(chunk.cx, chunk.cz, chunk.size, pcx + .5, pcz + .5)
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

      chunk.alpha = MathUtils.lerp(chunk.alpha, chunk.targetAlpha, fadeK)
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

    chunk.root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (!(mat instanceof MeshStandardMaterial)) continue
        const transparent = a < 0.995
        mat.transparent = transparent
        mat.opacity = a
        mat.depthWrite = a > 0.12
      }
    })
    const props = chunk.root.getObjectByName('TerrainProps')
    if (props) props.userData.alpha = -1
    this.fadeProps(chunk)
  }

  /** Props fade on actual distance, independently of their opaque ground. */
  private fadeProps(chunk: Chunk): void {
    const props = chunk.root.getObjectByName('TerrainProps')
    if (!props) return
    const distance = Math.hypot(
      chunk.originX + CHUNK_SIZE / 2 - this.focusX,
      chunk.originZ + CHUNK_SIZE / 2 - this.focusZ,
    ) / CHUNK_SIZE
    const alpha = chunk.alpha * (1 - MathUtils.smoothstep(distance, 2, PROP_RADIUS + .7))
    props.visible = alpha > .01
    if (Math.abs((props.userData.alpha ?? -1) - alpha) < .02) return
    props.userData.alpha = alpha
    props.traverse(obj => {
      if (!(obj instanceof Mesh)) return
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const material of materials) {
        material.opacity = alpha
        material.transparent = false
        if (!material.alphaHash) {
          material.alphaHash = true
          material.needsUpdate = true
        }
        material.depthWrite = true
      }
    })
  }

  private buildChunk(
    cx: number,
    cz: number,
    withProps: boolean,
    dist: number,
    size = 1,
  ): Chunk {
    const root = new Group()
    root.name = `chunk_${cx}_${cz}`
    const originX = cx * CHUNK_SIZE
    const originZ = cz * CHUNK_SIZE
    const lod = lodFromDist(dist)

    const built = this.buildHeightMesh(originX, originZ, lod, size)
    root.add(built.mesh)
    if (built.water) root.add(built.water)
    if (withProps) {
      const props = this.buildProps(originX, originZ, cx, cz, built.heights, built.segs)
      props.name = 'TerrainProps'
      root.add(props)
    }

    // Near ground must be present immediately, especially underneath the jet.
    const initialAlpha = 1
    this.stampChunkMeshes(root, initialAlpha)
    root.matrixAutoUpdate = false
    root.updateMatrix()
    root.updateMatrixWorld(true)

    this.root.add(root)
    const chunk: Chunk = {
      key: tileKey(cx, cz, size),
      size,
      waterLevels: built.waterLevels,
      cx,
      cz,
      root,
      lod,
      segs: built.segs,
      hasProps: withProps,
      originX,
      originZ,
      heights: built.heights,
      alpha: initialAlpha,
      targetAlpha: 1,
      fadingOut: false,
      appliedAlpha: -1,
    }
    this.applyChunkAlpha(chunk)
    return chunk
  }

  private rebuildChunk(
    chunk: Chunk,
    lod: TerrainLod,
    withProps: boolean,
  ): void {
    const keepAlpha = chunk.alpha
    const remove: Object3D[] = []
    for (const child of chunk.root.children) {
      if (child.name === 'TerrainChunk' || child.name === 'WaterSurface') remove.push(child)
      if (child.name === 'TerrainProps' && !withProps) remove.push(child)
    }
    for (const child of remove) {
      chunk.root.remove(child)
      if (child instanceof Mesh) {
        child.geometry.dispose()
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const m of mats) m.dispose()
      } else {
        child.traverse((obj) => {
          if (!(obj instanceof Mesh)) return
          if (obj instanceof InstancedMesh) obj.dispose()
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          for (const m of mats) m.dispose()
        })
      }
    }

    const built = this.buildHeightMesh(chunk.originX, chunk.originZ, lod, chunk.size)
    this.stampChunkMeshes(built.mesh, keepAlpha)
    chunk.root.add(built.mesh)
    if (built.water) {
      this.stampChunkMeshes(built.water, keepAlpha)
      chunk.root.add(built.water)
    }
    if (withProps && !chunk.hasProps) {
      const props = this.buildProps(chunk.originX, chunk.originZ, chunk.cx, chunk.cz, built.heights, built.segs)
      props.name = 'TerrainProps'
      this.stampChunkMeshes(props, keepAlpha)
      chunk.root.add(props)
      chunk.hasProps = true
    }
    if (!withProps) chunk.hasProps = false

    chunk.lod = lod
    chunk.segs = built.segs
    chunk.heights = built.heights
    chunk.waterLevels = built.waterLevels
    chunk.alpha = keepAlpha
    chunk.appliedAlpha = -1
    chunk.root.updateMatrixWorld(true)
    this.applyChunkAlpha(chunk)
  }

  private stampChunkMeshes(root: Group | Mesh, opacity: number): void {
    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      if (obj.name === 'WaterSurface') {
        obj.material.opacity = opacity
        obj.material.transparent = opacity < .995
        obj.matrixAutoUpdate = false
        obj.updateMatrix()
        return
      }
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => {
          const c = m.clone()
          c.transparent = opacity < 0.995
          c.opacity = opacity
          if (c instanceof MeshStandardMaterial) {
            c.depthWrite = opacity > 0.12
          }
          return c
        })
      } else {
        const c = obj.material.clone()
        c.transparent = opacity < 0.995
        c.opacity = opacity
        if (c instanceof MeshStandardMaterial) {
          c.depthWrite = opacity > 0.12
          if (obj.name === 'TerrainChunk') this.configureWeatherMaterial(c)
        }
        obj.material = c
      }
      obj.matrixAutoUpdate = false
      obj.updateMatrix()
    })
  }

  private buildHeightMesh(
    originX: number,
    originZ: number,
    lod: TerrainLod,
    size = 1,
    waterDetail = false,
  ): { mesh: Mesh; water: Mesh | null; heights: Float32Array; waterLevels: Float32Array; segs: number } {
    const near = lod === 0
    const span = CHUNK_SIZE * size
    const baseSegs = size > 1 ? SEGS_MID : segsForLod(lod)
    const waterSegs = Math.min(WATER_MAX_SEGS, Math.max(baseSegs, Math.ceil(span / WATER_TARGET_CELL_M)))
    const segs = waterDetail ? waterSegs : baseSegs
    const geo = new PlaneGeometry(span, span, segs, segs)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const waterLevels = new Float32Array(pos.count)
    const half = span * 0.5
    const stride = segs + 1
    const cell = span / segs

    for (let i = 0; i < pos.count; i++) {
      const wx = originX + half + pos.getX(i)
      const wz = originZ + half + pos.getZ(i)
      const climate = sampleClimate(wx, wz)
      const h = climate.height
      waterLevels[i] = climate.waterLevel ?? 0
      pos.setY(i, h)
      const [r, g, b] = biomeColor(
        climate.biome,
        h,
        climate.moisture,
        wx,
        wz,
        climate.features,
        climate.coastal,
        climate.land,
        climate.biomeB,
        climate.biomeMix,
        climate.biomeWeights,
        climate.landform,
      )
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    const heights = new Float32Array(stride * stride)
    for (let i = 0; i < stride * stride; i++) heights[i] = pos.getY(i)
    const containsWater = heights.some((height, index) => waterLevels[index]! > height + .01)
    // The broad quadtree uses only 12 samples for a 3.36 km tile. That is
    // excellent for dry fog silhouettes but makes a lake shore read as a
    // dozen huge teeth. Rebuild just wet tiles at a capped world-space cell
    // size, so water and its underlying bed stay on the same precise grid.
    const touchesHydrology = !containsWater && !waterDetail && waterSegs > segs && hydrologyIntersectsBounds(
      originX, originZ, originX + span, originZ + span,
    )
    if ((containsWater || touchesHydrology) && !waterDetail && waterSegs > segs) {
      geo.dispose()
      return this.buildHeightMesh(originX, originZ, lod, size, true)
    }

    // Neighbour samples outside the tile give shared edges the same normal.
    // Clamping to an edge vertex used to halve the slope along every seam.
    const gradientX = new Float32Array(heights.length)
    const gradientZ = new Float32Array(heights.length)
    for (let iz = 0; iz < stride; iz++) for (let ix = 0; ix < stride; ix++) {
      const i = iz * stride + ix
      const wx = originX + ix * cell
      const wz = originZ + iz * cell
      const hl = ix > 0 ? heights[i - 1]! : Math.fround(sampleClimate(wx - cell, wz).height)
      const hr = ix < segs ? heights[i + 1]! : Math.fround(sampleClimate(wx + cell, wz).height)
      const hd = iz > 0 ? heights[i - stride]! : Math.fround(sampleClimate(wx, wz - cell).height)
      const hu = iz < segs ? heights[i + stride]! : Math.fround(sampleClimate(wx, wz + cell).height)
      gradientX[i] = (hr - hl) / (2 * cell)
      gradientZ[i] = (hu - hd) / (2 * cell)
    }
    {
      for (let iz = 0; iz < stride; iz++) {
        for (let ix = 0; ix < stride; ix++) {
          const i = iz * stride + ix
          const dx = gradientX[i]!
          const dz = gradientZ[i]!
          const slope = Math.min(1, Math.hypot(dx, dz) / 2.2)
          const shaded = applySlopeShading(
            [colors[i * 3]!, colors[i * 3 + 1]!, colors[i * 3 + 2]!],
            slope,
          )
          colors[i * 3] = shaded[0]
          colors[i * 3 + 1] = shaded[1]
          colors[i * 3 + 2] = shaded[2]
        }
      }
    }

    geo.setAttribute('color', new BufferAttribute(colors, 3))
    // Shared world-space edge samples keep neighbouring tiles aligned. Skirts
    // used to conceal LOD cracks, but their deep side faces became artificial
    // dark dams wherever a terrain tile met independently clipped water.
    // Eliminating them also removes unused geometry from every streamed tile.
    geo.computeVertexNormals()
    const normals = geo.attributes.normal as BufferAttribute
    for (let i = 0; i < heights.length; i++) {
      const dx = gradientX[i]!
      const dz = gradientZ[i]!
      const length = Math.hypot(dx, 1, dz)
      normals.setXYZ(i, -dx / length, 1 / length, -dz / length)
    }
    const mesh = new Mesh(geo, near ? this.groundMatNear : this.groundMatFar)
    mesh.position.set(originX + half, 0, originZ + half)
    // Shadows only matter up close (sun shadow camera is local)
    mesh.receiveShadow = near
    mesh.castShadow = false
    mesh.name = 'TerrainChunk'
    const water = buildWaterMesh(heights, waterLevels, segs, span, originX, originZ, this.waterClock,
      { rain: this.waterRain, snow: this.waterSnow })
    return { mesh, water, heights, waterLevels, segs }
  }

  private buildProps(
    originX: number, originZ: number, cx: number, cz: number,
    heights: Float32Array, segs: number,
  ): Group {
    this.vegFactory ??= createVegetationFactory()
    const veg = this.vegFactory.createBuckets()
    const samples = 100

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
    return veg.group
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
