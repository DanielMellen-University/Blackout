import {
  BufferAttribute,
  Color,
  DoubleSide,
  Fog,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
} from 'three'
import { hash2 } from './noise'
import {
  applySlopeShading,
  biomeColor,
  sampleClimate,
  type Biome,
} from './terrainSample'
import { createVegetationFactory, vegetationDensity } from './vegetation'

/**
 * Streaming envelope.
 * Terrain is generated past the fog wall so new chunks never appear
 * in clear view. Fog fully covers ~2 chunk rings before the stream edge.
 * Chunk builds are budgeted per frame; tiles fade in/out softly.
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
/** Detailed props only near the jet (cells). */
const PROP_RADIUS = 5
/** Soft opacity fade across the fog margin. */
const FADE_CELLS = FOG_MARGIN_CHUNKS + 0.4
/** Seconds-ish ease for spawn/despawn opacity. */
const FADE_RATE = 1.6
/**
 * Grid resolution per chunk. Same for near/far so shared edges match
 * (LOD mismatch was a major source of holes / paper gaps).
 */
const CHUNK_SEGS = 22
/**
 * Vertical skirt depth (m). Hides residual cracks and gives the surface
 * real edge thickness instead of a paper-thin sheet.
 */
const SKIRT_DEPTH = 220
/** Max chunk builds per frame (props count as heavier). */
const BUILDS_PER_FRAME = 2
export const STREAM_RADIUS_M = VIEW_RADIUS * CHUNK_SIZE
/**
 * Fog fully opaque at this range — two chunks inside the stream edge
 * (VIEW_RADIUS - FOG_MARGIN) * CHUNK_SIZE.
 */
export const FOG_FAR = (VIEW_RADIUS - FOG_MARGIN_CHUNKS) * CHUNK_SIZE
/** Clear air near the jet; linear fog ramps out to FOG_FAR. */
export const FOG_NEAR = Math.round(FOG_FAR * 0.34)

interface Chunk {
  key: string
  cx: number
  cz: number
  root: Group
  /** Current opacity 0–1 (lerped each frame). */
  alpha: number
  /** Desired opacity (distance fade or 0 while unloading). */
  targetAlpha: number
  /** Marked for removal after fade-out completes. */
  fadingOut: boolean
}

interface PendingChunk {
  cx: number
  cz: number
  withProps: boolean
  dist: number
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

  private readonly groundMat: MeshStandardMaterial
  private readonly vegFactory: ReturnType<typeof createVegetationFactory>

