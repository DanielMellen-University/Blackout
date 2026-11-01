import { describe, expect, it } from 'vitest'
import type { MeshStandardMaterial } from 'three'
import { riverReachesInBounds, waterBasinsInBounds } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'
import { buildWaterMesh, degenerateRibbonTriangle } from '../src/world/WaterSystem'

// Broad inlets used to crowd a lake's shore ring with points a few centimetres
// apart. Each made a needle-thin shore/fan triangle, which could rasterise with
// the wrong facing and sparkle white. Keep the drawn lake free of those slivers.
describe('lake water slivers', () => {
  it('draws the seed-73 wetland pond without sub-metre basin slivers', () => {
    setWorldSeed(73)
    const pond = waterBasinsInBounds(-7000, -20000, -6000, -19000).find(b => b.id === 'lake:-3:-10')!
    // One 2.4 km tile around the pond's two broad inlets.
    const size = 2400, originX = -6584 - size / 2, originZ = -19733 - size / 2
    const reaches = riverReachesInBounds(originX, originZ, originX + size, originZ + size)
    const beds = new Float32Array(4).fill(pond.level + 50), levels = new Float32Array(4)
    const mesh = buildWaterMesh(beds, levels, 1, size, originX, originZ, { value: 0 }, undefined,
      reaches, [], [pond])!
    try {
      const p = mesh.geometry.getAttribute('position'), kind = mesh.geometry.getAttribute('waterKind')
      let basinTriangles = 0, slivers = 0
      for (let i = 0; i < p.count; i += 3) {
        // Basin triangles carry the pond kind and sit exactly at its level;
        // river ribbons blend to the same kind at a mouth but ride 4 cm higher.
        if (![0, 1, 2].every(k => Math.abs(kind.getX(i + k) - .5) < 1e-6 && Math.abs(p.getY(i + k) - pond.level) < 1e-3)) continue
        basinTriangles++
        const ax = p.getX(i), az = p.getZ(i), bx = p.getX(i + 1), bz = p.getZ(i + 1)
        const cx = p.getX(i + 2), cz = p.getZ(i + 2)
        const shortest = Math.min(Math.hypot(ax - bx, az - bz), Math.hypot(bx - cx, bz - cz), Math.hypot(cx - ax, cz - az))
        // Tile clipping can legitimately cut small pieces at the tile edge.
        const onEdge = [ax, bx, cx, az, bz, cz].some(v => Math.abs(Math.abs(v) - size / 2) < .01)
        if (shortest < .3 && !onEdge) slivers++
      }
      expect(basinTriangles).toBeGreaterThan(500)
      expect(slivers).toBe(0)
    } finally {
      mesh.geometry.dispose()
      ;(mesh.material as MeshStandardMaterial).dispose()
    }
  })
})

describe('degenerate ribbon triangles', () => {
  it('skips millimetre needles but keeps thin real slivers', () => {
    // A 4 m needle 1 mm wide covers nothing.
    expect(degenerateRibbonTriangle({ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 2, z: .001 })).toBe(true)
    // A 10 m sliver 5 cm wide is still visible water.
    expect(degenerateRibbonTriangle({ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 5, z: .05 })).toBe(false)
    // An ordinary small triangle stays.
    expect(degenerateRibbonTriangle({ x: 0, z: 0 }, { x: .3, z: 0 }, { x: 0, z: .3 })).toBe(false)
  })
})
