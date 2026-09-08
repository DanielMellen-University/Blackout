import { describe, expect, it } from 'vitest'
import { basinDistance, CATCHMENT_SIZE, riverReaches, waterLandmarks } from '../src/world/Hydrology'
import { sampleGeography } from '../src/world/Geography'
import { setWorldSeed } from '../src/world/noise'
import { terrainSurfaceFromClimate } from '../src/world/terrainSample'

describe('natural drainage', () => {
  it('keeps rivers connected and descending, with varying widths', () => {
    setWorldSeed(1)
    const reaches = riverReaches(-1, -1)
    expect(reaches.length).toBeGreaterThan(50)
    const widths = reaches.map(r => r.wa)
    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(2)
    for (const r of reaches) {
      expect(r.ya).toBeGreaterThanOrEqual(r.yb)
      const c = sampleGeography((r.ax + r.bx) / 2, (r.az + r.bz) / 2)
      expect(terrainSurfaceFromClimate(c).kind).toBe('water')
      expect(c.waterLevel).toBeCloseTo((r.ya + r.yb) / 2, 0)
    }
  })

  it('keeps terrain-flow channels deterministic and tightly bounded', () => {
    setWorldSeed(1)
    const first = riverReaches(-1, -1)
    expect(first.length).toBeGreaterThan(50)
    expect(first.length).toBeLessThanOrEqual(180)
    for (const reach of first) {
      expect(reach.wa).toBeGreaterThan(0)
      expect(reach.wb).toBeGreaterThan(0)
      expect(Math.max(reach.wa, reach.wb)).toBeLessThanOrEqual(230)
    }
    const signature = first.map(reach => [reach.ax, reach.az, reach.bx, reach.bz, reach.wa, reach.wb])
    setWorldSeed(73)
    riverReaches(-1, -1)
    setWorldSeed(1)
    const replay = riverReaches(-1, -1)
    expect(replay.map(reach => [reach.ax, reach.az, reach.bx, reach.bz, reach.wa, reach.wb])).toEqual(signature)
  })

  it('has enclosed, irregular basins rather than circles or unbounded oceans', () => {
    setWorldSeed(1)
    for (const b of waterLandmarks(-1, -1)) {
      const radii: number[] = []
      for (let j = 0; j < 24; j++) {
        const angle = j * Math.PI / 12
        let low = 0, high = b.radius * 2
        for (let k = 0; k < 20; k++) {
          const mid = (low + high) / 2
          if (basinDistance(b, b.x + Math.cos(angle) * mid, b.z + Math.sin(angle) * mid) < 0) low = mid
          else high = mid
        }
        radii.push((low + high) / 2)
        expect(basinDistance(b, b.x + Math.cos(angle) * b.radius * 2, b.z + Math.sin(angle) * b.radius * 2)).toBeGreaterThan(0)
      }
      expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.5)
    }
  })

  it('stays continuous at catchment edges, including near-zero negative coordinates', () => {
    setWorldSeed(73)
    for (const edge of [-CATCHMENT_SIZE, 0, CATCHMENT_SIZE]) {
      for (const along of [-1e-14, 0, 6700, 18900, 32000 - 1e-10]) {
        const a = sampleGeography(edge - 1e-14, along)
        const b = sampleGeography(edge + 1e-14, along)
        expect(Number.isFinite(a.height)).toBe(true)
        expect(Math.abs(a.height - b.height)).toBeLessThan(.001)
      }
    }
  })

  it('keeps green landforms free of narrow spikes', () => {
    setWorldSeed(1)
    const green = new Set(['plains', 'forest', 'rainforest', 'savanna'])
    let samples = 0
    for (let x = -30000; x < 30000; x += 475) for (let z = -30000; z < 30000; z += 625) {
      const c = sampleGeography(x, z)
      if (!green.has(c.biome) || c.river > .1 || c.features.lake > .1 || c.coastal > .1) continue
      const a = sampleGeography(x - 25, z).height, b = sampleGeography(x + 25, z).height
      expect(Math.abs(a - 2 * c.height + b), `${x},${z}`).toBeLessThan(4)
      samples++
    }
    expect(samples).toBeGreaterThan(1000)
  })

  it('varies basin count and keeps seas as occasional landmarks', () => {
    let seaCount = 0
    let catchments = 0
    const basinCounts = new Set<number>()
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
        const basins = waterLandmarks(cx, cz)
        basinCounts.add(basins.length)
        if (basins.some(b => b.sea)) seaCount++
        catchments++
      }
    }
    expect(basinCounts.size).toBeGreaterThanOrEqual(2)
    expect(seaCount).toBeGreaterThan(0)
    expect(seaCount).toBeLessThan(catchments * .7)
  })
})
