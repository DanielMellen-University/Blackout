import { BufferAttribute, BufferGeometry } from 'three'
import { CHUNK_SIZE } from './TerrainGeometry'

/** Render-only edge owner. Contact grids and independent water are immutable. */
export interface TerrainEdgeBounds { originX: number; originZ: number; size: number }
export interface TerrainEdgeTile extends TerrainEdgeBounds {
  segs: number
  heights: Float32Array
  waterLevels: Float32Array
  geometry: BufferGeometry
}

export interface TerrainEdgeJoin<T extends TerrainEdgeBounds = TerrainEdgeTile> {
  neighbor: T
  /** North, east, south, west. */
  edge: number
  start: number
  end: number
}

export function terrainEdgeJoin<T extends TerrainEdgeBounds>(a: TerrainEdgeBounds, b: T): TerrainEdgeJoin<T> | null {
  const as = CHUNK_SIZE * a.size, bs = CHUNK_SIZE * b.size
  let edge: number, start: number, end: number
  if (a.originX + as === b.originX || b.originX + bs === a.originX) {
    edge = a.originX + as === b.originX ? 1 : 3
    start = Math.max(a.originZ, b.originZ); end = Math.min(a.originZ + as, b.originZ + bs)
  } else if (a.originZ + as === b.originZ || b.originZ + bs === a.originZ) {
    edge = a.originZ + as === b.originZ ? 2 : 0
    start = Math.max(a.originX, b.originX); end = Math.min(a.originX + as, b.originX + bs)
  } else return null
  return end > start ? { neighbor: b, edge, start, end } : null
}

function edgeSample(tile: TerrainEdgeTile, edge: number, t: number, result: number[]): number[] {
  const span = CHUNK_SIZE * tile.size, vertical = edge === 1 || edge === 3
  const q = Math.max(0, Math.min(tile.segs, (t - (vertical ? tile.originZ : tile.originX)) * tile.segs / span))
  const lo = Math.min(tile.segs - 1, Math.floor(q)), f = q - lo, stride = tile.segs + 1
  const a = edge === 0 ? lo : edge === 1 ? lo * stride + tile.segs
    : edge === 2 ? tile.segs * stride + lo : lo * stride
  const b = a + (edge === 0 || edge === 2 ? 1 : stride)
  result[0] = tile.heights[a]! + (tile.heights[b]! - tile.heights[a]!) * f
  result[1] = tile.waterLevels[a]! + (tile.waterLevels[b]! - tile.waterLevels[a]!) * f
  const normal = tile.geometry.getAttribute('normal'), color = tile.geometry.getAttribute('color')
  for (let axis = 0; axis < 3; axis++) {
    const n = normal.getComponent(a, axis), c = color.getComponent(a, axis)
    result[axis + 2] = n + (normal.getComponent(b, axis) - n) * f
    result[axis + 5] = c + (color.getComponent(b, axis) - c) * f
  }
  return result
}

// Synchronous publication copies these numeric workspaces into privately owned
// typed attributes before returning. No tile, geometry or contact owner is kept.
const positions: number[] = [], normals: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = []
const samples = Array.from({ length: 6 }, () => new Array<number>(8).fill(0))

/**
 * Replace coarse downward skirts with exact vertical joins to resident edges.
 * Union knots include BOTH grids, including non-nested water-promoted grids.
 * A downward skirt alone cannot cover a finer edge above the coarse surface.
 * The strip spans only the gap between surfaces and never changes a contact sample.
 * All triangles remain in the existing terrain draw. No water vertices are joined.
 */
