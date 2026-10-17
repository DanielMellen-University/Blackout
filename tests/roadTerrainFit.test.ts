import { expect, it } from 'vitest'
import { fitRoadTerrainSteps } from '../src/world/RoadTerrainFit'
import { TERRAIN_CONTACT_GRID } from '../src/world/TerrainGeometry'

function fit(positions: number[], offsets: number[], indices: number[], x = 0, z = 0) {
  const generator = fitRoadTerrainSteps(positions, offsets, indices, x, z)
  let result = generator.next(), yields = 0
  while (!result.done) { yields++; result = generator.next() }
  return { indices: result.value, yields }
}

it('preserves ribbon area and winding while splitting at every terrain plane', () => {
  const positions = [-31, 20, -19, 39, 22, -17, -27, 21, 46]
  const offsets = [.45, .45, .45], source = [0, 1, 2], grid = TERRAIN_CONTACT_GRID
  const originX = 113644.112, originZ = -55704.222
  const area = (a: number, b: number, c: number) => ((positions[b * 3]! - positions[a * 3]!) *
    (positions[c * 3 + 2]! - positions[a * 3 + 2]!) - (positions[b * 3 + 2]! - positions[a * 3 + 2]!) *
    (positions[c * 3]! - positions[a * 3]!)) / 2
  const before = area(0, 1, 2), result = fit(positions, offsets, source, originX, originZ)
  expect(result.yields).toBeGreaterThan(0); expect(result.indices.length).toBeGreaterThan(source.length)
  let after = 0
  for (let t = 0; t < result.indices.length; t += 3) {
    const ids = result.indices.slice(t, t + 3), signedArea = area(ids[0]!, ids[1]!, ids[2]!)
    expect(signedArea).toBeGreaterThan(0); after += signedArea
    const x = ids.map(i => positions[i * 3]! + originX), z = ids.map(i => positions[i * 3 + 2]! + originZ)
    const cx = Math.floor(x.reduce((a, b) => a + b, 0) / 3 / grid)
    const cz = Math.floor(z.reduce((a, b) => a + b, 0) / 3 / grid)
    const diagonal = (cx + cz + 1) * grid
    for (const v of x) { expect(v).toBeGreaterThanOrEqual(cx * grid - 1e-8); expect(v).toBeLessThanOrEqual((cx + 1) * grid + 1e-8) }
    for (const v of z) { expect(v).toBeGreaterThanOrEqual(cz * grid - 1e-8); expect(v).toBeLessThanOrEqual((cz + 1) * grid + 1e-8) }
    const sum = x.map((v, i) => v + z[i]! - diagonal)
    expect(Math.min(...sum) >= -1e-8 || Math.max(...sum) <= 1e-8).toBe(true)
  }
  expect(after).toBeCloseTo(before, 7)
})

it('retains fixed engineered triangles and their vertices verbatim', () => {
  const positions = [0, 50, 0, 100, 60, 0, 0, 50, 20], offsets = [.45, -1, .45]
  const original = [...positions], result = fit(positions, offsets, [0, 1, 2])
  expect(result.indices).toEqual([0, 1, 2]); expect(positions).toEqual(original)
})

it('keeps vertical soil faces, fits their bottom edges and does not duplicate diagonal faces', () => {
  const positions = [0, .3, 17.5, 17.5, .3, 0, 0, 0, 17.5], offsets = [.3, .3, 0]
  const result = fit(positions, offsets, [0, 1, 2])
  expect(result.indices).toHaveLength(3)
  expect(result.indices.map(i => offsets[i])).toEqual(offsets)
})
