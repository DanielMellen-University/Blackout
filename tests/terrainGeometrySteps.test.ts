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
    const steps = generateTerrainGeometrySteps(-41580, -37800, 0)
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
    const steps = generateTerrainGeometrySteps(-41580, -37800, 0)
    while (true) {
      const result = steps.next()
      expect(result.done).toBe(false)
      if (result.value === 'water-grid') break
    }
    generateTerrainGeometry(-6720, -6720, 2, 32)
    expect(digest(finish(steps))).toBe('a33a074d96c1717a8e379efc8384f55f87597669c5bdff558cc451cb62de55e7')
  })

  // Captured from the unsliced generator at 1065d0b, not from this iterator.
  // These pin every output buffer and bounds across independent water/detail paths.
  it.each([
    { name: 'near', input: [0, 0, 0], expected: '409958b7ea25e459bec2d93af3d1f0313bc0f716b5c43ad00077dec646ee00fd' },
    { name: 'skirt', input: [0, 0, 1, 2, [true, true, true, true]], expected: 'd2ffd2839b5cffae4ef28b8560b00780a5c5f4845c1df9d3d51183db5dcf21d8' },
    { name: 'pond', input: [-41580, -37800, 0], expected: 'a33a074d96c1717a8e379efc8384f55f87597669c5bdff558cc451cb62de55e7' },
    { name: 'far water', input: [-6720, -6720, 2, 32], expected: 'ec79f7ccdbe6078d741a88ab14aca2baa99424d00cef78ec5339030746af44d5' },
    { name: 'far fallback', input: [-420, 420, 2, 8, [true, false, true, false], 'fallback'], expected: 'ff16fd4621e16cbc5fdd69e0300a081efe4f8e2bf1a153dd37cf466898de5701' },
    { name: 'runway pad', input: [0, 0, 0], pad: true, expected: 'bd49a9ab3d4538903d4b64c31a8070a72b7c19143049dec1627aa523cf368738' },
  ])('preserves the previous $name payload byte-for-byte', ({ input, expected, pad }) => {
    if (pad) setOpsPad(0, 0, 42, .4)
    const args = input as Parameters<typeof generateTerrainGeometrySteps>
    expect(digest(finish(generateTerrainGeometrySteps(...args)))).toBe(expected)
    expect(digest(generateTerrainGeometry(...args))).toBe(expected)
  })

  it('keeps suspended grids and river lists independent of interleaved builds', () => {
    const expected = generateTerrainGeometry(-6720, -6720, 2, 32)
    const expectedPond = generateTerrainGeometry(-41580, -37800, 0)
    const broad = generateTerrainGeometrySteps(-6720, -6720, 2, 32)
    const pond = generateTerrainGeometrySteps(-41580, -37800, 0)
    for (let index = 0; index < 30; index++) {
      expect(broad.next().done).toBe(false)
      expect(pond.next().done).toBe(false)
      if (index === 15) generateTerrainGeometry(8400, 8400, 1)
    }
    expect(finish(broad)).toEqual(expected)
    expect(finish(pond)).toEqual(expectedPond)
  })

  it.each(['ground', 'water'] as const)('releases partial geometry when cancelled after %s', phase => {
    const steps = generateTerrainGeometrySteps(-41580, -37800, 0)
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
    expect(digest(generateTerrainGeometry(-41580, -37800, 0))).toBe('a33a074d96c1717a8e379efc8384f55f87597669c5bdff558cc451cb62de55e7')
  })
})
