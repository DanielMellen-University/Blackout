import { describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { sampleGeography } from '../src/world/Geography'
import { terrainSurfaceFromClimate } from '../src/world/terrainSample'

describe('exploration geography', () => {
  it('has oceans, elevated lakes, tall summits and distinct land provinces across seeds', () => {
    const counts: Record<string, number> = {}
    let peak = 0
    let elevatedLake = false
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (let x = -30000; x <= 30000; x += 600) {
        for (let z = -30000; z <= 30000; z += 600) {
          const c = sampleGeography(x, z)
          counts[c.biome] = (counts[c.biome] ?? 0) + 1
          peak = Math.max(peak, c.height)
          if (c.biome === 'water' && (c.waterLevel ?? 0) > 40) elevatedLake = true
          const surface = terrainSurfaceFromClimate(c)
          expect(Number.isFinite(surface.height)).toBe(true)
          if (surface.kind === 'water') expect(surface.height).toBeGreaterThanOrEqual(c.height)
        }
      }
    }
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(12)
    expect(counts.ocean).toBeGreaterThan(2000)
    expect(counts.ocean).toBeLessThan(20000)
    expect(peak).toBeGreaterThan(4500)
    expect(elevatedLake).toBe(true)
    for (const biome of ['volcanic', 'saltflat', 'tundra', 'mesa', 'desert', 'rainforest']) {
      expect(counts[biome], biome).toBeGreaterThan(0)
    }
  })

  it('keeps an elevated lake level across its basin and meets the banks without a drop', () => {
    setWorldSeed(1)
    const levels = [-20, 0, 20].map(offset => {
      const c = sampleGeography(-22200 + offset, -22200)
      expect(c.biome).toBe('water')
      return terrainSurfaceFromClimate(c).height
    })
    expect(levels[0]).toBeGreaterThan(100)
    expect(levels[1]).toBe(levels[0])
    expect(levels[2]).toBe(levels[0])
    let crossings = 0
    for (let x = -23700; x < -20700; x += 10) {
      const a = terrainSurfaceFromClimate(sampleGeography(x, -22200))
      const b = terrainSurfaceFromClimate(sampleGeography(x + 10, -22200))
      if (a.kind !== b.kind) {
        crossings++
        expect(Math.abs(a.height - b.height)).toBeLessThan(10)
      }
    }
    expect(crossings).toBeGreaterThanOrEqual(2)
  })

  it('does not introduce elevation seams at positive or negative landmark cell borders', () => {
    setWorldSeed(73)
    for (const boundary of [-18000, -9000, 0, 9000, 18000]) {
      for (let along = -20000; along < 20000; along += 731) {
        const a = terrainSurfaceFromClimate(sampleGeography(boundary - .01, along))
        const b = terrainSurfaceFromClimate(sampleGeography(boundary + .01, along))
        expect(Math.abs(a.height - b.height)).toBeLessThan(.5)
      }
    }
  })
})
