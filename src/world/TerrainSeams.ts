import { BufferAttribute, BufferGeometry } from 'three'
import { CHUNK_SIZE } from './TerrainGeometry'

/** Render-only edge owner. Contact grids and independent water are immutable. */
export interface TerrainEdgeTile {
  originX: number
  originZ: number
  size: number
  segs: number
  heights: Float32Array
  waterLevels: Float32Array
  geometry: BufferGeometry
}

export interface TerrainEdgeJoin {
  neighbor: TerrainEdgeTile
  /** North, east, south, west. */
  edge: number
  start: number
  end: number
}

export function terrainEdgeJoin(a: TerrainEdgeTile, b: TerrainEdgeTile): TerrainEdgeJoin | null {
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

function edgeSample(tile: TerrainEdgeTile, edge: number, t: number): number[] {
  const span = CHUNK_SIZE * tile.size, vertical = edge === 1 || edge === 3
  const q = Math.max(0, Math.min(tile.segs, (t - (vertical ? tile.originZ : tile.originX)) * tile.segs / span))
  const lo = Math.min(tile.segs - 1, Math.floor(q)), f = q - lo, stride = tile.segs + 1
  const index = (i: number) => edge === 0 ? i : edge === 1 ? i * stride + tile.segs
    : edge === 2 ? tile.segs * stride + i : i * stride
  const a = index(lo), b = index(lo + 1)
  const mix = (x: number, y: number) => x + (y - x) * f
  const result = [mix(tile.heights[a]!, tile.heights[b]!), mix(tile.waterLevels[a]!, tile.waterLevels[b]!)]
  for (const name of ['normal', 'color']) {
    const attr = tile.geometry.getAttribute(name)
    for (let axis = 0; axis < 3; axis++) result.push(mix(attr.getComponent(a, axis), attr.getComponent(b, axis)))
  }
  return result
}

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
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = []
  for (const [name, target, size] of [['position', positions, 3], ['normal', normals, 3], ['color', colors, 3], ['uv', uv, 2]] as const) {
    const attr = source.getAttribute(name)
    for (let i = 0; i < baseVertices * size; i++) target.push(attr ? attr.array[i]! : 0)
  }
  const span = CHUNK_SIZE * tile.size, half = span / 2, core = (tile.segs + 1) ** 2
  const p = source.getAttribute('position'), original = source.index!
  const coreIndices = tile.segs * tile.segs * 6
  for (let i = 0; i < coreIndices + baseVertices - core; i += 3) {
    const a = i < coreIndices ? original.getX(i) : core + i - coreIndices
    const b = i < coreIndices ? original.getX(i + 1) : a + 1
    const c = i < coreIndices ? original.getX(i + 2) : a + 2
    // Drop only skirt triangles whose entire interval has a resident replacement.
    const covered = a >= core && joins.some(j => {
      const vertical = j.edge === 1 || j.edge === 3, fixed = j.edge === 0 || j.edge === 3 ? -half : half
      return [a, b, c].every(v => {
        const cross = vertical ? p.getX(v) : p.getZ(v)
        const along = (vertical ? tile.originZ + p.getZ(v) : tile.originX + p.getX(v)) + half
        return Math.abs(cross - fixed) < .001 && along >= j.start - .001 && along <= j.end + .001
      })
    })
    if (!covered) indices.push(a, b, c)
  }
  const add = (edge: number, t: number, value: number[]): number => {
    const vertical = edge === 1 || edge === 3, fixed = edge === 0 || edge === 3 ? -half : half
    const along = t - (vertical ? tile.originZ : tile.originX) - half
    const i = positions.length / 3
    positions.push(vertical ? fixed : along, value[0]!, vertical ? along : fixed)
    normals.push(value[2]!, value[3]!, value[4]!); colors.push(value[5]!, value[6]!, value[7]!); uv.push(0, 0)
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
      const dl = edgeSample(tile, edge, l)[0]! - edgeSample(neighbor, opposite, l)[0]!
      const dr = edgeSample(tile, edge, r)[0]! - edgeSample(neighbor, opposite, r)[0]!
      if (dl * dr < 0) crossings.push(l + (r - l) * dl / (dl - dr))
      // Clip the join to dry portions, instead of discarding a whole interval
      // whose end is wet. Both surfaces must clear BOTH interpolated levels.
      const al = edgeSample(tile, edge, l), ar = edgeSample(tile, edge, r)
      const bl = edgeSample(neighbor, opposite, l), br = edgeSample(neighbor, opposite, r)
      for (const [hl, hr] of [[al[0]!, ar[0]!], [bl[0]!, br[0]!]]) {
        for (const [wl, wr] of [[al[1]!, ar[1]!], [bl[1]!, br[1]!]]) {
          const cl = hl! - wl! - 2, cr = hr! - wr! - 2
          if (cl * cr < 0) crossings.push(l + (r - l) * cl / (cl - cr))
        }
      }
    }
    knots.push(...crossings); knots.sort((a, b) => a - b)
    for (let i = 1; i < knots.length; i++) {
      const l = knots[i - 1]!, r = knots[i]!
      if (r - l < 1e-6) continue
      const al = edgeSample(tile, edge, l), ar = edgeSample(tile, edge, r)
      const bl = edgeSample(neighbor, opposite, l), br = edgeSample(neighbor, opposite, r)
      // Preserve open wet edges and their independent shoreline clipping.
      const am = edgeSample(tile, edge, (l + r) / 2), bm = edgeSample(neighbor, opposite, (l + r) / 2)
      if (Math.min(am[0]!, bm[0]!) <= Math.max(am[1]!, bm[1]!) + 2) continue
      const a = add(edge, l, al), b = add(edge, r, ar), c = add(edge, l, bl), d = add(edge, r, br)
      // Both windings keep a vertical join visible from either side under FrontSide.
      indices.push(a, b, c, b, d, c, c, b, a, c, d, b)
    }
  }
  const geometry = new BufferGeometry()
  for (const [name, array, size] of [['position', positions, 3], ['normal', normals, 3], ['color', colors, 3], ['uv', uv, 2]] as const) {
    geometry.setAttribute(name, new BufferAttribute(new Float32Array(array), size))
  }
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1))
  geometry.computeBoundingSphere()
  return geometry
}
