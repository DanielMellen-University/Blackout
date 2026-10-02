import { BufferAttribute, BufferGeometry, Float32BufferAttribute, PlaneGeometry, Sphere, Vector3 } from 'three'
import { applySlopeShadingInto, biomeColorInto, sampleClimateInto, sampleTerrainHeightFast, type Climate } from './terrainSample'
import { createClimateSample } from './Geography'
import { CATCHMENT_SIZE, riverReachesInBounds, waterLandmarks, type RiverReach, type WaterBasin } from './Hydrology'
import { buildWaterMesh } from './WaterSystem'

export const CHUNK_SIZE = 420
export type TerrainLod = 0 | 1 | 2
export type TerrainGeometryQuality = 'full' | 'fallback'
const SEGS_NEAR = 24
const SEGS_MID = 12
// Far tiles still shape the visible mountain horizon. Six samples made the
// otherwise rounded landforms collapse into triangular needle silhouettes;
// eight keeps the horizon smooth while remaining far below mid-tile detail.
const SEGS_FAR = 8
const WATER_TARGET_CELL_M: Record<TerrainLod, number> = { 0: 7, 1: 20, 2: 60 }
const WATER_MAX_SEGS: Record<TerrainLod, number> = { 0: 56, 1: 40, 2: 16 }
const RIVER_TARGET_CELL_M: Record<TerrainLod, number> = { 0: 10, 1: 26, 2: 70 }
const RIVER_MAX_SEGS: Record<TerrainLod, number> = { 0: 64, 1: 64, 2: 16 }
const TERRAIN_SKIRT_DEPTH = 60
const CLIMATE_POOL_LIMIT = 1024
const climatePool: Climate[] = []
// Skirt geometry is converted to typed attributes before this synchronous
// builder returns, so its numeric staging arrays can be reused by the next
// tile without retaining one allocation per coarse edge set.
const skirtPositionsScratch: number[] = []
const skirtColorsScratch: number[] = []
/** Reused detailed river list; generation is synchronous within each worker. */
const riverReachScratch: RiverReach[] = []
/** Reused fixed-basin list; water meshes consume it before generation returns. */
const basinScratch: WaterBasin[] = []

function acquireClimateGrid(count: number): Climate[] {
  const samples = new Array<Climate>((count + 1) * (count + 1))
  for (let i = 0; i < samples.length; i++) samples[i] = climatePool.pop() ?? createClimateSample()
  return samples
}

function releaseClimateGrid(samples: readonly Climate[]): void {
  for (const climate of samples) {
    if (climatePool.length >= CLIMATE_POOL_LIMIT) break
    climatePool.push(climate)
  }
}

export interface TerrainGeometryBuffers {
  attributes: Record<string, { array: Float32Array; itemSize: number }>
  index: Uint32Array | Uint16Array | null
  bounds: { x: number; y: number; z: number; radius: number }
}

export interface TerrainGeometryData {
  ground: TerrainGeometryBuffers
  water: TerrainGeometryBuffers | null
  heights: Float32Array
  waterLevels: Float32Array
  segs: number
}

/** CPU-only payload shared by workers and the synchronous fallback. */
function serializeGeometry(geometry: BufferGeometry): TerrainGeometryBuffers {
  const attributes: TerrainGeometryBuffers['attributes'] = {}
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    attributes[name] = { array: attribute.array as Float32Array, itemSize: attribute.itemSize }
  }
  if (!geometry.boundingSphere) geometry.computeBoundingSphere()
  const sphere = geometry.boundingSphere!
  return { attributes, index: geometry.index?.array as Uint32Array | Uint16Array | undefined ?? null,
    bounds: { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z, radius: sphere.radius } }
}

export function deserializeTerrainGeometry(data: TerrainGeometryBuffers): BufferGeometry {
  const geometry = new BufferGeometry()
  for (const [name, attribute] of Object.entries(data.attributes)) {
    geometry.setAttribute(name, new BufferAttribute(attribute.array, attribute.itemSize))
  }
  if (data.index) geometry.setIndex(new BufferAttribute(data.index, 1))
  geometry.boundingSphere = new Sphere(new Vector3(data.bounds.x, data.bounds.y, data.bounds.z), data.bounds.radius)
  return geometry
}

