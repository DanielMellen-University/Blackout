import { basinDistance, prepareHydrologyInBoundsSteps, riverReachesInBounds, waterBasinBoundsRadius,
  type RiverReach, type WaterBasin } from './Hydrology'
import { riverSurface, riverSurfaceDepthAt, type RiverSurface } from './RiverSurface'
import type { WaterBuildPhase } from './WaterSystem'
import { getWorldSeed } from './noise'

export interface BasinVertex { x: number; z: number; y: number; depth: number }
interface BasinSurface { boundary: BasinVertex[]; inner: BasinVertex[]; inlets: readonly RiverSurface[] }
/** Weak ownership follows the existing bounded drainage-node lifetime. */
const surfaces = new WeakMap<WaterBasin, BasinSurface>()

export function basinOpticalDepth(basin: WaterBasin, inlets: readonly RiverSurface[], x: number, z: number): number {
  let depth = Math.max(.08, -basinDistance(basin, x, z) * .06)
  for (const surface of inlets) depth = Math.max(depth, riverSurfaceDepthAt(surface, x, z))
  return depth
}

/** Canonical complete-basin inlet queries keep optical data independent of tile
 * order, LOD and cancellation. Authored fixtures consume their supplied reaches. */
export function* basinSurfaceSteps(basin: WaterBasin, supplied: readonly RiverReach[]):
  Generator<WaterBuildPhase, BasinSurface, void> {
  const previous = basin.id ? surfaces.get(basin) : undefined
  if (previous) return previous
  const buildSeed = getWorldSeed()
  const ensureSeed = (): void => {
    if (getWorldSeed() !== buildSeed) throw new Error('World seed changed during basin preparation')
  }
  let reaches = supplied
  if (basin.id) {
    const r = waterBasinBoundsRadius(basin) + 200
    for (const _phase of prepareHydrologyInBoundsSteps(basin.x - r, basin.z - r, basin.x + r, basin.z + r)) yield 'shore'
    ensureSeed()
    reaches = riverReachesInBounds(basin.x - r, basin.z - r, basin.x + r, basin.z + r)
  }
  const inlets: RiverSurface[] = []
  for (const reach of reaches) {
    if (Math.min(Math.abs(reach.ya - basin.level), Math.abs(reach.yb - basin.level)) > 1) continue
    const surface = riverSurface(reach, [basin])
    const r = waterBasinBoundsRadius(basin)
    if (surface.maxX < basin.x - r || surface.minX > basin.x + r ||
      surface.maxZ < basin.z - r || surface.minZ > basin.z + r) continue
    inlets.push(surface)
    if (inlets.length % 4 === 0) { yield 'shore'; ensureSeed() }
  }
  const boundary: BasinVertex[] = []
  const outline = basin.islands?.length ? { ...basin, islands: undefined } : basin
  const count = basin.shoreRadii?.length ?? (basin.sea ? 256 : basin.pond ? 96 : 160)
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2
    let low = 0, high = basin.radius * (basin.sea ? 2.65 : basin.pond ? 2.9 : 2.5)
    for (let expand = 0; expand < 3 && basinDistance(outline, basin.x + Math.cos(angle) * high,
      basin.z + Math.sin(angle) * high) < 0; expand++) high *= 1.35
    for (let pass = 0; !basin.shoreRadii && pass < 9; pass++) {
      const radius = (low + high) * .5
      if (basinDistance(outline, basin.x + Math.cos(angle) * radius, basin.z + Math.sin(angle) * radius) < 0) low = radius
      else high = radius
    }
    if (basin.shoreRadii) low = basin.shoreRadii[i]!
    const x = Math.cos(angle) * low, z = Math.sin(angle) * low
    boundary.push({ x, z, y: basin.level, depth: basinOpticalDepth(basin, inlets, basin.x + x, basin.z + z) })
    if (i % 8 === 7) { yield 'shore'; ensureSeed() }
  }
  if (inlets.length && basin.shoreRadii) {
    // Insert exact channel/shore intersections along existing polygon chords.
    // A narrow inlet must not fall between the lake's angular sample points.
    for (const inlet of inlets) for (const vertices of [inlet.triangles ?? inlet.sections, inlet.caps]) {
      for (let i = 0; i < vertices.length; i += 4) {
        const x = vertices[i]!, z = vertices[i + 2]!
        if (Math.abs(basinDistance(outline, x, z)) > .12 || Math.abs(vertices[i + 1]! - basin.level) > .15) continue
        const theta = (Math.atan2(z - basin.z, x - basin.x) + Math.PI * 2) % (Math.PI * 2)
        const sector = Math.floor(theta / (Math.PI * 2) * basin.shoreRadii.length)
        const a = boundary[sector]!, b = boundary[(sector + 1) % basin.shoreRadii.length]!
        const dx = b.x - a.x, dz = b.z - a.z
        const t = Math.max(0, Math.min(1, ((x - basin.x - a.x) * dx + (z - basin.z - a.z) * dz) / (dx * dx + dz * dz)))
        boundary.push({ x: a.x + dx * t, z: a.z + dz * t, y: basin.level, depth: Math.max(.08, vertices[i + 3]!) })
      }
      yield 'shore'; ensureSeed()
    }
    const angle = (p: BasinVertex) => (Math.atan2(p.z, p.x) + Math.PI * 2) % (Math.PI * 2)
    boundary.sort((a, b) => angle(a) - angle(b))
    let count = 0
    for (const vertex of boundary) {
      const last = boundary[count - 1]
      if (last && Math.hypot(vertex.x - last.x, vertex.z - last.z) < .05) last.depth = Math.max(last.depth, vertex.depth)
      else boundary[count++] = vertex
    }
    boundary.length = count
    if (count > 1 && Math.hypot(boundary[0]!.x - boundary[count - 1]!.x, boundary[0]!.z - boundary[count - 1]!.z) < .05) {
      boundary[0]!.depth = Math.max(boundary[0]!.depth, boundary.pop()!.depth)
    }
  }
  const inner = boundary.map(p => {
    const t = Math.max(.3, 1 - 120 / Math.max(1, Math.hypot(p.x, p.z)))
    const x = p.x * t, z = p.z * t
    return { x, z, y: basin.level, depth: basinOpticalDepth(basin, inlets, basin.x + x, basin.z + z) }
  })
  const result = { boundary, inner, inlets }
  // Publish only complete data; abandoned cooperative builds retain no scratch.
  if (basin.id) surfaces.set(basin, result)
  return result
}
