import {
  BufferAttribute,
  Color,
  Fog,
  Group,
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
 * Fog fully covers the stream edge; chunk builds are budgeted per frame
 * so crossing a cell boundary never freezes the main thread.
 */
export const CHUNK_SIZE = 400
export const VIEW_RADIUS = 12
const PROP_RADIUS = 5
/** Slightly denser mesh so steep mountains / badlands hold their shape. */
const CHUNK_SEGS = 20
/** Max chunk builds per frame (props count as heavier). */
const BUILDS_PER_FRAME = 2
export const FOG_NEAR = 1400
export const FOG_FAR = 4800
export const STREAM_RADIUS_M = VIEW_RADIUS * CHUNK_SIZE

interface Chunk {
  key: string
  cx: number
  cz: number
  root: Group
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
      flatShading: true,
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
   * then builds a small budget so freefall never freezes.
   */
  update(worldX: number, worldZ: number): void {
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
        if (!this.chunks.has(key) && !this.pendingKeys.has(key)) {
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

    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        this.root.remove(chunk.root)
        this.disposeChunk(chunk)
        this.chunks.delete(key)
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

  private buildChunk(cx: number, cz: number, withProps: boolean): Chunk {
    const root = new Group()
    root.name = `chunk_${cx}_${cz}`
    const originX = cx * CHUNK_SIZE
    const originZ = cz * CHUNK_SIZE

    root.add(this.buildHeightMesh(originX, originZ))
    if (withProps) root.add(this.buildProps(originX, originZ, cx, cz))

    this.root.add(root)
    return { key: `${cx},${cz}`, cx, cz, root }
  }

  private buildHeightMesh(originX: number, originZ: number): Mesh {
    const geo = new PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGS, CHUNK_SEGS)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const half = CHUNK_SIZE * 0.5
    const stride = CHUNK_SEGS + 1
    const cell = CHUNK_SIZE / CHUNK_SEGS

    const biomes: Biome[] = new Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
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

    geo.setAttribute('color', new BufferAttribute(colors, 3))
    geo.computeVertexNormals()

    const mesh = new Mesh(geo, this.groundMat)
    mesh.position.set(originX + half, 0, originZ + half)
    mesh.receiveShadow = true
    mesh.castShadow = false
    mesh.name = 'TerrainChunk'
    return mesh
  }

  private buildProps(originX: number, originZ: number, cx: number, cz: number): Group {
    const veg = this.vegFactory.createBuckets()
    const samples = 100

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
      if (obj instanceof Mesh && obj.name === 'TerrainChunk') {
        obj.geometry.dispose()
      }
    })
    chunk.root.clear()
  }
}