/** Deduplicate backing buffers so postMessage can transfer without copying. */
export function terrainTransferables(payload: TerrainGeometryData): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = []
  appendUniqueTransferable(buffers, payload.heights.buffer as ArrayBuffer)
  appendUniqueTransferable(buffers, payload.waterLevels.buffer as ArrayBuffer)
  appendGeometryTransferables(buffers, payload.ground)
  if (payload.water) appendGeometryTransferables(buffers, payload.water)
  return buffers
}

function appendGeometryTransferables(buffers: ArrayBuffer[], data: TerrainGeometryBuffers): void {
  for (const name in data.attributes) {
    const attribute = data.attributes[name]
    if (attribute) appendUniqueTransferable(buffers, attribute.array.buffer as ArrayBuffer)
  }
  if (data.index) appendUniqueTransferable(buffers, data.index.buffer as ArrayBuffer)
}

function appendUniqueTransferable(buffers: ArrayBuffer[], buffer: ArrayBuffer): void {
  for (const existing of buffers) if (existing === buffer) return
  buffers.push(buffer)
}

/** True when a streamed tile overlaps an analytic pond that coarse vertices can miss. */
export function pondIntersectsBounds(originX: number, originZ: number, span: number): boolean {
  const minX = originX, minZ = originZ, maxX = originX + span, maxZ = originZ + span
  const minCx = Math.floor(minX / CATCHMENT_SIZE), maxCx = Math.floor((maxX - 1) / CATCHMENT_SIZE)
  const minCz = Math.floor(minZ / CATCHMENT_SIZE), maxCz = Math.floor((maxZ - 1) / CATCHMENT_SIZE)
  for (let cx = minCx; cx <= maxCx; cx++) for (let cz = minCz; cz <= maxCz; cz++) {
    for (const basin of waterLandmarks(cx, cz)) {
      if (!basin.pond) continue
      const nearestX = Math.max(minX, Math.min(maxX, basin.x))
      const nearestZ = Math.max(minZ, Math.min(maxZ, basin.z))
      if (Math.hypot(nearestX - basin.x, nearestZ - basin.z) < basin.radius * 1.7 + 120) return true
    }
  }
  return false
}

function basinsInBounds(originX: number, originZ: number, span: number): WaterBasin[] {
  const result = basinScratch
  result.length = 0
  // The largest generated sea has radius 4500; warped shorelines remain
  // inside 1.75 radii. Broad far tiles must not expand queries by their span.
  const margin = Math.min(span * .8, 8000)
  const minCx = Math.floor((originX - margin) / CATCHMENT_SIZE)
  const maxCx = Math.floor((originX + span + margin) / CATCHMENT_SIZE)
  const minCz = Math.floor((originZ - margin) / CATCHMENT_SIZE)
  const maxCz = Math.floor((originZ + span + margin) / CATCHMENT_SIZE)
  for (let cx = minCx; cx <= maxCx; cx++) for (let cz = minCz; cz <= maxCz; cz++) {
    for (const basin of waterLandmarks(cx, cz)) {
      const extent = basin.radius * 1.75 + span * .5
      const centerX = originX + span * .5, centerZ = originZ + span * .5
      if (Math.abs(basin.x - centerX) <= extent && Math.abs(basin.z - centerZ) <= extent) {
        result.push(basin)
      }
    }
  }
  return result
}

export function segsForLod(lod: TerrainLod): number {
  if (lod === 0) return SEGS_NEAR
  if (lod === 1) return SEGS_MID
  return SEGS_FAR
}

/** Water-only grid budget; distant water can be coarser behind the fog. */
export function waterSegsForLod(lod: TerrainLod, span: number): number {
  return Math.min(WATER_MAX_SEGS[lod], Math.max(segsForLod(lod),
    Math.ceil(span / WATER_TARGET_CELL_M[lod])))
}

/**
 * Build one non-indexed skirt strip for each dry tile edge. The strips are
 * merged into the terrain draw, so the quadtree gets crack coverage without
 * adding one draw call per streamed tile. Wet edges stay open for clipped
 * lakes and rivers, avoiding the old artificial dark water dams.
 */
