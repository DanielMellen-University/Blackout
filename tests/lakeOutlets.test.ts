import { describe, expect, it } from 'vitest'
import { basinDistance, riverReaches, riverReachesInBounds, waterBasinsInBounds, waterLandmarks } from '../src/world/Hydrology'
import { coastField } from '../src/world/Coastline'
import { sampleGeography } from '../src/world/Geography'
import { setWorldSeed } from '../src/world/noise'
import { riverSurface } from '../src/world/RiverSurface'

function sourceLake() { return waterLandmarks(-2, -1).find(b => b.id === 'lake:-29:-5')! }
function outletReaches() { return riverReaches(-2, -1).filter(r => r.fromId === '-29:-5' || r.fromId === '-29:-4') }
function outletSignature() { return outletReaches().map(r => [r.id, r.ax, r.az, r.bx, r.bz, r.ya, r.yb, r.wa, r.wb]) }

describe('canonical lake outlets', () => {
  it('retains a generated level span where a narrow wetland outlet meets another stream', () => {
    setWorldSeed(1)
    const incoming = riverReaches(-2, 2).filter(r => r.toId === '-23:46' && r.id?.endsWith(':0:16'))
    expect(incoming.map(r => r.fromId)).toEqual(expect.arrayContaining(['-22:46', '-23:45']))
    for (const r of incoming) {
      expect(r.ya).toBeCloseTo(r.yb, 6)
      for (let i = 0; i <= 8; i++) {
        const c = sampleGeography(r.ax + r.dx * i / 8, r.az + r.dz * i / 8)
        expect(c.waterLevel).toBeCloseTo(r.yb, 6)
        expect(c.height).toBeLessThan(c.waterLevel)
      }
    }
  })

  it('keeps higher junction banks clear of a lower lake without an uphill reconnection', () => {
    setWorldSeed(42)
    const lake = waterLandmarks(-2, 2).find(b => b.id === 'lake:-19:41')!
    expect(lake).toBeDefined()
    for (const from of ['-18:40', '-20:41']) {
      const reaches = riverReaches(-2, 2).filter(r => r.fromId === from)
      expect(reaches.length).toBeGreaterThan(8)
      let previous = Infinity
      for (const r of reaches) {
        const sections = riverSurface(r, []).sections
        for (let i = 0; i < sections.length; i += 12) {
          const c = sampleGeography(sections[i + 4]!, sections[i + 6]!)
          expect(c.waterLevel).toBeGreaterThan(0)
          expect(c.height).toBeLessThan(c.waterLevel)
          expect(c.waterLevel).toBeLessThanOrEqual(previous + .15)
          previous = c.waterLevel
        }
      }
    }
  })

  it('carves a descending stream from the lake shore into a matching river junction', () => {
    setWorldSeed(73)
    const lake = sourceLake(), outlet = outletReaches()
    expect(lake).toBeDefined()
    expect(outlet.length).toBeGreaterThan(2)
    expect(outlet.length).toBeLessThanOrEqual(48)
    expect(lake.outletId).toBe('-29:-3')
    expect(basinDistance(lake, outlet[0]!.ax, outlet[0]!.az)).toBeLessThan(.2)
    expect(outlet[0]!.ya).toBeCloseTo(lake.level, 6)
    for (const r of outlet) {
      // Ordinary shared graph edges, not a second independently-owned ribbon.
      expect(r.id).toMatch(/^-?\d+:-?\d+:0:\d+$/)
      expect(r.ya).toBeGreaterThanOrEqual(r.yb)
      expect(r.discharge).toBeGreaterThan(0)
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, c = sampleGeography(r.ax + r.dx * t, r.az + r.dz * t)
        expect(c.height).toBeLessThan(c.waterLevel)
      }
      const next = riverReachesInBounds(r.bx - 1, r.bz - 1, r.bx + 1, r.bz + 1).filter(q => q.id !== r.id)
      expect(next.some(q => Math.hypot(q.ax - r.bx, q.az - r.bz) < .01 && Math.abs(q.ya - r.yb) < .05)).toBe(true)
    }
    const junction = riverReaches(-2, -1).filter(r => r.toId === '-29:-3')
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
    for (const [seed, cx, cz, id] of [[1, -2, -1, 'lake:-23:-12'],
      [1, -2, 1, 'lake:-29:27'], [42, -2, 0, 'lake:-24:7']] as const) {
      setWorldSeed(seed)
      const lake = waterLandmarks(cx, cz).find(b => b.id === id)
      expect(lake).toBeDefined()
      expect(lake!.outletId).toBeUndefined()
    }
  })

  it('reuses a river emerging from a submerged node instead of doubling its outlet', () => {
    setWorldSeed(1337)
    const lake = waterLandmarks(-2, 0).find(b => b.id === 'lake:-22:7')!
    const rivers = riverReaches(-2, 0)
    expect(lake.outletId).toBe('-22:8')
    expect(rivers.some(r => r.id?.startsWith('lake-outlet:'))).toBe(false)
    const emerging = rivers.filter(r => r.fromId === '-22:7')
    expect(emerging.length).toBeGreaterThan(0)
    expect(new Set(emerging.map(r => r.id)).size).toBe(emerging.length)
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

  it.each([[73, -2, 0, '-31:4:0:4'], [1337, -2, 0, '-19:9:0:6']] as const)(
    'keeps a broad turning channel downhill for seed %s', (seed, cx, cz, id) => {
      setWorldSeed(seed)
      const r = riverReaches(cx, cz).find(r => r.id === id)!
      expect(r).toBeDefined()
      expect(Math.max(r.wa, r.wb)).toBeGreaterThan(500)
      let previous = Infinity
      for (let i = 0; i <= 32; i++) {
        const level = sampleGeography(r.ax + r.dx * i / 32, r.az + r.dz * i / 32).waterLevel
        expect(level).toBeLessThanOrEqual(previous + .15)
        previous = level
      }
    },
  )

  it('retains outlet data and geometry across neighbor-first queries and cache eviction', () => {
    setWorldSeed(74); waterLandmarks(-2, -1); setWorldSeed(73)
    const first = outletSignature(), level = sourceLake().level
    expect(first.length).toBeGreaterThan(2)
    setWorldSeed(74); waterLandmarks(-2, -1); setWorldSeed(73)
    for (const [x, z] of [[-1, -1], [-2, 0], [-3, -1]]) waterLandmarks(x!, z!)
    expect(outletSignature()).toEqual(first)
    expect(sourceLake().level).toBe(level)
    expect(sourceLake().outletId).toBe('-29:-3')
    for (let x = 8; x < 30; x++) waterLandmarks(x, -8)
    expect(outletSignature()).toEqual(first)
    expect(sourceLake().outletId).toBe('-29:-3')
  })

  it('connects real lake-shore exits to native channels or independent receiving water', () => {
    let outlets = 0, checked = 0
    for (const seed of [1, 42, 73, 1337, 2026]) {
      setWorldSeed(seed)
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
        for (const lake of waterLandmarks(x, z).filter(b => b.outletId)) {
          const radius = lake.boundsRadius! + 6000
          const rivers = riverReachesInBounds(lake.x - radius, lake.z - radius, lake.x + radius, lake.z + radius)
          const emerging = rivers.filter(r => Math.abs(basinDistance(lake, r.ax, r.az)) < .2 && Math.abs(r.ya - lake.level) < .05)
          expect(emerging.length, `${seed}:${lake.id}`).toBeGreaterThan(0)
          for (const r of emerging) {
            const water = coastField(r.bx, r.bz) <= .00001 || waterBasinsInBounds(r.bx, r.bz, r.bx, r.bz)
              .some(b => basinDistance(b, r.bx, r.bz) < 1 && Math.abs(b.level - r.yb) < .05)
            const next = rivers.some(q => q.id !== r.id && Math.hypot(q.ax - r.bx, q.az - r.bz) < .01 && Math.abs(q.ya - r.yb) < .05)
            expect(water || next, `${seed}:${r.id}`).toBe(true)
            checked++
          }
          outlets++
        }
      }
    }
    expect(outlets).toBeGreaterThan(15)
    expect(checked).toBeGreaterThanOrEqual(outlets)
  }, 20_000)
})
