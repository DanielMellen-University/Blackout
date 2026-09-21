import { BufferAttribute, BufferGeometry, Float32BufferAttribute, PlaneGeometry, Sphere, Vector3 } from 'three'
import { applySlopeShading, biomeColor, sampleClimate, type Climate } from './terrainSample'
import { CATCHMENT_SIZE, riverReachesInBounds, waterLandmarks, type WaterBasin } from './Hydrology'
import { buildWaterMesh } from './WaterSystem'

export const CHUNK_SIZE = 420
export type TerrainLod = 0 | 1 | 2
export type TerrainGeometryQuality = 'full' | 'fallback'
const SEGS_NEAR = 24
const SEGS_MID = 12
const SEGS_FAR = 6
const WATER_TARGET_CELL_M: Record<TerrainLod, number> = { 0: 7, 1: 20, 2: 60 }
const WATER_MAX_SEGS: Record<TerrainLod, number> = { 0: 56, 1: 40, 2: 16 }
const RIVER_TARGET_CELL_M: Record<TerrainLod, number> = { 0: 10, 1: 26, 2: 70 }
const RIVER_MAX_SEGS: Record<TerrainLod, number> = { 0: 64, 1: 64, 2: 16 }
const TERRAIN_SKIRT_DEPTH = 60

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
  const buffers = new Set<ArrayBuffer>()
  buffers.add(payload.heights.buffer as ArrayBuffer)
  buffers.add(payload.waterLevels.buffer as ArrayBuffer)
  for (const data of [payload.ground, payload.water]) {
    if (!data) continue
    for (const attribute of Object.values(data.attributes)) buffers.add(attribute.array.buffer as ArrayBuffer)
    if (data.index) buffers.add(data.index.buffer as ArrayBuffer)
  }
  return [...buffers]
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
  const result: WaterBasin[] = []
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
  const positions: number[] = []
  const skirtColors: number[] = []
  const half = span * .5
  const cell = span / segs
  const add = (a: number, b: number): void => {
    // One wet point is enough to leave the whole edge open. This is slightly
    // conservative, but keeps a shoreline from acquiring a single isolated
    // wall segment when the analytic water surface crosses the edge.
    if (waterLevels[a]! > heights[a]! + .2 || waterLevels[b]! > heights[b]! + .2) return
    const ax = -half + (a % stride) * cell
    const az = -half + Math.floor(a / stride) * cell
    const bx = -half + (b % stride) * cell
    const bz = -half + Math.floor(b / stride) * cell
    const values = [
      [ax, heights[a]!, az], [bx, heights[b]!, bz],
      [ax, heights[a]! - depth, az], [bx, heights[b]! - depth, bz],
    ] as const
    for (const [i, j, k] of [[0, 1, 2], [1, 3, 2]] as const) {
      for (const index of [i, j, k]) {
        const point = values[index]!
        positions.push(point[0], point[1], point[2])
        const source = index === 3 ? b : index === 2 ? a : index === 1 ? b : a
        const shade = index >= 2 ? .97 : 1
        skirtColors.push(colors[source * 3]! * shade, colors[source * 3 + 1]! * shade,
          colors[source * 3 + 2]! * shade)
      }
    }
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
    : riverReachesInBounds(originX, originZ, originX + span, originZ + span)
  const riverSegs = Math.min(RIVER_MAX_SEGS[lod],
    Math.max(baseSegs, Math.ceil(span / RIVER_TARGET_CELL_M[lod])))
  const detailSegs = Math.max(baseSegs, waterSegsForLod(lod, span), reaches.length ? riverSegs : 0)
  // Analytic hydrology determines the grid before expensive colors/normals.
  // Ocean detection still probes the base grid; shared vertices are reused
  // if that probe promotes the tile, instead of constructing two meshes.
  let segs = reducedFar
    ? baseSegs
    : reaches.length || pondIntersectsBounds(originX, originZ, span) ? detailSegs : baseSegs
  const climateCache = new Map<string, Climate>()
  const climatesForGrid = (count: number): Climate[] => {
    const samples: Climate[] = []
    for (let iz = 0; iz <= count; iz++) for (let ix = 0; ix <= count; ix++) {
      const wx = originX + ix * span / count, wz = originZ + iz * span / count
      const key = `${wx},${wz}`
      let climate = climateCache.get(key)
      if (!climate) {
        climate = sampleClimate(wx, wz)
        climateCache.set(key, climate)
      }
      samples.push(climate)
    }
    return samples
  }
  let climates = climatesForGrid(segs)
  if (!reducedFar && segs < detailSegs && climates.some(climate => (climate.waterLevel ?? 0) > climate.height + .01)) {
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
    const [r, g, b] = biomeColor(climate.biome, h, climate.moisture, wx, wz,
      climate.features, climate.coastal, climate.land, climate.biomeB, climate.biomeMix,
      climate.biomeWeights, climate.landform)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }
  // Neighbour samples outside the tile give shared edges the same normal.
  // Clamping to an edge vertex used to halve the slope along every seam.
  const gradientX = new Float32Array(heights.length)
  const gradientZ = new Float32Array(heights.length)
  for (let iz = 0; iz < stride; iz++) for (let ix = 0; ix < stride; ix++) {
    const i = iz * stride + ix
    const wx = originX + ix * cell
    const wz = originZ + iz * cell
    const hl = ix > 0 ? heights[i - 1]! : Math.fround(sampleClimate(wx - cell, wz).height)
    const hr = ix < segs ? heights[i + 1]! : Math.fround(sampleClimate(wx + cell, wz).height)
    const hd = iz > 0 ? heights[i - stride]! : Math.fround(sampleClimate(wx, wz - cell).height)
    const hu = iz < segs ? heights[i + stride]! : Math.fround(sampleClimate(wx, wz + cell).height)
    gradientX[i] = (hr - hl) / (2 * cell)
    gradientZ[i] = (hu - hd) / (2 * cell)
  }
  {
    for (let iz = 0; iz < stride; iz++) {
      for (let ix = 0; ix < stride; ix++) {
        const i = iz * stride + ix
        const dx = gradientX[i]!
        const dz = gradientZ[i]!
        const slope = Math.min(1, Math.hypot(dx, dz) / 2.2)
        const shaded = applySlopeShading(
          [colors[i * 3]!, colors[i * 3 + 1]!, colors[i * 3 + 2]!],
          slope,
        )
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
  return { ground, water, heights, waterLevels, segs }
}
