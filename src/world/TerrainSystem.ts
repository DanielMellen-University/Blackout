import {
  BufferAttribute,
  Color,
  DoubleSide,
  Fog,
  FrontSide,
  Group,
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
  type Biome,
} from './terrainSample'
import { createVegetationFactory, vegetationDensity } from './vegetation'
import { setContactHeightSampler } from './ground'

/**
 * Streaming envelope.
 * Terrain is generated past the fog wall so new chunks never appear
 * in clear view. Fog fully covers ~2 chunk rings before the stream edge.
 * Distance LOD + cheap far tiles keep the wider ring affordable.
 */
export const CHUNK_SIZE = 420
/**
 * Stream half-width in chunks (diameter ~2× this).
 * Doubled from 10 → 20 for longer sight lines.
 */
export const VIEW_RADIUS = 20
/**
 * Chunk rings kept past the fog horizon. Generation / fade happens
 * inside this hidden margin so you never watch tiles pop in.
 */
export const FOG_MARGIN_CHUNKS = 2
/**
 * Temporary: disable trees/rocks/props until we redo vegetation.
 * Flip to true later to restore placement.
 */
const ENABLE_VEGETATION = false
/** Detailed props only near the jet (cells). */
const PROP_RADIUS = 4
/** Soft opacity fade across the fog margin. */
const FADE_CELLS = FOG_MARGIN_CHUNKS + 0.4
/** Seconds-ish ease for spawn/despawn opacity. */
const FADE_RATE = 1.6
/** Near-field mesh density (player ring). */
const SEGS_NEAR = 16
/** Mid ring — still readable through light fog. */
const SEGS_MID = 9
/** Far ring — silhouette only (heavy fog). */
const SEGS_FAR = 5
/** Skirts only where seams can be seen (not in the fog bank). */
const SKIRT_DIST = 12
/** Slope shading only up close. */
const SLOPE_DIST = 5
/**
 * Vertical skirt depth (m). Hides residual cracks and gives the surface
 * real edge thickness instead of a paper-thin sheet.
 */
const SKIRT_DEPTH = 220
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
  if (dist <= 5) return 0
  if (dist <= 11) return 1
  return 2
}

/**
 * Promote as soon as the inner band is entered; demote only after leaving
 * a wider outer band so tiles do not thrash on the 5/11 cell rings.
 */
