import { BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, ShapeUtils, Vector2, Vector3 } from 'three'
import { basinDistance, waterBasinBoundsRadius, type RiverReach, type WaterBasin } from './Hydrology'
import { applyWaterAppearance, type WaterWeatherUniforms } from './WaterAppearance'

interface WaterVertex { x: number; z: number; bed: number; level: number; basin: number }
interface BasinVertex { x: number; z: number; y: number; depth: number }

/** Cached warped shoreline samples reused by every terrain tile touching a basin. */
const basinBoundaryCache = new WeakMap<WaterBasin, BasinVertex[]>()
const basinIslandCache = new WeakMap<WaterBasin, { points: BasinVertex[]; triangles: number[][] }>()
interface WaterStaging {
  positions: number[]; depths: number[]; flowValues: number[]
  flowDirections: number[]; waterKinds: number[]; waterDrops: number[]
}
// A suspended builder owns its arrays. Retain only one idle workspace, matching
// the old scratch budget; synchronous workers still reuse it between jobs.
const stagingPool: WaterStaging[] = []
function acquireStaging(): WaterStaging {
  return stagingPool.pop() ?? { positions: [], depths: [], flowValues: [],
    flowDirections: [], waterKinds: [], waterDrops: [] }
}
function releaseStaging(staging: WaterStaging): void {
  staging.positions.length = staging.depths.length = staging.flowValues.length = 0
  staging.flowDirections.length = staging.waterKinds.length = staging.waterDrops.length = 0
  if (stagingPool.length === 0) stagingPool.push(staging)
}

export type WaterBuildPhase = 'grid' | 'shore' | 'basin' | 'river' | 'attributes' | 'normals' | 'bounds'
export type WaterMeshSteps = Generator<WaterBuildPhase, Mesh | null, void>

export function makeWaterMaterial(
  clock: { value: number },
  weather: WaterWeatherUniforms | undefined,
  polygonOffset = -2,
  detailScale?: { value: number },
): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: 0x345361, roughness: 0.2, metalness: 0.08,
    side: DoubleSide,
    polygonOffset: true, polygonOffsetFactor: polygonOffset, polygonOffsetUnits: polygonOffset,
  })
  applyWaterAppearance(material, clock, weather, detailScale)
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
  const steps = buildWaterMeshSteps(beds, levels, segs, size, originX, originZ,
    clock, weather, basinMaskOrReaches, reachesArg, basins)
  let result = steps.next()
  while (!result.done) result = steps.next()
  return result.value
}

