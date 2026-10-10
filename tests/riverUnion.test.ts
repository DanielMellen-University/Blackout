import { describe, expect, it } from 'vitest'
import { riverReachesInBounds, waterLandmarks, type RiverReach, type WaterBasin } from '../src/world/Hydrology'
import { riverSurface, type RiverSurface } from '../src/world/RiverSurface'
import { riverUnionSteps } from '../src/world/RiverUnion'
import { setWorldSeed } from '../src/world/noise'

function drain<T>(steps: Generator<unknown, T, void>): T {
  let r = steps.next()
  while (!r.done) r = steps.next()
  return r.value
}
function triangles(surface: RiverSurface): number[][] {
  const output: number[][] = []
  const add = (p: Float64Array, a: number, b: number, c: number) =>
    output.push([...p.slice(a, a + 4), ...p.slice(b, b + 4), ...p.slice(c, c + 4)])
  if (surface.triangles) for (let i = 0; i < surface.triangles.length; i += 12) add(surface.triangles, i, i + 4, i + 8)
  else {
    const p = surface.sections
    for (let i = 0; i < p.length - 12; i += 12) {
      add(p, i, i + 12, i + 16); add(p, i, i + 16, i + 4)
      add(p, i + 4, i + 16, i + 20); add(p, i + 4, i + 20, i + 8)
    }
    for (let i = 0; i < surface.caps.length; i += 12) add(surface.caps, i, i + 4, i + 8)
  }
  return output
}
function hits(triangles: readonly number[][], x: number, z: number): number[][] {
  const output: number[][] = []
  for (const p of triangles) {
    if (x < Math.min(p[0]!, p[4]!, p[8]!) || x > Math.max(p[0]!, p[4]!, p[8]!) ||
      z < Math.min(p[2]!, p[6]!, p[10]!) || z > Math.max(p[2]!, p[6]!, p[10]!)) continue
    const d = (p[6]! - p[10]!) * (p[0]! - p[8]!) + (p[8]! - p[4]!) * (p[2]! - p[10]!)
    if (Math.abs(d) < 1e-8) continue
    const a = ((p[6]! - p[10]!) * (x - p[8]!) + (p[8]! - p[4]!) * (z - p[10]!)) / d
    const b = ((p[10]! - p[2]!) * (x - p[8]!) + (p[0]! - p[8]!) * (z - p[10]!)) / d, c = 1 - a - b
    if (Math.min(a, b, c) <= 1e-6) continue
    output.push([p[1]! * a + p[5]! * b + p[9]! * c, p[3]! * a + p[7]! * b + p[11]! * c])
  }
  return output
}
function reach(ax: number, az: number, bx: number, bz: number, ya = 80, yb = 80): RiverReach {
  const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz)
  return { ax, az, bx, bz, dx, dz, length, lengthSq: length * length, ya, yb, wa: 120, wb: 160,
    source: false, terminal: false, tangentAX: dx / length, tangentAZ: dz / length,
    tangentBX: dx / length, tangentBZ: dz / length }
}
function review(reaches: RiverReach[], basins: readonly WaterBasin[], lowX: number, lowZ: number,
  highX: number, highZ: number, step: number): { wet: number; overlapsBefore: number } {
  const before = reaches.flatMap(r => triangles(riverSurface(r, basins)))
  const after = reaches.flatMap(r => triangles(drain(riverUnionSteps(r, basins, reaches))))
  let wet = 0, overlapsBefore = 0
  for (let x = lowX; x < highX; x += step) for (let z = lowZ; z < highZ; z += step) {
    const old = hits(before, x, z), current = hits(after, x, z)
    overlapsBefore += Number(old.length > 1)
    if (!old.length) { expect(current).toHaveLength(0); continue }
    wet++
    expect(current, `${x},${z}`).toHaveLength(1)
    const top = Math.max(...old.map(p => p[0]!))
    expect(current[0]![0]).toBeCloseTo(top, 5)
    const deepest = Math.max(...old.filter(p => Math.abs(p[0]! - top) < 1e-7).map(p => p[1]!))
    expect(current[0]![1]).toBeCloseTo(deepest, 5)
  }
  return { wet, overlapsBefore }
}

