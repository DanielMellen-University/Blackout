/** Basin-owned depression breaches. All edges remain on one four-neighbour
 * lattice, so a spill becomes part of the drainage tree rather than crossing
 * existing rivers as an unrelated ribbon. Cache coordinates, never node trees. */
export interface DrainageNode {
  gx: number; gz: number; x: number; z: number; height: number
  rawParent?: readonly [number, number] | null
  drainageRoot?: readonly [number, number]
  spill?: { path: readonly (readonly [number, number])[] } | null
  waterGrade?: number
  drainageFlow?: number
}
const DIRECTIONS = [[-1, 0], [0, -1], [1, 0], [0, 1]] as const
const SEARCH_RADIUS = 8
const MAX_BREACH = 400

export function drainageRouter<T extends DrainageNode>(get: (gx: number, gz: number) => T, rainfall: (n: T) => number) {
  const rawParent = (n: T): T | null => {
    if (n.rawParent !== undefined) return n.rawParent ? get(...n.rawParent) : null
    let best: T | null = null, slope = 0
    if (n.height > 0) for (const [dx, dz] of DIRECTIONS) {
      const q = get(n.gx + dx, n.gz + dz)
      const grade = (n.height - q.height) / Math.hypot(n.x - q.x, n.z - q.z)
      if (grade > slope + .00001) { best = q; slope = grade }
    }
    n.rawParent = best ? [best.gx, best.gz] : null
    return best
  }
  const root = (n: T): T => {
    const path: T[] = []
    let current = n
    while (!current.drainageRoot) {
      path.push(current)
      const p = rawParent(current)
      if (!p) { current.drainageRoot = [current.gx, current.gz]; break }
      current = p
    }
    const coordinates = current.drainageRoot!
    for (const q of path) q.drainageRoot = coordinates
    return get(...coordinates)
  }
  const sameRoot = (a: T, b: T): boolean => a.gx === b.gx && a.gz === b.gz
  function* spillSteps(sink: T): Generator<void, NonNullable<DrainageNode['spill']> | null> {
    if (sink.spill !== undefined) return sink.spill
    if (sink.height <= 0) return (sink.spill = null)
    let edge: T | null = null, outlet: T | null = null, cost = Infinity
    // Explore the connected raw basin, not every unrelated catchment in the
    // surrounding square. Every admitted reverse path stays in the existing
    // search envelope and below the same breach ceiling.
    const span = SEARCH_RADIUS * 2 + 1, visited = new Uint8Array(span * span)
    const queue: T[] = [sink]
    visited[SEARCH_RADIUS * span + SEARCH_RADIUS] = 1
    yield
    for (let index = 0; index < queue.length; index++) {
      if (index && index % 8 === 0) yield
      const a = queue[index]!
      for (const [x, z] of DIRECTIONS) {
        const b = get(a.gx + x, a.gz + z)
        const barrier = Math.max(a.height, b.height) - sink.height
        if (barrier > MAX_BREACH) continue
        const p = rawParent(b)
        if (p?.gx === a.gx && p.gz === a.gz) {
          const dx = b.gx - sink.gx + SEARCH_RADIUS, dz = b.gz - sink.gz + SEARCH_RADIUS
          if (dx >= 0 && dz >= 0 && dx < span && dz < span && !visited[dz * span + dx]) {
            visited[dz * span + dx] = 1; queue.push(b)
          }
          continue
        }
        const target = root(b)
        if (target.height >= sink.height - .5) continue
        const score = barrier + Math.hypot(a.x - sink.x, a.z - sink.z) * .001
        // Preserve a stable geographic tie-break regardless of traversal order.
        if (score < cost || (score === cost && edge && (a.gz < edge.gz || (a.gz === edge.gz && a.gx < edge.gx)))) {
          edge = a; outlet = b; cost = score
        }
      }
    }
    if (!edge || !outlet) return (sink.spill = null)
    const path: (readonly [number, number])[] = [[outlet.gx, outlet.gz]]
    let current: T | null = edge
    while (current && path.length <= 64) {
      path.push([current.gx, current.gz])
      if (sameRoot(current, sink)) {
        path.reverse()
        return (sink.spill = { path })
      }
      current = rawParent(current)
    }
    return (sink.spill = null)
  }
  const spill = (sink: T): NonNullable<DrainageNode['spill']> | null => {
    if (sink.spill !== undefined) return sink.spill
    const steps = spillSteps(sink)
    let result = steps.next()
    while (!result.done) result = steps.next()
    return result.value
  }
  const parent = (n: T): T | null => {
    const sink = root(n), plan = spill(sink)
    if (plan) for (let i = 0; i < plan.path.length - 1; i++) {
      const a = plan.path[i]!
      if (a[0] === n.gx && a[1] === n.gz) return get(...plan.path[i + 1]!)
    }
    return rawParent(n)
  }
  const grade = (n: T): number => {
    if (n.waterGrade !== undefined) return n.waterGrade
    if (n.height <= 0) return (n.waterGrade = 0)
    let level = n.height - 8
    for (const [dx, dz] of DIRECTIONS) {
      const q = get(n.gx + dx, n.gz + dz), p = parent(q)
      if (p?.gx === n.gx && p.gz === n.gz)
        level = Math.min(level, grade(q))
    }
    return (n.waterGrade = Math.max(.01, level))
  }
  const flow = (n: T): number => {
    if (n.drainageFlow !== undefined) return n.drainageFlow
    let amount = rainfall(n)
    for (const [dx, dz] of DIRECTIONS) {
      const q = get(n.gx + dx, n.gz + dz), p = parent(q)
      if (p?.gx === n.gx && p.gz === n.gz) amount += flow(q)
    }
    return (n.drainageFlow = amount)
  }
  /** Worker/fallback preparation warms complete drainage dependencies in
   * cooperative slices. Cancelled searches publish no partial spill route. */
  function* prepareSteps(start: T): Generator<void> {
    if (start.waterGrade !== undefined && start.drainageFlow !== undefined) return
    function* prepareParent(n: T): Generator<void, T | null> {
      const sink = root(n)
      if (sink.spill === undefined) yield* spillSteps(sink)
      return parent(n)
    }
    let current = start
    while (true) {
      const p = yield* prepareParent(current)
      if (!p) break
      current = p
    }
    let work = 0
    function* accumulate(n: T): Generator<void> {
      if (n.waterGrade !== undefined && n.drainageFlow !== undefined) return
      let level = n.height <= 0 ? 0 : n.height - 8, amount = rainfall(n)
      for (const [dx, dz] of DIRECTIONS) {
        const q = get(n.gx + dx, n.gz + dz), p = yield* prepareParent(q)
        if (p?.gx !== n.gx || p.gz !== n.gz) continue
        yield* accumulate(q)
        level = Math.min(level, q.waterGrade!)
        amount += q.drainageFlow!
      }
      n.waterGrade = n.height <= 0 ? 0 : Math.max(.01, level)
      n.drainageFlow = amount
      if (++work % 8 === 0) yield
    }
    yield* accumulate(current)
    // A terminal scalar can survive FIFO eviction of an upstream node. Warm
    // that recreated start too instead of returning with its caches absent.
    yield* accumulate(start)
  }
  return { parent, rawParent, root, grade, flow, prepareSteps }
}
