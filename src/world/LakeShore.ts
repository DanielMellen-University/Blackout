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
