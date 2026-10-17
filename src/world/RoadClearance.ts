import type { SettlementPlan } from './SettlementPlan'

type Position = { x: number; z: number }
type Footprint = { x: number; z: number; c: number; s: number; hx: number; hz: number }
const CELL = 512
const MAX_QUERY_CELLS = 1024

/** Temporary worker-owned index. Inflate rotated footprints by the complete
 * shoulder and a small setback. Conservative at corners, never load-order based.
 * Raised roads also avoid buildings: this is not a tunnel/overbuilding system. */
export class RoadClearance {
  private readonly cells = new Map<string, Footprint[]>()

  constructor(plans: readonly SettlementPlan[], width: number) {
    const margin = width * .775 + 2
    for (const plan of plans) for (const building of plan.buildings) {
      this.add(building, building.width / 2 + margin, building.depth / 2 + margin)
      // Match the actual 25 x 17 m gas-station canopy, including columns/pumps.
      if (building.service) this.add(building.service, 12.5 + margin, 8.5 + margin)
    }
  }

  private add(p: Position & { yaw: number }, hx: number, hz: number): void {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw)
    const box: Footprint = { x: p.x, z: p.z, c, s, hx, hz }
    const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz
    for (let x = Math.floor((p.x - ex) / CELL); x <= Math.floor((p.x + ex) / CELL); x++) {
      for (let z = Math.floor((p.z - ez) / CELL); z <= Math.floor((p.z + ez) / CELL); z++) {
        const key = `${x},${z}`, entries = this.cells.get(key)
        if (entries) entries.push(box)
        else this.cells.set(key, [box])
      }
    }
  }

  /** Traverse only bins touched by the centreline, not a diagonal's entire
   * bounding rectangle. Expanded footprints already include the road width. */
  readonly allows = (a: Position, b: Position): boolean => {
    if (!Number.isFinite(a.x) || !Number.isFinite(a.z) || !Number.isFinite(b.x) || !Number.isFinite(b.z)) return false
    let x = Math.floor(a.x / CELL), z = Math.floor(a.z / CELL)
    const endX = Math.floor(b.x / CELL), endZ = Math.floor(b.z / CELL)
    const dx = b.x - a.x, dz = b.z - a.z, sx = Math.sign(dx), sz = Math.sign(dz)
    const stepX = dx ? CELL / Math.abs(dx) : Infinity, stepZ = dz ? CELL / Math.abs(dz) : Infinity
    let tx = dx ? ((x + (sx > 0 ? 1 : 0)) * CELL - a.x) / dx : Infinity
    let tz = dz ? ((z + (sz > 0 ? 1 : 0)) * CELL - a.z) / dz : Infinity
    for (let visited = 0; visited < MAX_QUERY_CELLS; visited++) {
      const entries = this.cells.get(`${x},${z}`)
      if (entries) for (const box of entries) if (intersects(a, b, box)) return false
      if (x === endX && z === endZ) return true
      if (tx < tz) { x += sx; tx += stepX }
      else { z += sz; tz += stepZ }
    }
    return false
  }

  routeAllows(points: readonly Position[]): boolean {
    for (let i = 1; i < points.length; i++) if (!this.allows(points[i - 1]!, points[i]!)) return false
    return true
  }
}

/** Segment/OBB slab intersection in local coordinates, including tangency.
 * Three's positive yaw maps local +X toward world -Z. */
function intersects(a: Position, b: Position, box: Footprint): boolean {
  const ax = a.x - box.x, az = a.z - box.z, bx = b.x - box.x, bz = b.z - box.z
  const x = ax * box.c - az * box.s, z = ax * box.s + az * box.c
  const dx = (bx - ax) * box.c - (bz - az) * box.s
  const dz = (bx - ax) * box.s + (bz - az) * box.c
  let lo = 0, hi = 1
  if (Math.abs(dx) < 1e-12) { if (Math.abs(x) > box.hx) return false }
  else {
    const t0 = (-box.hx - x) / dx, t1 = (box.hx - x) / dx
    lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1))
    if (lo > hi) return false
  }
  if (Math.abs(dz) < 1e-12) { if (Math.abs(z) > box.hz) return false }
  else {
    const t0 = (-box.hz - z) / dz, t1 = (box.hz - z) / dz
    lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1))
  }
  return lo <= hi
}
