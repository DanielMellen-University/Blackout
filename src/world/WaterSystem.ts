import { BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, ShapeUtils, Vector2 } from 'three'
import { basinDistance, waterBasinBoundsRadius, type RiverReach, type WaterBasin } from './Hydrology'
import { riverSurface } from './RiverSurface'
import { smoothstep } from './noise'
import { applyWaterAppearance, type WaterWeatherUniforms } from './WaterAppearance'
import { basinOpticalDepth, basinSurfaceSteps, type BasinVertex } from './BasinSurface'

interface WaterVertex { x: number; z: number; bed: number; level: number; basin: number }
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
      if (basins.length > 0 && basinMask && Math.max(levels[a]!, levels[b]!, levels[c]!) > 0 &&
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
    yield* appendAnalyticBasins(basins, reaches, size, originX, originZ, positions, depths, flowValues, flowDirections, waterKinds, waterDrops)
    yield* appendRiverRibbons(reaches, basins, size, originX, originZ, positions, depths, flowValues, flowDirections, waterKinds, waterDrops)
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

/** Water ripples supply local normals in the shader. Do not shade the graded
 * ribbon's individual triangles as rigid, faceted panels at every bend. */
function* computeWaterNormalsSteps(geometry: BufferGeometry): Generator<WaterBuildPhase, void, void> {
  const positions = geometry.getAttribute('position')
  const normals = new BufferAttribute(new Float32Array(positions.count * 3), 3)
  geometry.setAttribute('normal', normals)
  for (let i = 0; i < positions.count; i += 3) {
    // Analytic lake fans and river ribbons can use opposite windings. Keep
    // that sign for DoubleSide's back-face normal flip, but discard the
    // accidental triangular tilt of the graded ribbon's broad surface.
    const ax = positions.getX(i), az = positions.getZ(i)
    const bx = positions.getX(i + 1), bz = positions.getZ(i + 1)
    const cx = positions.getX(i + 2), cz = positions.getZ(i + 2)
    const y = (cz - bz) * (ax - bx) - (cx - bx) * (az - bz) >= 0 ? 1 : -1
    normals.setXYZ(i, 0, y, 0)
    normals.setXYZ(i + 1, 0, y, 0)
    normals.setXYZ(i + 2, 0, y, 0)
    if (i % 96 === 93) yield 'normals'
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
    const surface = yield* basinSurfaceSteps(basin, reaches)
    const { boundary, inner, inlets } = surface
    if (basin.islands?.length) {
      let lake = basin.id ? basinIslandCache.get(basin) : undefined
      if (!lake) {
        const holes = basin.islands.map(island => Array.from({ length: 32 }, (_, i) => {
          const a = -i / 32 * Math.PI * 2
          return new Vector2(island.x - basin.x + Math.cos(a) * island.radius,
            island.z - basin.z + Math.sin(a) * island.radius)
        }))
        const outer = boundary.map(p => new Vector2(p.x, p.z))
        lake = { points: [...outer, ...holes.flat()].map(p => ({ x: p.x, z: p.y, y: basin.level, depth: .08 })),
          triangles: ShapeUtils.triangulateShape(outer, holes) }
        if (basin.id) basinIslandCache.set(basin, lake)
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
            target.y = basin.level; target.depth = basinOpticalDepth(basin, inlets, basin.x + p.x, basin.z + p.z)
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
    // Generated basins share an exact polygon with collision/carving. Do not
    // bridge a concave cove with a different chord on distant LOD tiles.
    const boundaryStep = basin.shoreRadii ? 1 : Math.max(1, Math.ceil(boundary.length / desiredSamples))
    const center: BasinVertex = {
      x: 0, z: 0, y: basin.level,
      depth: basin.sea ? 180 : basin.pond ? 42 : 96,
    }
    const append = (first: BasinVertex, second: BasinVertex, third: BasinVertex): void => {
      for (let index = 0; index < 3; index++) {
        const p = index === 0 ? first : index === 1 ? second : third
        const target = polygonScratch[index]!
        target.x = basin.x + p.x - centerX; target.z = basin.z + p.z - centerZ
        target.y = p.y; target.depth = p.depth
      }
      appendPolygon(polygonScratch, basin.sea ? 2 : basin.pond ? .5 : 1)
    }
    for (let i = 0; i < boundary.length; i += boundaryStep) {
      const edge = boundary[i]!
      const next = boundary[(i + boundaryStep) % boundary.length]!
      const a = inner[i]!, b = inner[(i + boundaryStep) % inner.length]!
      append(edge, next, b); append(edge, b, a)
      // The interior is dark/deep already; its fan cannot paint radial wedges
      // across the narrow, separately tessellated shallow shoreline band.
      append(center, a, b)
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
  const half = size / 2
  type RibbonVertex = { x: number; z: number; y: number; depth: number; kind: number; riverBlend: number }
  type Section = { left: RibbonVertex; center: RibbonVertex; right: RibbonVertex }
  const polygonScratch: RibbonVertex[] = new Array(4)

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
        kind: a.kind + (b.kind - a.kind) * t,
        riverBlend: a.riverBlend + (b.riverBlend - a.riverBlend) * t,
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

  const writePolygon = (
    polygon: readonly RibbonVertex[], flowX: number, flowZ: number, drop: number, flow: number,
  ): void => {
    const first = polygon[0]!
    for (let i = 1; i < polygon.length - 1; i++) {
      const second = polygon[i]!, third = polygon[i + 1]!
      positions.push(first.x, first.y, first.z, second.x, second.y, second.z, third.x, third.y, third.z)
      depths.push(first.depth, second.depth, third.depth)
      flowValues.push(flow * first.riverBlend, flow * second.riverBlend, flow * third.riverBlend)
      flowDirections.push(flowX, flowZ, flowX, flowZ, flowX, flowZ)
      waterKinds.push(first.kind, second.kind, third.kind)
      waterDrops.push(drop * first.riverBlend, drop * second.riverBlend, drop * third.riverBlend)
    }
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
    writePolygon(polygon, flowX, flowZ, drop, flow)
  }

  const appendQuad = (a: RibbonVertex, b: RibbonVertex, c: RibbonVertex, d: RibbonVertex,
    flowX: number, flowZ: number, drop: number, flow: number): void => {
    // Clip the canonical triangles, not the whole non-planar quad. Re-fanning
    // a tile-clipped quad changes its diagonal and therefore its water height.
    appendPolygon(a, b, c, undefined, flowX, flowZ, drop, flow)
    appendPolygon(a, c, d, undefined, flowX, flowZ, drop, flow)
  }

  for (const reach of reaches) {
    const length = Math.hypot(reach.bx - reach.ax, reach.bz - reach.az)
    if (length < .001) continue
    const surface = riverSurface(reach, basins)
    const flowX = (reach.bx - reach.ax) / length, flowZ = (reach.bz - reach.az) / length
    const drop = Math.max(0, Math.min(1, (reach.ya - reach.yb) / length * 5.5))
    const nearby = basins.filter(b => b.regionalSea ? reach.mouth && reach.yb === 0 :
      b.x + waterBasinBoundsRadius(b) + 400 >= surface.minX && b.x - waterBasinBoundsRadius(b) - 400 <= surface.maxX &&
      b.z + waterBasinBoundsRadius(b) + 400 >= surface.minZ && b.z - waterBasinBoundsRadius(b) - 400 <= surface.maxZ)
    const vertex = (data: Float64Array, index: number): RibbonVertex => {
      const x = data[index]!, z = data[index + 2]!
      let blend = 0, kind = 0
      for (const b of nearby) {
        const d = basinDistance(b, x, z)
        const amount = 1 - smoothstep(0, Math.max(100, Math.min(400, reach.wb * 2)), Math.max(0, d))
        if (amount > blend) { blend = amount; kind = (b.sea ? 2 : b.pond ? .5 : 1) * amount }
      }
      return { x: x - originX - half, y: data[index + 1]! + .04,
        z: z - originZ - half, depth: data[index + 3]!, kind, riverBlend: 1 - blend }
    }
    const strength = (left: RibbonVertex, center: RibbonVertex): number => Math.max(.24, Math.min(1,
      .24 + Math.pow(Math.min(1, Math.hypot(left.x - center.x, left.z - center.z) / 90), .65) * .66 + drop * .1))
    if (surface.triangles) {
      const flow = Math.max(.24, Math.min(1, .24 + Math.pow(Math.min(1,
        (reach.wa + reach.wb) * .5 / 90), .65) * .66 + drop * .1))
      for (let i = 0; i < surface.triangles.length; i += 12) {
        appendPolygon(vertex(surface.triangles, i), vertex(surface.triangles, i + 4),
          vertex(surface.triangles, i + 8), undefined, flowX, flowZ, drop, flow)
        if (i % 48 === 36) yield 'river'
      }
      yield 'river'
      continue
    }
    const sections: (Section & { flow: number })[] = []
    for (let i = 0; i < surface.sections.length; i += 12) {
      const left = vertex(surface.sections, i), center = vertex(surface.sections, i + 4)
      sections.push({ left, center, right: vertex(surface.sections, i + 8), flow: strength(left, center) })
    }
    for (let i = 0; i < sections.length - 1; i++) {
      const a = sections[i]!, b = sections[i + 1]!, flow = (a.flow + b.flow) * .5
      appendQuad(a.left, b.left, b.center, a.center, flowX, flowZ, drop, flow)
      appendQuad(a.center, b.center, b.right, a.right, flowX, flowZ, drop, flow)
      if (i % 4 === 3) yield 'river'
    }
    for (let i = 0; i < surface.caps.length; i += 12) {
      const a = vertex(surface.caps, i), b = vertex(surface.caps, i + 4), c = vertex(surface.caps, i + 8)
      appendPolygon(a, b, c, undefined, flowX, flowZ, drop, sections[0]!.flow)
      if (i % 48 === 36) yield 'river'
    }
    yield 'river'
  }
}
