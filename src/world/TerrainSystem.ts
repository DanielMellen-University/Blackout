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

/** Chunk edge length in world meters. */
export const CHUNK_SIZE = 320
/** Chunks in each direction from the player (radius). */
export const VIEW_RADIUS = 7
/** Grid resolution per chunk (higher = smoother, more verts). */
const CHUNK_SEGS = 28
/** Fog / draw envelope (meters). */
export const FOG_NEAR = 900
export const FOG_FAR = 4800

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

/**
 * Infinite streaming terrain: heightfield chunks + biome props + long fog.
 */
export class TerrainSystem {
  readonly root = new Group()
  private readonly chunks = new Map<string, Chunk>()
  private readonly scene: Scene
  private lastCx = Number.NaN
  private lastCz = Number.NaN

  private readonly groundMat: MeshStandardMaterial
  private readonly trunkMat: MeshStandardMaterial
  private readonly leafMats: MeshStandardMaterial[]
  private readonly rockMat: MeshStandardMaterial
  private readonly cactusMat: MeshStandardMaterial
  private readonly snowTreeMat: MeshStandardMaterial

  private readonly trunkGeo: CylinderGeometry
  private readonly leafGeo: ConeGeometry
  private readonly rockGeo: ConeGeometry
  private readonly cactusGeo: CylinderGeometry

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
    this.rockMat = new MeshStandardMaterial({
      color: 0x6a6e72,
      roughness: 0.92,
      metalness: 0.05,
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

    this.trunkGeo = new CylinderGeometry(0.28, 0.42, 1, 5)
    this.leafGeo = new ConeGeometry(1.5, 3.4, 6)
    this.rockGeo = new ConeGeometry(1.2, 1.8, 5)
    this.cactusGeo = new CylinderGeometry(0.35, 0.4, 2.4, 6)

    this.applyFog()
  }

  /** Update fog on the scene for long draw distance. */
  applyFog(near = FOG_NEAR, far = FOG_FAR): void {
    const fogColor = 0x8aa8c0
    this.scene.background = new Color(fogColor)
    this.scene.fog = new Fog(fogColor, near, far)
  }

  /**
   * Stream chunks around world position. Call each frame (cheap if cell unchanged).
   */
  update(worldX: number, worldZ: number): void {
    const cx = Math.floor(worldX / CHUNK_SIZE)
    const cz = Math.floor(worldZ / CHUNK_SIZE)
    if (cx === this.lastCx && cz === this.lastCz) return
    this.lastCx = cx
    this.lastCz = cz

    const needed = new Set<string>()
    for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
      for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
        // Circular-ish cull for corners
        if (dx * dx + dz * dz > VIEW_RADIUS * VIEW_RADIUS + VIEW_RADIUS) continue
        const kx = cx + dx
        const kz = cz + dz
        const key = `${kx},${kz}`
        needed.add(key)
        if (!this.chunks.has(key)) {
          this.chunks.set(key, this.buildChunk(kx, kz))
        }
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        this.root.remove(chunk.root)
        this.disposeChunk(chunk)
        this.chunks.delete(key)
      }
    }
  }

  private buildChunk(cx: number, cz: number): Chunk {
    const root = new Group()
    root.name = `chunk_${cx}_${cz}`
    const originX = cx * CHUNK_SIZE
    const originZ = cz * CHUNK_SIZE

    root.add(this.buildHeightMesh(originX, originZ))
    root.add(this.buildProps(originX, originZ, cx, cz))

    this.root.add(root)
    return { key: `${cx},${cz}`, cx, cz, root }
  }

  private buildHeightMesh(originX: number, originZ: number): Mesh {
    const geo = new PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGS, CHUNK_SEGS)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as BufferAttribute
    const colors = new Float32Array(pos.count * 3)

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i)
      const lz = pos.getZ(i)
      // PlaneGeometry centered at 0: vertices in [-size/2, size/2]
      const wx = originX + CHUNK_SIZE * 0.5 + lx
      const wz = originZ + CHUNK_SIZE * 0.5 + lz
      const climate = sampleClimate(wx, wz)
      let h = climate.height
      // Flatten lake beds slightly for readable water patches
      if (climate.biome === 'water') h = Math.min(h, 0.35)
      pos.setY(i, h)
      const [r, g, b] = biomeColor(
        climate.biome,
        h,
        climate.moisture,
        wx,
        wz,
      )
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    geo.setAttribute('color', new BufferAttribute(colors, 3))
    geo.computeVertexNormals()

    const mesh = new Mesh(geo, this.groundMat)
    mesh.position.set(originX + CHUNK_SIZE * 0.5, 0, originZ + CHUNK_SIZE * 0.5)
    mesh.receiveShadow = true
    mesh.castShadow = false
    mesh.name = 'TerrainChunk'
    return mesh
  }

  private buildProps(originX: number, originZ: number, cx: number, cz: number): Group {
    const group = new Group()
    group.name = 'Props'

    const maxTrees = 48
    const maxRocks = 18
    const maxCactus = 22

    const trunks = new InstancedMesh(this.trunkGeo, this.trunkMat, maxTrees)
    const foliage = this.leafMats.map(
      (m) => new InstancedMesh(this.leafGeo, m, maxTrees),
    )
    const snowTrees = new InstancedMesh(this.leafGeo, this.snowTreeMat, maxTrees)
    const rocks = new InstancedMesh(this.rockGeo, this.rockMat, maxRocks)
    const cacti = new InstancedMesh(this.cactusGeo, this.cactusMat, maxCactus)

    for (const m of [trunks, snowTrees, rocks, cacti, ...foliage]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage)
      m.castShadow = true
      m.receiveShadow = true
      m.count = 0
    }

    let ti = 0
    let ri = 0
    let ci = 0

    // Deterministic scatter inside chunk
    const samples = 110
    for (let i = 0; i < samples; i++) {
      const u = hash2(cx * 31 + i, cz * 17 + i * 3)
      const v = hash2(cz * 13 + i * 7, cx * 19 - i)
      const wx = originX + u * CHUNK_SIZE
      const wz = originZ + v * CHUNK_SIZE
      // Clear runway / approach corridor
      if (Math.hypot(wx, wz) < 100) continue
      if (Math.abs(wx) < 32 && Math.abs(wz) < 110) continue

      const climate = sampleClimate(wx, wz)
      const h = climate.height
      if (climate.biome === 'water' || climate.biome === 'runway') continue

      const density = propDensity(climate.biome, climate.moisture)
      if (hash2(i + cx, cz - i) > density) continue

      if (
        (climate.biome === 'forest' ||
          climate.biome === 'plains' ||
          climate.biome === 'hills') &&
        ti < maxTrees
      ) {
        const s = 0.75 + hash2(i, 9) * 1.6
        const rot = hash2(i, 3) * Math.PI * 2
        placeTree(trunks, foliage, snowTrees, false, ti, wx, h, wz, s, rot)
        ti++
      } else if (climate.biome === 'snow' && ti < maxTrees && hash2(i, 4) > 0.55) {
        const s = 0.6 + hash2(i, 8) * 1.1
        const rot = hash2(i, 2) * Math.PI * 2
        placeTree(trunks, foliage, snowTrees, true, ti, wx, h, wz, s, rot)
        ti++
      } else if (
        (climate.biome === 'mountain' || climate.biome === 'hills') &&
        ri < maxRocks
      ) {
        const s = 1.2 + hash2(i, 5) * 3.5
        _pos.set(wx, h + s * 0.35, wz)
        _quat.setFromAxisAngle(_Y, hash2(i, 6) * Math.PI * 2)
        _scale.set(s, s * (0.7 + hash2(i, 1)), s)
        _mat.compose(_pos, _quat, _scale)
        rocks.setMatrixAt(ri, _mat)
        ri++
      } else if (climate.biome === 'desert' && ci < maxCactus) {
        const s = 0.8 + hash2(i, 11) * 1.4
        _pos.set(wx, h + s * 1.1, wz)
        _quat.setFromAxisAngle(_Y, hash2(i, 12) * Math.PI * 2)
        _scale.set(s * 0.7, s, s * 0.7)
        _mat.compose(_pos, _quat, _scale)
        cacti.setMatrixAt(ci, _mat)
        ci++
      }
    }

    trunks.count = ti
    for (const f of foliage) f.count = ti
    snowTrees.count = ti
    rocks.count = ri
    cacti.count = ci

    for (const m of [trunks, snowTrees, rocks, cacti, ...foliage]) {
      m.instanceMatrix.needsUpdate = true
      if (m.count > 0) group.add(m)
    }

    return group
  }

  private disposeChunk(chunk: Chunk): void {
    // Only dispose per-chunk heightfield geometry. Prop geos/mats are shared.
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
    case 'forest':
      return 0.72 + moisture * 0.15
    case 'plains':
      return 0.22
    case 'hills':
      return 0.28
    case 'desert':
      return 0.35
    case 'mountain':
      return 0.4
    case 'snow':
      return 0.25
    default:
      return 0.1
  }
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
    // hide green foliage slots
    _pos.set(0, -5000, 0)
    _scale.set(0, 0, 0)
    _mat.compose(_pos, _quat, _scale)
    for (const f of foliage) f.setMatrixAt(index, _mat)
  } else {
    const variant = Math.floor(hash2(index * 3, Math.floor(x + z)) * foliage.length) % foliage.length
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
