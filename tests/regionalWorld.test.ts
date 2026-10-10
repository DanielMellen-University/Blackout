import { describe, expect, it } from 'vitest'
import { coastField } from '../src/world/Coastline'
import { setWorldSeed } from '../src/world/noise'
import { basinDistance, riverReaches, riverReachesInBounds, waterBasinsInBounds, waterLandmarks } from '../src/world/Hydrology'
import { sampleGeography } from '../src/world/Geography'
import { clearOpsPad, findPlayableSpawn, isUsableAirfield, terrainSurfaceFromClimate } from '../src/world/terrainSample'

describe('regional connected world', () => {
  it('keeps seas uncommon while preserving usable inland starts', () => {
    let wet = 0, count = 0, coasts = 0
    for (const seed of [1, 42, 73, 1337, 2026, 9, 10, 867, 17, 99]) {
      setWorldSeed(seed); clearOpsPad()
      for (let x = -128000; x <= 128000; x += 4000) for (let z = -128000; z <= 128000; z += 4000) {
        wet += Number(coastField(x, z) < 0); count++
      }
      const spawn = findPlayableSpawn()
      expect(spawn).not.toBeNull()
      expect(isUsableAirfield(spawn!)).toBe(true)
      let found = false
      for (let a = 0; a < 32 && !found; a++) for (let d = 2000; d <= 40000; d += 2000) {
        if (coastField(spawn!.x + Math.cos(a / 32 * Math.PI * 2) * d,
          spawn!.z + Math.sin(a / 32 * Math.PI * 2) * d) < 0) found = true
      }
      coasts += Number(found)
    }
    expect(wet / count).toBeGreaterThanOrEqual(.04)
    expect(wet / count).toBeLessThanOrEqual(.065)
    expect(coasts).toBeGreaterThan(0)
  })

  it('has stable confluence identities, downhill grades, braids and lake outlets', () => {
    const edges = new Map<string, Set<string>>()
    let splitLength = 0, length = 0, outlets = 0, ponds = 0
    for (const seed of [1, 42, 1337]) {
      setWorldSeed(seed)
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        for (const r of riverReaches(x, z)) {
          expect(r.id).toBeDefined(); expect(r.ya).toBeGreaterThanOrEqual(r.yb)
          expect(r.discharge).toBeGreaterThan(0)
          const target = `${seed}:${r.toId}`
          const sources = edges.get(target) ?? new Set<string>()
          sources.add(r.fromId!); edges.set(target, sources)
          length += r.length
          if (r.branch) splitLength += r.length
        }
        for (const b of waterLandmarks(x, z)) {
          if (b.regionalSea) continue
          outlets += Number(!!b.outletId); ponds += Number(b.pond)
          const radii = b.shoreRadii!
          for (let i = 0; i < radii.length; i++) expect(Math.abs(radii[(i + radii.length - 1) % radii.length]! -
            radii[i]! * 2 + radii[(i + 1) % radii.length]!) / b.radius).toBeLessThan(.14)
          const c = sampleGeography(b.x, b.z)
          expect(terrainSurfaceFromClimate(c).kind).toBe('water')
          expect(c.waterLevel).toBe(b.level)
          for (const island of b.islands ?? []) expect(basinDistance(b, island.x, island.z)).toBeGreaterThan(0)
        }
      }
    }
    expect([...edges.values()].some(sources => sources.size >= 2)).toBe(true)
    expect(splitLength / length).toBeLessThan(.015)
    expect(outlets).toBeGreaterThan(0); expect(ponds).toBeGreaterThan(0)
  })

  it('retains rare low-gradient split/rejoin channels in a longer watershed', () => {
    setWorldSeed(1)
    const branches = riverReaches(-3, -2).filter(r => r.fromId === '-37:-30' && r.branch)
    expect(branches.some(r => r.id?.includes(':-1:'))).toBe(true)
    expect(branches.some(r => r.id?.includes(':1:'))).toBe(true)
    for (const r of branches) expect(r.ya).toBeGreaterThanOrEqual(r.yb)
  })

  it('gives the former small receiving pond a larger, concave asymmetric shore', () => {
    setWorldSeed(42)
    const pond = waterLandmarks(-1, -1).find(b => b.id === 'lake:-12:-10')!
    expect(pond.radius).toBeGreaterThan(900)
    const radii = [...pond.shoreRadii!]
    expect(radii).toHaveLength(64)
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(2)
    const points = radii.map((r, i) => ({ x: Math.cos(i / radii.length * Math.PI * 2) * r,
      z: Math.sin(i / radii.length * Math.PI * 2) * r }))
    const concave = points.filter((b, i) => {
      const a = points[(i + points.length - 1) % points.length]!, c = points[(i + 1) % points.length]!
      return (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x) < 0
    })
    expect(concave.length).toBeGreaterThan(4)
  })

  it('retains about one-fifth of river length and one-quarter of previous water coverage', () => {
    // Recorded on the same seed/coordinate set immediately before the density
    // revision. Measure actual wet surface, not just sea masks or mesh counts.
    const previousLength = 3345541.412438616, previousWetSamples = 14804
    let length = 0, wet = 0
    for (const seed of [1, 42, 1337]) {
      setWorldSeed(seed)
      for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
        for (const r of riverReaches(cx, cz)) length += r.length
      }
      for (let x = -64000; x <= 64000; x += 1000) for (let z = -64000; z <= 64000; z += 1000) {
        const c = sampleGeography(x, z)
        wet += Number(terrainSurfaceFromClimate(c).kind === 'water')
      }
    }
    expect(length / previousLength).toBeGreaterThan(.15)
    expect(length / previousLength).toBeLessThan(.25)
    expect(wet / previousWetSamples).toBeGreaterThan(.20)
    expect(wet / previousWetSamples).toBeLessThan(.30)
  })

  it('connects every downstream end to another channel or an actual receiving water body', () => {
    let checked = 0, mouths = 0
    for (const seed of [1, 42, 1337]) {
      setWorldSeed(seed)
      for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
        for (const r of riverReaches(cx, cz)) {
          // Do not count the river's own carved surface as proof of an outlet.
          const receiving = coastField(r.bx, r.bz) <= .00001 ||
            waterBasinsInBounds(r.bx, r.bz, r.bx, r.bz).some(b => basinDistance(b, r.bx, r.bz) < 1)
          const next = riverReachesInBounds(r.bx - 1, r.bz - 1, r.bx + 1, r.bz + 1)
            .some(q => q !== r && Math.hypot(q.ax - r.bx, q.az - r.bz) < .01 && Math.abs(q.ya - r.yb) < .05)
          expect(receiving || next, `${seed}: ${r.id} ends on dry land`).toBe(true)
          if (r.mouth) { expect(receiving).toBe(true); mouths++ }
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
    expect(mouths).toBeGreaterThan(0)
  })

  it('varies river widths gradually with broad lowland trunks and narrow headwaters', () => {
    let broad = false, narrow = false, widened = false
    for (const seed of [1, 42, 1337]) {
      setWorldSeed(seed)
      for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
        for (const r of riverReaches(cx, cz)) {
          expect(Math.max(r.wa, r.wb)).toBeLessThanOrEqual(880)
          broad ||= r.wa > 150
          narrow ||= !!r.source && r.wa <= 10
          if (r.id?.endsWith(':1')) {
            const oldWidth = Math.min(220, 5 + Math.pow(r.discharge!, .62) * 11)
            expect(r.wa / oldWidth).toBeLessThanOrEqual(4.001)
            widened ||= r.wa / oldWidth > 2.5
          }
          expect(Math.abs(r.wb - r.wa) / Math.max(1, r.length)).toBeLessThan(.8)
        }
      }
    }
    expect(broad && narrow && widened).toBe(true)
  })

  it('does not lose established tributary discharge downstream of the rainfall window', () => {
    setWorldSeed(1)
    const edges = new Map<string, { from: string; to: string; flow: number }>()
    for (let cx = -2; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
      for (const r of riverReaches(cx, cz)) edges.set(`${r.fromId}:${r.toId}`,
        { from: r.fromId!, to: r.toId!, flow: r.discharge! })
    }
    const outgoing = new Map([...edges.values()].map(r => [r.from, r.flow]))
    let checked = 0
    for (const r of edges.values()) if (outgoing.has(r.to)) {
      expect(outgoing.get(r.to)!, `${r.from} loses river flow at ${r.to}`).toBeGreaterThanOrEqual(r.flow)
      checked++
    }
    expect(checked).toBeGreaterThan(10)
  })

  it.each([[1, 2, -1], [42, 0, 2], [42, 1, 3], [2026, -1, 1]])(
    'keeps shoreline detours connected at matching elevations for seed %s region %s,%s', (seed, cx, cz) => {
      setWorldSeed(seed)
      const reaches = riverReaches(cx, cz)
      expect(reaches.length).toBeGreaterThan(0)
      for (const r of reaches) {
        expect(r.ya).toBeGreaterThanOrEqual(r.yb)
        const receivingLevels = waterBasinsInBounds(r.bx, r.bz, r.bx, r.bz)
          .filter(b => basinDistance(b, r.bx, r.bz) < 1).map(b => b.level)
        if (coastField(r.bx, r.bz) <= .00001) receivingLevels.push(0)
        const joinsWater = receivingLevels.some(level => Math.abs(level - r.yb) < .05)
        const joinsRiver = riverReachesInBounds(r.bx - 1, r.bz - 1, r.bx + 1, r.bz + 1)
          .some(q => q.id !== r.id && Math.hypot(q.ax - r.bx, q.az - r.bz) < .01 && Math.abs(q.ya - r.yb) < .05)
        expect(joinsWater || joinsRiver, `${r.id} has a disconnected downstream cross-section`).toBe(true)
      }
    },
  )

  it('keeps boundary channels identical when regions are generated in reverse order', () => {
    const signature = () => [-1, 0, 1].map(x => riverReaches(x, 0).map(r => [r.id, r.ax, r.bx, r.ya, r.yb, r.wa, r.wb]))
    setWorldSeed(42); const first = signature()
    setWorldSeed(43); riverReaches(0, 0)
    setWorldSeed(42); for (const x of [1, 0, -1]) riverReaches(x, 0)
    expect(signature()).toEqual(first)
    for (const edge of [-32000, 0, 32000]) for (let z = -32000; z <= 32000; z += 500) {
      const a = sampleGeography(edge - .001, z), b = sampleGeography(edge + .001, z)
      expect(Math.abs(a.height - b.height)).toBeLessThan(.05)
      expect(Math.abs((a.waterLevel ?? 0) - (b.waterLevel ?? 0))).toBeLessThan(.05)
    }
  })
})
