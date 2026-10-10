import { describe, expect, it } from 'vitest'
import { basinDistance, waterLandmarks } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'

describe('small pond contours', () => {
  it('keeps small basins substantial, varied, rounded, and within existing bounds', () => {
    let count = 0, concave = 0
    const proportions = new Set<number>()
    for (const seed of [1, 42, 1337]) {
      setWorldSeed(seed)
      for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) {
        for (const basin of waterLandmarks(cx, cz)) {
          if (basin.sea || basin.radius >= 1800) continue
          const radii = basin.shoreRadii!
          let area = 0, indents = 0
          const points = Array.from(radii, (r, i) => {
            const a = i / radii.length * Math.PI * 2
            return { x: Math.cos(a) * r, z: Math.sin(a) * r }
          })
          for (let i = 0; i < radii.length; i++) {
            const next = (i + 1) % radii.length
            area += radii[i]! * radii[next]! * Math.sin(Math.PI * 2 / radii.length) * .5
            const a = points[i]!, b = points[next]!, c = points[(i + 2) % radii.length]!
            if ((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x) < 0) indents++
            expect(Math.abs(radii[(i + radii.length - 1) % radii.length]! + radii[next]! - 2 * radii[i]!))
              .toBeLessThan(basin.radius * .1)
          }
          const effectiveRadius = Math.sqrt(area / Math.PI)
          expect(effectiveRadius, `${seed}/${basin.id}`).toBeGreaterThan(775)
          expect(effectiveRadius / basin.radius).toBeGreaterThan(.86)
          expect(Math.max(...radii)).toBeLessThan(basin.boundsRadius!)
          proportions.add(Math.round(Math.max(...radii) / Math.min(...radii) * 5))
          if (indents > 2) concave++
          count++
        }
      }
    }
    expect(count).toBeGreaterThan(40)
    expect(count).toBeLessThan(65) // Larger ponds must not restore dense spawning.
    expect(concave).toBeGreaterThan(count * .7)
    expect(proportions.size).toBeGreaterThan(8)
  })

  it('keeps island holes enclosed instead of bridging dry land across a cove', () => {
    setWorldSeed(42)
    const lake = waterLandmarks(1, 0).find(b => b.id === 'lake:17:4')!
    expect(lake).toBeDefined()
    expect(lake.islands).toBeUndefined() // Its former island crossed this shore by 213 m.
    let islands = 0
    for (const seed of [1, 42, 1337]) {
      setWorldSeed(seed)
      for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
        for (const basin of waterLandmarks(cx, cz)) for (const island of basin.islands ?? []) {
          const outer = { ...basin, islands: undefined }
          for (let i = 0; i < 32; i++) {
            const angle = i / 32 * Math.PI * 2
            expect(basinDistance(outer, island.x + Math.cos(angle) * island.radius,
              island.z + Math.sin(angle) * island.radius)).toBeLessThan(-island.radius * .05)
          }
          islands++
        }
      }
    }
    expect(islands).toBeGreaterThan(0)
  })
})