export function lodWithHysteresis(dist: number, current: TerrainLod): TerrainLod {
  const desired = lodFromDist(dist)
  if (desired === current) return current
  if (desired < current) {
    if (current === 2 && dist <= 10) return desired
    if (current === 1 && dist <= 4.5) return 0
    return current
  }
  if (current === 0 && dist >= 6.5) return desired
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
  private readonly scene: Scene
  private lastCx = Number.NaN
  private lastCz = Number.NaN
  private focusX = 0
  private focusZ = 0

  /** Near tiles: double-sided so steep cliffs don't punch holes. */
  private readonly groundMatNear: MeshStandardMaterial
  /** Mid/far tiles: single-sided (half the fill rate). */
  private readonly groundMatFar: MeshStandardMaterial
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
    this.applyFog()
    setContactHeightSampler((x, z) => this.sampleMeshHeight(x, z))
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
    this.lastCx = Number.NaN
    this.lastCz = Number.NaN
  }

  /**
   * Call every frame. Schedules needed chunks when the cell changes,
   * builds a small budget, and eases chunk/prop opacity in and out.
   */
  update(worldX: number, worldZ: number, dt = 1 / 60): void {
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
    const chunk = this.chunks.get(`${cx},${cz}`)
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
    if (!chunk || chunk.heights.length !== (chunk.segs + 1) * (chunk.segs + 1)) {
      return null
    }
    return interpolateGridHeight(
      chunk.heights,
      chunk.segs,
      chunk.originX,
      chunk.originZ,
      x,
      z,
    )
  }

  private scheduleAround(cx: number, cz: number): void {
    const needed = new Set<string>()
    const r2 = VIEW_RADIUS * VIEW_RADIUS + VIEW_RADIUS

    for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        if (dx * dx + dz * dz > r2) continue
        const kx = cx + dx
        const kz = cz + dz
        const key = `${kx},${kz}`
        needed.add(key)
        const dist = Math.hypot(dx, dz)
        const existing = this.chunks.get(key)
        if (existing) {
          existing.fadingOut = false
          const lod = lodWithHysteresis(dist, existing.lod)
          const wantProps = ENABLE_VEGETATION && dist <= PROP_RADIUS
          const needsRebuild =
            lod !== existing.lod || (wantProps && !existing.hasProps)
          if (needsRebuild && !this.pendingKeys.has(key)) {
            this.pending.push({ cx: kx, cz: kz, dist, rebuild: true })
            this.pendingKeys.add(key)
          }
        } else if (!this.pendingKeys.has(key)) {
          this.pending.push({
            cx: kx,
            cz: kz,
            dist,
            rebuild: false,
          })
          this.pendingKeys.add(key)
        }
      }
    }

    for (const p of this.pending) {
      p.dist = Math.hypot(p.cx - cx, p.cz - cz)
    }
    this.pending.sort((a, b) => a.dist - b.dist)

    // Soft unload: mark out-of-range chunks to fade, don't hard-delete
    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        chunk.fadingOut = true
        chunk.targetAlpha = 0
      }
    }

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!
      const key = `${p.cx},${p.cz}`
      if (!needed.has(key)) {
        this.pending.splice(i, 1)
        this.pendingKeys.delete(key)
      }
    }
  }

  private drainBuildQueue(): void {
    let spent = 0
    while (spent < BUILD_BUDGET && this.pending.length > 0) {
      const job = this.pending.shift()!
      const key = `${job.cx},${job.cz}`
      this.pendingKeys.delete(key)

      const pcx = Math.floor(this.focusX / CHUNK_SIZE)
      const pcz = Math.floor(this.focusZ / CHUNK_SIZE)
      const dist = Math.hypot(job.cx - pcx, job.cz - pcz)
      if (dist * dist > VIEW_RADIUS * VIEW_RADIUS + VIEW_RADIUS) continue

      const withProps = ENABLE_VEGETATION && dist <= PROP_RADIUS
      const existing = this.chunks.get(key)
      if (existing) {
        if (!job.rebuild) continue
        const lod = lodWithHysteresis(dist, existing.lod)
        const wantProps = withProps && !existing.hasProps
        if (lod === existing.lod && !wantProps) continue
        this.rebuildChunk(existing, lod, dist, withProps)
        spent += buildCost(dist, withProps)
        continue
      }

      this.chunks.set(key, this.buildChunk(job.cx, job.cz, withProps, dist))
      spent += buildCost(dist, withProps)
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
      if (!chunk.fadingOut) {
        const cellDist = Math.hypot(chunk.cx - pcx, chunk.cz - pcz)
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
  }

  private buildChunk(
    cx: number,
    cz: number,
    withProps: boolean,
    dist: number,
  ): Chunk {
    const root = new Group()
    root.name = `chunk_${cx}_${cz}`
    const originX = cx * CHUNK_SIZE
    const originZ = cz * CHUNK_SIZE
    const lod = lodFromDist(dist)

    const built = this.buildHeightMesh(originX, originZ, dist, lod)
    root.add(built.mesh)
    if (withProps) {
      const props = this.buildProps(originX, originZ, cx, cz)
      props.name = 'TerrainProps'
      root.add(props)
    }

    this.stampChunkMeshes(root, 0)
    root.matrixAutoUpdate = false
    root.updateMatrix()
    root.updateMatrixWorld(true)

    this.root.add(root)
    const chunk: Chunk = {
      key: `${cx},${cz}`,
      cx,
      cz,
      root,
      lod,
      segs: built.segs,
      hasProps: withProps,
      originX,
      originZ,
      heights: built.heights,
      alpha: 0,
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
    dist: number,
    withProps: boolean,
  ): void {
    const keepAlpha = chunk.alpha
    const remove: Object3D[] = []
    for (const child of chunk.root.children) {
      if (child.name === 'TerrainChunk') remove.push(child)
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
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          for (const m of mats) m.dispose()
        })
      }
    }

    const built = this.buildHeightMesh(chunk.originX, chunk.originZ, dist, lod)
    this.stampChunkMeshes(built.mesh, keepAlpha)
    chunk.root.add(built.mesh)
    if (withProps && !chunk.hasProps) {
      const props = this.buildProps(chunk.originX, chunk.originZ, chunk.cx, chunk.cz)
      props.name = 'TerrainProps'
      this.stampChunkMeshes(props, keepAlpha)
      chunk.root.add(props)
      chunk.hasProps = true
    }
    if (!withProps) chunk.hasProps = false

    chunk.lod = lod
    chunk.segs = built.segs
    chunk.heights = built.heights
    chunk.alpha = keepAlpha
    chunk.appliedAlpha = -1
    chunk.root.updateMatrixWorld(true)
    this.applyChunkAlpha(chunk)
  }

  private stampChunkMeshes(root: Group | Mesh, opacity: number): void {
    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => {
          const c = m.clone()
          c.transparent = opacity < 0.995
          c.opacity = opacity
          if (c instanceof MeshStandardMaterial) c.depthWrite = opacity > 0.12
          return c
        })
      } else {
        const c = obj.material.clone()
        c.transparent = opacity < 0.995
        c.opacity = opacity
        if (c instanceof MeshStandardMaterial) c.depthWrite = opacity > 0.12
        obj.material = c
      }
      obj.matrixAutoUpdate = false
      obj.updateMatrix()
    })
  }

  private buildHeightMesh(
    originX: number,
    originZ: number,
    dist: number,
    lod: TerrainLod,
  ): { mesh: Mesh; heights: Float32Array; segs: number } {
    const segs = segsForLod(lod)
    const doSlope = dist <= SLOPE_DIST
    const doSkirt = dist <= SKIRT_DIST
    const near = lod === 0

    const geo = new PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segs, segs)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const half = CHUNK_SIZE * 0.5
    const stride = segs + 1
    const cell = CHUNK_SIZE / segs

    const biomes: Biome[] | null = doSlope ? new Array(pos.count) : null
    for (let i = 0; i < pos.count; i++) {
      const wx = originX + half + pos.getX(i)
      const wz = originZ + half + pos.getZ(i)
      const climate = sampleClimate(wx, wz)
      const surface = terrainSurfaceFromClimate(climate)
      const h = surface.height
      pos.setY(i, h)
      if (biomes) biomes[i] = climate.biome
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
      )
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    const heights = new Float32Array(stride * stride)
    for (let i = 0; i < stride * stride; i++) heights[i] = pos.getY(i)

    if (doSlope && biomes) {
      for (let iz = 0; iz < stride; iz++) {
        for (let ix = 0; ix < stride; ix++) {
          const i = iz * stride + ix
          const h = pos.getY(i)
          const hl = pos.getY(iz * stride + Math.max(0, ix - 1))
          const hr = pos.getY(iz * stride + Math.min(stride - 1, ix + 1))
          const hd = pos.getY(Math.max(0, iz - 1) * stride + ix)
          const hu = pos.getY(Math.min(stride - 1, iz + 1) * stride + ix)
          const dx = (hr - hl) / (2 * cell)
          const dz = (hu - hd) / (2 * cell)
          const slope = Math.min(1, Math.hypot(dx, dz) / 2.2)
          const shaded = applySlopeShading(
            [colors[i * 3]!, colors[i * 3 + 1]!, colors[i * 3 + 2]!],
            slope,
            biomes[i]!,
            h,
          )
          colors[i * 3] = shaded[0]
          colors[i * 3 + 1] = shaded[1]
          colors[i * 3 + 2] = shaded[2]
        }
      }
    }

    geo.setAttribute('color', new BufferAttribute(colors, 3))
    if (doSkirt) this.appendEdgeSkirts(geo, segs)
    geo.computeVertexNormals()

    const mesh = new Mesh(geo, near ? this.groundMatNear : this.groundMatFar)
    mesh.position.set(originX + half, 0, originZ + half)
    // Shadows only matter up close (sun shadow camera is local)
    mesh.receiveShadow = near
    mesh.castShadow = false
    mesh.name = 'TerrainChunk'
    return { mesh, heights, segs }
  }

  /**
   * Extrude a deep skirt from every boundary — hides cracks / paper edges.
   *
   * Important: skirt uses *duplicated* rim verts, not the surface edge verts.
   * Sharing those verts with computeVertexNormals() averaged vertical skirt
   * normals into the ground and painted a dark grid along every chunk seam.
   */
  private appendEdgeSkirts(geo: PlaneGeometry, segs: number): void {
    const posAttr = geo.attributes.position as BufferAttribute
    const colAttr = geo.attributes.color as BufferAttribute
    const stride = segs + 1
    const nTop = posAttr.count

    // Boundary walk CCW (viewed from above): minZ → maxX → maxZ → minX
    const edge: number[] = []
    for (let ix = 0; ix < segs; ix++) edge.push(ix)
    for (let iz = 0; iz < segs; iz++) edge.push(iz * stride + segs)
    for (let ix = segs; ix > 0; ix--) edge.push(segs * stride + ix)
    for (let iz = segs; iz > 0; iz--) edge.push(iz * stride)
    const nEdge = edge.length

    // Per edge sample: one rim copy + one bottom → 2 * nEdge extra verts
    const nNew = nTop + nEdge * 2
    const pos = new Float32Array(nNew * 3)
    const col = new Float32Array(nNew * 3)

    for (let i = 0; i < nTop; i++) {
      pos[i * 3] = posAttr.getX(i)
      pos[i * 3 + 1] = posAttr.getY(i)
      pos[i * 3 + 2] = posAttr.getZ(i)
      col[i * 3] = colAttr.getX(i)
      col[i * 3 + 1] = colAttr.getY(i)
      col[i * 3 + 2] = colAttr.getZ(i)
    }

    // Outward nudge so coplanar skirts don't z-fight the neighbor chunk
    const EPS = 0.35
    for (let e = 0; e < nEdge; e++) {
      const src = edge[e]!
      const x = posAttr.getX(src)
      const y = posAttr.getY(src)
      const z = posAttr.getZ(src)
      // Outward from chunk center (local origin is chunk center after mesh place)
      const len = Math.hypot(x, z) || 1
      const ox = (x / len) * EPS
      const oz = (z / len) * EPS

      const rim = nTop + e
      const bot = nTop + nEdge + e
      pos[rim * 3] = x + ox
      pos[rim * 3 + 1] = y
      pos[rim * 3 + 2] = z + oz
      pos[bot * 3] = x + ox
      pos[bot * 3 + 1] = y - SKIRT_DEPTH
      pos[bot * 3 + 2] = z + oz

      // Match surface color (slightly shaded rock — not black)
      const cr = colAttr.getX(src)
      const cg = colAttr.getY(src)
      const cb = colAttr.getZ(src)
      col[rim * 3] = cr * 0.88
      col[rim * 3 + 1] = cg * 0.86
      col[rim * 3 + 2] = cb * 0.84
      col[bot * 3] = cr * 0.55
      col[bot * 3 + 1] = cg * 0.52
      col[bot * 3 + 2] = cb * 0.48
    }

    const oldIndex = geo.getIndex()
    if (!oldIndex) return
    const nOld = oldIndex.count
    const idx = new Uint32Array(nOld + nEdge * 6)
    for (let i = 0; i < nOld; i++) idx[i] = oldIndex.getX(i)

    let w = nOld
    for (let e = 0; e < nEdge; e++) {
      const e2 = (e + 1) % nEdge
      const aR = nTop + e
      const bR = nTop + e2
      const aB = nTop + nEdge + e
      const bB = nTop + nEdge + e2
      idx[w++] = aR
      idx[w++] = bR
      idx[w++] = bB
      idx[w++] = aR
      idx[w++] = bB
      idx[w++] = aB
    }

    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('color', new BufferAttribute(col, 3))
    geo.setIndex(new BufferAttribute(idx, 1))
  }

  private buildProps(originX: number, originZ: number, cx: number, cz: number): Group {
    this.vegFactory ??= createVegetationFactory()
    const veg = this.vegFactory.createBuckets()
    const samples = 40

    for (let i = 0; i < samples; i++) {
      const u = hash2(cx * 31 + i, cz * 17 + i * 3)
      const v = hash2(cz * 13 + i * 7, cx * 19 - i)
      const wx = originX + u * CHUNK_SIZE
      const wz = originZ + v * CHUNK_SIZE
      if (Math.hypot(wx, wz) < 105) continue
      if (Math.abs(wx) < 34 && Math.abs(wz) < 120) continue

      const climate = sampleClimate(wx, wz)
      const surface = terrainSurfaceFromClimate(climate)
      const h = surface.height
      const f = climate.features
      if (climate.biome === 'ocean' || climate.biome === 'runway') continue
      if (surface.kind === 'water' && f.river < 0.45 && f.lake < 0.45) continue
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
      // Terrain geometry is unique; vegetation geos are factory-shared — don't dispose those
      if (obj.name === 'TerrainChunk') {
        obj.geometry.dispose()
      }
      // Materials were cloned per chunk for fade — free them
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) m.dispose()
    })
    chunk.root.clear()
  }
}
