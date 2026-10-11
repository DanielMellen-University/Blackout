import { describe, expect, it } from 'vitest'
import { type RiverReach } from '../src/world/Hydrology'
import { riverSurface } from '../src/world/RiverSurface'

function reach(ax: number, az: number, bx: number, bz: number): RiverReach {
  const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz)
  return { ax, az, bx, bz, dx, dz, length, lengthSq: length * length, wa: 60, wb: 90,
    ya: 80, yb: 60, source: false, terminal: false }
}

describe('smooth physical river spans', () => {
  it('curves the centreline through existing sections instead of rotating a straight ribbon', () => {
    const r = reach(0, 0, 500, 500)
    r.tangentAX = 1; r.tangentAZ = 0; r.tangentBX = 0; r.tangentBZ = 1
    const p = riverSurface(r, []).sections
    expect(p.length / 12).toBe(7) // Same bounded section budget as before.
    const middle = 3 * 12 + 4
    expect(p[middle]).toBeGreaterThan(300)
    expect(p[middle + 2]).toBeLessThan(200)
    expect(p[4]).toBe(0); expect(p[6]).toBe(0)
    expect(p[p.length - 8]).toBe(500); expect(p[p.length - 6]).toBe(500)
    for (let i = 12; i < p.length; i += 12) expect(p[i + 5]).toBeLessThanOrEqual(p[i - 7]!)
  })

  it('matches every bank coordinate across adjacent spans with a shared tangent and width', () => {
    const a = reach(0, 0, 500, 500), b = reach(500, 500, 1000, 1000)
    a.tangentAX = 1; a.tangentAZ = 0; a.tangentBX = Math.SQRT1_2; a.tangentBZ = Math.SQRT1_2
    b.tangentAX = Math.SQRT1_2; b.tangentAZ = Math.SQRT1_2; b.tangentBX = 0; b.tangentBZ = 1
    b.wa = a.wb; b.ya = a.yb
    const first = riverSurface(a, []).sections, second = riverSurface(b, []).sections
    expect([...first.slice(-12)]).toEqual([...second.slice(0, 12)])
  })

  it('keeps legacy spans without endpoint directions straight and finite', () => {
    const r = reach(0, 0, 500, 500), p = riverSurface(r, []).sections
    for (let i = 0; i < p.length; i += 12) {
      expect(p[i + 4]).toBeCloseTo(p[i + 6]!, 8)
      for (let j = 0; j < 12; j++) expect(Number.isFinite(p[i + j])).toBe(true)
    }
  })

  it('preserves span shape far from the world origin', () => {
    const local = reach(0, 0, 500, 500), offset = 100000000
    const distant = reach(offset, -offset, offset + 500, -offset + 500)
    for (const r of [local, distant]) {
      r.tangentAX = 1; r.tangentAZ = 0; r.tangentBX = 0; r.tangentBZ = 1
    }
    const a = riverSurface(local, []).sections, b = riverSurface(distant, []).sections
    for (let i = 0; i < a.length; i += 4) {
      expect(b[i]! - offset).toBeCloseTo(a[i]!, 6)
      expect(b[i + 2]! + offset).toBeCloseTo(a[i + 2]!, 6)
      expect(b[i + 1]).toBe(a[i + 1])
    }
  })
})
