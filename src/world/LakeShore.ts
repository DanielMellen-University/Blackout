import { basinDistance, type RiverReach, type WaterBasin } from './Hydrology'
import { riverSurface } from './RiverSurface'

/** Refine the already constrained radial contour, without extra terrain probes.
 * Periodic monotone Hermite slopes round coves without overshooting their
 * neighbouring radii. This exact polygon is shared by water and collision. */
export function refineLakeShore(radii: Float32Array): Float32Array {
  const count = radii.length, refined = new Float32Array(count * 2)
  const slope = (previous: number, current: number, next: number): number => {
    const a = current - previous, b = next - current
    return a * b > 0 ? 2 * a * b / (a + b) : 0
  }
  for (let i = 0; i < count; i++) {
    const previous = radii[(i + count - 1) % count]!, a = radii[i]!
    const b = radii[(i + 1) % count]!, next = radii[(i + 2) % count]!
    refined[i * 2] = a
    refined[i * 2 + 1] = Math.max(Math.min(a, b), Math.min(Math.max(a, b),
      (a + b) * .5 + (slope(previous, a, b) - slope(a, b, next)) * .125))
  }
  return refined
}

/** Round the union of a lake and its level mouth ribbons into one cached
 * radial polygon. A compact polynomial smooth minimum has matching value
 * and first derivative at both shoulders, unlike a hard lake/ribbon union.
 * Unjoined lakes keep their original object and all original radii. */
export function flareLakeShore(basin: WaterBasin, joined: readonly RiverReach[], maximumRadius = Infinity): WaterBasin {
  if (!basin.shoreRadii || !joined.length) return basin
  const spans: { ax: number; az: number; dx: number; dz: number; lengthSq: number; wa: number; wb: number }[] = []
  let margin = 0
  for (const reach of joined) {
    if (Math.abs(reach.ya - basin.level) > .00001 || Math.abs(reach.yb - basin.level) > .00001) continue
    // A temporary unregistered copy supplies the same curved cross-sections
    // used by the ribbon. Do not cache the original against an unfinished lake.
    const sections = riverSurface({ ...reach, source: false, mouth: false }, []).sections
    for (let i = 0; i < sections.length - 12; i += 12) {
      const ax = sections[i + 4]!, az = sections[i + 6]!
      const dx = sections[i + 16]! - ax, dz = sections[i + 18]! - az
      const wa = Math.hypot(sections[i]! - ax, sections[i + 2]! - az)
      const wb = Math.hypot(sections[i + 12]! - sections[i + 16]!, sections[i + 14]! - sections[i + 18]!)
      spans.push({ ax, az, dx, dz, lengthSq: dx * dx + dz * dz, wa, wb })
      margin = Math.max(margin, wa * 4, wb * 4)
    }
  }
  if (!spans.length) return basin
  let radii = basin.shoreRadii
  // Resample chords, not a new eased curve: sectors outside every mouth
  // retain the original polygon, including its original constrained anchors.
  while (radii.length < 512) {
    const next = new Float32Array(radii.length * 2)
    for (let i = 0; i < next.length; i++) {
      const angle = i / next.length * Math.PI * 2
      next[i] = i % 2 === 0 ? radii[i / 2]! : -basinDistance({ ...basin, islands: undefined, shoreRadii: radii },
        basin.x + Math.cos(angle), basin.z + Math.sin(angle)) + 1
    }
    radii = next
  }
  const shore = radii.slice()
  for (let i = 0; i < shore.length; i++) {
    const angle = i / shore.length * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle)
    const field = (radius: number): number => {
      const x = basin.x + cos * radius, z = basin.z + sin * radius
      let channel = Infinity, width = 0
      for (const s of spans) {
        const t = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (z - s.az) * s.dz) / Math.max(.001, s.lengthSq)))
        const w = s.wa + (s.wb - s.wa) * t
        const d = Math.hypot(x - s.ax - s.dx * t, z - s.az - s.dz * t) - w
        if (d < channel) { channel = d; width = w }
      }
      const lake = radius - radii[i]!, k = width * 3
      if (!k) return lake
      const h = Math.max(0, 1 - Math.abs(lake - channel) / k)
      return Math.min(lake, channel) - h * h * k * .25
    }
    if (field(radii[i]!) >= -1e-5) continue
    let lo = radii[i]!, hi = lo
    // Find the first outward crossing. A grazing channel can cross a ray
    // again farther away; a single wide bracket could jump over dry land.
    for (let step = 1; step <= 64; step++) {
      hi = radii[i]! + margin * step / 64
      if (field(hi) >= 0) break
      lo = hi
    }
    for (let pass = 0; pass < 20; pass++) {
      const mid = (lo + hi) * .5
      if (field(mid) < 0) lo = mid
      else hi = mid
    }
    shore[i] = (lo + hi) * .5
  }
  // Smooth only the added mouth displacement. This rounds radial grazing
  // cases without eroding a constrained cove or moving an unjoined bank.
  let displacement = shore.map((r, i) => Math.max(0, r - radii[i]!))
  for (let pass = 0; pass < 14; pass++) {
    const next = displacement.slice()
    for (let i = 0; i < next.length; i++) next[i] =
      displacement[(i + next.length - 1) % next.length]! * .25 + displacement[i]! * .5 +
      displacement[(i + 1) % next.length]! * .25
    displacement = next
  }
  // Scale the added shoulder uniformly if the regional query halo would be
  // exceeded. A hard radial clamp would introduce a new corner at the limit.
  let scale = 1
  for (let i = 0; i < shore.length; i++) if (displacement[i]! > 0)
    scale = Math.min(scale, Math.max(0, maximumRadius - radii[i]!) / displacement[i]!)
  for (let i = 0; i < shore.length; i++) shore[i] = radii[i]! + displacement[i]! * scale
  return { ...basin, shoreRadii: shore,
    boundsRadius: Math.max(basin.boundsRadius ?? basin.radius * 1.75, ...shore) }
}
