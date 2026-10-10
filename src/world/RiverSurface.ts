import { basinDistance, type RiverReach, type WaterBasin } from './Hydrology'
import { smoothstep } from './noise'

/** Shared world-space water geometry, without the renderer's .04 m depth bias.
 * Each section has left/centre/right vertices, each stored as x/y/z/depth.
 * End caps use the same four-component format in non-indexed triangles. */
export interface RiverSurface {
  sections: Float64Array
  caps: Float64Array
  /** Lake-clipped triangles replace sections/caps only near receiving shores. */
  triangles?: Float64Array
  /** Compact 4x4 triangle index for clipped mouths; no hot-query allocation. */
  bins?: { offsets: Uint32Array; indices: Uint32Array }
  minX: number; minZ: number; maxX: number; maxZ: number
}
const surfaces = new WeakMap<RiverReach, RiverSurface>()
const canonicalBasins = new WeakMap<RiverReach, readonly WaterBasin[]>()
const empty = new Float64Array(0)
type Vertex = readonly number[]

export function registerRiverSurface(reach: RiverReach, basins: readonly WaterBasin[]): void {
  canonicalBasins.set(reach, basins)
}

function clipLakeShore(sections: Float64Array, caps: Float64Array, lakes: readonly WaterBasin[]): Float64Array | undefined {
  const output: number[] = []
  let changed = false
  const middle = (a: Vertex, b: Vertex): Vertex => a.map((v, i) => (v + b[i]!) * .5)
  const distance = (b: WaterBasin, p: Vertex): number => basinDistance(b, p[0]!, p[2]!)
  const append = (a: Vertex, b: Vertex, c: Vertex, subdivision = 0): void => {
    for (const lake of lakes) {
      const da = distance(lake, a), db = distance(lake, b), dc = distance(lake, c)
      if (Math.max(da, db, dc) < -.2) { changed = true; return }
      const intersects = Math.min(da, db, dc) < 0 || basinDistance(lake,
        (a[0]! + b[0]! + c[0]!) / 3, (a[2]! + b[2]! + c[2]!) / 3) < 0
      changed ||= intersects
      if (intersects && subdivision < 3 && Math.max(
        Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!), Math.hypot(b[0]! - c[0]!, b[2]! - c[2]!),
        Math.hypot(c[0]! - a[0]!, c[2]! - a[2]!)) > 60) {
        const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a)
        append(a, ab, ca, subdivision + 1); append(ab, b, bc, subdivision + 1)
        append(ca, bc, c, subdivision + 1); append(ab, bc, ca, subdivision + 1)
        return
      }
    }
    let polygon: Vertex[] = [a, b, c]
    for (const lake of lakes) {
      if (!polygon.length) return
      const outside: Vertex[] = []
      let previous = polygon[polygon.length - 1]!, previousDistance = distance(lake, previous)
      for (const current of polygon) {
        const currentDistance = distance(lake, current)
        if ((currentDistance >= 0) !== (previousDistance >= 0)) {
          let lo = 0, hi = 1
          for (let pass = 0; pass < 12; pass++) {
            const t = (lo + hi) * .5, d = basinDistance(lake,
              previous[0]! + (current[0]! - previous[0]!) * t, previous[2]! + (current[2]! - previous[2]!) * t)
            if ((d >= 0) === (previousDistance >= 0)) lo = t
            else hi = t
          }
          const t = (lo + hi) * .5
          outside.push([previous[0]! + (current[0]! - previous[0]!) * t, lake.level,
            previous[2]! + (current[2]! - previous[2]!) * t,
            previous[3]! + (current[3]! - previous[3]!) * t])
        }
        if (currentDistance >= 0) outside.push(current)
        previous = current; previousDistance = currentDistance
      }
      polygon = outside
    }
    for (let i = 1; i < polygon.length - 1; i++) output.push(...polygon[0]!, ...polygon[i]!, ...polygon[i + 1]!)
  }
  for (let i = 0; i < sections.length - 12; i += 12) {
    const a = Array.from(sections.slice(i, i + 12)), b = Array.from(sections.slice(i + 12, i + 24))
    append(a.slice(0, 4), b.slice(0, 4), b.slice(4, 8)); append(a.slice(0, 4), b.slice(4, 8), a.slice(4, 8))
    append(a.slice(4, 8), b.slice(4, 8), b.slice(8, 12)); append(a.slice(4, 8), b.slice(8, 12), a.slice(8, 12))
  }
  for (let i = 0; i < caps.length; i += 12)
    append(Array.from(caps.slice(i, i + 4)), Array.from(caps.slice(i + 4, i + 8)), Array.from(caps.slice(i + 8, i + 12)))
  return changed ? new Float64Array(output) : undefined
}

