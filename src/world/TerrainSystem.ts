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
  private readonly bushMat: MeshStandardMaterial
  private readonly grassMat: MeshStandardMaterial
  private readonly deadMat: MeshStandardMaterial

  private readonly trunkGeo: CylinderGeometry
  private readonly leafGeo: ConeGeometry
  private readonly bigLeafGeo: ConeGeometry
  private readonly bushGeo: ConeGeometry
  private readonly grassGeo: CylinderGeometry
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
    this.bushMat = new MeshStandardMaterial({
      color: 0x3d6b2e,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true,
    })
    this.grassMat = new MeshStandardMaterial({
      color: 0x4a8a38,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: true,
    })
    this.deadMat = new MeshStandardMaterial({
      color: 0x5a4a38,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    })

    this.trunkGeo = new CylinderGeometry(0.28, 0.42, 1, 5)
    this.leafGeo = new ConeGeometry(1.5, 3.4, 6)
    this.bigLeafGeo = new ConeGeometry(2.2, 5.2, 6)
    this.bushGeo = new ConeGeometry(1.1, 1.4, 5)
    this.grassGeo = new CylinderGeometry(0.08, 0.2, 0.9, 4)
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
        climate.features,
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

    const maxTrees = 40
    const maxRF = 28
    const maxRocks = 18
    const maxCactus = 20
    const maxReed = 28
    const maxBush = 32
    const maxGrass = 40
    const maxDead = 12

    const trunks = new InstancedMesh(this.trunkGeo, this.trunkMat, maxTrees + maxRF + maxDead)
    const foliage = this.leafMats.map(
      (m) => new InstancedMesh(this.leafGeo, m, maxTrees),
    )
    const rfFoliage = new InstancedMesh(this.bigLeafGeo, this.rainforestLeafMat, maxRF)
    const snowTrees = new InstancedMesh(this.leafGeo, this.snowTreeMat, maxTrees)
    const rocks = new InstancedMesh(this.rockGeo, this.rockMat, maxRocks)
    const mesaRocks = new InstancedMesh(this.rockGeo, this.mesaRockMat, maxRocks)
    const cacti = new InstancedMesh(this.cactusGeo, this.cactusMat, maxCactus)
    const reeds = new InstancedMesh(this.reedGeo, this.reedMat, maxReed)
    const bushes = new InstancedMesh(this.bushGeo, this.bushMat, maxBush)
    const grass = new InstancedMesh(this.grassGeo, this.grassMat, maxGrass)
    const deadTrunks = new InstancedMesh(this.trunkGeo, this.deadMat, maxDead)

    const allMeshes = [
      trunks,
      snowTrees,
      rocks,
      mesaRocks,
      cacti,
      reeds,
      rfFoliage,
      bushes,
      grass,
      deadTrunks,
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
    let bi = 0
    let gi = 0
    let di = 0

    const samples = 96
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
      // Keep surface of open water clear; denser edge vegetation nearby
      if (climate.biome === 'water' && f.river < 0.5 && f.lake < 0.5) continue
      if (f.river > 0.82) continue
      if (f.ravine > 0.55) continue

      const density = propDensity(climate.biome, climate.moisture, f)
      if (hash2(i + cx, cz - i) > density) continue

      const rot = hash2(i, 3) * Math.PI * 2
      const roll = hash2(i, 14)

      // Shoreline reeds: lakes, ponds, riverbanks
      const nearWater =
        f.lake > 0.35 || f.pond > 0.5 || (f.river > 0.25 && f.river < 0.75) || f.stream > 0.5
      if (nearWater && rdi < maxReed && roll < 0.55) {
        const s = 0.8 + hash2(i, 8) * 1.5
        _pos.set(wx, h + s * 1.0, wz)
        _quat.setFromAxisAngle(_Y, rot)
        _scale.set(s * 0.45, s, s * 0.45)
        _mat.compose(_pos, _quat, _scale)
        reeds.setMatrixAt(rdi, _mat)
        rdi++
        continue
      }

      switch (climate.biome) {
        case 'rainforest':
          if (rfi < maxRF) {
            const s = 1.5 + hash2(i, 9) * 2.2
            placeSimpleTree(trunks, ti + rfi, wx, h, wz, s, rot)
            _pos.set(wx, h + s * 0.5 + s * 2.1, wz)
            _quat.setFromAxisAngle(_Y, rot)
            _scale.set(s * 1.2, s * 1.15, s * 1.2)
            _mat.compose(_pos, _quat, _scale)
            rfFoliage.setMatrixAt(rfi, _mat)
            rfi++
          } else if (bi < maxBush) {
            placeBush(bushes, bi++, wx, h, wz, 0.9 + roll * 1.2, rot)
          }
          break
        case 'forest':
          if (ti < maxTrees && roll < 0.75) {
            const s = 0.8 + hash2(i, 9) * 1.7
            placeTree(trunks, foliage, snowTrees, false, ti, wx, h, wz, s, rot)
            ti++
          } else if (bi < maxBush) {
            placeBush(bushes, bi++, wx, h, wz, 0.7 + roll, rot)
          } else if (di < maxDead && roll > 0.9) {
            placeSimpleTree(deadTrunks, di, wx, h, wz, 0.6 + roll * 0.8, rot)
            di++
          }
          break
        case 'plains':
          if (gi < maxGrass && roll < 0.55) {
            placeGrass(grass, gi++, wx, h, wz, 0.7 + roll * 1.1, rot)
          } else if (bi < maxBush && roll < 0.75) {
            placeBush(bushes, bi++, wx, h, wz, 0.5 + roll * 0.8, rot)
          } else if (ti < maxTrees && roll > 0.85) {
            const s = 0.55 + hash2(i, 9) * 1.1
            placeTree(trunks, foliage, snowTrees, false, ti, wx, h, wz, s, rot)
            ti++
          }
          break
        case 'hills':
          if (ti < maxTrees && roll < 0.45) {
            const s = 0.7 + hash2(i, 9) * 1.4
            placeTree(trunks, foliage, snowTrees, false, ti, wx, h, wz, s, rot)
            ti++
          } else if (ri < maxRocks && roll > 0.7) {
            placeRock(rocks, ri++, wx, h, wz, 1.0 + roll * 2.5, rot)
          } else if (bi < maxBush) {
            placeBush(bushes, bi++, wx, h, wz, 0.6 + roll, rot)
          }
          break
        case 'swamp':
          if (rdi < maxReed) {
            const s = 0.9 + hash2(i, 8) * 1.4
            _pos.set(wx, h + s * 1.0, wz)
            _quat.setFromAxisAngle(_Y, rot)
            _scale.set(s * 0.5, s, s * 0.5)
            _mat.compose(_pos, _quat, _scale)
            reeds.setMatrixAt(rdi, _mat)
            rdi++
          } else if (ti < maxTrees && roll > 0.55) {
            const s = 0.5 + hash2(i, 9) * 1.0
            placeTree(trunks, foliage, snowTrees, false, ti, wx, h, wz, s, rot)
            ti++
          } else if (di < maxDead) {
            placeSimpleTree(deadTrunks, di, wx, h, wz, 0.5 + roll * 0.7, rot)
            di++
          }
          break
        case 'snow':
          if (ti < maxTrees && roll > 0.4) {
            const s = 0.5 + hash2(i, 8) * 1.15
            placeTree(trunks, foliage, snowTrees, true, ti, wx, h, wz, s, rot)
            ti++
          } else if (ri < maxRocks) {
            placeRock(rocks, ri++, wx, h, wz, 1.2 + roll * 3, rot)
          }
          break
        case 'mountain':
          if (ri < maxRocks) {
            placeRock(rocks, ri++, wx, h, wz, 1.4 + roll * 4.5, rot)
          } else if (ti < maxTrees && h < 120 && roll > 0.7) {
            const s = 0.45 + hash2(i, 8) * 0.9
            placeTree(trunks, foliage, snowTrees, h > 110, ti, wx, h, wz, s, rot)
            ti++
          }
          break
        case 'mesa':
          if (mi < maxRocks) {
            placeRock(mesaRocks, mi++, wx, h, wz, 1.5 + roll * 5, rot)
          } else if (bi < maxBush && roll > 0.8) {
            placeBush(bushes, bi++, wx, h, wz, 0.4 + roll * 0.5, rot)
          }
          break
        case 'desert':
          if (ci < maxCactus) {
            const s = 0.85 + hash2(i, 11) * 1.5
            _pos.set(wx, h + s * 1.1, wz)
            _quat.setFromAxisAngle(_Y, rot)
            _scale.set(s * 0.7, s, s * 0.7)
            _mat.compose(_pos, _quat, _scale)
            cacti.setMatrixAt(ci, _mat)
            ci++
          } else if (ri < maxRocks && roll > 0.75) {
            placeRock(rocks, ri++, wx, h, wz, 0.8 + roll * 2, rot)
          }
          break
        default:
          if (gi < maxGrass) placeGrass(grass, gi++, wx, h, wz, 0.6 + roll, rot)
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
    bushes.count = bi
    grass.count = gi
    deadTrunks.count = di

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

function propDensity(
  biome: Biome,
  moisture: number,
  f: { river: number; lake: number; pond: number; stream: number },
): number {
  let d = 0.15
  switch (biome) {
    case 'rainforest':
      d = 0.88
      break
    case 'forest':
      d = 0.72 + moisture * 0.1
      break
    case 'swamp':
      d = 0.62
      break
    case 'plains':
      d = 0.42
      break
    case 'hills':
      d = 0.4
      break
    case 'desert':
      d = 0.34
      break
    case 'mesa':
      d = 0.36
      break
    case 'mountain':
      d = 0.42
      break
    case 'snow':
      d = 0.28
      break
    default:
      d = 0.2
  }
  // Denser scrub along water edges
  if (f.lake > 0.3 || f.pond > 0.4 || f.stream > 0.4) d = Math.min(1, d + 0.2)
  if (f.river > 0.2 && f.river < 0.7) d = Math.min(1, d + 0.15)
  return d
}

function placeBush(
  mesh: InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  s: number,
  rotY: number,
): void {
  _quat.setFromAxisAngle(_Y, rotY)
  _pos.set(x, y + s * 0.45, z)
  _scale.set(s, s * 0.85, s)
  _mat.compose(_pos, _quat, _scale)
  mesh.setMatrixAt(index, _mat)
}

function placeGrass(
  mesh: InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  s: number,
  rotY: number,
): void {
  _quat.setFromAxisAngle(_Y, rotY)
  _pos.set(x, y + s * 0.4, z)
  _scale.set(s * 0.8, s, s * 0.8)
  _mat.compose(_pos, _quat, _scale)
  mesh.setMatrixAt(index, _mat)
}

function placeRock(
  mesh: InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  s: number,
  rotY: number,
): void {
  _quat.setFromAxisAngle(_Y, rotY)
  _pos.set(x, y + s * 0.32, z)
  _scale.set(s, s * (0.55 + hash2(index, 1) * 0.4), s)
  _mat.compose(_pos, _quat, _scale)
  mesh.setMatrixAt(index, _mat)
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
