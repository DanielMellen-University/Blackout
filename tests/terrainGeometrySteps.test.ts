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
    ...Object.entries(data.ground.attributes).filter(([key]) => !omitGroundColor || key !== 'color').map(([, attribute]) => attribute.array), data.ground.index,
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

  // Reproduced independently on 10.919, retaining the 10.891 topology/water.
  // Only land colors change in 10.920. Keep heights, indices, normals, water
  // attributes (including water colors), bounds and detail byte-for-byte.
  // Original full payload hashes remain in fixtures/terrain-payload-10.891.txt.
  it.each([
    { name: 'near', input: [0, 0, 0], expected: '9c74cf58927051f854677f64b6369bec443be8f64929bb3c493242d2a6865fa4' },
    { name: 'skirt', input: [0, 0, 1, 2, [true, true, true, true]], expected: '65fef889caca5be1553bf55a48592c87dde1a4f602529b51c4ba2f7d8af6b583' },
    { name: 'pond', input: [-22050, -28350, 0], expected: '8de9f18c347abbdf0ec24d112b23f74f28babc28124d01a6a6ee4159e7610930' },
    { name: 'far water', input: [-6720, -6720, 2, 32], expected: 'a119804031046dfaf5387a232db2eafb902c33134ff569e7f6ee4753d5b734f7' },
    { name: 'far fallback', input: [-420, 420, 2, 8, [true, false, true, false], 'fallback'], expected: '6799ca9ad47e443e81bb2e5d38e726f1ff8963705e1d346a5acee151564fc3f9' },
    { name: 'runway pad', input: [0, 0, 0], pad: true, expected: 'abe42f102ec0178412549e71fdfb6e69083b541b226c51b5a8c08d8cc3b388db' },
  ])('preserves the regional $name non-color payload byte-for-byte', ({ input, expected, pad }) => {
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
