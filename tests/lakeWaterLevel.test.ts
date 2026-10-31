import { describe, expect, it } from 'vitest'
import { basinDistance, hydrologyWaterLevelAt, riverReachesInBounds, sampleHydrology, waterBasinsInBounds } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'

// Water collision and the crash spray read
// hydrologyWaterLevelAt. It must report the lake's own fixed level everywhere
// the drawn lake covers, and dry land just outside a shore with no river.
describe('lake water level queries', () => {
  it('reports the fixed level across the seed-73 wetland pond', () => {
    setWorldSeed(73)
    const pond = waterBasinsInBounds(-5000, -19500, -4000, -18500).find(b => b.id === 'lake:-2:-9')!
    const radii = pond.shoreRadii!
    let inside = 0, outside = 0
    for (let i = 0; i < radii.length; i += 4) {
      const theta = (i + .5) / radii.length * Math.PI * 2
      const r = Math.min(radii[i]!, radii[(i + 1) % radii.length]!)
      for (const t of [.2, .6, .95]) {
        const x = pond.x + Math.cos(theta) * r * t, z = pond.z + Math.sin(theta) * r * t
        if (basinDistance(pond, x, z) >= 0) continue
        // A river ribbon may sit a few centimetres above the lake at a mouth.
        expect(hydrologyWaterLevelAt(x, z)).toBeGreaterThanOrEqual(pond.level - 1e-6)
        expect(hydrologyWaterLevelAt(x, z)).toBeLessThan(pond.level + .5)
        inside++
      }
      // 60 m beyond the shore: dry unless a channel is there.
      const x = pond.x + Math.cos(theta) * (radii[i]! + 60), z = pond.z + Math.sin(theta) * (radii[i]! + 60)
      if (basinDistance(pond, x, z) <= 0) continue
      const nearRiver = riverReachesInBounds(x - 400, z - 400, x + 400, z + 400).length > 0
      if (nearRiver && sampleHydrology(x, z, pond.level + 50).river > 0) continue
      expect(hydrologyWaterLevelAt(x, z)).toBe(-Infinity)
      outside++
    }
    expect(inside).toBeGreaterThan(30)
    expect(outside).toBeGreaterThan(5)
  })
})