export function joinTerrainEdges(tile: TerrainEdgeTile, baseVertices: number,
  joins: readonly TerrainEdgeJoin[]): BufferGeometry {
  const source = tile.geometry
  const coreIndices = tile.segs * tile.segs * 6
  let vertices = baseVertices, indexCount = coreIndices
  const triangle = (a: number, b: number, c: number): void => {
    indices[indexCount++] = a; indices[indexCount++] = b; indices[indexCount++] = c
  }
  const span = CHUNK_SIZE * tile.size, half = span / 2, core = (tile.segs + 1) ** 2
  const p = source.getAttribute('position'), original = source.index!
  for (let i = core; i < baseVertices; i += 3) {
    const a = i, b = a + 1, c = a + 2
    // Drop only skirt triangles whose entire interval has a resident replacement.
    let covered = false
    if (a >= core) for (const j of joins) {
      const vertical = j.edge === 1 || j.edge === 3, fixed = j.edge === 0 || j.edge === 3 ? -half : half
      let inside = true
      for (let corner = 0; corner < 3; corner++) {
        const v = corner === 0 ? a : corner === 1 ? b : c
        const cross = vertical ? p.getX(v) : p.getZ(v)
        const along = (vertical ? tile.originZ + p.getZ(v) : tile.originX + p.getX(v)) + half
        if (!(Math.abs(cross - fixed) < .001 && along >= j.start - .001 && along <= j.end + .001)) { inside = false; break }
      }
      if (inside) { covered = true; break }
    }
    if (!covered) triangle(a, b, c)
  }
  const add = (edge: number, t: number, value: number[]): number => {
    const vertical = edge === 1 || edge === 3, fixed = edge === 0 || edge === 3 ? -half : half
    const along = t - (vertical ? tile.originZ : tile.originX) - half
    const i = vertices++, at = i * 3
    positions[at] = vertical ? fixed : along; positions[at + 1] = value[0]!; positions[at + 2] = vertical ? along : fixed
    for (let axis = 0; axis < 3; axis++) { normals[at + axis] = value[axis + 2]!; colors[at + axis] = value[axis + 5]! }
    uv[i * 2] = uv[i * 2 + 1] = 0
    return i
  }
  for (const join of joins) {
    const { neighbor, edge, start, end } = join, opposite = (edge + 2) % 4
    // The coarser sampling grid owns the connector. Equal grids need no join.
    if (span / tile.segs <= CHUNK_SIZE * neighbor.size / neighbor.segs) continue
    const knots = [start, end]
    for (const t of [tile, neighbor]) {
      const origin = edge === 1 || edge === 3 ? t.originZ : t.originX
      const step = CHUNK_SIZE * t.size / t.segs
      for (let i = 0; i <= t.segs; i++) { const k = origin + i * step; if (k > start && k < end) knots.push(k) }
    }
    knots.sort((a, b) => a - b)
    // Split where the two profiles cross, avoiding a folded quad that could
    // protrude above both surfaces despite matching all original knots.
    const crossings: number[] = []
    for (let i = 1; i < knots.length; i++) {
      const l = knots[i - 1]!, r = knots[i]!
      const al = edgeSample(tile, edge, l, samples[0]!), ar = edgeSample(tile, edge, r, samples[1]!)
      const bl = edgeSample(neighbor, opposite, l, samples[2]!), br = edgeSample(neighbor, opposite, r, samples[3]!)
      const dl = al[0]! - bl[0]!, dr = ar[0]! - br[0]!
      if (dl * dr < 0) crossings.push(l + (r - l) * dl / (dl - dr))
      // Split every terrain/water crossing so the visible bank can be clipped
      // exactly to the higher independent water surface, including mixed shores.
      const waterDeltaL = al[1]! - bl[1]!, waterDeltaR = ar[1]! - br[1]!
      if (waterDeltaL * waterDeltaR < 0)
        crossings.push(l + (r - l) * waterDeltaL / (waterDeltaL - waterDeltaR))
      for (let h = 0; h < 2; h++) {
        const hl = h === 0 ? al[0]! : bl[0]!, hr = h === 0 ? ar[0]! : br[0]!
        for (let w = 0; w < 2; w++) {
          const wl = w === 0 ? al[1]! : bl[1]!, wr = w === 0 ? ar[1]! : br[1]!
          const cl = hl - wl - .02, cr = hr - wr - .02
          if (cl * cr < 0) crossings.push(l + (r - l) * cl / (cl - cr))
        }
      }
    }
    knots.push(...crossings); knots.sort((a, b) => a - b)
    for (let i = 1; i < knots.length; i++) {
      const l = knots[i - 1]!, r = knots[i]!
      if (r - l < 1e-6) continue
      const al = edgeSample(tile, edge, l, samples[0]!), ar = edgeSample(tile, edge, r, samples[1]!)
      const bl = edgeSample(neighbor, opposite, l, samples[2]!), br = edgeSample(neighbor, opposite, r, samples[3]!)
      // Fully submerged edges remain open. Where only one bed is submerged,
      // cover the exposed bank down to water instead of dropping the whole
      // interval. The 2 cm clearance avoids coincident water/terrain pixels;
      // contact grids and independent water vertices remain unchanged.
      const am = edgeSample(tile, edge, (l + r) / 2, samples[4]!), bm = edgeSample(neighbor, opposite, (l + r) / 2, samples[5]!)
      if (Math.max(am[0]!, bm[0]!) <= Math.max(am[1]!, bm[1]!) + .02) continue
      const waterL = Math.max(al[1]!, bl[1]!) + .02, waterR = Math.max(ar[1]!, br[1]!) + .02
      al[0] = Math.max(al[0]!, waterL); bl[0] = Math.max(bl[0]!, waterL)
      ar[0] = Math.max(ar[0]!, waterR); br[0] = Math.max(br[0]!, waterR)
      const a = add(edge, l, al), b = add(edge, r, ar), c = add(edge, l, bl), d = add(edge, r, br)
      // Both windings keep a vertical join visible from either side under FrontSide.
      triangle(a, b, c); triangle(b, d, c); triangle(c, b, a); triangle(c, d, b)
    }
  }
  const geometry = new BufferGeometry()
  for (const [name, array, size] of [['position', positions, 3], ['normal', normals, 3], ['color', colors, 3], ['uv', uv, 2]] as const) {
    const values = new Float32Array(vertices * size)
    // Core and original skirt attributes already have their final type. Copy
    // them directly instead of round-tripping the entire tile through JS arrays.
    const attr = source.getAttribute(name), base = baseVertices * size
    if (attr) values.set(attr.array.subarray(0, base))
    for (let i = base; i < values.length; i++) values[i] = array[i]!
    geometry.setAttribute(name, new BufferAttribute(values, size))
  }
  const values = new Uint32Array(indexCount)
  values.set(original.array.subarray(0, coreIndices))
  for (let i = coreIndices; i < values.length; i++) values[i] = indices[i]!
  geometry.setIndex(new BufferAttribute(values, 1))
  geometry.computeBoundingSphere()
  return geometry
}
