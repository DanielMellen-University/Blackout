import { createHash } from 'node:crypto'
import { BufferGeometry, Material } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateTerrainGeometry, generateTerrainGeometrySteps,
  type TerrainGeometryData, type TerrainGeometrySteps } from '../src/world/TerrainGeometry'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, setOpsPad } from '../src/world/terrainSample'

function digest(data: TerrainGeometryData): string {
  const hash = createHash('sha256')
  hash.update(JSON.stringify({ segs: data.segs, groundBounds: data.ground.bounds, waterBounds: data.water?.bounds }))
  for (const array of [data.heights, data.waterLevels,
    ...Object.values(data.ground.attributes).map(attribute => attribute.array), data.ground.index,
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
    expect(digest(finish(steps))).toBe('d07789c28a3d63dbf5134c14f9d6791c8880983572846794998cfcec835a5173')
  })

  // Regional world revision 2, with a current wetland pond fixture.
  // These pin every output buffer and bounds across independent water/detail paths.
  it.each([
    { name: 'near', input: [0, 0, 0], expected: 'c98a1777d69273e4b38f9614934ac8503e2c97e956199df8025e9674b765f137' },
    { name: 'skirt', input: [0, 0, 1, 2, [true, true, true, true]], expected: 'ea99ee2c3420335e099ad6c29c688d437d1148e85e6e10726ae50249a3c1c296' },
    { name: 'pond', input: [-22050, -28350, 0], expected: 'd07789c28a3d63dbf5134c14f9d6791c8880983572846794998cfcec835a5173' },
    { name: 'far water', input: [-6720, -6720, 2, 32], expected: '6059327cbcc3afd95290d66a7f10eb0521d1de5ad55a83c738f68a6ae6e1f556' },
    { name: 'far fallback', input: [-420, 420, 2, 8, [true, false, true, false], 'fallback'], expected: '7ae793c49622ca8d92d72d1bf50bd84f63f0f518f340e4d9a3af59a6082022d5' },
    { name: 'runway pad', input: [0, 0, 0], pad: true, expected: 'd2ed58aedb22f745ca9ef8ac0c851cb414e9feea732fa13f0af1e32229279b39' },
  ])('preserves the regional $name payload byte-for-byte', ({ input, expected, pad }) => {
    if (pad) setOpsPad(0, 0, 42, .4)
    const args = input as Parameters<typeof generateTerrainGeometrySteps>
    expect(digest(finish(generateTerrainGeometrySteps(...args)))).toBe(expected)
    expect(digest(generateTerrainGeometry(...args))).toBe(expected)
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
    expect(digest(generateTerrainGeometry(-22050, -28350, 0))).toBe('d07789c28a3d63dbf5134c14f9d6791c8880983572846794998cfcec835a5173')
  })
})