export function riverSurface(reach: RiverReach, basins: readonly WaterBasin[]): RiverSurface {
  const cached = surfaces.get(reach)
  if (cached) return cached
  basins = canonicalBasins.get(reach) ?? basins
  const dx = reach.bx - reach.ax, dz = reach.bz - reach.az
  const length = Math.max(.001, Math.hypot(dx, dz)), fx = dx / length, fz = dz / length
  const steps = Math.max(4, Math.min(12, Math.ceil(length / 120)))
  const values: number[] = [], caps: number[] = []
  const width = Math.max(reach.wa, reach.wb) * 2 + 100
  const lakes = basins.filter(b => !b.regionalSea &&
    b.x + (b.boundsRadius ?? b.radius * 1.75) >= Math.min(reach.ax, reach.bx) - width &&
    b.x - (b.boundsRadius ?? b.radius * 1.75) <= Math.max(reach.ax, reach.bx) + width &&
    b.z + (b.boundsRadius ?? b.radius * 1.75) >= Math.min(reach.az, reach.bz) - width &&
    b.z - (b.boundsRadius ?? b.radius * 1.75) <= Math.max(reach.az, reach.bz) + width)
  const vertex = (x: number, y: number, z: number, depth: number): number[] => {
    // Wide corners enter a receiving lake before their centreline does. Blend
    // each vertex into that surface, instead of fixing only the clipped tip in
    // the renderer and leaving collision at the old river grade.
    let weight = 0, target = 0
    for (const b of lakes) {
      const d = basinDistance(b, x, z)
      const blend = 1 - smoothstep(0, 100, Math.max(0, d))
      if (blend > weight || (blend === weight && b.level > target)) { weight = blend; target = b.level }
    }
    return [x, y + (target - y) * weight, z, depth]
  }
  for (let step = 0; step <= steps; step++) {
    const t = step / steps, w = Math.max(5, reach.wa + (reach.wb - reach.wa) * t)
    let nx = -fz, nz = fx
    if (reach.tangentAX !== undefined && reach.tangentBX !== undefined) {
      const tx = reach.tangentAX + (reach.tangentBX - reach.tangentAX) * t
      const tz = reach.tangentAZ! + (reach.tangentBZ! - reach.tangentAZ!) * t
      const m = Math.hypot(tx, tz)
      if (m > .00001) { nx = -tz / m; nz = tx / m }
    }
    const x = reach.ax + dx * t, z = reach.az + dz * t, y = reach.ya + (reach.yb - reach.ya) * t
    const depth = reach.mouth ? Math.max(.22, Math.min(4, w * .035)) : Math.max(.45, Math.min(4, w * .028))
    const edge = Math.max(.08, Math.min(.55, depth * .16))
    values.push(...vertex(x + nx * w, y, z + nz * w, edge), ...vertex(x, y, z, depth),
      ...vertex(x - nx * w, y, z - nz * w, edge))
  }
  if (reach.mouth) {
    const last = values.length - 12
    const radius = Math.hypot(values[last]! - values[last + 4]!, values[last + 2]! - values[last + 6]!)
    const overlap = Math.min(80, Math.max(32, radius * 2.2))
    for (let side = 0; side < 3; side++) {
      const index = last + side * 4
      values.push(...vertex(values[index]! + fx * overlap, values[index + 1]!,
        values[index + 2]! + fz * overlap, Math.max(values[index + 3]!, .18)))
    }
  }
  const triangle = (a: readonly number[], b: readonly number[], c: readonly number[]): void => { caps.push(...a, ...b, ...c) }
  const quad = (a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]): void => {
    triangle(a, b, c); triangle(a, c, d)
  }
  const cap = (index: number, direction: number, round: boolean, scale = 1): void => {
    const left = values.slice(index, index + 4), center = values.slice(index + 4, index + 8)
    const right = values.slice(index + 8, index + 12)
    const radius = Math.hypot(left[0]! - center[0]!, left[2]! - center[2]!) * scale
    if (round) {
      // A mouth closes only the outward half of its last cross-section. A
      // full disc also covered the upstream ribbon, leaving coplanar surfaces
      // with different depths/flow that flickered as a bright semicircular lip.
      const half = scale !== 1.06
      const nx = (left[0]! - center[0]!) / Math.max(.001, radius / scale)
      const nz = (left[2]! - center[2]!) / Math.max(.001, radius / scale)
      const points = Array.from({ length: half ? 9 : 8 }, (_, i) => {
        const angle = half ? -Math.PI * .5 + i / 8 * Math.PI : i / 8 * Math.PI * 2
        const along = Math.cos(angle) * radius, across = Math.sin(angle) * radius
        return vertex(center[0]! + (half ? nz * direction * along + nx * across : along), center[1]!,
          center[2]! + (half ? -nx * direction * along + nz * across : across), Math.max(.08, center[3]! * .5))
      })
      for (let i = 0; i < (half ? points.length - 1 : points.length); i++)
        triangle(center, points[i]!, points[(i + 1) % points.length]!)
      return
    }
    const distance = Math.max(140, radius * 3.4)
    const section = (t: number, w: number, lift: number, depth: number): number[][] => {
      const x = center[0]! + fx * direction * distance * t, z = center[2]! + fz * direction * distance * t
      return [vertex(x - fz * w, center[1]! + lift, z + fx * w, depth),
        vertex(x + fz * w, center[1]! + lift, z - fx * w, depth)]
    }
    const near = section(.2, Math.max(1.2, radius * .7), .02, .06)
    const mid = section(.5, Math.max(.8, radius * .42), .012, .035)
    const tip = vertex(center[0]! + fx * direction * distance, center[1]! - .012,
      center[2]! + fz * direction * distance, .008)
    quad(left, right, near[1]!, near[0]!); quad(near[0]!, near[1]!, mid[1]!, mid[0]!)
    triangle(mid[0]!, mid[1]!, tip)
  }
  if (reach.source ?? true) cap(0, -1, !!reach.mouth)
  else if (!reach.mouth && reach.tangentAX === undefined) cap(0, -1, true, 1.06)
  const last = values.length - 12
  if (reach.terminal ?? true) {
    cap(last, 1, !!reach.mouth)
    if (!reach.mouth) cap(last, 1, true, .82)
  } else if (!reach.mouth && reach.tangentBX === undefined) cap(last, 1, true, 1.06)
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  for (const array of [values, caps]) for (let i = 0; i < array.length; i += 4) {
    minX = Math.min(minX, array[i]!); maxX = Math.max(maxX, array[i]!)
    minZ = Math.min(minZ, array[i + 2]!); maxZ = Math.max(maxZ, array[i + 2]!)
  }
  const surface: RiverSurface = { sections: new Float64Array(values), caps: new Float64Array(caps), minX, minZ, maxX, maxZ }
  if (lakes.length) {
    surface.triangles = clipLakeShore(surface.sections, surface.caps, lakes)
    if (surface.triangles) {
      surface.sections = empty; surface.caps = empty
      if (surface.triangles.length >= 384) {
        const buckets: number[][] = Array.from({ length: 16 }, () => [])
        const sx = 4 / Math.max(.001, maxX - minX), sz = 4 / Math.max(.001, maxZ - minZ)
        const p = surface.triangles
        for (let i = 0; i < p.length; i += 12) {
          const x0 = Math.max(0, Math.min(3, Math.floor((Math.min(p[i]!, p[i + 4]!, p[i + 8]!) - minX) * sx)))
          const x1 = Math.max(0, Math.min(3, Math.floor((Math.max(p[i]!, p[i + 4]!, p[i + 8]!) - minX) * sx)))
          const z0 = Math.max(0, Math.min(3, Math.floor((Math.min(p[i + 2]!, p[i + 6]!, p[i + 10]!) - minZ) * sz)))
          const z1 = Math.max(0, Math.min(3, Math.floor((Math.max(p[i + 2]!, p[i + 6]!, p[i + 10]!) - minZ) * sz)))
          for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) buckets[z * 4 + x]!.push(i)
        }
        const offsets = new Uint32Array(17)
        for (let i = 0; i < buckets.length; i++) offsets[i + 1] = offsets[i]! + buckets[i]!.length
        surface.bins = { offsets, indices: new Uint32Array(buckets.flat()) }
      }
    }
  }
  surfaces.set(reach, surface)
  canonicalBasins.delete(reach)
  return surface
}

