/** Approved Oct 22 2026. The original five awards are shared by this many gates. */
export const MIN_MISSION_GATES = 15
export const MAX_MISSION_GATES = 100
export const BASELINE_GATE_AWARDS = 5

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
