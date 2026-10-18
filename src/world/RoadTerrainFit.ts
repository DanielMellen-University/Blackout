import { TERRAIN_CONTACT_GRID } from './TerrainGeometry'

const TERRAIN_SPACINGS = [TERRAIN_CONTACT_GRID, 35, 52.5, 70, 105, 140, 210, 280, 420, 560, 840, 1120, 1680]

type Vertex = { x: number; y: number; z: number; offset: number }

/** Clip ground ribbons at the terrain lattice and its diagonals. Every coarser
 * terrain edge is on this lattice too, so draping vertices also fits triangle
 * interiors. Fixed bridge/fill anchors retain their original triangles. */
export function *fitRoadTerrainSteps(positions: number[], offsets: number[], indices: number[],
  originX: number, originZ: number, height?: (x: number, z: number) => number | null): Generator<void, number[]> {
  const fitted: number[] = [], cell = TERRAIN_CONTACT_GRID
  // A flat source profile alone is insufficient: a crest can lie between its
  // rows, and a coarser LOD can bend where the near surface does not. Certify
  // every enclosing lattice vertex at every dry terrain spacing before keeping
  // a source triangle. The cache belongs to this bounded build, never the world.
  const heights = new Map<string, number | null>()
  const planar = (triangle: Vertex[]): boolean => {
    if (!height) return false
    const [a, b, c] = triangle as [Vertex, Vertex, Vertex]
    const dx = b.x - a.x, dz = b.z - a.z, ex = c.x - a.x, ez = c.z - a.z
    const determinant = dx * ez - ex * dz
    if (Math.abs(determinant) < 1e-8) return false
    const ay = a.y - a.offset, by = b.y - b.offset - ay, cy = c.y - c.offset - ay
    const sx = (by * ez - cy * dz) / determinant, sz = (dx * cy - ex * by) / determinant
    const minX = Math.min(a.x, b.x, c.x) + originX, maxX = Math.max(a.x, b.x, c.x) + originX
    const minZ = Math.min(a.z, b.z, c.z) + originZ, maxZ = Math.max(a.z, b.z, c.z) + originZ
    // Near, mid, single far, horizon sizes 2..32, and reduced far fallback.
    for (const spacing of TERRAIN_SPACINGS) {
      for (let x = Math.floor(minX / spacing); x <= Math.ceil(maxX / spacing); x++) {
        for (let z = Math.floor(minZ / spacing); z <= Math.ceil(maxZ / spacing); z++) {
          const wx = x * spacing, wz = z * spacing, id = `${wx},${wz}`
          let actual = heights.get(id)
          if (actual === undefined) { actual = height(wx, wz); heights.set(id, actual) }
          const expected = ay + sx * (wx - originX - a.x) + sz * (wz - originZ - a.z)
          if (actual === null || Math.abs(actual - expected) > 1e-5) return false
        }
      }
    }
    return true
  }
  // Open addressing stores vertex indices rather than allocating coordinate
  // strings and Map entries for every emitted corner. Compare the exact same
  // Float32 X/Z/offset identity used by the renderer and the previous weld.
  let table = new Uint32Array(2 ** Math.ceil(Math.log2(Math.max(16, offsets.length * 2)))), used = 0
  const floats = new Float32Array(3), bits = new Uint32Array(floats.buffer)
  const hash = (x: number, z: number, offset: number): number => {
    floats[0] = Math.fround(x) || 0; floats[1] = Math.fround(z) || 0; floats[2] = Math.fround(offset) || 0
    return (Math.imul(bits[0]! ^ (bits[0]! >>> 16), 0x45d9f3b) ^
      Math.imul(bits[1]! ^ (bits[1]! >>> 16), 0x119de1f3) ^ bits[2]!) >>> 0
  }
  const grow = () => {
    const old = table
    table = new Uint32Array(old.length * 2)
    for (const entry of old) if (entry) {
      const i = entry - 1
      let slot = hash(positions[i * 3]!, positions[i * 3 + 2]!, offsets[i]!) & (table.length - 1)
      while (table[slot]) slot = (slot + 1) & (table.length - 1)
      table[slot] = entry
    }
  }
  const slotFor = (v: Vertex): number => {
    let slot = hash(v.x, v.z, v.offset) & (table.length - 1)
    while (table[slot]) {
      const i = table[slot]! - 1
      if (Math.fround(positions[i * 3]!) === Math.fround(v.x) &&
        Math.fround(positions[i * 3 + 2]!) === Math.fround(v.z) &&
        Math.fround(offsets[i]!) === Math.fround(v.offset)) break
      slot = (slot + 1) & (table.length - 1)
    }
    return slot
  }
  const vertex = (): Vertex => ({ x: 0, y: 0, z: 0, offset: 0 })
  const original = vertex()
  for (let i = 0; i < offsets.length; i++) if (offsets[i]! >= 0) {
    original.x = positions[i * 3]!; original.y = positions[i * 3 + 1]!
    original.z = positions[i * 3 + 2]!; original.offset = offsets[i]!
    const slot = slotFor(original)
    if (!table[slot]) used++
    table[slot] = i + 1
  }
  const add = (v: Vertex): number => {
    if ((used + 1) * 2 >= table.length) grow()
    const slot = slotFor(v), found = table[slot]!
    if (found) return found - 1
    const index = offsets.length
    positions.push(v.x, v.y, v.z); offsets.push(v.offset)
    table[slot] = index + 1; used++
    return index
  }
  type Polygon = { points: Vertex[]; count: number }
  // A triangle clipped to a square and a diagonal needs at most eight points.
  // Keep fixed workspace across all cells, triangles and cooperative yields.
  const polygon = (): Polygon => ({ points: Array.from({ length: 10 }, vertex), count: 0 })
  const triangle = polygon(), first = polygon(), second = polygon()
  const signed = (v: Vertex, plane: number, boundary: number): number => {
    switch (plane) {
      case 0: return v.x - boundary
      case 1: return boundary - v.x
      case 2: return v.z - boundary
      case 3: return boundary - v.z
      case 4: return boundary - v.x - v.z
      default: return v.x + v.z - boundary
    }
  }
  const clip = (input: Polygon, output: Polygon, plane: number, boundary: number): void => {
    let count = 0
    if (input.count) {
      let a = input.points[input.count - 1]!, da = signed(a, plane, boundary)
      for (let j = 0; j < input.count; j++) {
        const b = input.points[j]!, db = signed(b, plane, boundary)
        if ((da < 0) !== (db < 0)) {
          const t = da / (da - db), out = output.points[count++]!
          out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t
          out.z = a.z + (b.z - a.z) * t; out.offset = a.offset + (b.offset - a.offset) * t
        }
        if (db >= 0) {
          const out = output.points[count++]!
          out.x = b.x; out.y = b.y; out.z = b.z; out.offset = b.offset
        }
        a = b; da = db
      }
    }
    output.count = count
  }
  const emit = (polygon: Polygon) => {
    for (let j = 2; j < polygon.count; j++) {
      const a = polygon.points[0]!, b = polygon.points[j - 1]!, c = polygon.points[j]!
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z
      const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z
      if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-8) continue
      fitted.push(add(a), add(b), add(c))
    }
  }
  let processed = 64
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]!, ib = indices[i + 1]!, ic = indices[i + 2]!
    if (processed >= 64) { yield; processed = 0 }
    processed++
    if (offsets[ia]! < 0 || offsets[ib]! < 0 || offsets[ic]! < 0) { fitted.push(ia, ib, ic); continue }
    for (let j = 0; j < 3; j++) {
      const id = indices[i + j]!, v = triangle.points[j]!
      v.x = positions[id * 3]!; v.y = positions[id * 3 + 1]!
      v.z = positions[id * 3 + 2]!; v.offset = offsets[id]!
    }
    triangle.count = 3
    const [a, b, c] = triangle.points as [Vertex, Vertex, Vertex]
    if (planar(triangle.points)) { fitted.push(ia, ib, ic); continue }
    const minX = Math.floor((Math.min(a.x, b.x, c.x) + originX) / cell)
    const maxX = Math.floor((Math.max(a.x, b.x, c.x) + originX) / cell)
    const minZ = Math.floor((Math.min(a.z, b.z, c.z) + originZ) / cell)
    const maxZ = Math.floor((Math.max(a.z, b.z, c.z) + originZ) / cell)
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const left = x * cell - originX, top = z * cell - originZ
      clip(triangle, first, 0, left)
      clip(first, second, 1, left + cell)
      clip(second, first, 2, top)
      clip(first, second, 3, top + cell)
      if (second.count < 3) continue
      const diagonal = left + top + cell
      // A vertical edge can lie exactly on the diagonal. Emit that face once.
      let onDiagonal = true
      for (let j = 0; j < second.count; j++) {
        const v = second.points[j]!
        if (Math.abs(v.x + v.z - diagonal) >= 1e-8) { onDiagonal = false; break }
      }
      if (onDiagonal) emit(second)
      else {
        clip(second, first, 4, diagonal); emit(first)
        clip(second, first, 5, diagonal); emit(first)
      }
    }
  }
  return fitted
}
