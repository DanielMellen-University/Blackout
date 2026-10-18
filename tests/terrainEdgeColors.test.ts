import { afterEach, expect, it } from 'vitest'
import { generateTerrainGeometry, type TerrainLod } from '../src/world/TerrainGeometry'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'

type Job = [number, number, TerrainLod, number]
// Actual shared vertices selected by the four-seed 10.923 browser review.
const fixtures: { seed: number; x: number; z: number; jobs: [Job, Job] }[] = [
  { seed: 42, x: -15120, z: 14280, jobs: [[-15120, 14280, 2, 2], [-16800, 13440, 2, 4]] },
  { seed: 2026, x: -26880, z: -28140, jobs: [[-26880, -28560, 2, 2], [-28560, -28560, 2, 4]] },
  { seed: 9001, x: -25200, z: -15540, jobs: [[-26040, -15960, 2, 2], [-25200, -16800, 2, 4]] },
  { seed: 808, x: -97020, z: 21840, jobs: [[-97440, 21000, 2, 2], [-97440, 21840, 2, 4]] },
]
afterEach(clearOpsPad)

it.each(fixtures)('keeps dry mixed-LOD edge colors continuous on seed $seed', ({ seed, x, z, jobs }) => {
  setWorldSeed(seed); clearOpsPad()
  const colors = jobs.map(job => {
    const data = generateTerrainGeometry(...job), step = 420 * job[3] / data.segs
    const ix = (x - job[0]) / step, iz = (z - job[1]) / step
    expect(ix).toBeCloseTo(Math.round(ix), 8); expect(iz).toBeCloseTo(Math.round(iz), 8)
    const i = Math.round(iz) * (data.segs + 1) + Math.round(ix)
    expect(data.heights[i]!).toBeGreaterThan(data.waterLevels[i]! + 2)
    return Array.from(data.ground.attributes.color!.array.subarray(i * 3, i * 3 + 3))
  })
  expect(Math.max(...colors[0]!.map((v, i) => Math.abs(v - colors[1]![i]!)))).toBeLessThan(1e-7)
})
