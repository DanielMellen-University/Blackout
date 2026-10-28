import { getTerrainProfile } from '../world/TerrainProfile'

/** Approved Oct 22 2026. The original five awards are shared by this many gates. */
export const MIN_MISSION_GATES = 15
export const MAX_MISSION_GATES = 100
export const BASELINE_GATE_AWARDS = 5
/** Mission overhaul A (Oct 24 2026, spacing decided Oct 27): generated routes. */
export const MIN_GENERATED_GATES = 8
export const MAX_GENERATED_GATES = 20
export const MIN_GATE_SPACING_M = 800
export const MAX_GATE_SPACING_M = 2_500

interface Point { x: number; y: number; z: number }

/** Round authored corridor corners, then distribute gates by travelled distance.
 * Runs only while building a route. Keep the departure and aligned home final.
 */
export function distributeMissionGates(anchors: readonly Point[], count: number, roundCorners = true): Point[] {
  if (anchors.length < 2) return anchors.map(p => ({ ...p }))
  const samples: Point[] = [{ ...anchors[0]! }]
  const mix = (a: Point, b: Point, t: number): Point => ({
    x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
  })
  for (let i = 1; roundCorners && i < anchors.length - 1; i++) {
    const a = anchors[i - 1]!, b = anchors[i]!, c = anchors[i + 1]!
    const entry = mix(b, a, .35), exit = mix(b, c, .35)
    samples.push(entry)
    for (let step = 1; step <= 32; step++) {
      const t = step / 32
      samples.push(mix(mix(entry, b, t), mix(b, exit, t), t))
    }
  }
  if (!roundCorners) samples.push(...anchors.slice(1).map(p => ({ ...p })))
  else samples.push({ ...anchors[anchors.length - 1]! })
  const distances = [0]
  for (let i = 1; i < samples.length; i++) distances.push(distances[i - 1]! + Math.hypot(
    samples[i]!.x - samples[i - 1]!.x, samples[i]!.z - samples[i - 1]!.z))
  const total = distances[distances.length - 1]!
  const result: Point[] = []
  let segment = 1
  for (let i = 0; i < count; i++) {
    const distance = total * i / (count - 1)
    while (segment < samples.length - 1 && distances[segment]! < distance) segment++
    result.push(mix(samples[segment - 1]!, samples[segment]!,
      (distance - distances[segment - 1]!) / Math.max(1e-9, distances[segment]! - distances[segment - 1]!)))
  }
  return result
}

/** Daniel, Oct 27 2026: terrain bending is moderate only. */
export const MAX_ROUTE_BEND_M = 160
const BEND_STEPS = [-1, -.5, 0, .5, 1] as const
const BEND_TURN_LIMIT_DEG = 72
/** Metres of ground saved per metre of bend before a gate leaves the line. */
const BEND_STRAIGHT_BIAS = .05
const VALLEY_BEND_STRAIGHT_BIAS = .005

/** Nudge interior gates sideways, at most MAX_ROUTE_BEND_M from the seeded
 * line, toward lower ground: gentle curves through valleys and saddles. Gate 1
 * and the last two runway-axis gates stay put.
 * Spacing stays 0.8 to 2.5 km and every turn, from the spawn heading on,
 * stays under the 75 degree limit. The active terrain theme selects the bias. */
export function bendRouteTowardValleys<T extends Point>(
  gates: readonly T[], spawnX: number, spawnZ: number,
  ground: (x: number, z: number) => number,
): T[] {
  const theme = getTerrainProfile()?.theme
  const straightBias = theme === 'mountain-valley-run' || theme === 'volcanic-run'
    ? VALLEY_BEND_STRAIGHT_BIAS : BEND_STRAIGHT_BIAS
  const out = gates.map(p => ({ ...p }))
  const turn = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number => {
    const ux = bx - ax, uz = bz - az, vx = cx - bx, vz = cz - bz
    const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz)
    if (lu < 1e-6 || lv < 1e-6) return 180
    return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) / (lu * lv)))) * 180 / Math.PI
  }
  const at = (i: number): { x: number; z: number } => i < 0 ? { x: spawnX, z: spawnZ } : out[i]!
  const fits = (i: number): boolean => {
    for (const leg of [i, i + 1]) {
      if (leg < 1 || leg >= out.length) continue
      const length = Math.hypot(out[leg]!.x - out[leg - 1]!.x, out[leg]!.z - out[leg - 1]!.z)
      if (length < MIN_GATE_SPACING_M || length > MAX_GATE_SPACING_M) return false
    }
    for (const j of [i - 1, i, i + 1]) {
      if (j < 0 || j >= out.length - 1) continue
      const a = at(j - 1), b = out[j]!, c = out[j + 1]!
      if (turn(a.x, a.z, b.x, b.z, c.x, c.z) >= BEND_TURN_LIMIT_DEG) return false
    }
    return true
  }
  for (let i = 1; i < out.length - 2; i++) {
    const before = out[i - 1]!, after = gates[i + 1]!
    const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx, dz)
    if (length < 1e-6) continue
    const nx = dz / length, nz = -dx / length
    const base = gates[i]!
    let best = { x: base.x, z: base.z }, bestCost = Number.POSITIVE_INFINITY
    for (const step of BEND_STEPS) {
      const x = base.x + nx * step * MAX_ROUTE_BEND_M, z = base.z + nz * step * MAX_ROUTE_BEND_M
      const height = ground(x, z)
      if (!Number.isFinite(height)) continue
      out[i]!.x = x; out[i]!.z = z
      if (!fits(i)) continue
      const cost = height + Math.abs(step) * MAX_ROUTE_BEND_M * straightBias
      if (cost < bestCost) { bestCost = cost; best = { x, z } }
    }
    out[i]!.x = best.x; out[i]!.z = best.z
  }
  return out
}
