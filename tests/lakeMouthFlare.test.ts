import { describe, expect, it } from 'vitest'
import { basinDistance, waterBasinsInBounds, type RiverReach, type WaterBasin } from '../src/world/Hydrology'
import { flareLakeShore } from '../src/world/LakeShore'
import { setWorldSeed } from '../src/world/noise'

const lake: WaterBasin = { x: 0, z: 0, radius: 500, aspect: 1, angle: 0, phase: 0,
  level: 100, sea: false, pond: true, shoreRadii: new Float32Array(128).fill(500) }
function mouth(angle = 0): RiverReach {
  const dx = Math.cos(angle) * 300, dz = Math.sin(angle) * 300
  return { ax: 500, az: 0, bx: 500 + dx, bz: dz, dx, dz, length: 300, lengthSq: 90000,
    wa: 80, wb: 80, ya: 100, yb: 100, source: false, terminal: false }
}
function maxTurn(b: WaterBasin, hidden: (x: number, z: number) => boolean = () => false): number {
  const r = b.shoreRadii!, p = (i: number) => {
    i = (i + r.length) % r.length
    const a = i / r.length * Math.PI * 2
    return [Math.cos(a) * r[i]!, Math.sin(a) * r[i]!] as const
  }
  let max = 0
  for (let i = 0; i < r.length; i++) {
    const a = p(i - 1), b = p(i), c = p(i + 1)
    if (hidden(b[0], b[1])) continue
    const ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1]
    max = Math.max(max, Math.acos(Math.max(-1, Math.min(1, (ux * vx + uz * vz) /
      (Math.hypot(ux, uz) * Math.hypot(vx, vz))))))
  }
  return max * 180 / Math.PI
}

describe('shared lake mouth flare', () => {
  it.each([0, .6, 1])('rounds the level mouth at angle %s without an acute polygon corner', angle => {
    const flared = flareLakeShore(lake, [mouth(angle)])
    expect(Math.max(...flared.shoreRadii!)).toBeGreaterThan(550)
    // A 30 degree maximum exterior turn leaves an interior angle of at
    // least 150 degrees, well away from the original pointed bank spit.
    expect(maxTurn(flared)).toBeLessThan(30)
    // At the actual ribbon crossing require at least a 135 degree bank
    // interior angle. A sharper acute spit is the reported failure.
    const radii = flared.shoreRadii!, tx = Math.cos(angle), tz = Math.sin(angle)
    let crossings = 0
    for (const side of [-1, 1]) for (let i = 0; i < radii.length; i++) {
      const a = i / radii.length * Math.PI * 2, b = (i + 1) / radii.length * Math.PI * 2
      const ax = Math.cos(a) * radii[i]!, az = Math.sin(a) * radii[i]!
      const bx = Math.cos(b) * radii[(i + 1) % radii.length]!, bz = Math.sin(b) * radii[(i + 1) % radii.length]!
      const da = -(ax - 500) * tz + az * tx - side * 80
      const db = -(bx - 500) * tz + bz * tx - side * 80
      if ((da >= 0) === (db >= 0)) continue
      const f = da / (da - db), along = (ax + (bx - ax) * f - 500) * tx + (az + (bz - az) * f) * tz
      if (along < -160 || along > 300) continue
      const turn = Math.acos(Math.min(1, Math.abs((bx - ax) * tx + (bz - az) * tz) / Math.hypot(bx - ax, bz - az))) * 180 / Math.PI
      expect(turn, `bank ${side}, along ${along}, point ${ax},${az}`).toBeLessThan(45)
      crossings++
    }
    expect(crossings).toBe(2)
    expect(flared.boundsRadius).toBeGreaterThanOrEqual(Math.max(...flared.shoreRadii!))
    // Original anchors on the opposite, unjoined bank are byte-identical.
    const scale = flared.shoreRadii!.length / lake.shoreRadii!.length
    for (let i = 32; i <= 96; i++) expect(flared.shoreRadii![i * scale]).toBe(lake.shoreRadii![i])
    expect(basinDistance(flared, 520, 30)).toBeLessThan(0)
    expect([...lake.shoreRadii!].every(r => r === 500)).toBe(true)
  })

  it.each([[73, -5016, -18905]])('bounds generated mouth turns for seed %s', (seed, x, z) => {
    setWorldSeed(seed!)
    const basins = waterBasinsInBounds(x! - 1800, z! - 1800, x! + 1800, z! + 1800).filter(b => b.shoreRadii)
    expect(basins.length).toBeGreaterThan(0)
    for (const basin of basins) expect(maxTurn(basin), basin.id).toBeLessThan(30)
  })

  it('leaves unjoined lakes and their cached array unchanged', () => {
    expect(flareLakeShore(lake, [])).toBe(lake)
    expect(flareLakeShore(lake, []).shoreRadii).toBe(lake.shoreRadii)
  })
})