function triangleValue(p: Float64Array, a: number, b: number, c: number, x: number, z: number, component: 1 | 3): number {
  const ax = p[a]!, az = p[a + 2]!, bx = p[b]!, bz = p[b + 2]!, cx = p[c]!, cz = p[c + 2]!
  if (x < Math.min(ax, bx, cx) - .00001 || x > Math.max(ax, bx, cx) + .00001 ||
    z < Math.min(az, bz, cz) - .00001 || z > Math.max(az, bz, cz) + .00001) return -Infinity
  const determinant = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
  if (Math.abs(determinant) < 1e-8) return -Infinity
  const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / determinant
  const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / determinant
  if (Math.min(u, v, 1 - u - v) < -1e-7) return -Infinity
  return p[a + component]! * u + p[b + component]! * v + p[c + component]! * (1 - u - v)
}

/** Exact shared triangle height. Cached geometry makes the hot query allocation-free. */
export function riverSurfaceHeightAt(surface: RiverSurface, x: number, z: number): number {
  return surfaceValueAt(surface, x, z, 1)
}

/** The same canonical triangles supply optical depth on both sides of a mouth. */
export function riverSurfaceDepthAt(surface: RiverSurface, x: number, z: number): number {
  return surfaceValueAt(surface, x, z, 3)
}

