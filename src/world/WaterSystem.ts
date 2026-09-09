import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three'
import type { RiverReach } from './Hydrology'
import { applyWaterAppearance, type WaterWeatherUniforms } from './WaterAppearance'

interface WaterVertex { x: number; z: number; bed: number; level: number; basin: number }

function makeWaterMaterial(
  clock: { value: number },
  weather: WaterWeatherUniforms | undefined,
  polygonOffset = -1,
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: 0x345361, roughness: 0.2, metalness: 0.08,
    side: DoubleSide,
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
  basinMaskOrReaches?: Float32Array | readonly RiverReach[],
  reachesArg: readonly RiverReach[] = [],
): Mesh | null {
  // Keep the old reaches-only call shape usable for focused tools and tests,
  // while terrain tiles pass an explicit mask to distinguish rivers from
  // fixed-level lakes and seas.
  const basinMask = basinMaskOrReaches instanceof Float32Array ? basinMaskOrReaches : undefined
  const reaches: readonly RiverReach[] = basinMaskOrReaches instanceof Float32Array
    ? reachesArg
    : basinMaskOrReaches ?? reachesArg
  const positions: number[] = []
  const depths: number[] = []
  const stride = segs + 1
  const cell = size / segs
  const vertex = (i: number): WaterVertex => ({
    x: (i % stride) * cell - size / 2,
    z: Math.floor(i / stride) * cell - size / 2,
    bed: beds[i]!, level: levels[i]!, basin: basinMask?.[i] ?? 1,
  })
  function triangle(a: number, b: number, c: number): void {
    if (basinMask && basinMask[a]! <= .5 && basinMask[b]! <= .5 && basinMask[c]! <= .5) return
    if (beds[a]! >= levels[a]! && beds[b]! >= levels[b]! && beds[c]! >= levels[c]!) return
    const input = [vertex(a), vertex(b), vertex(c)]
    const polygon: WaterVertex[] = []
    for (let i = 0; i < 3; i++) {
      const p = input[i]!
      const q = input[(i + 1) % 3]!
      const dp = p.basin > .5 ? p.level - p.bed : -1
      const dq = q.basin > .5 ? q.level - q.bed : -1
      if (dp > 0) polygon.push(p)
      if ((dp > 0) !== (dq > 0)) {
        const t = dp / (dp - dq)
        polygon.push({
          x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t,
          bed: p.bed + (q.bed - p.bed) * t, level: p.level + (q.level - p.level) * t,
          basin: p.basin + (q.basin - p.basin) * t,
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
 * Analytic river ribbons retain the exact centerline and graded width emitted
 * by hydrology, even where a terrain tile has too few vertices to clip a
 * narrow stream. Every tile clips its own piece, so adjacent tiles meet at a
 * shared boundary without overlapping geometry.
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
  type RibbonVertex = { x: number; z: number; y: number; depth: number }
  type Section = { left: RibbonVertex; center: RibbonVertex; right: RibbonVertex }

  const clip = (polygon: RibbonVertex[], axis: 'x' | 'z', bound: number, keepGreater: boolean): RibbonVertex[] => {
    if (!polygon.length) return polygon
    const result: RibbonVertex[] = []
    const inside = (point: RibbonVertex): boolean => keepGreater ? point[axis] >= bound : point[axis] <= bound
    const intersection = (a: RibbonVertex, b: RibbonVertex): RibbonVertex => {
      const delta = b[axis] - a[axis]
      const t = Math.abs(delta) < 1e-9 ? 0 : (bound - a[axis]) / delta
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        y: a.y + (b.y - a.y) * t,
        depth: a.depth + (b.depth - a.depth) * t,
      }
    }
    let previous = polygon[polygon.length - 1]!
    let previousInside = inside(previous)
    for (const current of polygon) {
      const currentInside = inside(current)
      if (currentInside !== previousInside) result.push(intersection(previous, current))
      if (currentInside) result.push(current)
      previous = current
      previousInside = currentInside
    }
    return result
  }

  const appendPolygon = (input: RibbonVertex[]): void => {
    let polygon = input
    polygon = clip(polygon, 'x', -half, true)
    polygon = clip(polygon, 'x', half, false)
    polygon = clip(polygon, 'z', -half, true)
    polygon = clip(polygon, 'z', half, false)
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const point of [polygon[0]!, polygon[i]!, polygon[i + 1]!]) {
        positions.push(point.x, point.y, point.z)
        depths.push(point.depth)
      }
    }
  }

  const appendQuad = (a: RibbonVertex, b: RibbonVertex, c: RibbonVertex, d: RibbonVertex): void => {
    appendPolygon([a, b, c, d])
  }

  const appendRoundCap = (section: Section, radius: number): void => {
    const center = section.center
    const points: RibbonVertex[] = []
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2
      points.push({ x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius,
        y: center.y, depth: Math.max(.08, center.depth * .5) })
    }
    for (let i = 0; i < points.length; i++) {
      appendPolygon([center, points[i]!, points[(i + 1) % points.length]!])
    }
  }

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
      // The reach is also the carve path used by sampleHydrology. Do not add
      // a renderer-only meander here or the water will float off its channel.
      const mouthFade = reach.mouth ? 1 - Math.max(0, Math.min(1, (t - .55) / .45)) : 1
      const channelHalfWidth = Math.max(reach.mouth ? 2 : 5, baseWidth * mouthFade)
      const depth = reach.mouth
        ? Math.max(.12, Math.min(4, channelHalfWidth * .028))
        : Math.max(.45, Math.min(4, channelHalfWidth * .028))
      const y = reach.ya + (reach.yb - reach.ya) * t + .04
      const edgeDepth = Math.max(.08, Math.min(.55, depth * .16))
      const centerX = baseX, centerZ = baseZ
      sections.push({
        left: { x: centerX + nx * channelHalfWidth - originX - half, z: centerZ + nz * channelHalfWidth - originZ - half, y, depth: edgeDepth },
        center: { x: centerX - originX - half, z: centerZ - originZ - half, y, depth },
        right: { x: centerX - nx * channelHalfWidth - originX - half, z: centerZ - nz * channelHalfWidth - originZ - half, y, depth: edgeDepth },
      })
    }

    for (let step = 0; step < sections.length - 1; step++) {
      const a = sections[step]!, b = sections[step + 1]!
      appendQuad(a.left, b.left, b.center, a.center)
      appendQuad(a.center, b.center, b.right, a.right)
    }
    // Rounded joins/mouths hide tiny miter gaps when adjacent curved reaches
    // change direction or width. They are clipped with the same tile bounds.
    const first = sections[0]!, last = sections[sections.length - 1]!
    appendRoundCap(first, Math.hypot(first.left.x - first.center.x, first.left.z - first.center.z))
    appendRoundCap(last, Math.hypot(last.left.x - last.center.x, last.left.z - last.center.z))
  }

}
