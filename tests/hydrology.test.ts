import { describe, expect, it } from 'vitest'
import { basinDistance, CATCHMENT_SIZE, hydrologyIntersectsBounds, riverReaches, riverReachesInBounds, sampleHydrology, sampleHydrologyInto, waterBasinBoundsRadius, waterLandmarks, type RiverReach } from '../src/world/Hydrology'
import { sampleGeography } from '../src/world/Geography'
import { setWorldSeed } from '../src/world/noise'
import { terrainSurfaceFromClimate } from '../src/world/terrainSample'
import { riverSurface, riverSurfaceHeightAt } from '../src/world/RiverSurface'

describe('natural drainage', () => {
  it('reuses caller-owned hydrology storage without changing the sample', () => {
    setWorldSeed(1)
    const x = -1375, z = 8420, ground = 615
    const expected = sampleHydrology(x, z, ground)
    const storage = { height: 0, waterLevel: 0, river: 0, lake: 0, pond: 0, stream: 0, coastal: 0 }
    const first = sampleHydrologyInto(storage, x, z, ground)
    expect(first).toBe(storage)
    expect(first).toEqual(expected)
    const firstSnapshot = { ...first }

    const second = sampleHydrologyInto(storage, x + 9000, z - 5000, ground + 140)
    expect(second).toBe(storage)
    for (const value of Object.values(second)) expect(Number.isFinite(value)).toBe(true)
    expect(second).not.toEqual(firstSnapshot)
  })

  it('contains malformed coordinates and ground samples without poisoning the cache', () => {
    setWorldSeed(1)
    const storage = { height: 0, waterLevel: 0, river: 0, lake: 0, pond: 0, stream: 0, coastal: 0 }
    const sample = sampleHydrologyInto(storage, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)
    expect(sample).toBe(storage)
    expect(Object.values(sample).every((value) => Number.isFinite(value))).toBe(true)

    const replay = sampleHydrologyInto(storage, 0, 0, 0)
    expect(Object.values(replay).every((value) => Number.isFinite(value))).toBe(true)
    expect(replay).toEqual(sampleHydrology(0, 0, 0))
  })

  it('fails closed for malformed catchment and bounds queries', () => {
    setWorldSeed(1)
    expect(waterLandmarks(Number.NaN, Number.POSITIVE_INFINITY).every((basin) =>
      [basin.x, basin.z, basin.radius, basin.level].every(Number.isFinite),
    )).toBe(true)
    expect(hydrologyIntersectsBounds(Number.NaN, 0, 100, 100)).toBe(false)
    expect(hydrologyIntersectsBounds(100, 100, 0, 0)).toBe(false)
  })

  it('caches a conservative warped-shoreline bound with a legacy fallback', () => {
    setWorldSeed(1)
    const basins = waterLandmarks(-1, -1)
    expect(basins.length).toBeGreaterThan(0)
    for (const basin of basins) {
      expect(basin.boundsRadius).toBeCloseTo(basin.radius * 1.75, 8)
      expect(waterBasinBoundsRadius(basin)).toBe(basin.boundsRadius)
    }
    expect(waterBasinBoundsRadius({ radius: 720 })).toBeCloseTo(1260, 8)
    expect(waterBasinBoundsRadius({ radius: Number.NaN, boundsRadius: Number.NaN })).toBe(0)
  })

  it('treats malformed basin geometry as outside water', () => {
    setWorldSeed(1)
    const valid = waterLandmarks(-1, -1)[0]!
    expect(basinDistance(valid, valid.x, valid.z)).toBeLessThan(0)
    const malformed = [
      null,
      { ...valid, x: Number.NaN },
      { ...valid, radius: 0 },
      { ...valid, aspect: Number.POSITIVE_INFINITY },
      { ...valid, level: Number.NaN },
    ]
    for (const basin of malformed) {
      expect(basinDistance(basin as never, valid.x, valid.z)).toBe(Number.POSITIVE_INFINITY)
    }
    expect(basinDistance(valid, Number.NaN, valid.z)).toBe(Number.POSITIVE_INFINITY)
  })

  it('keeps rivers connected and descending, with varying widths', () => {
    setWorldSeed(1)
    const reaches = riverReaches(-1, -1)
    expect(reaches.length).toBeGreaterThan(50)
    expect(riverReaches(-1, -1)).toBe(reaches)
    expect(new Set(reaches).size).toBe(reaches.length)
    const widths = reaches.map(r => r.wa)
    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(2)
    for (const r of reaches) {
      expect(r.ya).toBeGreaterThanOrEqual(r.yb)
      expect(r.dx).toBeCloseTo(r.bx - r.ax, 8)
      expect(r.dz).toBeCloseTo(r.bz - r.az, 8)
      expect(r.lengthSq).toBeCloseTo(r.dx * r.dx + r.dz * r.dz, 8)
      expect(r.length).toBeCloseTo(Math.hypot(r.dx, r.dz), 8)
      const c = sampleGeography((r.ax + r.bx) / 2, (r.az + r.bz) / 2)
      expect(terrainSurfaceFromClimate(c).kind).toBe('water')
      // Wide corners and lake mouths use the shared triangle grade, not a
      // second centreline-only interpolation. Independent renderer agreement
      // is covered across bends, caps, mouths and seeds in waterSurfaceAgreement.
      const x = (r.ax + r.bx) / 2, z = (r.az + r.bz) / 2
      const levels = riverReachesInBounds(x, z, x, z).map(q => riverSurfaceHeightAt(riverSurface(q, []), x, z))
      for (const b of waterLandmarks(-1, -1)) if (basinDistance(b, x, z) <= 0) levels.push(b.level)
      expect(c.waterLevel).toBeCloseTo(Math.max(...levels), 6)
    }
  })

  it('keeps terrain-flow channels deterministic and tightly bounded', () => {
    setWorldSeed(1)
    const first = riverReaches(-1, -1)
    expect(first.length).toBeGreaterThan(50)
    // Sixteen by sixteen owned nodes, sixteen spans, at most three delta arms.
    expect(first.length).toBeLessThanOrEqual(16 * 16 * 16 * 3)
    for (const reach of first) {
      expect(reach.wa).toBeGreaterThan(0)
      expect(reach.wb).toBeGreaterThan(0)
      expect(Math.max(reach.wa, reach.wb)).toBeLessThanOrEqual(880)
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

  it('keeps the boolean river query equivalent to the detailed query', () => {
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (const bounds of [
        [-18000, -12000, -14000, -8000, 0],
        [-4200, 6800, 2200, 11600, 240],
        [31000, -9000, 32600, -7400, 1200],
      ] as const) {
        const [minX, minZ, maxX, maxZ, margin] = bounds
        expect(hydrologyIntersectsBounds(minX, minZ, maxX, maxZ, margin))
          .toBe(riverReachesInBounds(minX, minZ, maxX, maxZ, margin).length > 0)
      }
    }
  })

  it('fills a caller-owned river reach buffer without changing detailed results', () => {
    setWorldSeed(1)
    const out: RiverReach[] = []
    const reach = riverReaches(-1, -1)[0]!
    const x = (reach.ax + reach.bx) * .5, z = (reach.az + reach.bz) * .5
    const first = riverReachesInBounds(x - 200, z - 200, x + 200, z + 200, 0, out)
    expect(first).toBe(out)
    expect(first.length).toBeGreaterThan(0)
    const signature = first.map((reach) => `${reach.ax}:${reach.az}:${reach.bx}:${reach.bz}`)
    const second = riverReachesInBounds(31_000, -9_000, 32_600, -7_400, 1200, out)
    expect(second).toBe(out)
    expect(second).not.toEqual(signature)
    expect(out.every((reach) => Number.isFinite(reach.length))).toBe(true)
    expect(riverReachesInBounds(x - 200, z - 200, x + 200, z + 200, 0).map((reach) =>
      `${reach.ax}:${reach.az}:${reach.bx}:${reach.bz}`,
    )).toEqual(signature)
  })

  it('keeps broad river banks dry outside the analytic channel ribbon', () => {
    setWorldSeed(1)
    // Stay away from headwaters and junctions: another channel can legitimately
    // cross the bank probe there even when this ribbon's own bank is dry.
    const reach = riverReaches(-1, -1).find(candidate => {
      if (candidate.mouth || candidate.branch || candidate.id?.split(':').at(-1) !== '8') return false
      const width = Math.max(candidate.wa, candidate.wb)
      const x = (candidate.ax + candidate.bx) * .5 - candidate.dz / candidate.length * width * 3
      const z = (candidate.az + candidate.bz) * .5 + candidate.dx / candidate.length * width * 3
      return sampleGeography(x, z).waterLevel === 0
    })
    expect(reach).toBeDefined()
    const dx = reach!.bx - reach!.ax, dz = reach!.bz - reach!.az
    const length = Math.hypot(dx, dz)
    const width = Math.max(reach!.wa, reach!.wb)
    const x = (reach!.ax + reach!.bx) * .5 - dz / length * width * 3
    const z = (reach!.az + reach!.bz) * .5 + dx / length * width * 3
    const climate = sampleGeography(x, z)
    expect(climate.waterLevel).toBe(0)
    expect(terrainSurfaceFromClimate(climate).kind).toBe('land')
  })

  it('has enclosed, irregular inland lakes, separate from regional seas', () => {
    setWorldSeed(1)
    for (const b of waterLandmarks(-1, -1)) {
      if (b.regionalSea) continue
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
      expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.3)
      const oppositeDelta = Math.max(...radii.map((radius, index) =>
        Math.abs(radius - radii[(index + 12) % 24]!)))
      expect(oppositeDelta).toBeGreaterThan(b.radius * .08)
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
    const seaRadii: number[] = []
    let catchments = 0
    const basinCounts = new Set<number>()
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
        const basins = waterLandmarks(cx, cz)
        basinCounts.add(basins.length)
        for (const basin of basins) if (basin.sea) seaRadii.push(basin.radius)
        if (basins.some(b => b.sea)) seaCount++
        catchments++
      }
    }
    expect(basinCounts.size).toBeGreaterThanOrEqual(2)
    expect(seaCount).toBeGreaterThan(0)
    expect(seaCount).toBeLessThanOrEqual(catchments)
    // These are review anchors, not sea geometry or coverage measurements.
    expect(Math.min(...seaRadii)).toBeGreaterThanOrEqual(3200)
    expect(Math.max(...seaRadii)).toBeLessThan(4201)
  })

  it('emits larger wetland ponds and classifies narrow channels as streams', () => {
    let ponds = 0, streams = 0
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
        const hasPond = waterLandmarks(cx, cz).some(candidate => !candidate.sea && candidate.pond)
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

  it('keeps lakes clear of earlier basins by the squared overlap gate', () => {
    setWorldSeed(1)
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        const basins = waterLandmarks(cx, cz)
        for (let i = 1; i < basins.length; i++) {
          const lake = basins[i]!
          for (let j = 0; j < i; j++) {
            const earlier = basins[j]!
            const dx = lake.x - earlier.x, dz = lake.z - earlier.z
            const minDistance = lake.radius + earlier.radius * .7
            expect(dx * dx + dz * dz).toBeGreaterThanOrEqual(minDistance * minDistance)
          }
        }
      }
    }
  })

})
