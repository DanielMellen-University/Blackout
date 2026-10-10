import { prepareHydrologyInBoundsSteps, riverReachesInBounds, type RiverReach, type WaterBasin } from './Hydrology'
import { riverSurface, type RiverSurface } from './RiverSurface'
import { getWorldSeed } from './noise'
import type { WaterBuildPhase } from './WaterSystem'

type Point = readonly number[] // x, y, z, optical depth
interface Face {
  points: Point[]; key: string
  minX: number; minZ: number; maxX: number; maxZ: number
  height: readonly number[]; depth: readonly number[]
}
interface RiverUnionSurface extends RiverSurface { triangles: Float64Array }
const unions = new WeakMap<RiverReach, RiverUnionSurface>()
const EMPTY = new Float64Array(0)

function plane(p: readonly Point[], component: 1 | 3): readonly number[] {
  const a = p[0]!, b = p[1]!, c = p[2]!
  const bx = b[0]! - a[0]!, bz = b[2]! - a[2]!, cx = c[0]! - a[0]!, cz = c[2]! - a[2]!
  const denominator = bx * cz - bz * cx
  return [(cz * (b[component]! - a[component]!) - bz * (c[component]! - a[component]!)) / denominator,
    (bx * (c[component]! - a[component]!) - cx * (b[component]! - a[component]!)) / denominator, a[component]!]
}
function value(face: Face, p: Point, field: 'height' | 'depth'): number {
  const coefficients = face[field], a = face.points[0]!
  return coefficients[0]! * (p[0]! - a[0]!) + coefficients[1]! * (p[2]! - a[2]!) + coefficients[2]!
}
function faces(surface: RiverSurface, key: string): Face[] {
  const result: Face[] = []
  const add = (data: Float64Array, a: number, b: number, c: number): void => {
    const points = [Array.from(data.slice(a, a + 4)), Array.from(data.slice(b, b + 4)), Array.from(data.slice(c, c + 4))]
    const cross = (points[1]![0]! - points[0]![0]!) * (points[2]![2]! - points[0]![2]!) -
      (points[1]![2]! - points[0]![2]!) * (points[2]![0]! - points[0]![0]!)
    if (Math.abs(cross) < 1e-7) return
    if (cross < 0) [points[1], points[2]] = [points[2]!, points[1]!]
    result.push({ points, key: `${key}/${result.length.toString().padStart(5, '0')}`,
      minX: Math.min(...points.map(p => p[0]!)), maxX: Math.max(...points.map(p => p[0]!)),
      minZ: Math.min(...points.map(p => p[2]!)), maxZ: Math.max(...points.map(p => p[2]!)),
      height: plane(points, 1), depth: plane(points, 3) })
  }
  if (surface.triangles) {
    for (let i = 0; i < surface.triangles.length; i += 12) add(surface.triangles, i, i + 4, i + 8)
  } else {
    const p = surface.sections
    for (let i = 0; i < p.length - 12; i += 12) {
      add(p, i, i + 12, i + 16); add(p, i, i + 16, i + 4)
      add(p, i + 4, i + 16, i + 20); add(p, i + 4, i + 20, i + 8)
    }
    for (let i = 0; i < surface.caps.length; i += 12) add(surface.caps, i, i + 4, i + 8)
  }
  return result
}
function clip(polygon: readonly Point[], distance: (p: Point) => number, positive = true): Point[] {
  if (!polygon.length) return []
  const output: Point[] = []
  const append = (p: Point): void => {
    const last = output[output.length - 1]
    if (!last || Math.hypot(last[0]! - p[0]!, last[2]! - p[2]!) > 1e-8) output.push(p)
  }
  let previous = polygon[polygon.length - 1]!, a = distance(previous) * (positive ? 1 : -1)
  for (const current of polygon) {
    const b = distance(current) * (positive ? 1 : -1)
    if ((a >= 0) !== (b >= 0)) {
      const t = a / (a - b)
      append(previous.map((v, i) => v + (current[i]! - v) * t))
    }
    if (b >= 0) append(current)
    previous = current; a = b
  }
  if (output.length > 1 && Math.hypot(output[0]![0]! - output[output.length - 1]![0]!,
    output[0]![2]! - output[output.length - 1]![2]!) <= 1e-8) output.pop()
  return output
}
const side = (a: Point, b: Point) => (p: Point): number =>
  (b[0]! - a[0]!) * (p[2]! - a[2]!) - (b[2]! - a[2]!) * (p[0]! - a[0]!)
function area(polygon: readonly Point[]): number {
  let result = 0
  for (let i = 1; i < polygon.length - 1; i++) result += side(polygon[0]!, polygon[i]!)(polygon[i + 1]!)
  return result * .5
}

/** Subtract a convex winning footprint without changing the losing face's
 * height/depth interpolation. The remaining pieces are themselves convex. */
