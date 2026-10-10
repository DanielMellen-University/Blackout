import { describe, expect, it } from 'vitest'
import { basinDistance, riverReaches, riverReachesInBounds, waterBasinsInBounds, waterLandmarks } from '../src/world/Hydrology'
import { coastField } from '../src/world/Coastline'
import { sampleGeography } from '../src/world/Geography'
import { setWorldSeed } from '../src/world/noise'

function sourceLake() {
  return waterLandmarks(1, 1).find(b => b.id === 'lake:19:25')!
}
function outletSignature() {
  return riverReaches(1, 1).filter(r => r.id?.startsWith('lake-outlet:19:25:'))
    .map(r => [r.id, r.ax, r.az, r.bx, r.bz, r.ya, r.yb, r.wa, r.wb])
}

describe('actual lake outlets', () => {
  it('carves a descending stream from the lake shore into a matching river junction', () => {
    setWorldSeed(73)
    const lake = sourceLake()
    const outlet = riverReaches(1, 1).filter(r => r.id?.startsWith('lake-outlet:19:25:'))
    expect(outlet.length).toBeGreaterThan(2)
    expect(outlet.length).toBeLessThanOrEqual(48)
    expect(lake.outletId).toBe('20:26')
    expect(basinDistance(lake, outlet[0]!.ax, outlet[0]!.az)).toBeLessThan(.2)
    expect(outlet[0]!.ya).toBeCloseTo(lake.level, 6)
    for (const r of outlet) {
      expect(r.ya).toBeGreaterThanOrEqual(r.yb)
      expect(r.discharge).toBeGreaterThan(0)
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, c = sampleGeography(r.ax + r.dx * t, r.az + r.dz * t)
        expect(c.height).toBeLessThan(c.waterLevel)
      }
      const next = riverReachesInBounds(r.bx - 1, r.bz - 1, r.bx + 1, r.bz + 1).filter(q => q.id !== r.id)
      expect(next.some(q => Math.hypot(q.ax - r.bx, q.az - r.bz) < .01 && Math.abs(q.ya - r.yb) < .05)).toBe(true)
    }
    const junction = riverReaches(1, 1).filter(r => r.toId === '20:26')
    let checked = 0
    for (const r of junction) {
      let previous = Infinity
      for (let i = 0; i <= 12; i++) {
        const level = sampleGeography(r.ax + r.dx * i / 12, r.az + r.dz * i / 12).waterLevel
        expect(level).toBeLessThanOrEqual(previous + .15)
        previous = level; checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('does not advertise placeholder outlets on closed ponds', () => {
    setWorldSeed(1)
    expect(waterLandmarks(-1, 0).find(b => b.id === 'lake:-12:11')!.outletId).toBeUndefined()
    expect(waterLandmarks(-1, 1).find(b => b.id === 'lake:-3:19')!.outletId).toBeUndefined()
    setWorldSeed(42)
    expect(waterLandmarks(1, 0).find(b => b.id === 'lake:23:10')!.outletId).toBeUndefined()
  })

  it('reuses a river emerging from a submerged node instead of doubling its outlet', () => {
    setWorldSeed(42)
    const lake = waterLandmarks(1, 2).find(b => b.id === 'lake:16:36')!
    const rivers = riverReaches(1, 2)
    expect(lake.outletId).toBe('16:37')
    expect(rivers.some(r => r.id?.startsWith('lake-outlet:16:36:'))).toBe(false)
    const emerging = rivers.filter(r => r.fromId === '16:37')
    expect(emerging.length).toBeGreaterThan(0)
    expect(basinDistance(lake, emerging[0]!.ax, emerging[0]!.az)).toBeLessThan(.2)
    for (const r of emerging) {
      let previous = Infinity
      for (let i = 0; i <= 8; i++) {
        const level = sampleGeography(r.ax + r.dx * i / 8, r.az + r.dz * i / 8).waterLevel
        expect(level).toBeLessThanOrEqual(previous + .15)
        previous = level
      }
    }
  })

  it('keeps a wide channel downhill when its bank brushes a lower lake', () => {
    setWorldSeed(2026)
    const r = riverReaches(-1, 1).find(r => r.id === '-6:24:0:6')!
    let previous = Infinity
    for (let i = 0; i <= 32; i++) {
      const level = sampleGeography(r.ax + r.dx * i / 32, r.az + r.dz * i / 32).waterLevel
      expect(level).toBeLessThanOrEqual(previous + .15)
      previous = level
    }
  })

  it('retains outlet data and geometry across neighbor-first queries and cache eviction', () => {
    setWorldSeed(74); waterLandmarks(1, 1); setWorldSeed(73)
    const first = outletSignature(), level = sourceLake().level
    setWorldSeed(74); waterLandmarks(1, 1); setWorldSeed(73)
    for (const [x, z] of [[2, 1], [1, 2], [0, 1]]) waterLandmarks(x!, z!)
    expect(outletSignature()).toEqual(first)
    expect(sourceLake().level).toBe(level)
    expect(sourceLake().outletId).toBe('20:26')
    for (let x = 8; x < 30; x++) waterLandmarks(x, -8)
    expect(outletSignature()).toEqual(first)
    expect(sourceLake().outletId).toBe('20:26')
  })

  it('keeps all added downstream ends connected to a river or independent receiving surface', () => {
    let checked = 0
    for (const seed of [1, 42, 73, 1337, 2026]) {
      setWorldSeed(seed)
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        for (const r of riverReaches(x, z).filter(r => r.id?.startsWith('lake-outlet:'))) {
          const water = coastField(r.bx, r.bz) <= .00001 || waterBasinsInBounds(r.bx, r.bz, r.bx, r.bz)
            .some(b => basinDistance(b, r.bx, r.bz) < 1 && Math.abs(b.level - r.yb) < .05)
          const next = riverReachesInBounds(r.bx - 1, r.bz - 1, r.bx + 1, r.bz + 1).some(q =>
            q.id !== r.id && Math.hypot(q.ax - r.bx, q.az - r.bz) < .01 && Math.abs(q.ya - r.yb) < .05)
          expect(water || next, `${seed}:${r.id}`).toBe(true)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(2)
  })
})
