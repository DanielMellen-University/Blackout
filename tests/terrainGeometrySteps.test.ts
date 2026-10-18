import { createHash } from 'node:crypto'
import { BufferGeometry, Material } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateTerrainGeometry, generateTerrainGeometrySteps,
  type TerrainGeometryData, type TerrainGeometrySteps } from '../src/world/TerrainGeometry'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, setOpsPad } from '../src/world/terrainSample'

function digest(data: TerrainGeometryData, omitGroundColor = false): string {
  const hash = createHash('sha256')
  hash.update(JSON.stringify({ segs: data.segs, groundBounds: data.ground.bounds, waterBounds: data.water?.bounds }))
  for (const array of [data.heights, data.waterLevels,
    ...Object.entries(data.ground.attributes).filter(([key]) => !omitGroundColor || (key !== 'color' && key !== 'normal')).map(([, attribute]) => attribute.array), data.ground.index,
    ...Object.values(data.water?.attributes ?? {}).map(attribute => attribute.array), data.water?.index]) {
    if (array) hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))
  }
  return hash.digest('hex')
}

function finish(steps: TerrainGeometrySteps): TerrainGeometryData {
  let result = steps.next()
  while (!result.done) result = steps.next()
  return result.value
}

beforeEach(() => { setWorldSeed(1); clearOpsPad() })
afterEach(() => { clearOpsPad(); vi.restoreAllMocks() })

describe('cooperative terrain geometry', () => {
  it('delegates cancellation during cold preparation without allocating a mesh', () => {
    setWorldSeed(424242)
    const steps = generateTerrainGeometrySteps(0, 0, 0)
    const disposal = vi.spyOn(BufferGeometry.prototype, 'dispose')
    expect(steps.next()).toEqual({ value: 'hydrology-samples', done: false })
    steps.return(undefined as never)
    expect(disposal).not.toHaveBeenCalled()
    const restart = generateTerrainGeometrySteps(0, 0, 0)
    expect(restart.next()).toEqual({ value: 'hydrology-samples', done: false })
    restart.return(undefined as never)
  })

  it('releases both suspended ground and child water geometry exactly once', () => {
    const steps = generateTerrainGeometrySteps(-22050, -28350, 0)
    while (true) {
      const result = steps.next()
      expect(result.done).toBe(false)
      if (result.value === 'water-attributes') break
    }
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const materialDispose = vi.spyOn(Material.prototype, 'dispose')
    steps.return(undefined as never)
    expect(geometryDispose).toHaveBeenCalledTimes(2)
    expect(materialDispose).not.toHaveBeenCalled()
    steps.return(undefined as never)
    expect(geometryDispose).toHaveBeenCalledTimes(2)
  })

  it('keeps suspended analytic water independent of other tiles using the basin collector', () => {
    const steps = generateTerrainGeometrySteps(-22050, -28350, 0)
    while (true) {
      const result = steps.next()
      expect(result.done).toBe(false)
      if (result.value === 'water-grid') break
    }
    generateTerrainGeometry(-6720, -6720, 2, 32)
    expect(digest(finish(steps))).toBe('a8035efe576eef94178dabce16ac856b9cac2927ca6b358d46f5bccd6e4212e4')
  })

  // Physical hashes independently reproduced on frozen 10.923 before the
  // render-normal fix. Heights, positions, indices, water (including its normals
  // and colors), bounds and detail remain byte-identical. Old normal-inclusive
  // hashes are archived in fixtures/terrain-non-color-10.923.txt; original full
  // payload hashes remain in fixtures/terrain-payload-10.891.txt.
  it.each([
    { name: 'near', input: [0, 0, 0], expected: 'ed4cbd7c6c804a8968a9204cef20753f620e43667ad083b13aba7d8bb0c819a3' },
    { name: 'skirt', input: [0, 0, 1, 2, [true, true, true, true]], expected: '00b65dc00a2908a437ebe055bdf2a8155a0e006c572938b8f40eab4b29d2fd2b' },
    { name: 'pond', input: [-22050, -28350, 0], expected: 'f01d189eb51041b302310822c8ff09de940179ba2eec9fa1dee7e77ff566a92f' },
    { name: 'far water', input: [-6720, -6720, 2, 32], expected: 'fbeda54e03f8635e1c287dcf19257b239c401060fa3354280c57e6c5afa670fd' },
    { name: 'far fallback', input: [-420, 420, 2, 8, [true, false, true, false], 'fallback'], expected: 'f12aa4e1ea1b80faac6a907eb2ef73515dda58a00028cf936204d8d1083538bb' },
    { name: 'runway pad', input: [0, 0, 0], pad: true, expected: 'f844a610580fc158a1eca7dc9583cc13325780ede9f76cf4d14e97ad7f75aebe' },
  ])('preserves the regional $name physical payload byte-for-byte', ({ input, expected, pad }) => {
    if (pad) setOpsPad(0, 0, 42, .4)
    const args = input as Parameters<typeof generateTerrainGeometrySteps>
    const stepped = finish(generateTerrainGeometrySteps(...args)), direct = generateTerrainGeometry(...args)
    expect(digest(stepped, true)).toBe(expected)
    expect(digest(direct, true)).toBe(expected)
    expect(digest(stepped)).toBe(digest(direct))
  })

  it('keeps suspended grids and river lists independent of interleaved builds', () => {
    const expected = generateTerrainGeometry(-6720, -6720, 2, 32)
    const expectedPond = generateTerrainGeometry(-22050, -28350, 0)
    const broad = generateTerrainGeometrySteps(-6720, -6720, 2, 32)
    const pond = generateTerrainGeometrySteps(-22050, -28350, 0)
    for (let index = 0; index < 30; index++) {
      expect(broad.next().done).toBe(false)
      expect(pond.next().done).toBe(false)
      if (index === 15) generateTerrainGeometry(8400, 8400, 1)
    }
    expect(finish(broad)).toEqual(expected)
    expect(finish(pond)).toEqual(expectedPond)
  })

  it.each(['ground', 'water'] as const)('releases partial geometry when cancelled after %s', phase => {
    const steps = generateTerrainGeometrySteps(-22050, -28350, 0)
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const materialDispose = vi.spyOn(Material.prototype, 'dispose')
    while (true) {
      const result = steps.next()
      expect(result.done).toBe(false)
      if (result.value === phase) break
    }
    const before = geometryDispose.mock.calls.length
    steps.return(undefined as never)
    expect(geometryDispose.mock.calls.length - before).toBe(phase === 'ground' ? 1 : 2)
    expect(materialDispose).toHaveBeenCalledTimes(phase === 'water' ? 1 : 0)
    steps.return(undefined as never)
    expect(geometryDispose.mock.calls.length - before).toBe(phase === 'ground' ? 1 : 2)
    expect(digest(generateTerrainGeometry(-22050, -28350, 0))).toBe('a8035efe576eef94178dabce16ac856b9cac2927ca6b358d46f5bccd6e4212e4')
  })
})
