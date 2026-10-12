import { describe, expect, it } from 'vitest'
import { type BufferAttribute, type Mesh } from 'three'
import { basinDistance, type RiverReach, type WaterBasin, waterLandmarks, riverReachesInBounds } from '../src/world/Hydrology'
import { coastField, coastalRelief } from '../src/world/Coastline'
import { basinSurfaceSteps } from '../src/world/BasinSurface'
import { buildWaterMesh } from '../src/world/WaterSystem'
import { setWorldSeed } from '../src/world/noise'

function drawnOptics(mesh: Mesh, x: number, z: number): number[] {
  const p = mesh.geometry.getAttribute('position') as BufferAttribute
  let height = -Infinity, values: number[] = []
  x -= mesh.position.x; z -= mesh.position.z
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i), az = p.getZ(i), bx = p.getX(i + 1), bz = p.getZ(i + 1), cx = p.getX(i + 2), cz = p.getZ(i + 2)
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
    if (Math.abs(d) < 1e-8) continue
    const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d
    const b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, c = 1 - a - b
    if (Math.min(a, b, c) < -1e-6) continue
    const y = p.getY(i) * a + p.getY(i + 1) * b + p.getY(i + 2) * c
    if (y < height) continue
    height = y
    values = ['waterDepth', 'waterFlow', 'waterKind'].map(name => {
      const attribute = mesh.geometry.getAttribute(name)
      return attribute.getX(i) * a + attribute.getX(i + 1) * b + attribute.getX(i + 2) * c
    })
  }
  expect(Number.isFinite(height), `${x},${z}`).toBe(true)
  return values
}
function drain<T>(steps: Generator<unknown, T, void>): T {
  let r = steps.next()
  while (!r.done) r = steps.next()
  return r.value
}
function dispose(mesh: Mesh): void {
  mesh.geometry.dispose()
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
}