function subtract(polygon: readonly Point[], blocker: readonly Point[]): Point[][] {
  const pieces: Point[][] = []
  let inside = [...polygon]
  for (let i = 0; i < blocker.length && inside.length >= 3; i++) {
    const a = blocker[i]!, b = blocker[(i + 1) % blocker.length]!
    if (Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!) < 1e-8) continue
    const distance = side(a, b)
    const outside = clip(inside, distance, false)
    if (outside.length >= 3 && area(outside) > 1e-6) pieces.push(outside)
    inside = clip(inside, distance)
    if (area(inside) <= 1e-6) break
  }
  return pieces
}

/** Resolve the visible upper envelope, then the deepest optical face on
 * coplanar joins. Stable identities settle exact ties, never query order.
 * Collision continues querying the identical upper envelope of base faces. */
export function* riverUnionSteps(reach: RiverReach, basins: readonly WaterBasin[], supplied: readonly RiverReach[]):
  Generator<WaterBuildPhase, RiverUnionSurface, void> {
  const cached = reach.id ? unions.get(reach) : undefined
  if (cached) return cached
  const seed = getWorldSeed()
  const ensureSeed = (): void => {
    if (getWorldSeed() !== seed) throw new Error('World seed changed during river union')
  }
  const base = riverSurface(reach, basins)
  let neighbors = supplied
  if (reach.id) {
    for (const _ of prepareHydrologyInBoundsSteps(base.minX - 1, base.minZ - 1, base.maxX + 1, base.maxZ + 1)) {
      yield 'river'; ensureSeed()
    }
    neighbors = riverReachesInBounds(base.minX - 1, base.minZ - 1, base.maxX + 1, base.maxZ + 1)
  }
  const own = faces(base, reach.id ?? `authored:${supplied.indexOf(reach)}`)
  const candidates: Face[] = [...own]
  const ids = new Set<string>()
  if (reach.id) ids.add(reach.id)
  for (let i = 0; i < neighbors.length; i++) {
    const r = neighbors[i]!
    if (r === reach || (r.id && ids.has(r.id))) continue
    if (r.id) ids.add(r.id)
    const surface = riverSurface(r, basins)
    if (surface.minX >= base.maxX || surface.maxX <= base.minX || surface.minZ >= base.maxZ || surface.maxZ <= base.minZ) continue
    candidates.push(...faces(surface, r.id ?? `authored:${i}`))
    yield 'river'; ensureSeed()
  }
  // A small temporary spatial index bounds comparisons to nearby faces. It
  // is released when the cooperative build completes or is cancelled.
  const cell = 180, bins = new Map<string, Face[]>()
  for (const face of candidates) {
    const minX = Math.floor(face.minX / cell), maxX = Math.floor(face.maxX / cell)
    const minZ = Math.floor(face.minZ / cell), maxZ = Math.floor(face.maxZ / cell)
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      const key = `${x},${z}`, bin = bins.get(key)
      if (bin) bin.push(face); else bins.set(key, [face])
    }
  }
  const output: number[] = []
  let visits = 0
  for (const face of own) {
    const nearby = new Set<Face>()
    for (let z = Math.floor(face.minZ / cell); z <= Math.floor(face.maxZ / cell); z++)
      for (let x = Math.floor(face.minX / cell); x <= Math.floor(face.maxX / cell); x++)
        for (const other of bins.get(`${x},${z}`) ?? []) nearby.add(other)
    let pieces: Point[][] = [face.points]
    for (const other of [...nearby].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) {
      if (++visits % 8 === 0) { yield 'river'; ensureSeed() }
      if (other === face || other.minX >= face.maxX || other.maxX <= face.minX ||
        other.minZ >= face.maxZ || other.maxZ <= face.minZ) continue
      let blocker = other.points
      for (let i = 0; i < 3; i++) blocker = clip(blocker, side(face.points[i]!, face.points[(i + 1) % 3]!))
      if (blocker.length < 3 || area(blocker) <= 1e-6) continue
      const heightDelta = (p: Point) => value(other, p, 'height') - value(face, p, 'height')
      if (blocker.every(p => Math.abs(heightDelta(p)) < 1e-7)) {
        const depthDelta = (p: Point) => value(other, p, 'depth') - value(face, p, 'depth')
        if (blocker.every(p => Math.abs(depthDelta(p)) < 1e-7)) {
          if (other.key < face.key) continue
        } else blocker = clip(blocker, depthDelta)
      } else blocker = clip(blocker, heightDelta)
      if (blocker.length < 3 || area(blocker) <= 1e-6) continue
      pieces = pieces.flatMap(polygon => subtract(polygon, blocker))
      if (!pieces.length) break
    }
    for (const polygon of pieces) for (let i = 1; i < polygon.length - 1; i++) {
      const a = polygon[0]!, b = polygon[i]!, c = polygon[i + 1]!
      if (Math.abs(side(a, b)(c)) < 1e-6) continue
      output.push(...a, ...b, ...c)
    }
    yield 'river'; ensureSeed()
  }
  const result = { ...base, sections: EMPTY, caps: EMPTY, triangles: new Float64Array(output), bins: undefined }
  // No retained neighbor graph or partial-cache publication.
  if (reach.id) unions.set(reach, result)
  return result
}
