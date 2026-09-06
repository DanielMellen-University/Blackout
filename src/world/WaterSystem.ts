import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { applyWaterAppearance } from './WaterAppearance'

interface WaterVertex { x: number; z: number; bed: number; level: number }

/** Four vertices cover the distant ocean beyond the streamed seabed. */
export function createOceanBackdrop(clock: { value: number }): Mesh {
  const geometry = new PlaneGeometry(120000, 120000)
  geometry.rotateX(-Math.PI / 2)
  geometry.setAttribute('waterDepth', new Float32BufferAttribute([300, 300, 300, 300], 1))
  const material = new MeshStandardMaterial({ roughness: .38, metalness: .15 })
  applyWaterAppearance(material, clock)
  const mesh = new Mesh(geometry, material)
  mesh.name = 'DistantOcean'
  // Local shoreline meshes sit at exactly sea level and supply depth/foam.
  mesh.position.y = -.15
  return mesh
}

/**
 * Independent water geometry. Each terrain triangle is clipped at its water
 * level, leaving a true bed below it and an exact shared shoreline.
 */
export function buildWaterMesh(
  beds: Float32Array, levels: Float32Array, segs: number, size: number,
  originX: number, originZ: number, clock: { value: number },
): Mesh | null {
  // Deep ocean is covered by one four-vertex backdrop, not hundreds of meshes.
  if (beds.every((bed, i) => bed < -80 && levels[i] === 0)) return null
  const positions: number[] = []
  const depths: number[] = []
  const stride = segs + 1
  const cell = size / segs
  const vertex = (i: number): WaterVertex => ({
    x: (i % stride) * cell - size / 2,
    z: Math.floor(i / stride) * cell - size / 2,
    bed: beds[i]!, level: levels[i]!,
  })
  function triangle(a: number, b: number, c: number): void {
    if (beds[a]! >= levels[a]! && beds[b]! >= levels[b]! && beds[c]! >= levels[c]!) return
    const input = [vertex(a), vertex(b), vertex(c)]
    const polygon: WaterVertex[] = []
    for (let i = 0; i < 3; i++) {
      const p = input[i]!
      const q = input[(i + 1) % 3]!
      const dp = p.level - p.bed
      const dq = q.level - q.bed
      if (dp > 0) polygon.push(p)
      if ((dp > 0) !== (dq > 0)) {
        const t = dp / (dp - dq)
        polygon.push({
          x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t,
          bed: p.bed + (q.bed - p.bed) * t, level: p.level + (q.level - p.level) * t,
        })
      }
    }
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const p of [polygon[0]!, polygon[i]!, polygon[i + 1]!]) {
        positions.push(p.x, p.level, p.z)
        depths.push(Math.max(0, p.level - p.bed))
      }
    }
  }
  for (let z = 0; z < segs; z++) for (let x = 0; x < segs; x++) {
    const a = z * stride + x, b = a + stride, c = b + 1, d = a + 1
    triangle(a, b, d)
    triangle(b, c, d)
  }
  if (!positions.length) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('waterDepth', new Float32BufferAttribute(depths, 1))
  geometry.computeVertexNormals()
  const material = new MeshStandardMaterial({
    color: 0x196477, roughness: 0.38, metalness: 0.15,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })
  applyWaterAppearance(material, clock)
  const mesh = new Mesh(geometry, material)
  mesh.name = 'WaterSurface'
  mesh.position.set(originX + size / 2, 0, originZ + size / 2)
  return mesh
}