describe('unified river surface', () => {
  it('matches mouth-cap rim depth to the existing cross-section banks', () => {
    const r = reach(-100, 0, 100, 0)
    r.wa = 500; r.wb = 500; r.mouth = true; r.terminal = true
    const surface = riverSurface(r, [])
    const p = surface.sections, last = p.length - 12, cap = surface.caps
    // First/last arc vertices are the same physical right/left bank vertices.
    for (const [sectionIndex, capIndex] of [[last + 8, 4], [last, cap.length - 4]]) {
      for (let component = 0; component < 4; component++)
        expect(cap[capIndex! + component]).toBeCloseTo(p[sectionIndex! + component]!, 6)
    }
  })

  it.each([false, true])('removes coplanar confluence overlap (reverse order %s)', reverse => {
    const reaches = [reach(-500, -260, 250, 0), reach(-500, 260, 250, 0), reach(250, 0, 700, 0)]
    if (reverse) reaches.reverse()
    const counts = review(reaches, [], -450.27, -300.19, 650, 300, 23)
    expect(counts.wet).toBeGreaterThan(300)
    expect(counts.overlapsBefore).toBeGreaterThan(30)
  })

  it('retains the upper water surface where sloping channels cross', () => {
    const counts = review([reach(-400, 0, 400, 0, 100, 50), reach(0, -400, 0, 400, 70, 70)],
      [], -380.27, -380.19, 380, 380, 21)
    expect(counts.overlapsBefore).toBeGreaterThan(100)
  })

  it('removes folded triangles within one wide turning ribbon', () => {
    const r = reach(-100, 0, 100, 0)
    r.wa = 380; r.wb = 380; r.tangentAX = .25; r.tangentAZ = .96824584
    r.tangentBX = .25; r.tangentBZ = -.96824584
    const counts = review([r], [], -500.27, -450.19, 500, 450, 17)
    expect(counts.overlapsBefore).toBeGreaterThan(0)
  })

  it('joins the previously striped seed-1337 broad confluence without duplicate wet coverage', () => {
    setWorldSeed(1338); waterLandmarks(0, 0); setWorldSeed(1337)
    const lake = waterLandmarks(0, 0).find(b => b.id === 'lake:5:10')!
    const reaches = [...riverReachesInBounds(lake.x - 2500, lake.z - 3500, lake.x + 2500, lake.z + 2500)]
    const counts = review(reaches, [lake], lake.x - 1200, lake.z - 2300, lake.x + 1500, lake.z + 1000, 25)
    expect(counts.wet).toBeGreaterThan(2500)
    expect(counts.overlapsBefore).toBeGreaterThan(700)
  })

  it('does not publish cancelled work and reuses only a complete canonical surface', () => {
    setWorldSeed(1340); waterLandmarks(0, 0); setWorldSeed(1337)
    const r = riverReachesInBounds(9500, 17500, 10500, 18500)[0]!
    const steps = riverUnionSteps(r, [], [])
    expect(steps.next().done).toBe(false)
    steps.return(undefined as never)
    const complete = drain(riverUnionSteps(r, [], []))
    expect(riverUnionSteps(r, [], []).next()).toEqual({ done: true, value: complete })
    expect(complete.triangles.length).toBeGreaterThan(0)
  })

  it('keeps generated output identical across neighboring-region query order', () => {
    const build = (reverse: boolean) => {
      setWorldSeed(reverse ? 1343 : 1342); waterLandmarks(0, 0); setWorldSeed(1337)
      if (reverse) { waterLandmarks(1, 0); waterLandmarks(0, -1) }
      const reaches = riverReachesInBounds(9500, 17500, 10500, 18500)
      const r = reaches.find(r => r.id === '5:8:0:16')!
      expect(r).toBeDefined()
      if (!reverse) { waterLandmarks(0, -1); waterLandmarks(1, 0) }
      return drain(riverUnionSteps(r, [], [...reaches].reverse())).triangles
    }
    expect(build(false)).toEqual(build(true))
  })

  it('rejects seed changes while a build is suspended', () => {
    setWorldSeed(1341); waterLandmarks(0, 0); setWorldSeed(1337)
    const r = riverReachesInBounds(9500, 17500, 10500, 18500)[0]!
    const steps = riverUnionSteps(r, [], [])
    expect(steps.next().done).toBe(false)
    setWorldSeed(42)
    expect(() => steps.next()).toThrow('World seed changed during river union')
  })
})
