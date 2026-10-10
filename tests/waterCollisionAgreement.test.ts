import { describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { basinDistance, riverReaches, riverReachesInBounds, waterBasinsInBounds } from '../src/world/Hydrology'
import { sampleGeography } from '../src/world/Geography'
import { buildWaterMesh } from '../src/world/WaterSystem'

describe('visible river and collision agreement', () => {
  it.each([[3, -33, 33, '-1:1'], [73, -5, 30, '0:12'], [1337, 22, -40, '-1:1']])(
    'samples the visible top surface at overlapping ribbons for seed %s node %s,%s', (seed, gx, gz, suffix) => {
      setWorldSeed(seed)
      const r = riverReaches(Math.floor(gx / 16), Math.floor(gz / 16))
        .find(r => r.id === `${gx}:${gz}:${suffix}`)!
      expect(r).toBeDefined()
      const x = (r.ax + r.bx) / 2, z = (r.az + r.bz) / 2, span = 2000
      const reaches = riverReachesInBounds(x - span / 2, z - span / 2, x + span / 2, z + span / 2)
      const mesh = buildWaterMesh(new Float32Array(4).fill(100000), new Float32Array(4),
        1, span, x - span / 2, z - span / 2, { value: 0 }, undefined, reaches, [],
        waterBasinsInBounds(x - span / 2, z - span / 2, x + span / 2, z + span / 2))!
      const positions = mesh.geometry.getAttribute('position')
      let visible = -Infinity
      // Barycentric height of every actual drawn triangle covering the test
      // point, not another approximation of the river centreline sampler.
      for (let i = 0; i < positions.count; i += 3) {
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
      mesh.geometry.dispose()
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
      expect(Number.isFinite(visible)).toBe(true)
      const sample = sampleGeography(x, z)
      expect(Math.abs(sample.waterLevel - (visible - .04)), JSON.stringify({ x, z, actual: sample.waterLevel, visible,
        basins: waterBasinsInBounds(x, z, x, z).map(b => ({ id: b.id, d: basinDistance(b, x, z), level: b.level })) })).toBeLessThan(.15)
      expect(sample.height).toBeLessThan(sample.waterLevel)
    },
  )
})
