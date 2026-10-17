import { TERRAIN_CONTACT_GRID } from './TerrainGeometry'

type Vertex = { x: number; y: number; z: number; offset: number }

/** Clip ground ribbons at the terrain lattice and its diagonals. Every coarser
 * terrain edge is on this lattice too, so draping vertices also fits triangle
 * interiors. Fixed bridge/fill anchors retain their original triangles. */
export function *fitRoadTerrainSteps(positions: number[], offsets: number[], indices: number[],
  originX: number, originZ: number): Generator<void, number[]> {
  const fitted: number[] = [], vertices = new Map<string, number>(), cell = TERRAIN_CONTACT_GRID
  const key = (v: Vertex) => `${Math.fround(v.x)},${Math.fround(v.z)},${Math.fround(v.offset)}`
  for (let i = 0; i < offsets.length; i++) if (offsets[i]! >= 0) {
    vertices.set(key({ x: positions[i * 3]!, y: positions[i * 3 + 1]!, z: positions[i * 3 + 2]!, offset: offsets[i]! }), i)
  }
  const add = (v: Vertex): number => {
    const id = key(v), found = vertices.get(id)
    if (found !== undefined) return found
    const index = offsets.length
    positions.push(v.x, v.y, v.z); offsets.push(v.offset); vertices.set(id, index)
    return index
  }
  const clip = (polygon: Vertex[], signed: (v: Vertex) => number): Vertex[] => {
    const result: Vertex[] = []
    let a = polygon.at(-1)!, da = signed(a)
    for (const b of polygon) {
      const db = signed(b)
      if ((da < 0) !== (db < 0)) {
        const t = da / (da - db)
        result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t, offset: a.offset + (b.offset - a.offset) * t })
      }
      if (db >= 0) result.push(b)
      a = b; da = db
    }
    return result
  }
  const emit = (polygon: Vertex[]) => {
    for (let j = 2; j < polygon.length; j++) {
      const a = polygon[0]!, b = polygon[j - 1]!, c = polygon[j]!
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
      const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z
      if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-8) continue
      fitted.push(add(a), add(b), add(c))
    }
  }
  for (let i = 0; i < indices.length; i += 3) {
    if (i % 192 === 0) yield
    const ids = [indices[i]!, indices[i + 1]!, indices[i + 2]!]
    if (ids.some(id => offsets[id]! < 0)) { fitted.push(...ids); continue }
    const triangle = ids.map(id => ({ x: positions[id * 3]!, y: positions[id * 3 + 1]!,
      z: positions[id * 3 + 2]!, offset: offsets[id]! }))
    const minX = Math.floor((Math.min(...triangle.map(v => v.x)) + originX) / cell)
    const maxX = Math.floor((Math.max(...triangle.map(v => v.x)) + originX) / cell)
    const minZ = Math.floor((Math.min(...triangle.map(v => v.z)) + originZ) / cell)
    const maxZ = Math.floor((Math.max(...triangle.map(v => v.z)) + originZ) / cell)
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const left = x * cell - originX, top = z * cell - originZ
      let polygon = triangle
      for (const signed of [(v: Vertex) => v.x - left, (v: Vertex) => left + cell - v.x,
        (v: Vertex) => v.z - top, (v: Vertex) => top + cell - v.z]) {
        if (!polygon.length) break
        polygon = clip(polygon, signed)
      }
      if (polygon.length < 3) continue
      const diagonal = left + top + cell
      // A vertical edge can lie exactly on the diagonal. Emit that face once.
      if (polygon.every(v => Math.abs(v.x + v.z - diagonal) < 1e-8)) emit(polygon)
      else {
        emit(clip(polygon, v => diagonal - v.x - v.z))
        emit(clip(polygon, v => v.x + v.z - diagonal))
      }
    }
  }
  return fitted
}
