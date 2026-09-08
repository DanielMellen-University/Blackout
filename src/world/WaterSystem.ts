import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three'
import type { RiverReach } from './Hydrology'
import { fbm } from './noise'
import { applyWaterAppearance, type WaterWeatherUniforms } from './WaterAppearance'

interface WaterVertex { x: number; z: number; bed: number; level: number }

function makeWaterMaterial(
  clock: { value: number },
  weather: WaterWeatherUniforms | undefined,
  polygonOffset = -1,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: 0x345361, roughness: 0.2, metalness: 0.08,
    polygonOffset: true, polygonOffsetFactor: polygonOffset, polygonOffsetUnits: polygonOffset,
  })
  applyWaterAppearance(material, clock, weather)
  return material
}

/**
 * Independent water geometry. Each terrain triangle is clipped at its water
 * level, leaving a true bed below it and an exact shared shoreline.
 */
export function buildWaterMesh(
  beds: Float32Array, levels: Float32Array, segs: number, size: number,
  originX: number, originZ: number, clock: { value: number }, weather?: WaterWeatherUniforms,
  reaches: readonly RiverReach[] = [],
): Mesh | null {
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
  appendRiverRibbons(reaches, size, originX, originZ, positions, depths)
  if (!positions.length) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('waterDepth', new Float32BufferAttribute(depths, 1))
  geometry.computeVertexNormals()
  // Water triangles are clipped per terrain cell, so give the renderer an
  // explicit bound for fast streamed-tile culling.
  geometry.computeBoundingSphere()
  const material = makeWaterMaterial(clock, weather)
  const mesh = new Mesh(geometry, material)
  mesh.name = 'WaterSurface'
  mesh.position.set(originX + size / 2, 0, originZ + size / 2)
  return mesh
}

/**
 * Analytic river ribbons retain their curved, varying channel profile even
 * where a far terrain tile has too few vertices to clip a narrow stream.
 * One mesh batches every reach owned by a streamed terrain tile.
 */
function appendRiverRibbons(
  reaches: readonly RiverReach[],
  size: number,
  originX: number,
  originZ: number,
  positions: number[],
  depths: number[],
): void {
  const half = size / 2
  type Section = { leftX: number; leftZ: number; rightX: number; rightZ: number; y: number; depth: number }

  for (const reach of reaches) {
    const dx = reach.bx - reach.ax, dz = reach.bz - reach.az
    const length = Math.hypot(dx, dz)
    if (length < 1) continue
    const nx = -dz / length, nz = dx / length
    // A section roughly every 120 m is enough for visible meanders without
    // turning a whole catchment into a high-poly water surface.
    const sections: Section[] = []
    const steps = Math.max(4, Math.min(12, Math.ceil(length / 120)))
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      const baseX = reach.ax + dx * t
      const baseZ = reach.az + dz * t
      const baseWidth = reach.wa + (reach.wb - reach.wa) * t
      // Endpoint fade preserves exact joins between adjacent reach segments.
      const bend = (fbm(baseX / 340 + 17, baseZ / 340 - 23, 2) - .5) *
        Math.min(22, baseWidth * .28) * Math.sin(Math.PI * t)
      const centerX = baseX + nx * bend
      const centerZ = baseZ + nz * bend
      const widthVariation = .86 + fbm(baseX / 190 - 41, baseZ / 190 + 29, 2) * .28
      const channelHalfWidth = Math.max(5, baseWidth * widthVariation)
      const depth = Math.max(.45, Math.min(4, channelHalfWidth * .028))
      const y = reach.ya + (reach.yb - reach.ya) * t + .04
      sections.push({
        leftX: centerX + nx * channelHalfWidth - originX - half,
        leftZ: centerZ + nz * channelHalfWidth - originZ - half,
        rightX: centerX - nx * channelHalfWidth - originX - half,
        rightZ: centerZ - nz * channelHalfWidth - originZ - half,
        y,
        depth,
      })
    }

    for (let step = 0; step < sections.length - 1; step++) {
      const a = sections[step]!, b = sections[step + 1]!
      // Two independently addressable triangles keep the mesh non-indexed,
      // matching the clipped basin surface and avoiding seam bookkeeping.
      positions.push(
        a.leftX, a.y, a.leftZ,
        b.leftX, b.y, b.leftZ,
        b.rightX, b.y, b.rightZ,
        a.leftX, a.y, a.leftZ,
        b.rightX, b.y, b.rightZ,
        a.rightX, a.y, a.rightZ,
      )
      depths.push(a.depth, b.depth, b.depth, a.depth, b.depth, a.depth)
    }
  }

}