/** Same output as the synchronous API, with cancellable bounded work batches. */
export function* buildWaterMeshSteps(
  beds: Float32Array, levels: Float32Array, segs: number, size: number,
  originX: number, originZ: number, clock: { value: number }, weather?: WaterWeatherUniforms,
  basinMaskOrReaches?: Float32Array | readonly RiverReach[],
  reachesArg: readonly RiverReach[] = [],
  basins: readonly WaterBasin[] = [],
): WaterMeshSteps {
  // Keep the old reaches-only call shape usable for focused tools and tests,
  // while terrain tiles pass an explicit mask to distinguish rivers from
  // fixed-level lakes and seas.
  const basinMask = basinMaskOrReaches instanceof Float32Array ? basinMaskOrReaches : undefined
  const reaches: readonly RiverReach[] = (basinMaskOrReaches instanceof Float32Array
    ? reachesArg
    : basinMaskOrReaches ?? reachesArg).slice()
  // Terrain's bounds collector reuses a list; later builds cannot overwrite
  // this suspended job's membership. Landmark/reach metadata stays immutable.
  basins = basins.slice()
  const staging = acquireStaging()
  const { positions, depths, flowValues, flowDirections, waterKinds, waterDrops } = staging
  let geometry: BufferGeometry | null = null
  let material: MeshStandardMaterial | null = null
  let delivered = false
  try {
    const stride = segs + 1
    const cell = size / segs
    const input: [WaterVertex, WaterVertex, WaterVertex] = [
      { x: 0, z: 0, bed: 0, level: 0, basin: 0 },
      { x: 0, z: 0, bed: 0, level: 0, basin: 0 },
      { x: 0, z: 0, bed: 0, level: 0, basin: 0 },
    ]
    const intersections: [WaterVertex, WaterVertex, WaterVertex] = [
      { x: 0, z: 0, bed: 0, level: 0, basin: 0 },
      { x: 0, z: 0, bed: 0, level: 0, basin: 0 },
      { x: 0, z: 0, bed: 0, level: 0, basin: 0 },
    ]
    const polygon: WaterVertex[] = []
    const setVertex = (target: WaterVertex, index: number): void => {
      target.x = (index % stride) * cell - size / 2
      target.z = Math.floor(index / stride) * cell - size / 2
      target.bed = beds[index]!
      target.level = levels[index]!
      target.basin = basinMask?.[index] ?? 1
    }
    function triangle(a: number, b: number, c: number): void {
      if (basinMask && basinMask[a]! <= .5 && basinMask[b]! <= .5 && basinMask[c]! <= .5) return
      // Fixed-level basins get their own smooth analytic shoreline below. Do not
      // also rasterize these triangles, or the two surfaces recreate the old
      // sawtooth edge and expose a dark bed wedge between cells.
      if (basins.length > 0 && basinMask && levels[a]! > 0 &&
        (basinMask[a]! > .5 || basinMask[b]! > .5 || basinMask[c]! > .5)) return
      if (beds[a]! >= levels[a]! && beds[b]! >= levels[b]! && beds[c]! >= levels[c]!) return
      setVertex(input[0], a)
      setVertex(input[1], b)
      setVertex(input[2], c)
      polygon.length = 0
      for (let i = 0; i < 3; i++) {
        const p = input[i]!
        const q = input[(i + 1) % 3]!
        const dp = p.basin > .5 ? p.level - p.bed : -1
        const dq = q.basin > .5 ? q.level - q.bed : -1
        if (dp > 0) polygon.push(p)
        if ((dp > 0) !== (dq > 0)) {
          const t = dp / (dp - dq)
          const intersection = intersections[i]!
          intersection.x = p.x + (q.x - p.x) * t
          intersection.z = p.z + (q.z - p.z) * t
          intersection.bed = p.bed + (q.bed - p.bed) * t
          intersection.level = p.level + (q.level - p.level) * t
          intersection.basin = p.basin + (q.basin - p.basin) * t
          polygon.push(intersection)
        }
      }
      const first = polygon[0]!
      for (let i = 1; i < polygon.length - 1; i++) {
        const second = polygon[i]!
        const third = polygon[i + 1]!
        positions.push(
          first.x, first.level, first.z,
          second.x, second.level, second.z,
          third.x, third.level, third.z,
        )
        depths.push(
          Math.max(0, first.level - first.bed),
          Math.max(0, second.level - second.bed),
          Math.max(0, third.level - third.bed),
        )
        flowValues.push(0, 0, 0)
        flowDirections.push(0, 0, 0, 0, 0, 0)
        waterDrops.push(0, 0, 0)
        // Raster water is the compatibility path for a fixed basin. Analytic
        // basins below carry their exact lake, pond, or sea kind.
        const kind = first.level <= 0 ? 2 : 1
        waterKinds.push(kind, kind, kind)
      }
    }
    for (let z = 0; z < segs; z++) for (let x = 0; x < segs; x++) {
      const a = z * stride + x, b = a + stride, c = b + 1, d = a + 1
      triangle(a, b, d)
      triangle(b, c, d)
      if ((z * segs + x) % 32 === 31) yield 'grid'
    }
    yield 'grid'
    yield* appendAnalyticBasins(basins, size, originX, originZ, positions, depths, flowValues, flowDirections, waterKinds, waterDrops)
    yield* appendRiverRibbons(reaches, size, originX, originZ, positions, depths, flowValues, flowDirections, waterKinds, waterDrops)
    if (!positions.length) return null
    geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    yield 'attributes'
    geometry.setAttribute('waterDepth', new Float32BufferAttribute(depths, 1))
    geometry.setAttribute('waterFlow', new Float32BufferAttribute(flowValues, 1))
    geometry.setAttribute('waterFlowDir', new Float32BufferAttribute(flowDirections, 2))
    yield 'attributes'
    geometry.setAttribute('waterKind', new Float32BufferAttribute(waterKinds, 1))
    geometry.setAttribute('waterDrop', new Float32BufferAttribute(waterDrops, 1))
    yield 'attributes'
    yield* computeWaterNormalsSteps(geometry)
    // Water triangles are clipped per terrain cell, so give the renderer an
    // explicit bound for fast streamed-tile culling.
    geometry.computeBoundingSphere()
    yield 'bounds'
    material = makeWaterMaterial(clock, weather)
    const mesh = new Mesh(geometry, material)
    mesh.name = 'WaterSurface'
    mesh.position.set(originX + size / 2, 0, originZ + size / 2)
    delivered = true
    return mesh
  } finally {
    if (!delivered) { geometry?.dispose(); material?.dispose() }
    releaseStaging(staging)
  }
}

