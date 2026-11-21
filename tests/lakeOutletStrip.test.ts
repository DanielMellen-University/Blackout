import { describe, expect, it } from 'vitest'
import { waterBasinsInBounds } from '../src/world/Hydrology'
import { sampleGeography } from '../src/world/Geography'
import { setWorldSeed } from '../src/world/noise'

// Captured from b9e1ac86 on Node 22: angle, first river-wet X/Z, distance
// from the original pond shore. The preceding 2 to 8 m were dry grass.
const rays = [
  [-1.413, -3842.8370208114347, -18982.284050054168, 3],
  [-1.412, -3841.4767467445786, -18983.52435623327, 4],
  [-1.411, -3840.113576116394, -18984.764537076684, 5],
  [-1.410, -3838.747505939567, -18986.004590356228, 6],
  [-1.409, -3837.378533221772, -18987.244513845646, 7],
  [-1.408, -3836.0066549655317, -18988.48430532125, 8],
  [-1.407, -3834.631868168115, -18989.723962562257, 9],
] as const

describe('level pond outlet shore overlap', () => {
  it('leaves no dry sample across the original seed-73 pond outlet strip', () => {
    setWorldSeed(73)
    const lake = waterBasinsInBounds(-7000, -21000, -2000, -16000).find(b => b.id === 'lake:-2:-9')!
    let checked = 0
    for (const [angle, wetX, wetZ, wetDistance] of rays) {
      // Cover the lake, the entire former gap and the original river edge,
      // at half-metre spacing, plus both angular shoulders of each ray.
      for (const shift of [-.00025, 0, .00025]) for (let d = -2; d <= 12; d += .5) {
        const radius = Math.hypot(wetX - lake.x, wetZ - lake.z) - wetDistance + d
        const sample = sampleGeography(lake.x + Math.cos(angle + shift) * radius,
          lake.z + Math.sin(angle + shift) * radius)
        expect(sample.waterLevel, `${angle}, ${shift}, ${d}`).toBeCloseTo(lake.level, 6)
        expect(sample.height).toBeLessThan(sample.waterLevel)
        checked++
      }
    }
    expect(checked).toBe(609)
  })
})