function surfaceValueAt(surface: RiverSurface, x: number, z: number, component: 1 | 3): number {
  if (x < surface.minX || x > surface.maxX || z < surface.minZ || z > surface.maxZ) return -Infinity
  let height = -Infinity
  if (surface.triangles) {
    if (surface.bins) {
      const xBin = Math.min(3, Math.floor((x - surface.minX) * 4 / Math.max(.001, surface.maxX - surface.minX)))
      const zBin = Math.min(3, Math.floor((z - surface.minZ) * 4 / Math.max(.001, surface.maxZ - surface.minZ)))
      const bin = zBin * 4 + xBin, { offsets, indices } = surface.bins
      for (let j = offsets[bin]!; j < offsets[bin + 1]!; j++) {
        const i = indices[j]!
        height = Math.max(height, triangleValue(surface.triangles, i, i + 4, i + 8, x, z, component))
      }
      return height
    }
    for (let i = 0; i < surface.triangles.length; i += 12)
      height = Math.max(height, triangleValue(surface.triangles, i, i + 4, i + 8, x, z, component))
    return height
  }
  const p = surface.sections
  for (let i = 0; i < p.length - 12; i += 12) {
    height = Math.max(height, triangleValue(p, i, i + 12, i + 16, x, z, component),
      triangleValue(p, i, i + 16, i + 4, x, z, component), triangleValue(p, i + 4, i + 16, i + 20, x, z, component),
      triangleValue(p, i + 4, i + 20, i + 8, x, z, component))
  }
  for (let i = 0; i < surface.caps.length; i += 12)
    height = Math.max(height, triangleValue(surface.caps, i, i + 4, i + 8, x, z, component))
  return height
}
