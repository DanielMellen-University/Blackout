import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three'
import { basinDistance, type RiverReach, type WaterBasin } from './Hydrology'
import { applyWaterAppearance, type WaterWeatherUniforms } from './WaterAppearance'

interface WaterVertex { x: number; z: number; bed: number; level: number; basin: number }
interface BasinVertex { x: number; z: number; y: number; depth: number }

/** Cached warped shoreline samples reused by every terrain tile touching a basin. */
const basinBoundaryCache = new WeakMap<WaterBasin, BasinVertex[]>()

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
  basins: readonly WaterBasin[] = [],
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
  const flowValues: number[] = []
  const flowDirections: number[] = []
  const stride = segs + 1
  const cell = size / segs
  const vertex = (i: number): WaterVertex => ({
    x: (i % stride) * cell - size / 2,
    z: Math.floor(i / stride) * cell - size / 2,
    bed: beds[i]!, level: levels[i]!, basin: basinMask?.[i] ?? 1,
  })
  function triangle(a: number, b: number, c: number): void {
    if (basinMask && basinMask[a]! <= .5 && basinMask[b]! <= .5 && basinMask[c]! <= .5) return
    // Fixed-level basins get their own smooth analytic shoreline below. Do not
    // also rasterize these triangles, or the two surfaces recreate the old
    // sawtooth edge and expose a dark bed wedge between cells.
    if (basins.length > 0 && basinMask &&
      (basinMask[a]! > .5 || basinMask[b]! > .5 || basinMask[c]! > .5)) return
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
        flowValues.push(0)
        flowDirections.push(0, 0)
      }
    }
  }
  for (let z = 0; z < segs; z++) for (let x = 0; x < segs; x++) {
    const a = z * stride + x, b = a + stride, c = b + 1, d = a + 1
    triangle(a, b, d)
    triangle(b, c, d)
  }
  appendAnalyticBasins(basins, size, originX, originZ, positions, depths, flowValues, flowDirections)
  appendRiverRibbons(reaches, size, originX, originZ, positions, depths, flowValues, flowDirections)
  if (!positions.length) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('waterDepth', new Float32BufferAttribute(depths, 1))
  geometry.setAttribute('waterFlow', new Float32BufferAttribute(flowValues, 1))
  geometry.setAttribute('waterFlowDir', new Float32BufferAttribute(flowDirections, 2))
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
 * Tessellate each fixed-level basin from its warped analytic shoreline. The
 * fan is clipped to the streamed tile, so a lake keeps one continuous outline
 * while still batching into the existing water draw per tile.
 */
