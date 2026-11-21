import { describe, expect, it } from 'vitest'
import { basinDistance, riverReachesInBounds, waterBasinsInBounds, type RiverReach, type WaterBasin } from '../src/world/Hydrology'
import { flareLakeShore, flareLakeShoreSteps } from '../src/world/LakeShore'
import { riverSurface, riverSurfaceHeightAt } from '../src/world/RiverSurface'
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
      const turn = Math.acos(Math.min(1, -side * ((bx - ax) * tx + (bz - az) * tz) / Math.hypot(bx - ax, bz - az))) * 180 / Math.PI
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

  it('bounds actual visible bank crossings at the seed-73 wetland mouths', () => {
    setWorldSeed(73)
    const lakes = waterBasinsInBounds(-8500, -22500, -2000, -15000).filter(b => b.shoreRadii)
    const reaches = riverReachesInBounds(-8500, -22500, -2000, -15000)
    const raw = reaches.map(r => riverSurface({ ...r, source: false, terminal: false, mouth: false }, []))
    const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx
    let checked = 0
    for (const lake of lakes) {
      const radii = lake.shoreRadii!, n = radii.length
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2
        const ax = lake.x + Math.cos(a) * radii[i]!, az = lake.z + Math.sin(a) * radii[i]!
        const sx = Math.cos(b) * radii[(i + 1) % n]! - Math.cos(a) * radii[i]!
        const sz = Math.sin(b) * radii[(i + 1) % n]! - Math.sin(a) * radii[i]!
        for (let j = 0; j < reaches.length; j++) {
          const r = reaches[j]!
          if (Math.abs(r.ya - lake.level) > .001 || Math.abs(r.yb - lake.level) > .001) continue
          const p = raw[j]!.sections
          for (let k = 0; k < p.length - 12; k += 12) for (const side of [1, -1]) {
            const offset = side === 1 ? 0 : 8, rx = p[k + offset]!, rz = p[k + offset + 2]!
            const dx = p[k + 12 + offset]! - rx, dz = p[k + 14 + offset]! - rz
            const determinant = cross(sx, sz, dx, dz)
            if (Math.abs(determinant) < 1e-8) continue
            const t = cross(rx - ax, rz - az, dx, dz) / determinant
            const u = cross(rx - ax, rz - az, sx, sz) / determinant
            if (Math.min(t, u) < 0 || Math.max(t, u) > 1) continue
            // Orient both boundaries with water on their left. Taking an
            // absolute dot product would incorrectly accept an acute spit.
            const bx = -side * dx, bz = -side * dz, sl = Math.hypot(sx, sz), bl = Math.hypot(bx, bz)
            const nx = sz / sl + bz / bl, nz = -sx / sl - bx / bl, nl = Math.hypot(nx, nz)
            const x = ax + sx * t + nx / nl * .5, z = az + sz * t + nz / nl * .5
            // A crossing covered by another lake/ribbon has no visible bank.
            if (lakes.some(b => basinDistance(b, x, z) < 0) || raw.some(s => riverSurfaceHeightAt(s, x, z) > 0)) continue
            const turn = Math.acos(Math.max(-1, Math.min(1, (sx * bx + sz * bz) / sl / bl))) * 180 / Math.PI
            expect(turn, `${lake.id}, ${r.id}`).toBeLessThan(45)
            checked++
          }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(4)
  })

  it('keeps suspended and interleaved fits private and byte-identical', () => {
    const expected = flareLakeShore(lake, [mouth()])
    const steps = flareLakeShoreSteps(lake, [mouth()])
    for (let i = 0; i < 10; i++) expect(steps.next().done).toBe(false)
    flareLakeShore(lake, [mouth(1)])
    let result = steps.next(), yields = 10
    while (!result.done) { yields++; result = steps.next() }
    expect(yields).toBeGreaterThan(64)
    expect(result.value.shoreRadii).toEqual(expected.shoreRadii)
    expect([...lake.shoreRadii!].every(r => r === 500)).toBe(true)
    const cancelled = flareLakeShoreSteps(lake, [mouth()])
    cancelled.next()
    cancelled.return(lake)
    expect(flareLakeShore(lake, [mouth()]).shoreRadii).toEqual(expected.shoreRadii)
  })

  it('keeps a fitted mouth inside the unchanged regional query extent', () => {
    const fitted = flareLakeShore(lake, [mouth()], 600)
    expect(Math.max(...fitted.shoreRadii!)).toBeLessThanOrEqual(600)
    expect(Math.max(...fitted.shoreRadii!)).toBeGreaterThan(590)
    expect(fitted.shoreRadii![256]).toBe(500)
  })

  it('leaves unjoined lakes and their cached array unchanged', () => {
    expect(flareLakeShore(lake, [])).toBe(lake)
    expect(flareLakeShore(lake, []).shoreRadii).toBe(lake.shoreRadii)
  })
})
