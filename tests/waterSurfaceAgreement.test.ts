import { describe, expect, it } from 'vitest'
import type { BufferAttribute, MeshStandardMaterial } from 'three'
import { setWorldSeed } from '../src/world/noise'
import { sampleGeography } from '../src/world/Geography'
import { basinDistance, riverReaches, riverReachesInBounds, waterBasinsInBounds, waterLandmarks, type RiverReach } from '../src/world/Hydrology'
import { buildWaterMesh } from '../src/world/WaterSystem'

/** Independent barycentric query against the actual Float32 renderer payload. */
function drawnHeight(p: BufferAttribute, x: number, z: number): number {
  let height = -Infinity
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i), az = p.getZ(i), bx = p.getX(i + 1), bz = p.getZ(i + 1)
    const cx = p.getX(i + 2), cz = p.getZ(i + 2)
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
    if (Math.abs(d) < 1e-8) continue
    const a = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d
    const b = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, c = 1 - a - b
    if (Math.min(a, b, c) >= -1e-6)
      height = Math.max(height, p.getY(i) * a + p.getY(i + 1) * b + p.getY(i + 2) * c)
  }
  return height
}

describe('shared water surface', () => {
  it('keeps the same triangle height when a non-planar river quad crosses a tile boundary', () => {
    const dx = 560, dz = 300
    const reach: RiverReach = { ax: -280, az: -150, bx: 280, bz: 150, wa: 90, wb: 180, ya: 30, yb: 12,
      dx, dz, length: Math.hypot(dx, dz), lengthSq: dx * dx + dz * dz, source: false, terminal: false,
      tangentAX: .995, tangentAZ: .1, tangentBX: .4, tangentBZ: .916 }
    const make = (span: number, x: number, z: number) => buildWaterMesh(new Float32Array(4).fill(1e5),
      new Float32Array(4), 1, span, x - span / 2, z - span / 2, { value: 0 }, undefined, [reach], [], [])!
    const whole = make(2400, 0, 0), tile = make(420, 60, -40)
    try {
      const p = tile.geometry.getAttribute('position') as BufferAttribute
      const all = whole.geometry.getAttribute('position') as BufferAttribute
      expect(p.count).toBeGreaterThan(30)
      for (let i = 0; i < p.count; i += 3) {
        const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3
        const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3
        expect(drawnHeight(p, x, z)).toBeCloseTo(drawnHeight(all, x + 60, z - 40), 4)
      }
    } finally {
      for (const mesh of [whole, tile]) { mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose() }
    }
  })

  it('uses the exact generated shoreline chord at vertices and coves', () => {
    setWorldSeed(42)
    const basin = waterLandmarks(-1, -1).find(b => b.shoreRadii && !b.islands)!
    const radii = basin.shoreRadii!
    for (let i = 0; i < radii.length; i++) {
      const next = (i + 1) % radii.length, a = i / radii.length * Math.PI * 2, b = next / radii.length * Math.PI * 2
      const x = (Math.cos(a) * radii[i]! + Math.cos(b) * radii[next]!) * .5
      const z = (Math.sin(a) * radii[i]! + Math.sin(b) * radii[next]!) * .5
      expect(basinDistance(basin, basin.x + x, basin.z + z)).toBeCloseTo(0, 6)
      expect(basinDistance(basin, basin.x + x * .999, basin.z + z * .999)).toBeLessThan(0)
      expect(basinDistance(basin, basin.x + x * 1.001, basin.z + z * 1.001)).toBeGreaterThan(0)
    }
  })

  it('matches drawn bends, source caps and lake mouths across five fixed seeds', () => {
    let checked = 0, dry = 0, mismatches = 0, wetGrid = 0
    const failures: object[] = []
    for (const seed of [1, 42, 73, 1337, 2026]) {
      setWorldSeed(seed)
      const fixtures: number[][] = []
      for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
        const reaches = riverReaches(cx, cz)
        const r = reaches.find(r => r.mouth) ?? reaches[Math.floor(reaches.length / 2)]
        if (r) fixtures.push([(r.ax + r.bx) * .5, (r.az + r.bz) * .5])
        const source = reaches.find(r => r.source)
        if (source) fixtures.push([source.ax, source.az])
        const lake = waterLandmarks(cx, cz).find(b => !b.sea)
        if (lake) fixtures.push([lake.x, lake.z])
      }
      for (const [x, z] of fixtures) {
        const span = 1680, lowX = x! - span / 2, lowZ = z! - span / 2
        const mesh = buildWaterMesh(new Float32Array(4).fill(1e5), new Float32Array(4), 1, span,
          lowX, lowZ, { value: 0 }, undefined,
          riverReachesInBounds(lowX, lowZ, lowX + span, lowZ + span), [],
          waterBasinsInBounds(lowX, lowZ, lowX + span, lowZ + span))
        if (!mesh) continue
        try {
          const p = mesh.geometry.getAttribute('position') as BufferAttribute
          // Test the reverse direction as well: a wet collision point must
          // actually have visible inland water, including narrow source caps.
          for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
            const px = gx * span / 8, pz = gz * span / 8
            const sample = sampleGeography(x! + px, z! + pz)
            if (sample.waterLevel <= 0 || sample.height >= sample.waterLevel) continue
            wetGrid++
            const visible = drawnHeight(p, px, pz) - .04
            if (!Number.isFinite(visible) || Math.abs(sample.waterLevel - visible) > .15) {
              mismatches++
              if (failures.length < 12) failures.push({ seed, x: x! + px, z: z! + pz,
                water: sample.waterLevel, visible, reverse: true })
            }
          }
          const stride = Math.max(3, Math.ceil(p.count / 150 / 3) * 3)
          for (let i = 0; i < p.count; i += stride) {
            const px = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3
            const pz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3
            const visible = drawnHeight(p, px, pz) - .04
            if (!Number.isFinite(visible)) continue
            const sample = sampleGeography(x! + px, z! + pz)
            checked++
            dry += Number(sample.height >= visible)
            if (Math.abs(sample.waterLevel - visible) > .15) {
              mismatches++
              if (failures.length < 12) failures.push({ seed, x: x! + px, z: z! + pz,
                water: sample.waterLevel, visible, bed: sample.height })
            }
          }
        } finally {
          mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose()
        }
      }
    }
    expect(checked).toBeGreaterThan(3000)
    expect(wetGrid).toBeGreaterThan(500)
    expect({ mismatches, failures }).toEqual({ mismatches: 0, failures: [] })
    expect(dry).toBe(0)
  })
})