  constructor(scene: Scene) {
    this.scene = scene
    this.root.name = 'TerrainSystem'
    scene.add(this.root)

    this.groundMat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.04,
      // Smooth shading — flat faces made mountains look like knife edges
      flatShading: false,
      // Both faces so steep cliffs / underside glances never punch a sky hole
      side: DoubleSide,
    })
    this.vegFactory = createVegetationFactory()
    this.applyFog()
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
        const existing = this.chunks.get(key)
        if (existing) {
          // Came back into range while fading out — keep and fade back in
          existing.fadingOut = false
        } else if (!this.pendingKeys.has(key)) {
          const dist = Math.hypot(dx, dz)
          this.pending.push({
            cx: kx,
            cz: kz,
            withProps: dist <= PROP_RADIUS,
            dist,
          })
          this.pendingKeys.add(key)
        }
      }
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
    let built = 0
    while (built < BUILDS_PER_FRAME && this.pending.length > 0) {
      const job = this.pending.shift()!
      const key = `${job.cx},${job.cz}`
      this.pendingKeys.delete(key)
      if (this.chunks.has(key)) continue

      const pcx = Math.floor(this.focusX / CHUNK_SIZE)
      const pcz = Math.floor(this.focusZ / CHUNK_SIZE)
      const ddx = job.cx - pcx
      const ddz = job.cz - pcz
      if (ddx * ddx + ddz * ddz > VIEW_RADIUS * VIEW_RADIUS + VIEW_RADIUS) continue

      this.chunks.set(key, this.buildChunk(job.cx, job.cz, job.withProps))
      built += job.withProps ? BUILDS_PER_FRAME : 1
    }
  }

  /**
   * Lerp opacity toward targets; dispose only after fade-out finishes.
   * Outer ring also distance-fades so the stream edge ghosts into fog.
   */
  private updateFades(pcx: number, pcz: number, dt: number): void {
    const fadeK = 1 - Math.exp(-dt * FADE_RATE)
    const fadeStart = VIEW_RADIUS - FADE_CELLS
    const toRemove: string[] = []

    for (const [key, chunk] of this.chunks) {
      if (!chunk.fadingOut) {
        const cellDist = Math.hypot(chunk.cx - pcx, chunk.cz - pcz)
        // 1 inside fadeStart, 0 at VIEW_RADIUS
        chunk.targetAlpha =
          1 - MathUtils.smoothstep(cellDist, fadeStart, VIEW_RADIUS + 0.35)
      } else {
        chunk.targetAlpha = 0
      }

      chunk.alpha = MathUtils.lerp(chunk.alpha, chunk.targetAlpha, fadeK)
      // Snap ends so we hit fully opaque / fully gone cleanly
      if (Math.abs(chunk.alpha - chunk.targetAlpha) < 0.008) {
        chunk.alpha = chunk.targetAlpha
      }

      this.applyChunkAlpha(chunk)

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
        // Keep depth writes early so semi-transparent chunks don't "hole" the ground
        mat.depthWrite = a > 0.12
      }
    })
  }

  private buildChunk(cx: number, cz: number, withProps: boolean): Chunk {
    const root = new Group()
    root.name = `chunk_${cx}_${cz}`
    const originX = cx * CHUNK_SIZE
    const originZ = cz * CHUNK_SIZE

    root.add(this.buildHeightMesh(originX, originZ, withProps))
    if (withProps) root.add(this.buildProps(originX, originZ, cx, cz))

    // Per-chunk material clones so opacity fade doesn't affect other tiles
    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((m) => {
          const c = m.clone()
          c.transparent = true
          c.opacity = 0
          c.depthWrite = false
          return c
        })
      } else {
        const c = obj.material.clone()
        c.transparent = true
        c.opacity = 0
        if (c instanceof MeshStandardMaterial) c.depthWrite = false
        obj.material = c
      }
    })

    this.root.add(root)
    const chunk: Chunk = {
      key: `${cx},${cz}`,
      cx,
      cz,
      root,
      alpha: 0,
      targetAlpha: 1,
      fadingOut: false,
    }
    this.applyChunkAlpha(chunk)
    return chunk
  }

  private buildHeightMesh(
    originX: number,
    originZ: number,
    detailed: boolean,
  ): Mesh {
    // Same segs near and far so shared edges land on identical world samples
    const segs = CHUNK_SEGS
    const geo = new PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segs, segs)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const half = CHUNK_SIZE * 0.5
    const stride = segs + 1
    const cell = CHUNK_SIZE / segs

    const biomes: Biome[] = new Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
      // Snap to shared world grid so adjacent chunks share exact edge heights
      const wx = originX + half + pos.getX(i)
      const wz = originZ + half + pos.getZ(i)
      const climate = sampleClimate(wx, wz)
      let h = climate.height
      if (climate.biome === 'water') h = Math.min(h, 0.35)
      if (climate.biome === 'ocean') h = 0
      pos.setY(i, h)
      biomes[i] = climate.biome
      const [r, g, b] = biomeColor(
        climate.biome,
        h,
        climate.moisture,
        wx,
        wz,
        climate.features,
        climate.coastal,
        climate.land,
      )
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    // Slope cliff shading (all chunks — same mesh density now)
    if (detailed) {
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
    // Drop vertical skirts so steep seams / stream edges aren't paper-thin holes
    this.appendEdgeSkirts(geo, segs)
    geo.computeVertexNormals()

    const mesh = new Mesh(geo, this.groundMat)
    mesh.position.set(originX + half, 0, originZ + half)
    mesh.receiveShadow = true
    mesh.castShadow = false
    mesh.name = 'TerrainChunk'
    return mesh
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
    const veg = this.vegFactory.createBuckets()
    const samples = 56

    for (let i = 0; i < samples; i++) {
      const u = hash2(cx * 31 + i, cz * 17 + i * 3)
      const v = hash2(cz * 13 + i * 7, cx * 19 - i)
      const wx = originX + u * CHUNK_SIZE
      const wz = originZ + v * CHUNK_SIZE
      if (Math.hypot(wx, wz) < 105) continue
      if (Math.abs(wx) < 34 && Math.abs(wz) < 120) continue

      const climate = sampleClimate(wx, wz)
      const h = climate.height
      const f = climate.features
      if (climate.biome === 'ocean' || climate.biome === 'runway') continue
      if (climate.biome === 'water' && f.river < 0.45 && f.lake < 0.45) continue
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
