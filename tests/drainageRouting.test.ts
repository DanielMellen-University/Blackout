import { describe, expect, it } from 'vitest'
import { drainageRouter, type DrainageNode } from '../src/world/DrainageRouting'

function fixture(capacity = 16384) {
  const nodes = new Map<string, DrainageNode>()
  const get = (gx: number, gz: number): DrainageNode => {
    const key = `${gx},${gz}`
    let n = nodes.get(key)
    if (!n) {
      const height = gx < -6 || gx >= 9 || Math.abs(gz) > 6 ? 0 :
        Math.min(20 + (gx * gx + gz * gz) * 10, 10 + ((gx - 4) ** 2 + gz * gz) * 10)
      n = { gx, gz, x: gx * 2000, z: gz * 2000, height }
      if (nodes.size >= capacity) nodes.delete(nodes.keys().next().value!)
      nodes.set(key, n)
    }
    return n
  }
  return { get, evict: (gx: number, gz: number) => nodes.delete(`${gx},${gz}`),
    ...drainageRouter(get, n => n.height > 0 ? 1 : 0) }
}

describe('canonical depression drainage', () => {
  it('warms a recreated upstream node even when its terminal caches survive eviction', () => {
    const r = fixture(), first = r.get(0, 0)
    for (const _ of r.prepareSteps(first)) { /* complete preparation */ }
    const expectedGrade = first.waterGrade, expectedFlow = first.drainageFlow
    r.evict(0, 0)
    const replacement = r.get(0, 0)
    expect(replacement).not.toBe(first)
    for (const _ of r.prepareSteps(replacement)) { /* retain the cached terminal */ }
    expect(replacement.waterGrade).toBe(expectedGrade)
    expect(replacement.drainageFlow).toBe(expectedFlow)
  })

  it('prepares cooperatively without publishing a partial route when cancelled', () => {
    const r = fixture(), sink = r.get(0, 0)
    const cancelled = r.prepareSteps(sink)
    expect(cancelled.next().done).toBe(false)
    expect(sink.spill).toBeUndefined()
    cancelled.return()
    expect(sink.spill).toBeUndefined()
    let slices = 0
    for (const _ of r.prepareSteps(sink)) slices++
    expect(slices).toBeGreaterThan(10)
    expect(slices).toBeLessThan(2000)
    expect(sink.spill?.path[0]).toEqual([0, 0])
    const synchronous = fixture()
    for (const [x, z] of [[0, 0], [1, 0], [4, 0], [8, 0]]) {
      const a = r.get(x!, z!), b = synchronous.get(x!, z!)
      expect(r.grade(a)).toBe(synchronous.grade(b))
      expect(r.flow(a)).toBe(synchronous.flow(b))
    }
  })

  it('breaches a local depression into a lower basin and on to the sea without a loop', () => {
    const r = fixture(), sink = r.get(0, 0)
    expect(r.rawParent(sink)).toBeNull()
    expect(r.parent(sink)?.gx).toBe(1)
    const seen = new Set<string>()
    let n: DrainageNode | null = sink, previous = Infinity, previousFlow = 0
    while (n) {
      const key = `${n.gx},${n.gz}`
      expect(seen.has(key)).toBe(false); seen.add(key)
      expect(r.grade(n)).toBeLessThanOrEqual(previous)
      expect(r.grade(n)).toBeLessThanOrEqual(Math.max(.01, n.height - 8))
      expect(r.flow(n)).toBeGreaterThanOrEqual(previousFlow)
      previous = r.grade(n); previousFlow = r.flow(n)
      const p = r.parent(n)
      if (p) expect(Math.abs(p.gx - n.gx) + Math.abs(p.gz - n.gz)).toBe(1)
      else expect(n.height).toBe(0)
      n = p
      expect(seen.size).toBeLessThan(64)
    }
    expect(seen.has('4,0')).toBe(true)
    expect(previousFlow).toBeGreaterThan(20)
  })

  it('keeps routing, accumulated runoff and grades identical across query order and cache eviction', () => {
    const positions: [number, number][] = []
    for (let x = -6; x <= 9; x++) for (let z = -6; z <= 6; z++) positions.push([x, z])
    const snapshot = (r: ReturnType<typeof fixture>, reverse: boolean) => {
      for (const [x, z] of reverse ? [...positions].reverse() : positions) {
        const n = r.get(x, z); r.parent(n); r.grade(n); r.flow(n)
      }
      return positions.map(([x, z]) => {
        const n = r.get(x, z), p = r.parent(n)
        return [x, z, p?.gx, p?.gz, r.grade(n), r.flow(n)]
      })
    }
    const expected = snapshot(fixture(), false)
    expect(snapshot(fixture(), true)).toEqual(expected)
    const evicted = fixture(1024)
    snapshot(evicted, false)
    for (let i = 0; i < 2000; i++) evicted.get(1000 + i, 1000)
    expect(snapshot(evicted, true)).toEqual(expected)
  })
})