/** Preserve Three's non-indexed face-normal and Float32 normalization order. */
function* computeWaterNormalsSteps(geometry: BufferGeometry): Generator<WaterBuildPhase, void, void> {
  const positions = geometry.getAttribute('position')
  const normals = new BufferAttribute(new Float32Array(positions.count * 3), 3)
  geometry.setAttribute('normal', normals)
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const cb = new Vector3(), ab = new Vector3()
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i)
    b.fromBufferAttribute(positions, i + 1)
    c.fromBufferAttribute(positions, i + 2)
    cb.subVectors(c, b)
    ab.subVectors(a, b)
    cb.cross(ab)
    normals.setXYZ(i, cb.x, cb.y, cb.z)
    normals.setXYZ(i + 1, cb.x, cb.y, cb.z)
    normals.setXYZ(i + 2, cb.x, cb.y, cb.z)
    if (i % 96 === 93) yield 'normals'
  }
  for (let i = 0; i < normals.count; i++) {
    cb.fromBufferAttribute(normals, i).normalize()
    normals.setXYZ(i, cb.x, cb.y, cb.z)
    if (i % 96 === 95) yield 'normals'
  }
  normals.needsUpdate = true
  yield 'normals'
}

/**
 * Tessellate each fixed-level basin from its warped analytic shoreline. The
 * fan is clipped to the streamed tile, so a lake keeps one continuous outline
 * while still batching into the existing water draw per tile.
 */
