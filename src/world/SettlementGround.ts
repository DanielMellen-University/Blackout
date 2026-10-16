import type { LocalSpace } from './SettlementLayout'
import type { RoadGroundSampler } from './RoadSurface'

export const MAX_SETTLEMENT_GROUND_PATCHES = 24
export const MAX_SETTLEMENT_GROUND_VERTICES = 30_000
export interface SettlementGroundPatch {
  use: LocalSpace['use']; color: number
  /** Absolute-world triangle vertices, sampled off-thread. */
  positions: number[]
}

/** Independent draped surfaces, not a flat plane balanced on the centre
 * sample. Wet/steep triangles are omitted; fields keep their real relief. */
export function settlementGroundPatch(
  space: LocalSpace, originX: number, originZ: number, angle: number, sample: RoadGroundSampler,
): SettlementGroundPatch | null {
  const yaw = angle + space.yaw, c = Math.cos(yaw), s = Math.sin(yaw)
  const ca = Math.cos(angle), sa = Math.sin(angle)
  const centreX = originX + ca * space.x + sa * space.z
  const centreZ = originZ - sa * space.x + ca * space.z
  const step = space.use === 'field' ? 16 : 8
  const nx = Math.ceil(space.width / step), nz = Math.ceil(space.depth / step)
  if (nx <= 0 || nz <= 0 || nx * nz * 6 > MAX_SETTLEMENT_GROUND_VERTICES) return null
  const points: { x: number; y: number; z: number; dry: boolean }[] = []
  for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
    const lx = (x / nx - .5) * space.width, lz = (z / nz - .5) * space.depth
    const wx = centreX + c * lx + s * lz, wz = centreZ - s * lx + c * lz
    const ground = sample(wx, wz)
    points.push({ x: wx, y: ground.height + .12, z: wz,
      dry: Number.isFinite(ground.height) && ground.height > (ground.waterLevel ?? 0) + 2 })
  }
  const positions: number[] = []
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const a = points[z * (nx + 1) + x]!, b = points[z * (nx + 1) + x + 1]!
    const c = points[(z + 1) * (nx + 1) + x]!, d = points[(z + 1) * (nx + 1) + x + 1]!
    for (const triangle of [[a, c, b], [b, c, d]]) {
      if (triangle.some(p => !p.dry)) continue
      const high = Math.max(...triangle.map(p => p.y)), low = Math.min(...triangle.map(p => p.y))
      if (high - low > step * (space.use === 'field' ? .2 : .28)) continue
      for (const p of triangle) positions.push(p.x, p.y, p.z)
    }
  }
  return positions.length ? { use: space.use, color: space.color, positions } : null
}