describe('joined water optics', () => {
  it('carries regional sea shading through the seed 73 terminal cap without needing a basin object', () => {
    setWorldSeed(73)
    const reach = riverReachesInBounds(-65000, 8000, -63000, 10000).find(r => r.id === '-32:4:0:7')!
    expect(reach?.mouth).toBe(true)
    const size = 2400, segs = 16
    const originX = reach.bx - size / 2, originZ = reach.bz - size / 2
    const beds = new Float32Array((segs + 1) ** 2)
    for (let z = 0; z <= segs; z++) for (let x = 0; x <= segs; x++)
      beds[z * (segs + 1) + x] = coastalRelief(0, coastField(originX + x * size / segs, originZ + z * size / segs))
    const mesh = buildWaterMesh(beds, new Float32Array(beds.length), segs, size,
      originX, originZ, { value: 0 }, undefined, [reach], [], [])!
    try {
      const dx = reach.dx / reach.length, dz = reach.dz / reach.length
      // The old low-depth half-cap ended here with an abrupt teal ring. Probe
      // both sides, including sea pixels that no longer belong to the ribbon.
      const radius = reach.wb + 80
      for (const offset of [-8, 8]) {
        const x = reach.bx + dx * (radius + offset), z = reach.bz + dz * (radius + offset)
        expect(coastField(x, z)).toBeLessThan(0)
        const [depth, flow, kind] = drawnOptics(mesh, x, z)
        expect(depth).toBeGreaterThan(10)
        expect(flow).toBeCloseTo(0, 4)
        expect(kind).toBeCloseTo(2, 4)
      }
    } finally { dispose(mesh) }
  })

  it.each([12, 100])('matches depth, flow and kind across a %s m inlet without a false shallow lip', width => {
    const lake: WaterBasin = { x: 800, z: 500, radius: 220, aspect: 1, angle: 0, phase: 0,
      level: 90, sea: false, pond: true, shoreRadii: new Float32Array(32).fill(220) }
    const reach: RiverReach = { ax: 100, az: 520, bx: 800, bz: 520, wa: width, wb: width,
      ya: 100, yb: 90, dx: 700, dz: 0, length: 700, lengthSq: 490000,
      source: false, terminal: true, mouth: true, tangentAX: 1, tangentAZ: 0, tangentBX: 1, tangentBZ: 0 }
    const surface = drain(basinSurfaceSteps(lake, [reach]))
    expect(surface.boundary.length).toBeGreaterThan(32)
    for (const p of surface.boundary) expect(Math.abs(basinDistance(lake, p.x + lake.x, p.z + lake.z))).toBeLessThan(1e-5)
    // Solve the existing polygon shoreline, not an ideal circle.
    let low = 570, high = 600
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) * .5
      if (basinDistance(lake, mid, 520) < 0) high = mid
      else low = mid
    }
    const shore = (low + high) * .5
    const mesh = buildWaterMesh(new Float32Array(4).fill(200), new Float32Array(4), 1,
      1200, 0, 0, { value: 0 }, undefined, [reach], [], [lake])!
    try {
      const a = drawnOptics(mesh, shore - .01, 520), b = drawnOptics(mesh, shore + .01, 520)
      expect(a[0]).toBeGreaterThan(.2); expect(b[0]).toBeGreaterThan(.2)
      for (let i = 0; i < a.length; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(.02)
    } finally { dispose(mesh) }
  })

  it('keeps generated shallow-band data canonical across cancellation, order and region query history', () => {
    const build = (reverse: boolean) => {
      setWorldSeed(1338); waterLandmarks(0, 0); setWorldSeed(1337)
      if (reverse) waterLandmarks(-1, 0)
      const lake = waterLandmarks(-2, 0).find(b => b.id === 'lake:-22:7')!
      const partial = basinSurfaceSteps(lake, [])
      expect(partial.next().done).toBe(false)
      partial.return(undefined as never)
      const complete = drain(basinSurfaceSteps(lake, []))
      expect(drain(basinSurfaceSteps(lake, []))).toBe(complete)
      expect(complete.boundary.length).toBeLessThan(512)
      expect(complete.inner).toHaveLength(complete.boundary.length)
      expect(complete.inlets.length).toBeGreaterThan(0)
      return complete.boundary
    }
    expect(build(false)).toEqual(build(true))
  })

  it('preserves interpolated optical values when a lake triangle is clipped by different tiles', () => {
    setWorldSeed(1337)
    const lake = waterLandmarks(-2, 0).find(b => b.id === 'lake:-22:7')!
    const make = (size: number, x: number, z: number) => buildWaterMesh(new Float32Array(4).fill(1e5),
      new Float32Array(4), 1, size, x - size / 2, z - size / 2, { value: 0 }, undefined, [], [], [lake])!
    const whole = make(5000, lake.x, lake.z), tile = make(420, lake.x - 400, lake.z)
    try {
      for (let x = -180; x <= 180; x += 60) for (let z = -180; z <= 180; z += 60) {
        const px = lake.x - 400 + x, pz = lake.z + z
        if (basinDistance(lake, px, pz) >= -1) continue
        const a = drawnOptics(whole, px, pz), b = drawnOptics(tile, px, pz)
        for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(b[i]!, 3)
      }
    } finally { dispose(whole); dispose(tile) }
  })

  it('rejects a seed change during suspended basin preparation', () => {
    setWorldSeed(1338); waterLandmarks(0, 0); setWorldSeed(1337)
    const lake = waterLandmarks(-2, 0).find(b => b.id === 'lake:-22:7')!
    const steps = basinSurfaceSteps(lake, [])
    expect(steps.next().done).toBe(false)
    setWorldSeed(42)
    expect(() => steps.next()).toThrow('World seed changed')
    setWorldSeed(1337)
    expect(drain(basinSurfaceSteps(lake, [])).boundary.length).toBeGreaterThan(64)
  })
})