export function buildTerrainSkirtGeometry(
  heights: Float32Array,
  waterLevels: Float32Array,
  colors: Float32Array,
  segs: number,
  span: number,
  depth = TERRAIN_SKIRT_DEPTH,
  edges: readonly [boolean, boolean, boolean, boolean] = [true, true, true, true],
): BufferGeometry | null {
  const stride = segs + 1
  if (heights.length !== stride * stride || waterLevels.length !== heights.length ||
    colors.length !== heights.length * 3 || segs < 1 || depth <= 0) return null
  const positions = skirtPositionsScratch
  const skirtColors = skirtColorsScratch
  positions.length = 0
  skirtColors.length = 0
  const half = span * .5
  const cell = span / segs
  const addVertex = (x: number, y: number, z: number, source: number, shade: number): void => {
    positions.push(x, y, z)
    skirtColors.push(colors[source * 3]! * shade, colors[source * 3 + 1]! * shade,
      colors[source * 3 + 2]! * shade)
  }
  const add = (a: number, b: number): void => {
    // One wet point is enough to leave the whole edge open. This is slightly
    // conservative, but keeps a shoreline from acquiring a single isolated
    // wall segment when the analytic water surface crosses the edge.
    if (waterLevels[a]! > heights[a]! + .2 || waterLevels[b]! > heights[b]! + .2) return
    const ax = -half + (a % stride) * cell
    const az = -half + Math.floor(a / stride) * cell
    const bx = -half + (b % stride) * cell
    const bz = -half + Math.floor(b / stride) * cell
    const heightA = heights[a]!
    const heightB = heights[b]!
    addVertex(ax, heightA, az, a, 1)
    addVertex(bx, heightB, bz, b, 1)
    addVertex(ax, heightA - depth, az, a, .97)
    addVertex(bx, heightB, bz, b, 1)
    addVertex(bx, heightB - depth, bz, b, .97)
    addVertex(ax, heightA - depth, az, a, .97)
  }
  if (edges[0]) for (let ix = 0; ix < segs; ix++) add(ix, ix + 1)
  if (edges[1]) for (let iz = 0; iz < segs; iz++) add(iz * stride + segs, (iz + 1) * stride + segs)
  if (edges[2]) for (let ix = segs; ix > 0; ix--) add(segs * stride + ix, segs * stride + ix - 1)
  if (edges[3]) for (let iz = segs; iz > 0; iz--) add(iz * stride, (iz - 1) * stride)
  if (!positions.length) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(skirtColors, 3))
  geometry.computeVertexNormals()
  // Skirt triangles are vertical by design. Leaving their raw wall normals
  // untouched makes coarse/fine LOD seams collapse into dark hairlines under
  // the directional key light. Bias only the skirt copy toward a soft upward
  // normal so the crack cover inherits the terrain's readable daylight while
  // preserving the existing geometry and draw budget.
  const normals = geometry.getAttribute('normal')
  for (let i = 0; i < normals.count; i++) {
    const nx = normals.getX(i)
    const ny = Math.max(0.56, normals.getY(i))
    const nz = normals.getZ(i)
    const length = Math.hypot(nx, ny, nz)
    if (length > 1e-6) normals.setXYZ(i, nx / length, ny / length, nz / length)
  }
  geometry.computeBoundingSphere()
  return geometry
}

