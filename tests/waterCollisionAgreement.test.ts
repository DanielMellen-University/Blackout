import { describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { basinDistance, riverReaches, riverReachesInBounds, waterBasinsInBounds } from '../src/world/Hydrology'
import { sampleGeography } from '../src/world/Geography'
import { buildWaterMesh } from '../src/world/WaterSystem'

describe('visible river and collision agreement', () => {
  it('does not turn carved dry inland banks into phantom sea-level water', () => {
    setWorldSeed(42)
    for (const [x, z] of [[-24525, -21275], [-23900, -21725]]) {
      const sample = sampleGeography(x!, z!)
      expect(sample.features.river).toBeGreaterThan(.9)
      expect(sample.waterLevel).toBe(0)
      expect(sample.height).toBeGreaterThan(0)
      expect(sample.biome).not.toBe('ocean')
    }
  })

  it('does not draw duplicate river identities after node-cache eviction', () => {
    setWorldSeed(1)
    riverReaches(-1, -1)
    // Retain this region while evicting its node objects, then build the
    // neighboring region with newly-created copies of shared halo reaches.
    for (let i = 0; i < 65; i++) riverReaches(20 + i * 2, 20)
    riverReaches(-2, -1)
    const reaches = riverReachesInBounds(-34000, -20000, -30000, -16000)
    expect(reaches.length).toBeGreaterThan(10)
    expect(new Set(reaches.map(r => r.id)).size).toBe(reaches.length)
  })

  it('does not flood dry banks outside the river ribbon', () => {
    setWorldSeed(1)
    // These banks are lower than the adjacent graded river. The old wide
    // water-level margin falsely made them water without a drawn surface.
    for (const [x, z] of [[-11822.539234129012, -28285.57194245914],
      [-11766.248216077045, -28398.548797568226]]) {
      const sample = sampleGeography(x!, z!)
      expect(sample.height).toBeGreaterThan(0)
      expect(sample.waterLevel).toBe(0)
      expect(sample.biome).not.toBe('water')
    }
  })

  it.each([[3, -66071.36100050439, 65763.29348671297], [73, -9713.048403675144, 61429.09799563304],
    [1337, 44059.04200568734, -80069.24709157587]])(
    'samples the visible top surface at previously overlapping ribbons for seed %s at %s,%s', (seed, x, z) => {
      setWorldSeed(seed)
      const span = 2000
      const reaches = riverReachesInBounds(x - span / 2, z - span / 2, x + span / 2, z + span / 2)
      const mesh = buildWaterMesh(new Float32Array(4).fill(100000), new Float32Array(4),
        1, span, x - span / 2, z - span / 2, { value: 0 }, undefined, reaches, [],
        waterBasinsInBounds(x - span / 2, z - span / 2, x + span / 2, z + span / 2))!
      const positions = mesh?.geometry.getAttribute('position')
      let visible = -Infinity
      // Barycentric height of every actual drawn triangle covering the test
      // point, not another approximation of the river centreline sampler.
      for (let i = 0; positions && i < positions.count; i += 3) {
        const ax = positions.getX(i), az = positions.getZ(i)
        const bx = positions.getX(i + 1), bz = positions.getZ(i + 1)
        const cx = positions.getX(i + 2), cz = positions.getZ(i + 2)
        const determinant = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
        if (Math.abs(determinant) < 1e-9) continue
        const a = ((bz - cz) * -cx + (cx - bx) * -cz) / determinant
        const b = ((cz - az) * -cx + (ax - cx) * -cz) / determinant
        const c = 1 - a - b
        if (Math.min(a, b, c) >= -1e-7) visible = Math.max(visible,
          positions.getY(i) * a + positions.getY(i + 1) * b + positions.getY(i + 2) * c)
      }
      mesh?.geometry.dispose()
      if (mesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
      const sample = sampleGeography(x, z)
      // Whole short watersheds are intentionally suppressed in the new
      // selection. Their former positions must be genuinely dry, not leave
      // behind invisible water/collision surfaces after the mesh disappears.
      if (!Number.isFinite(visible)) {
        expect(sample.waterLevel).toBe(0)
        expect(sample.height).toBeGreaterThan(0)
        return
      }
      expect(Math.abs(sample.waterLevel - (visible - .04)), JSON.stringify({ x, z, actual: sample.waterLevel, visible,
        basins: waterBasinsInBounds(x, z, x, z).map(b => ({ id: b.id, d: basinDistance(b, x, z), level: b.level })) })).toBeLessThan(.15)
      expect(sample.height).toBeLessThan(sample.waterLevel)
    },
  )
})
