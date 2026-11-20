import { describe, expect, it } from 'vitest'
import { buildWaterMesh } from '../src/world/WaterSystem'

function area(beds: number[], mask: number[], level = 0): number {
  const mesh = buildWaterMesh(new Float32Array(beds), new Float32Array(4).fill(level),
    1, 100, 0, 0, { value: 0 }, undefined, new Float32Array(mask), [], [], true)
  if (!mesh) return 0
  try {
    const p = mesh.geometry.getAttribute('position')
    let sum = 0
    for (let i = 0; i < p.count; i += 3) {
      expect(p.getY(i)).toBe(level)
      sum += Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i)) -
        (p.getX(i+2)-p.getX(i))*(p.getZ(i+1)-p.getZ(i))) / 2
    }
    return sum
  } finally {
    mesh.geometry.dispose()
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose()
  }
}

describe('coarse sea meets the corrected terrain bed', () => {
  it('covers submerged corners even when their original biome mask was dry', () => {
    expect(area([-10,-10,-2,-2], [1,1,0,0])).toBe(10000)
    expect(area([-2,-2,-2,-2], [0,0,0,0])).toBe(10000)
  })

  it('clips at the interpolated bed crossing instead of the binary dry mask', () => {
    expect(area([-10,-10,10,10], [1,1,0,0])).toBeCloseTo(5000, 4)
    expect(area([10,10,10,10], [0,0,0,0])).toBe(0)
  })

  it('retains the freshwater mask for independently drawn river cells', () => {
    expect(area([5,5,5,5], [0,0,0,0], 10)).toBe(0)
    expect(area([5,5,5,5], [1,1,1,1], 10)).toBe(10000)
  })
})