function mergeTerrainSkirt(
  terrain: BufferGeometry,
  skirt: BufferGeometry,
): BufferGeometry {
  const mainPos = terrain.getAttribute('position') as BufferAttribute
  const mainColor = terrain.getAttribute('color') as BufferAttribute
  const mainNormal = terrain.getAttribute('normal') as BufferAttribute
  const skirtPos = skirt.getAttribute('position') as BufferAttribute
  const skirtColor = skirt.getAttribute('color') as BufferAttribute
  const skirtNormal = skirt.getAttribute('normal') as BufferAttribute
  const position = new Float32Array(mainPos.count * 3 + skirtPos.count * 3)
  const color = new Float32Array(mainColor.count * 3 + skirtColor.count * 3)
  const normal = new Float32Array(mainNormal.count * 3 + skirtNormal.count * 3)
  position.set(mainPos.array as Float32Array)
  position.set(skirtPos.array as Float32Array, mainPos.count * 3)
  color.set(mainColor.array as Float32Array)
  color.set(skirtColor.array as Float32Array, mainColor.count * 3)
  normal.set(mainNormal.array as Float32Array)
  normal.set(skirtNormal.array as Float32Array, mainNormal.count * 3)
  const merged = new BufferGeometry()
  merged.setAttribute('position', new BufferAttribute(position, 3))
  merged.setAttribute('color', new BufferAttribute(color, 3))
  merged.setAttribute('normal', new BufferAttribute(normal, 3))
  const uv = terrain.getAttribute('uv') as BufferAttribute | undefined
  if (uv) {
    const mergedUv = new Float32Array(uv.count * 2 + skirtPos.count * 2)
    mergedUv.set(uv.array as Float32Array)
    merged.setAttribute('uv', new BufferAttribute(mergedUv, 2))
  }
  const mainIndex = terrain.index?.array
  if (mainIndex) {
    const index = new Uint32Array(mainIndex.length + skirtPos.count)
    index.set(mainIndex as Uint16Array | Uint32Array)
    for (let i = 0; i < skirtPos.count; i++) index[mainIndex.length + i] = mainPos.count + i
    merged.setIndex(new BufferAttribute(index, 1))
  }
  merged.computeBoundingSphere()
  return merged
}