function appendAnalyticBasins(
  basins: readonly WaterBasin[],
  size: number,
  originX: number,
  originZ: number,
  positions: number[],
  depths: number[],
  flowValues: number[],
  flowDirections: number[],
): void {
  if (!basins.length) return
  const half = size / 2
  const centerX = originX + half, centerZ = originZ + half
  const clip = (input: BasinVertex[], axis: 'x' | 'z', bound: number, keepGreater: boolean): BasinVertex[] => {
    if (!input.length) return input
    const result: BasinVertex[] = []
    const inside = (point: BasinVertex): boolean => keepGreater ? point[axis] >= bound : point[axis] <= bound
    const intersection = (a: BasinVertex, b: BasinVertex): BasinVertex => {
      const delta = b[axis] - a[axis]
      const t = Math.abs(delta) < 1e-9 ? 0 : (bound - a[axis]) / delta
      return {
        x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
        y: a.y + (b.y - a.y) * t, depth: a.depth + (b.depth - a.depth) * t,
      }
    }
    let previous = input[input.length - 1]!, previousInside = inside(previous)
    for (const current of input) {
      const currentInside = inside(current)
      if (currentInside !== previousInside) result.push(intersection(previous, current))
      if (currentInside) result.push(current)
      previous = current
      previousInside = currentInside
    }
    return result
  }
  const appendPolygon = (input: BasinVertex[]): void => {
    let polygon = input
    polygon = clip(polygon, 'x', -half, true)
    polygon = clip(polygon, 'x', half, false)
    polygon = clip(polygon, 'z', -half, true)
    polygon = clip(polygon, 'z', half, false)
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const point of [polygon[0]!, polygon[i]!, polygon[i + 1]!]) {
        positions.push(point.x, point.y, point.z)
        depths.push(point.depth)
        flowValues.push(0)
        flowDirections.push(0, 0)
      }
    }
  }

  for (const basin of basins) {
    const extent = basin.radius * 1.75 + size * .72
    if (Math.abs(basin.x - centerX) > extent || Math.abs(basin.z - centerZ) > extent) continue
    const samples = basin.sea ? 256 : basin.pond ? 96 : 160
    let boundary = basinBoundaryCache.get(basin)
    if (!boundary) {
      boundary = []
      const highScale = basin.sea ? 2.65 : basin.pond ? 2.9 : 2.5
      for (let i = 0; i < samples; i++) {
        const angle = i / samples * Math.PI * 2
        let low = 0, high = basin.radius * highScale
        // The warped outline is broad and single-valued along a ray. Expand the
        // bracket defensively for unusually deep coves before binary searching.
        for (let expand = 0; expand < 3 && basinDistance(basin, basin.x + Math.cos(angle) * high,
          basin.z + Math.sin(angle) * high) < 0; expand++) high *= 1.35
        for (let pass = 0; pass < 9; pass++) {
          const radius = (low + high) * .5
          if (basinDistance(basin, basin.x + Math.cos(angle) * radius,
            basin.z + Math.sin(angle) * radius) < 0) low = radius
          else high = radius
        }
        // Keep the boundary in basin-local coordinates. Every tile can then
        // reuse the expensive warped shoreline solve and only clip the points
        // that overlap its own rectangle.
        boundary.push({
          x: Math.cos(angle) * low,
          z: Math.sin(angle) * low,
          y: basin.level,
          depth: .08,
        })
      }
      basinBoundaryCache.set(basin, boundary)
    }
    // Keep close shorelines smooth, but decimate the cached boundary when a
    // large quadtree tile is already hidden in the fog. The cache remains
    // high-resolution so flying back toward the same basin never bakes a
    // permanently faceted outline into the shared landmark.
    const sampleLimit = basin.sea ? 256 : basin.pond ? 96 : 160
    const tileScale = Math.min(1, 420 / Math.max(420, size))
    const desiredSamples = Math.max(48, Math.round(sampleLimit * (.3 + tileScale * .7)))
    const boundaryStep = Math.max(1, Math.ceil(boundary.length / desiredSamples))
    const center: BasinVertex = {
      x: basin.x - centerX, z: basin.z - centerZ, y: basin.level,
      depth: basin.sea ? 180 : basin.pond ? 42 : 96,
    }
    for (let i = 0; i < boundary.length; i += boundaryStep) {
      const edge = boundary[i]!
      const next = boundary[(i + boundaryStep) % boundary.length]!
      appendPolygon([
        center,
        { ...edge, x: basin.x + edge.x - centerX, z: basin.z + edge.z - centerZ },
        { ...next, x: basin.x + next.x - centerX, z: basin.z + next.z - centerZ },
      ])
    }
  }
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
  flowValues: number[],
  flowDirections: number[],
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

  const appendPolygon = (input: RibbonVertex[], flowX: number, flowZ: number): void => {
    let polygon = input
    polygon = clip(polygon, 'x', -half, true)
    polygon = clip(polygon, 'x', half, false)
    polygon = clip(polygon, 'z', -half, true)
    polygon = clip(polygon, 'z', half, false)
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const point of [polygon[0]!, polygon[i]!, polygon[i + 1]!]) {
        positions.push(point.x, point.y, point.z)
        depths.push(point.depth)
        flowValues.push(1)
        flowDirections.push(flowX, flowZ)
      }
    }
  }

  const appendQuad = (a: RibbonVertex, b: RibbonVertex, c: RibbonVertex, d: RibbonVertex,
    flowX: number, flowZ: number): void => {
    appendPolygon([a, b, c, d], flowX, flowZ)
  }

  const appendRoundCap = (section: Section, radius: number, flowX: number, flowZ: number): void => {
    const center = section.center
    const points: RibbonVertex[] = []
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2
      points.push({ x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius,
        y: center.y, depth: Math.max(.08, center.depth * .5) })
    }
    for (let i = 0; i < points.length; i++) {
      appendPolygon([center, points[i]!, points[(i + 1) % points.length]!], flowX, flowZ)
    }
  }

  const appendTaperedCap = (
    section: Section, flowX: number, flowZ: number, distance: number,
  ): void => {
    // Tributaries that end at a streamed catchment boundary should fade into
    // the terrain instead of exposing a circular hose cap from above. The
    // route remains continuous because only chain endpoints call this. Three
    // taper stages keep the silhouette from reading as a hard rectangular
    // cut when the last section is viewed edge-on or clipped by a neighbour.
    const halfWidth = Math.hypot(
      section.left.x - section.center.x,
      section.left.z - section.center.z,
    )
    const nearDistance = distance * .2
    const nearHalfWidth = Math.max(1.2, halfWidth * .7)
    const nearCenter: RibbonVertex = {
      x: section.center.x + flowX * nearDistance,
      z: section.center.z + flowZ * nearDistance,
      y: section.center.y + .02,
      depth: .06,
    }
    const nearLeft: RibbonVertex = {
      x: nearCenter.x - flowZ * nearHalfWidth,
      z: nearCenter.z + flowX * nearHalfWidth,
      y: nearCenter.y,
      depth: nearCenter.depth,
    }
    const nearRight: RibbonVertex = {
      x: nearCenter.x + flowZ * nearHalfWidth,
      z: nearCenter.z - flowX * nearHalfWidth,
      y: nearCenter.y,
      depth: nearCenter.depth,
    }
    const midDistance = distance * .5
    const midHalfWidth = Math.max(.8, halfWidth * .42)
    const midCenter: RibbonVertex = {
      x: section.center.x + flowX * midDistance,
      z: section.center.z + flowZ * midDistance,
      y: section.center.y + .012,
      depth: .035,
    }
    const midLeft: RibbonVertex = {
      x: midCenter.x - flowZ * midHalfWidth,
      z: midCenter.z + flowX * midHalfWidth,
      y: midCenter.y,
      depth: midCenter.depth,
    }
    const midRight: RibbonVertex = {
      x: midCenter.x + flowZ * midHalfWidth,
      z: midCenter.z - flowX * midHalfWidth,
      y: midCenter.y,
      depth: midCenter.depth,
    }
    const tip: RibbonVertex = {
      x: section.center.x + flowX * distance,
      z: section.center.z + flowZ * distance,
      y: section.center.y - .012,
      depth: .008,
    }
    appendPolygon([section.left, section.right, nearRight, nearLeft], flowX, flowZ)
    appendPolygon([nearLeft, nearRight, midRight, midLeft], flowX, flowZ)
    appendPolygon([midLeft, midRight, tip], flowX, flowZ)
  }

  const appendJunctionPad = (section: Section, radius: number, flowX: number, flowZ: number): void => {
    // A chain can begin or end at a confluence without owning a terminal
    // marker. A small shared pad hides the miter seam where the neighbouring
    // chain arrives, while keeping the actual endpoint taper for true ends.
    appendRoundCap(section, radius * 1.06, flowX, flowZ)
  }

  for (const reach of reaches) {
    const dx = reach.bx - reach.ax, dz = reach.bz - reach.az
    const length = Math.hypot(dx, dz)
    if (length < 1) continue
    const nx = -dz / length, nz = dx / length
    const flowX = dx / length, flowZ = dz / length
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
      // Keep a substantial submerged throat at a mouth. Tapering to a
      // two-metre point exactly at the shore left a visible pinhole between
      // the analytic river and the clipped basin surface, especially on a
      // low-detail neighbouring tile. The final section is hidden under the
      // receiving water, so this overlap is both safer and more natural.
      const mouthFade = reach.mouth
        ? .32 + .68 * (1 - Math.max(0, Math.min(1, (t - .55) / .45)))
        : 1
      const channelHalfWidth = Math.max(reach.mouth ? 8 : 5, baseWidth * mouthFade)
      const depth = reach.mouth
        ? Math.max(.22, Math.min(4, channelHalfWidth * .035))
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
      appendQuad(a.left, b.left, b.center, a.center, flowX, flowZ)
      appendQuad(a.center, b.center, b.right, a.right, flowX, flowZ)
    }
    // Extend a mouth a short distance below the receiving basin. The basin
    // owns the final water level, while this submerged overlap removes the
    // one-frame-looking seam that otherwise appears where two clipped
    // surfaces meet on separate terrain tiles.
    let last = sections[sections.length - 1]!
    if (reach.mouth && sections.length > 1) {
      const previous = sections[sections.length - 2]!
      const dx = last.center.x - previous.center.x, dz = last.center.z - previous.center.z
      const length = Math.hypot(dx, dz)
      if (length > 1) {
        const overlap = Math.min(80, Math.max(32, Math.hypot(last.left.x - last.center.x, last.left.z - last.center.z) * 2.2))
        const ox = dx / length * overlap, oz = dz / length * overlap
        const submerged = (point: RibbonVertex): RibbonVertex => ({
          x: point.x + ox, z: point.z + oz, y: last.center.y, depth: Math.max(point.depth, .18),
        })
        const nextLeft = submerged(last.left), nextCenter = submerged(last.center), nextRight = submerged(last.right)
        appendQuad(last.left, nextLeft, nextCenter, last.center, flowX, flowZ)
        appendQuad(last.center, nextCenter, nextRight, last.right, flowX, flowZ)
        last = { left: nextLeft, center: nextCenter, right: nextRight }
      }
    }
    // Rounded joins/mouths hide tiny miter gaps when adjacent curved reaches
    // change direction or width. They are clipped with the same tile bounds.
    const first = sections[0]!
    const radius = Math.hypot(first.left.x - first.center.x, first.left.z - first.center.z)
    const source = reach.source ?? true
    const terminal = reach.terminal ?? true
    if (source) {
      if (reach.mouth) appendRoundCap(first, radius, -flowX, -flowZ)
      else appendTaperedCap(first, -flowX, -flowZ, Math.max(140, radius * 3.4))
    } else if (!reach.mouth) {
      appendJunctionPad(first, radius, -flowX, -flowZ)
    }
    if (terminal) {
      if (reach.mouth) appendRoundCap(last, Math.hypot(last.left.x - last.center.x, last.left.z - last.center.z), flowX, flowZ)
      else {
        appendTaperedCap(last, flowX, flowZ, Math.max(140, radius * 3.4))
        // Keep a shallow rounded shoulder at the live section so a bank that
        // rises faster than the feather cannot expose a square terminal edge.
        appendRoundCap(last, Math.hypot(last.left.x - last.center.x, last.left.z - last.center.z) * .82, flowX, flowZ)
      }
    } else if (!reach.mouth) {
      appendJunctionPad(last, Math.hypot(last.left.x - last.center.x, last.left.z - last.center.z), flowX, flowZ)
    }
  }

}
