import { describe, expect, it } from 'vitest'
import { basinDistance, CATCHMENT_SIZE, hydrologyIntersectsBounds, riverReaches, waterLandmarks } from '../src/world/Hydrology'
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
    expect(first.length).toBeLessThanOrEqual(300)
    for (const reach of first) {
      expect(reach.wa).toBeGreaterThan(0)
      expect(reach.wb).toBeGreaterThan(0)
      expect(Math.max(reach.wa, reach.wb)).toBeLessThanOrEqual(230)
    }
    expect(first.some(reach => reach.mouth)).toBe(true)
    const signature = first.map(reach => [reach.ax, reach.az, reach.bx, reach.bz, reach.wa, reach.wb])
    setWorldSeed(73)
    riverReaches(-1, -1)
    setWorldSeed(1)
    const replay = riverReaches(-1, -1)
    expect(replay.map(reach => [reach.ax, reach.az, reach.bx, reach.bz, reach.wa, reach.wb])).toEqual(signature)
  })

  it('grades a river outlet into its receiving water without a vertical surface', () => {
    setWorldSeed(1)
    const outlet = riverReaches(-1, -1).reduce((best, candidate) =>
      !best || Math.max(candidate.wa, candidate.wb) > Math.max(best.wa, best.wb) ? candidate : best,
    )
    expect(outlet).toBeDefined()
    let previousLevel: number | null = null
    let wetPairs = 0
    // This reaches the seed-one trunk's sea outlet. Consecutive wet samples
    // must not jump from the river grade straight to sea level in one mesh cell.
    for (let t = 0; t <= 1.25; t += .0625) {
      const c = sampleGeography(
        outlet!.ax + (outlet!.bx - outlet!.ax) * t,
        outlet!.az + (outlet!.bz - outlet!.az) * t,
      )
      if (terrainSurfaceFromClimate(c).kind !== 'water') {
        previousLevel = null
        continue
      }
      const level = c.waterLevel ?? 0
      if (previousLevel !== null) {
        expect(Math.abs(level - previousLevel), `outlet t=${t.toFixed(3)}: ${previousLevel} -> ${level}`).toBeLessThan(15)
        wetPairs++
      }
      previousLevel = level
    }
    expect(wetPairs).toBeGreaterThan(8)
  })

  it('fills a short delta corridor past each shoreline mouth', () => {
    setWorldSeed(1)
    const outlet = riverReaches(-1, -1).find(reach => reach.mouth)
    expect(outlet).toBeDefined()
    const dx = outlet!.bx - outlet!.ax, dz = outlet!.bz - outlet!.az
    const length = Math.hypot(dx, dz)
    const width = outlet!.mouthWidth ?? outlet!.wb
    const distance = Math.max(30, Math.min(120, width * .7))
    const climate = sampleGeography(
      outlet!.bx + dx / length * distance,
      outlet!.bz + dz / length * distance,
    )
    expect(climate.waterLevel).toBeCloseTo(outlet!.yb, 0)
    expect(climate.height).toBeLessThan((climate.waterLevel ?? 0) + 1)
  })

  it('finds narrow drainage before a coarse tile can miss its banks', () => {
    setWorldSeed(1)
    const reach = riverReaches(-1, -1).find(candidate => Math.max(candidate.wa, candidate.wb) < 40)
    expect(reach).toBeDefined()
    const midX = (reach!.ax + reach!.bx) / 2
    const midZ = (reach!.az + reach!.bz) / 2
    expect(hydrologyIntersectsBounds(midX - 90, midZ - 90, midX + 90, midZ + 90)).toBe(true)
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
      // Broad rounded hills can bend several metres across this 50 m probe;
      // the cap still rejects the narrow needle profiles players can feel.
      expect(Math.abs(a - 2 * c.height + b), `${x},${z}`).toBeLessThan(6)
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

  it('emits small ponds and classifies narrow channels as streams', () => {
    let ponds = 0, streams = 0
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
        const hasPond = waterLandmarks(cx, cz).some(candidate => !candidate.sea && candidate.radius < 650)
        if (hasPond) ponds++
        for (let x = cx * CATCHMENT_SIZE; x < (cx + 1) * CATCHMENT_SIZE; x += 640) {
          for (let z = cz * CATCHMENT_SIZE; z < (cz + 1) * CATCHMENT_SIZE; z += 640) {
            const climate = sampleGeography(x, z)
            if (climate.features.stream > .2) streams++
          }
        }
      }
    }
    expect(ponds).toBeGreaterThan(0)
    expect(streams).toBeGreaterThan(0)
  })
})
