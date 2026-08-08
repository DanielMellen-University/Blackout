import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Fog,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from 'three'
import { hash2 } from './noise'
import { biomeColor, sampleClimate, type Biome } from './terrainSample'

/**
 * Streaming envelope.
 * Fog fully covers the stream edge; chunk builds are budgeted per frame
 * so crossing a cell boundary never freezes the main thread.
 */
export const CHUNK_SIZE = 400
export const VIEW_RADIUS = 12
const PROP_RADIUS = 5
const CHUNK_SEGS = 16
/** Max chunk builds per frame (props count as heavier). */
const BUILDS_PER_FRAME = 2
export const FOG_NEAR = 1400
export const FOG_FAR = 4800
export const STREAM_RADIUS_M = VIEW_RADIUS * CHUNK_SIZE

const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _mat = new Matrix4()
const _Y = new Vector3(0, 1, 0)

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
  private readonly trunkMat: MeshStandardMaterial
  private readonly leafMats: MeshStandardMaterial[]
  private readonly rainforestLeafMat: MeshStandardMaterial
  private readonly rockMat: MeshStandardMaterial
  private readonly mesaRockMat: MeshStandardMaterial
  private readonly cactusMat: MeshStandardMaterial
  private readonly snowTreeMat: MeshStandardMaterial
  private readonly reedMat: MeshStandardMaterial

  private readonly trunkGeo: CylinderGeometry
  private readonly leafGeo: ConeGeometry
  private readonly bigLeafGeo: ConeGeometry
  private readonly rockGeo: ConeGeometry
  private readonly cactusGeo: CylinderGeometry
  private readonly reedGeo: CylinderGeometry

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
    this.trunkMat = new MeshStandardMaterial({
      color: 0x4a3424,
      roughness: 0.9,
      metalness: 0.05,
    })
    this.leafMats = [
      new MeshStandardMaterial({
        color: 0x2d6b3a,
        roughness: 0.85,
        metalness: 0.02,
        flatShading: true,
      }),
      new MeshStandardMaterial({
        color: 0x3a7a42,
        roughness: 0.85,
        metalness: 0.02,
        flatShading: true,
      }),
      new MeshStandardMaterial({
        color: 0x1e5a28,
        roughness: 0.88,
        metalness: 0.02,
        flatShading: true,
      }),
    ]
    this.rainforestLeafMat = new MeshStandardMaterial({
      color: 0x0f4a28,
      roughness: 0.82,
      metalness: 0.02,
      flatShading: true,
    })
    this.rockMat = new MeshStandardMaterial({
      color: 0x6a6e72,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    })
    this.mesaRockMat = new MeshStandardMaterial({
      color: 0x8a4a32,
      roughness: 0.9,
      metalness: 0.04,
      flatShading: true,
    })
    this.cactusMat = new MeshStandardMaterial({
      color: 0x3d7a42,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    })
    this.snowTreeMat = new MeshStandardMaterial({
      color: 0xd8e4f0,
      roughness: 0.8,
      metalness: 0.02,
      flatShading: true,
    })
    this.reedMat = new MeshStandardMaterial({
      color: 0x3a5a28,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true,
    })

    this.trunkGeo = new CylinderGeometry(0.28, 0.42, 1, 5)
    this.leafGeo = new ConeGeometry(1.5, 3.4, 6)
    this.bigLeafGeo = new ConeGeometry(2.2, 5.2, 6)
    this.rockGeo = new ConeGeometry(1.2, 1.8, 5)
    this.cactusGeo = new CylinderGeometry(0.35, 0.4, 2.4, 6)
    this.reedGeo = new CylinderGeometry(0.12, 0.18, 2.2, 4)

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

    // Near chunks first so the player always has ground under them
    this.pending.sort((a, b) => a.dist - b.dist)

    // Drop far chunks immediately (cheap)
    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        this.root.remove(chunk.root)
        this.disposeChunk(chunk)
        this.chunks.delete(key)
      }
    }

    // Drop pending that left the ring
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

      // Skip if player already left this far behind
      const pcx = Math.floor(this.focusX / CHUNK_SIZE)
      const pcz = Math.floor(this.focusZ / CHUNK_SIZE)
      const ddx = job.cx - pcx
      const ddz = job.cz - pcz
      if (ddx * ddx + ddz * ddz > VIEW_RADIUS * VIEW_RADIUS + VIEW_RADIUS) continue

      this.chunks.set(key, this.buildChunk(job.cx, job.cz, job.withProps))
      // Prop chunks cost more; count as full budget after one
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

    for (let i = 0; i < pos.count; i++) {
      const wx = originX + half + pos.getX(i)
      const wz = originZ + half + pos.getZ(i)
      // One climate sample per vertex (height + biome + color)
      const climate = sampleClimate(wx, wz)
      let h = climate.height
      if (climate.biome === 'water') h = Math.min(h, 0.35)
      if (climate.biome === 'ocean') h = 0
      pos.setY(i, h)
      const [r, g, b] = biomeColor(
        climate.biome,
        h,
        climate.moisture,
        wx,
        wz,
        climate.river,
      )
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
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
    const group = new Group()
    group.name = 'Props'

    const maxTrees = 36
    const maxRF = 24
    const maxRocks = 14
    const maxCactus = 18
    const maxReed = 22

    const trunks = new InstancedMesh(this.trunkGeo, this.trunkMat, maxTrees + maxRF)
    const foliage = this.leafMats.map(
      (m) => new InstancedMesh(this.leafGeo, m, maxTrees),
    )
    const rfFoliage = new InstancedMesh(this.bigLeafGeo, this.rainforestLeafMat, maxRF)
    const snowTrees = new InstancedMesh(this.leafGeo, this.snowTreeMat, maxTrees)
    const rocks = new InstancedMesh(this.rockGeo, this.rockMat, maxRocks)
    const mesaRocks = new InstancedMesh(this.rockGeo, this.mesaRockMat, maxRocks)
    const cacti = new InstancedMesh(this.cactusGeo, this.cactusMat, maxCactus)
    const reeds = new InstancedMesh(this.reedGeo, this.reedMat, maxReed)

    const allMeshes = [
      trunks,
      snowTrees,
      rocks,
      mesaRocks,
      cacti,
      reeds,
      rfFoliage,
      ...foliage,
    ]
    for (const m of allMeshes) {
      m.instanceMatrix.setUsage(DynamicDrawUsage)
      m.castShadow = false
      m.receiveShadow = false
      m.count = 0
    }

    let ti = 0
    let rfi = 0
    let ri = 0
    let mi = 0
    let ci = 0
    let rdi = 0

    const samples = 72
    for (let i = 0; i < samples; i++) {
      const u = hash2(cx * 31 + i, cz * 17 + i * 3)
      const v = hash2(cz * 13 + i * 7, cx * 19 - i)
      const wx = originX + u * CHUNK_SIZE
      const wz = originZ + v * CHUNK_SIZE
      if (Math.hypot(wx, wz) < 105) continue
      if (Math.abs(wx) < 34 && Math.abs(wz) < 120) continue

      const climate = sampleClimate(wx, wz)
      const h = climate.height
      if (
        climate.biome === 'water' ||
        climate.biome === 'ocean' ||
        climate.biome === 'runway'
      )
        continue
      if (climate.river > 0.7) continue

      const density = propDensity(climate.biome, climate.moisture)
      if (hash2(i + cx, cz - i) > density) continue

      const rot = hash2(i, 3) * Math.PI * 2

      switch (climate.biome) {
        case 'rainforest':
          if (rfi < maxRF) {
            const s = 1.4 + hash2(i, 9) * 2.0
            placeSimpleTree(trunks, ti + rfi, wx, h, wz, s, rot)
            _pos.set(wx, h + s * 0.5 + s * 2.1, wz)
            _quat.setFromAxisAngle(_Y, rot)
            _scale.set(s * 1.15, s * 1.1, s * 1.15)
            _mat.compose(_pos, _quat, _scale)
            rfFoliage.setMatrixAt(rfi, _mat)
            rfi++
          }
          break
        case 'forest':
        case 'plains':
        case 'hills':
          if (ti < maxTrees) {
            const s = 0.75 + hash2(i, 9) * 1.6
            placeTree(trunks, foliage, snowTrees, false, ti, wx, h, wz, s, rot)
            ti++
          }
          break
        case 'swamp':
          if (rdi < maxReed) {
            const s = 0.9 + hash2(i, 8) * 1.3
            _pos.set(wx, h + s * 1.0, wz)
            _quat.setFromAxisAngle(_Y, rot)
            _scale.set(s * 0.5, s, s * 0.5)
            _mat.compose(_pos, _quat, _scale)
            reeds.setMatrixAt(rdi, _mat)
            rdi++
          } else if (ti < maxTrees && hash2(i, 4) > 0.65) {
            const s = 0.55 + hash2(i, 9) * 0.9
            placeTree(trunks, foliage, snowTrees, false, ti, wx, h, wz, s, rot)
            ti++
          }
          break
        case 'snow':
          if (ti < maxTrees && hash2(i, 4) > 0.55) {
            const s = 0.55 + hash2(i, 8) * 1.1
            placeTree(trunks, foliage, snowTrees, true, ti, wx, h, wz, s, rot)
            ti++
          }
          break
        case 'mountain':
          if (ri < maxRocks) {
            const s = 1.3 + hash2(i, 5) * 3.5
            _pos.set(wx, h + s * 0.35, wz)
            _quat.setFromAxisAngle(_Y, rot)
            _scale.set(s, s * (0.65 + hash2(i, 1)), s)
            _mat.compose(_pos, _quat, _scale)
            rocks.setMatrixAt(ri, _mat)
            ri++
          }
          break
        case 'mesa':
          if (mi < maxRocks) {
            const s = 1.4 + hash2(i, 5) * 4
            _pos.set(wx, h + s * 0.3, wz)
            _quat.setFromAxisAngle(_Y, rot)
            _scale.set(s, s * 0.55, s)
            _mat.compose(_pos, _quat, _scale)
            mesaRocks.setMatrixAt(mi, _mat)
            mi++
          }
          break
        case 'desert':
          if (ci < maxCactus) {
            const s = 0.85 + hash2(i, 11) * 1.4
            _pos.set(wx, h + s * 1.1, wz)
            _quat.setFromAxisAngle(_Y, rot)
            _scale.set(s * 0.7, s, s * 0.7)
            _mat.compose(_pos, _quat, _scale)
            cacti.setMatrixAt(ci, _mat)
            ci++
          }
          break
        default:
          break
      }
    }

    trunks.count = ti + rfi
    for (const f of foliage) f.count = ti
    snowTrees.count = ti
    rfFoliage.count = rfi
    rocks.count = ri
    mesaRocks.count = mi
    cacti.count = ci
    reeds.count = rdi

    for (const m of allMeshes) {
      m.instanceMatrix.needsUpdate = true
      if (m.count > 0) group.add(m)
    }

    return group
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

function propDensity(biome: Biome, moisture: number): number {
  switch (biome) {
    case 'rainforest':
      return 0.8
    case 'forest':
      return 0.65 + moisture * 0.1
    case 'swamp':
      return 0.5
    case 'plains':
      return 0.18
    case 'hills':
      return 0.26
    case 'desert':
      return 0.28
    case 'mesa':
      return 0.32
    case 'mountain':
      return 0.36
    case 'snow':
      return 0.18
    default:
      return 0.1
  }
}

function placeSimpleTree(
  trunks: InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  s: number,
  rotY: number,
): void {
  _quat.setFromAxisAngle(_Y, rotY)
  _pos.set(x, y + s * 0.55, z)
  _scale.set(s * 0.85, s * 1.15, s * 0.85)
  _mat.compose(_pos, _quat, _scale)
  trunks.setMatrixAt(index, _mat)
}

function placeTree(
  trunks: InstancedMesh,
  foliage: InstancedMesh[],
  snowTrees: InstancedMesh,
  snow: boolean,
  index: number,
  x: number,
  y: number,
  z: number,
  s: number,
  rotY: number,
): void {
  _quat.setFromAxisAngle(_Y, rotY)

  _pos.set(x, y + s * 0.5, z)
  _scale.set(s * 0.9, s, s * 0.9)
  _mat.compose(_pos, _quat, _scale)
  trunks.setMatrixAt(index, _mat)

  _pos.set(x, y + s * 0.5 + s * 1.55, z)
  _scale.set(s, s, s)
  _mat.compose(_pos, _quat, _scale)

  if (snow) {
    snowTrees.setMatrixAt(index, _mat)
    _pos.set(0, -5000, 0)
    _scale.set(0, 0, 0)
    _mat.compose(_pos, _quat, _scale)
    for (const f of foliage) f.setMatrixAt(index, _mat)
  } else {
    const variant =
      Math.floor(hash2(index * 3, Math.floor(x + z)) * foliage.length) %
      foliage.length
    for (let v = 0; v < foliage.length; v++) {
      if (v === variant) {
        _pos.set(x, y + s * 0.5 + s * 1.55, z)
        _scale.set(s, s, s)
      } else {
        _pos.set(0, -5000, 0)
        _scale.set(0, 0, 0)
      }
      _mat.compose(_pos, _quat, _scale)
      foliage[v]!.setMatrixAt(index, _mat)
    }
    _pos.set(0, -5000, 0)
    _scale.set(0, 0, 0)
    _mat.compose(_pos, _quat, _scale)
    snowTrees.setMatrixAt(index, _mat)
  }
}
