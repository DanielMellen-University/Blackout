import { BufferAttribute, BufferGeometry } from 'three'

/** Same indexed Float32 accumulation and normalization as Three.js, without
 * boxing every component across vector/attribute method calls on large roads.
 * Other attribute formats retain the library path. No second normal buffer. */
export function computeSurfaceNormals(geometry: BufferGeometry): void {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), index = geometry.index
  if (!(position instanceof BufferAttribute) || !(normal instanceof BufferAttribute) || !index ||
    !(position.array instanceof Float32Array) || !(normal.array instanceof Float32Array) ||
    position.normalized || normal.normalized || index.normalized || index.itemSize !== 1 || position.itemSize !== 3 || normal.itemSize !== 3 ||
    normal.count !== position.count) { geometry.computeVertexNormals(); return }
  const p = position.array, n = normal.array, ids = index.array
  n.fill(0)
  for (let i = 0; i < ids.length; i += 3) {
    const a = ids[i]! * 3, b = ids[i + 1]! * 3, c = ids[i + 2]! * 3
    const cbx = p[c]! - p[b]!, cby = p[c + 1]! - p[b + 1]!, cbz = p[c + 2]! - p[b + 2]!
    const abx = p[a]! - p[b]!, aby = p[a + 1]! - p[b + 1]!, abz = p[a + 2]! - p[b + 2]!
    const x = cby * abz - cbz * aby, y = cbz * abx - cbx * abz, z = cbx * aby - cby * abx
    // Typed stores round after each face, in the original index order.
    n[a] = n[a]! + x; n[a + 1] = n[a + 1]! + y; n[a + 2] = n[a + 2]! + z
    n[b] = n[b]! + x; n[b + 1] = n[b + 1]! + y; n[b + 2] = n[b + 2]! + z
    n[c] = n[c]! + x; n[c + 1] = n[c + 1]! + y; n[c + 2] = n[c + 2]! + z
  }
  for (let i = 0; i < n.length; i += 3) {
    const x = n[i]!, y = n[i + 1]!, z = n[i + 2]!, inverse = 1 / (Math.sqrt(x * x + y * y + z * z) || 1)
    n[i] = x * inverse; n[i + 1] = y * inverse; n[i + 2] = z * inverse
  }
  normal.needsUpdate = true
}