/** Generate deterministic geometry without scene objects or renderer access. */
export function generateTerrainGeometry(
  originX: number,
  originZ: number,
  lod: TerrainLod,
  size = 1,
  skirtEdges: readonly [boolean, boolean, boolean, boolean] | null = null,
  quality: TerrainGeometryQuality = 'full',
): TerrainGeometryData {
  const span = CHUNK_SIZE * size
  // Older browsers can lack module workers, so the synchronous fallback must
  // stay responsive while the full worker path retains the authored horizon.
  // Far fallback tiles are hidden behind fog and rebuild at full detail when
  // they approach the jet.
  const reducedFar = quality === 'fallback' && lod === 2
  const baseSegs = reducedFar
    ? (size > 1 ? 8 : 4)
    : size > 1 ? SEGS_MID : segsForLod(lod)
  const reaches = reducedFar
    ? []
    : riverReachesInBounds(originX, originZ, originX + span, originZ + span, 0, riverReachScratch)
  const riverSegs = Math.min(RIVER_MAX_SEGS[lod],
    Math.max(baseSegs, Math.ceil(span / RIVER_TARGET_CELL_M[lod])))
  const detailSegs = Math.max(baseSegs, waterSegsForLod(lod, span), reaches.length ? riverSegs : 0)
  // Analytic hydrology determines the grid before expensive colors/normals.
  // Ocean detection still probes the base grid; shared vertices are reused
  // if that probe promotes the tile, instead of constructing two meshes.
  let segs = reducedFar
    ? baseSegs
    : reaches.length || pondIntersectsBounds(originX, originZ, span) ? detailSegs : baseSegs
  // Sampling is deterministic for a world coordinate. Avoid a string-keyed
  // cache here: every vertex otherwise creates a coordinate string and a Map
  // entry even when the tile is never promoted to water detail. Promotion
  // recomputes the few shared coordinates instead of carrying that churn into
  // every worker request.
  const climatesForGrid = (count: number): Climate[] => {
    const samples = acquireClimateGrid(count)
    for (let iz = 0; iz <= count; iz++) for (let ix = 0; ix <= count; ix++) {
      const wx = originX + ix * span / count, wz = originZ + iz * span / count
      sampleClimateInto(samples[iz * (count + 1) + ix]!, wx, wz)
    }
    return samples
  }
  let climates = climatesForGrid(segs)
  if (!reducedFar && segs < detailSegs && climates.some(climate => (climate.waterLevel ?? 0) > climate.height + .01)) {
    releaseClimateGrid(climates)
    segs = detailSegs
    climates = climatesForGrid(segs)
  }
  let geo: BufferGeometry = new PlaneGeometry(span, span, segs, segs)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const heights = new Float32Array(pos.count)
  const waterLevels = new Float32Array(pos.count)
  const basinMask = new Float32Array(pos.count)
  const stride = segs + 1
  const cell = span / segs
  const vertexColor: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < pos.count; i++) {
    const wx = originX + (i % stride) * span / segs
    const wz = originZ + Math.floor(i / stride) * span / segs
    const climate = climates[i]!
    const h = climate.height
    heights[i] = h
    waterLevels[i] = climate.waterLevel ?? 0
    basinMask[i] = climate.biome === 'ocean' || (climate.biome === 'water' &&
      climate.features.lake + climate.features.pond > climate.features.river * .55) ? 1 : 0
    pos.setY(i, h)
    biomeColorInto(vertexColor, climate.biome, h, climate.moisture, wx, wz,
      climate.features, climate.coastal, climate.land, climate.biomeB, climate.biomeMix,
      climate.biomeWeights, climate.landform)
    colors[i * 3] = vertexColor[0]
    colors[i * 3 + 1] = vertexColor[1]
    colors[i * 3 + 2] = vertexColor[2]
  }
  // Neighbour samples outside the tile give shared edges the same normal.
  // Clamping to an edge vertex used to halve the slope along every seam.
  const gradientX = new Float32Array(heights.length)
  const gradientZ = new Float32Array(heights.length)
  for (let iz = 0; iz < stride; iz++) for (let ix = 0; ix < stride; ix++) {
    const i = iz * stride + ix
    const wx = originX + ix * cell
    const wz = originZ + iz * cell
    const hl = ix > 0 ? heights[i - 1]! : Math.fround(sampleTerrainHeightFast(wx - cell, wz))
    const hr = ix < segs ? heights[i + 1]! : Math.fround(sampleTerrainHeightFast(wx + cell, wz))
    const hd = iz > 0 ? heights[i - stride]! : Math.fround(sampleTerrainHeightFast(wx, wz - cell))
    const hu = iz < segs ? heights[i + stride]! : Math.fround(sampleTerrainHeightFast(wx, wz + cell))
    gradientX[i] = (hr - hl) / (2 * cell)
    gradientZ[i] = (hu - hd) / (2 * cell)
  }
  {
    const shaded: [number, number, number] = [0, 0, 0]
    for (let iz = 0; iz < stride; iz++) {
      for (let ix = 0; ix < stride; ix++) {
        const i = iz * stride + ix
        const dx = gradientX[i]!
        const dz = gradientZ[i]!
        const slope = Math.min(1, Math.hypot(dx, dz) / 2.2)
        applySlopeShadingInto(shaded, colors[i * 3]!, colors[i * 3 + 1]!, colors[i * 3 + 2]!, slope)
        colors[i * 3] = shaded[0]
        colors[i * 3 + 1] = shaded[1]
        colors[i * 3 + 2] = shaded[2]
      }
    }
  }

  geo.setAttribute('color', new BufferAttribute(colors, 3))
  // Shared world-space edge samples keep neighbouring tiles aligned. A
  // merged dry-edge skirt covers the remaining T-junctions between quadtree
  // LODs while wet edges stay open for independent water clipping.
  // PlaneGeometry already allocated normals; every value is replaced below.
  const normals = geo.attributes.normal as BufferAttribute
  for (let i = 0; i < heights.length; i++) {
    const dx = gradientX[i]!
    const dz = gradientZ[i]!
    const length = Math.hypot(dx, 1, dz)
    normals.setXYZ(i, -dx / length, 1 / length, -dz / length)
  }
  const skirt = lod === 0 || !skirtEdges ? null : buildTerrainSkirtGeometry(
    heights, waterLevels, colors, segs, span, TERRAIN_SKIRT_DEPTH, skirtEdges,
  )
  if (skirt) {
    const merged = mergeTerrainSkirt(geo, skirt)
    geo.dispose()
    skirt.dispose()
    geo = merged
  }
  const waterMesh = reducedFar
    ? null
    : buildWaterMesh(heights, waterLevels, segs, span, originX, originZ,
      { value: 0 }, undefined, basinMask, reaches, basinsInBounds(originX, originZ, span))
  const ground = serializeGeometry(geo)
  const water = waterMesh ? serializeGeometry(waterMesh.geometry) : null
  geo.dispose()
  if (waterMesh) {
    waterMesh.geometry.dispose()
    const materials = Array.isArray(waterMesh.material) ? waterMesh.material : [waterMesh.material]
    for (const material of materials) material.dispose()
  }
  releaseClimateGrid(climates)
  return { ground, water, heights, waterLevels, segs }
}