function* appendAnalyticBasins(
  basins: readonly WaterBasin[],
  size: number,
  originX: number,
  originZ: number,
  positions: number[],
  depths: number[],
  flowValues: number[],
  flowDirections: number[],
  waterKinds: number[],
  waterDrops: number[],
): Generator<WaterBuildPhase, void, void> {
  if (!basins.length) return
  const half = size / 2
  const centerX = originX + half, centerZ = originZ + half
  const polygonScratch: BasinVertex[] = [
    { x: 0, z: 0, y: 0, depth: 0 },
    { x: 0, z: 0, y: 0, depth: 0 },
    { x: 0, z: 0, y: 0, depth: 0 },
  ]
  // A convex triangle clipped by four tile edges can produce at most eight
  // vertices. Keep both ping-pong buffers at that bound so shoreline fans do
  // not allocate arrays or intersection records for every tile edge.
  const clipScratchA: BasinVertex[] = Array.from({ length: 8 }, () => ({ x: 0, z: 0, y: 0, depth: 0 }))
  const clipScratchB: BasinVertex[] = Array.from({ length: 8 }, () => ({ x: 0, z: 0, y: 0, depth: 0 }))
  const clipInto = (
    input: BasinVertex[], inputCount: number, axis: 'x' | 'z', bound: number,
    keepGreater: boolean, output: BasinVertex[],
  ): number => {
    if (inputCount <= 0) return 0
    const inside = (point: BasinVertex): boolean => keepGreater ? point[axis] >= bound : point[axis] <= bound
    let outputCount = 0
    let previous = input[inputCount - 1]!
    let previousInside = inside(previous)
    for (let index = 0; index < inputCount; index++) {
      const current = input[index]!
      const currentInside = inside(current)
      if (currentInside !== previousInside) {
        const delta = current[axis] - previous[axis]
        const t = Math.abs(delta) < 1e-9 ? 0 : (bound - previous[axis]) / delta
        const intersection = output[outputCount++]!
        intersection.x = previous.x + (current.x - previous.x) * t
        intersection.z = previous.z + (current.z - previous.z) * t
        intersection.y = previous.y + (current.y - previous.y) * t
        intersection.depth = previous.depth + (current.depth - previous.depth) * t
      }
      if (currentInside) {
        const kept = output[outputCount++]!
        kept.x = current.x
        kept.z = current.z
        kept.y = current.y
        kept.depth = current.depth
      }
      previous = current
      previousInside = currentInside
    }
    return outputCount
  }
  const appendPolygon = (input: BasinVertex[], kind: number): void => {
    let polygon = input
    let polygonCount = 3
    polygonCount = clipInto(polygon, polygonCount, 'x', -half, true, clipScratchA)
    polygon = clipScratchA
    polygonCount = clipInto(polygon, polygonCount, 'x', half, false, clipScratchB)
    polygon = clipScratchB
    polygonCount = clipInto(polygon, polygonCount, 'z', -half, true, clipScratchA)
    polygon = clipScratchA
    polygonCount = clipInto(polygon, polygonCount, 'z', half, false, clipScratchB)
    polygon = clipScratchB
    if (polygonCount < 3) return
    const first = polygon[0]!
    for (let i = 1; i < polygonCount - 1; i++) {
      const second = polygon[i]!
      const third = polygon[i + 1]!
      positions.push(
        first.x, first.y, first.z,
        second.x, second.y, second.z,
        third.x, third.y, third.z,
      )
      depths.push(first.depth, second.depth, third.depth)
      flowValues.push(0, 0, 0)
      flowDirections.push(0, 0, 0, 0, 0, 0)
      waterKinds.push(kind, kind, kind)
      waterDrops.push(0, 0, 0)
    }
  }

  for (const basin of basins) {
    if (basin.regionalSea) continue
    const extent = waterBasinBoundsRadius(basin) + size * .72
    if (Math.abs(basin.x - centerX) > extent || Math.abs(basin.z - centerZ) > extent) continue
    const samples = basin.sea ? 256 : basin.pond ? 96 : 160
    let boundary = basinBoundaryCache.get(basin)
    if (!boundary) {
      boundary = []
      const outline = basin.islands?.length ? { ...basin, islands: undefined } : basin
      const highScale = basin.sea ? 2.65 : basin.pond ? 2.9 : 2.5
      for (let i = 0; i < samples; i++) {
        const angle = i / samples * Math.PI * 2
        let low = 0, high = basin.radius * highScale
        // The warped outline is broad and single-valued along a ray. Expand the
        // bracket defensively for unusually deep coves before binary searching.
        for (let expand = 0; expand < 3 && basinDistance(outline, basin.x + Math.cos(angle) * high,
          basin.z + Math.sin(angle) * high) < 0; expand++) high *= 1.35
        for (let pass = 0; pass < 9; pass++) {
          const radius = (low + high) * .5
          if (basinDistance(outline, basin.x + Math.cos(angle) * radius,
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
        if (i % 8 === 7) yield 'shore'
      }
      basinBoundaryCache.set(basin, boundary)
    }
    if (basin.islands?.length) {
      let lake = basinIslandCache.get(basin)
      if (!lake) {
        const holes = basin.islands.map(island => Array.from({ length: 32 }, (_, i) => {
          const a = -i / 32 * Math.PI * 2
          return new Vector2(island.x - basin.x + Math.cos(a) * island.radius,
            island.z - basin.z + Math.sin(a) * island.radius)
        }))
        const outer = boundary.map(p => new Vector2(p.x, p.z))
        lake = { points: [...outer, ...holes.flat()].map(p => ({ x: p.x, z: p.y, y: basin.level, depth: .08 })),
          triangles: ShapeUtils.triangulateShape(outer, holes) }
        basinIslandCache.set(basin, lake)
      }
      for (let i = 0; i < lake.triangles.length; i++) {
        const triangle = lake.triangles[i]!
        const a = lake.points[triangle[0]!]!, b = lake.points[triangle[1]!]!, c = lake.points[triangle[2]!]!
        const midX = (a.x + b.x + c.x) / 3, midZ = (a.z + b.z + c.z) / 3
        // Hole triangulation has only shoreline vertices. An interior sample
        // stops the whole lake inheriting the shallow edge's pale colour.
        for (let side = 0; side < 3; side++) {
          const points = [lake.points[triangle[side]!]!, lake.points[triangle[(side + 1) % 3]!]!,
            { x: midX, z: midZ }]
          for (let k = 0; k < 3; k++) {
            const p = points[k]!, target = polygonScratch[k]!
            target.x = basin.x + p.x - centerX; target.z = basin.z + p.z - centerZ
            target.y = basin.level; target.depth = Math.max(.08, -basinDistance(basin, basin.x + p.x, basin.z + p.z) * .06)
          }
          appendPolygon(polygonScratch, 1)
        }
        if (i % 8 === 7) yield 'basin'
      }
      continue
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
      polygonScratch[0] = center
      const edgeVertex = polygonScratch[1]!
      edgeVertex.x = basin.x + edge.x - centerX
      edgeVertex.z = basin.z + edge.z - centerZ
      edgeVertex.y = edge.y
      edgeVertex.depth = edge.depth
      const nextVertex = polygonScratch[2]!
      nextVertex.x = basin.x + next.x - centerX
      nextVertex.z = basin.z + next.z - centerZ
      nextVertex.y = next.y
      nextVertex.depth = next.depth
      appendPolygon(polygonScratch, basin.sea ? 2 : basin.pond ? .5 : 1)
      if ((i / boundaryStep) % 8 === 7) yield 'basin'
    }
    yield 'basin'
  }
}

/**
 * Analytic river ribbons retain the exact centerline and graded width emitted
 * by hydrology, even where a terrain tile has too few vertices to clip a
 * narrow stream. Every tile clips its own piece, so adjacent tiles meet at a
 * shared boundary without overlapping geometry.
 */
function* appendRiverRibbons(
  reaches: readonly RiverReach[],
  size: number,
  originX: number,
  originZ: number,
  positions: number[],
  depths: number[],
  flowValues: number[],
  flowDirections: number[],
  waterKinds: number[],
  waterDrops: number[],
): Generator<WaterBuildPhase, void, void> {
  const half = size / 2
  type RibbonVertex = { x: number; z: number; y: number; depth: number }
  type Section = { left: RibbonVertex; center: RibbonVertex; right: RibbonVertex }
  const polygonScratch: RibbonVertex[] = new Array(4)
  const capPoints: RibbonVertex[] = Array.from({ length: 8 }, () => ({ x: 0, z: 0, y: 0, depth: 0 }))

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

  const appendPolygon = (
    a: RibbonVertex, b: RibbonVertex, c: RibbonVertex, d: RibbonVertex | undefined,
    flowX: number, flowZ: number, drop: number, flow: number,
  ): void => {
    polygonScratch[0] = a
    polygonScratch[1] = b
    polygonScratch[2] = c
    polygonScratch.length = d ? 4 : 3
    if (d) polygonScratch[3] = d
    let polygon = polygonScratch
    polygon = clip(polygon, 'x', -half, true)
    polygon = clip(polygon, 'x', half, false)
    polygon = clip(polygon, 'z', -half, true)
    polygon = clip(polygon, 'z', half, false)
    const first = polygon[0]!
    for (let i = 1; i < polygon.length - 1; i++) {
      const second = polygon[i]!
      const third = polygon[i + 1]!
      positions.push(
        first.x, first.y, first.z,
        second.x, second.y, second.z,
        third.x, third.y, third.z,
      )
      depths.push(first.depth, second.depth, third.depth)
      flowValues.push(flow, flow, flow)
      flowDirections.push(flowX, flowZ, flowX, flowZ, flowX, flowZ)
      waterKinds.push(0, 0, 0)
      waterDrops.push(drop, drop, drop)
    }
  }

  const appendQuad = (a: RibbonVertex, b: RibbonVertex, c: RibbonVertex, d: RibbonVertex,
    flowX: number, flowZ: number, drop: number, flow: number): void => {
    appendPolygon(a, b, c, d, flowX, flowZ, drop, flow)
  }

  const appendRoundCap = (
    section: Section, radius: number, flowX: number, flowZ: number, drop: number, flow: number,
  ): void => {
    const center = section.center
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2
      const point = capPoints[i]!
      point.x = center.x + Math.cos(angle) * radius
      point.z = center.z + Math.sin(angle) * radius
      point.y = center.y
      point.depth = Math.max(.08, center.depth * .5)
    }
    for (let i = 0; i < capPoints.length; i++) {
      appendPolygon(center, capPoints[i]!, capPoints[(i + 1) % capPoints.length]!, undefined,
        flowX, flowZ, drop, flow)
    }
  }

  const appendTaperedCap = (
    section: Section, flowX: number, flowZ: number, distance: number, drop: number, flow: number,
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
    appendPolygon(section.left, section.right, nearRight, nearLeft, flowX, flowZ, drop, flow)
    appendPolygon(nearLeft, nearRight, midRight, midLeft, flowX, flowZ, drop, flow)
    appendPolygon(midLeft, midRight, tip, undefined, flowX, flowZ, drop, flow)
  }

  const appendJunctionPad = (
    section: Section, radius: number, flowX: number, flowZ: number, drop: number, flow: number,
  ): void => {
    // A chain can begin or end at a confluence without owning a terminal
    // marker. A small shared pad hides the miter seam where the neighbouring
    // chain arrives, while keeping the actual endpoint taper for true ends.
    appendRoundCap(section, radius * 1.06, flowX, flowZ, drop, flow)
  }

  for (const reach of reaches) {
    const dx = reach.bx - reach.ax, dz = reach.bz - reach.az
    const length = Math.hypot(dx, dz)
    if (length < 1) continue
    const nx = -dz / length, nz = dx / length
    const flowX = dx / length, flowZ = dz / length
    // A bounded grade signal lets steep reaches read as rapids without
    // changing their exact water surface or adding a cascade mesh.
    const drop = Math.max(0, Math.min(1, (reach.ya - reach.yb) / length * 5.5))
    // A section roughly every 120 m is enough for visible meanders without
    // turning a whole catchment into a high-poly water surface.
    const sections: (Section & { flow: number })[] = []
    const steps = Math.max(4, Math.min(12, Math.ceil(length / 120)))
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      let sectionNX = nx, sectionNZ = nz
      if (reach.tangentAX !== undefined && reach.tangentBX !== undefined) {
        const tx = reach.tangentAX + (reach.tangentBX - reach.tangentAX) * t
        const tz = reach.tangentAZ! + (reach.tangentBZ! - reach.tangentAZ!) * t
        const magnitude = Math.hypot(tx, tz)
        sectionNX = -tz / magnitude; sectionNZ = tx / magnitude
      }
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
      // Flow strength is intentionally tied to the local channel size and
      // grade. Small tributaries stay calmer, while broad or steep reaches
      // receive the stronger riffle/highlight treatment in the shared shader.
      // Clamp the result so a narrow stream never disappears into a dry tint
      // and a huge channel cannot become an over-bright cyan stripe.
      const flow = Math.max(.24, Math.min(1,
        .24 + Math.pow(Math.min(1, channelHalfWidth / 90), .65) * .66 + drop * .1,
      ))
      const centerX = baseX, centerZ = baseZ
      sections.push({
        left: { x: centerX + sectionNX * channelHalfWidth - originX - half, z: centerZ + sectionNZ * channelHalfWidth - originZ - half, y, depth: edgeDepth },
        center: { x: centerX - originX - half, z: centerZ - originZ - half, y, depth },
        right: { x: centerX - sectionNX * channelHalfWidth - originX - half, z: centerZ - sectionNZ * channelHalfWidth - originZ - half, y, depth: edgeDepth },
        flow,
      })
    }

    for (let step = 0; step < sections.length - 1; step++) {
      const a = sections[step]!, b = sections[step + 1]!
      const flow = (a.flow + b.flow) * .5
      appendQuad(a.left, b.left, b.center, a.center, flowX, flowZ, drop, flow)
      appendQuad(a.center, b.center, b.right, a.right, flowX, flowZ, drop, flow)
      if (step % 4 === 3) yield 'river'
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
        appendQuad(last.left, nextLeft, nextCenter, last.center, flowX, flowZ, drop, last.flow)
        appendQuad(last.center, nextCenter, nextRight, last.right, flowX, flowZ, drop, last.flow)
        last = { left: nextLeft, center: nextCenter, right: nextRight, flow: last.flow }
      }
    }
    // Rounded joins/mouths hide tiny miter gaps when adjacent curved reaches
    // change direction or width. They are clipped with the same tile bounds.
    const first = sections[0]!
    const radius = Math.hypot(first.left.x - first.center.x, first.left.z - first.center.z)
    const source = reach.source ?? true
    const terminal = reach.terminal ?? true
    if (source) {
      if (reach.mouth) appendRoundCap(first, radius, -flowX, -flowZ, drop, first.flow)
      else appendTaperedCap(first, -flowX, -flowZ, Math.max(140, radius * 3.4), drop, first.flow)
    } else if (!reach.mouth && reach.tangentAX === undefined) {
      appendJunctionPad(first, radius, -flowX, -flowZ, drop, first.flow)
    }
    if (terminal) {
      if (reach.mouth) appendRoundCap(last, Math.hypot(last.left.x - last.center.x, last.left.z - last.center.z), flowX, flowZ, drop, last.flow)
      else {
        appendTaperedCap(last, flowX, flowZ, Math.max(140, radius * 3.4), drop, last.flow)
        // Keep a shallow rounded shoulder at the live section so a bank that
        // rises faster than the feather cannot expose a square terminal edge.
        appendRoundCap(last, Math.hypot(last.left.x - last.center.x, last.left.z - last.center.z) * .82, flowX, flowZ, drop, last.flow)
      }
    } else if (!reach.mouth && reach.tangentBX === undefined) {
      appendJunctionPad(last, Math.hypot(last.left.x - last.center.x, last.left.z - last.center.z), flowX, flowZ, drop, last.flow)
    }
    yield 'river'
  }

}
