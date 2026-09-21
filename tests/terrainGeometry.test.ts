import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { waterLandmarks } from '../src/world/Hydrology'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, sampleClimate, sampleTerrainHeightFast } from '../src/world/terrainSample'
import {
  CHUNK_SIZE,
  deserializeTerrainGeometry,
  generateTerrainGeometry,
  terrainTransferables,
  waterSegsForLod,
} from '../src/world/TerrainGeometry'

describe('worker terrain geometry', () => {
  beforeEach(() => {
    setWorldSeed(1)
    clearOpsPad()
  })
  afterEach(clearOpsPad)

  it('keeps neighboring near-tile edges on the exact same world surface', () => {
    const left = generateTerrainGeometry(0, 0, 0)
    const right = generateTerrainGeometry(CHUNK_SIZE, 0, 0)
    for (let iz = 0; iz <= left.segs; iz++) {
      const z = iz * CHUNK_SIZE / left.segs
      const a = iz * (left.segs + 1) + left.segs
      expect(left.heights[a]).toBe(Math.fround(sampleClimate(CHUNK_SIZE, z).height))
      const rightRow = iz * right.segs / left.segs
      if (Number.isInteger(rightRow)) {
        const b = rightRow * (right.segs + 1)
        expect(right.heights[b]).toBe(left.heights[a])
        expect(right.waterLevels[b]).toBe(left.waterLevels[a])
        if (left.segs === right.segs) {
          const leftNormal = left.ground.attributes.normal.array.subarray(a * 3, a * 3 + 3)
          const rightNormal = right.ground.attributes.normal.array.subarray(b * 3, b * 3 + 3)
          expect([...rightNormal]).toEqual([...leftNormal])
        }
      }
    }
  })

  it('keeps height-only normal probes numerically identical to climate heights', () => {
    for (const [x, z] of [[0, 0], [137, -281], [-1_920, 2_440], [8_400, -6_120]]) {
      expect(sampleTerrainHeightFast(x, z)).toBe(sampleClimate(x, z).height)
    }
  })

  it('transfers every buffer once and rebuilds the geometry without copying attributes', () => {
    const payload = generateTerrainGeometry(0, 0, 1, 2, [true, true, true, true])
    const buffers = terrainTransferables(payload)
    expect(new Set(buffers).size).toBe(buffers.length)
    const height = [...payload.heights]
    const originalPositions = [...payload.ground.attributes.position.array]
    const transferred = structuredClone(payload, { transfer: buffers })
    expect(buffers.every(buffer => buffer.byteLength === 0)).toBe(true)
    expect([...transferred.heights]).toEqual(height)
    const geometry = deserializeTerrainGeometry(transferred.ground)
    expect(geometry.getAttribute('position').array).toBe(transferred.ground.attributes.position.array)
    expect([...geometry.getAttribute('position').array]).toEqual(originalPositions)
    expect(geometry.index!.array).toBe(transferred.ground.index)
    expect(Number.isFinite(geometry.boundingSphere!.radius)).toBe(true)
    if (transferred.water) {
      const water = deserializeTerrainGeometry(transferred.water)
      expect(water.getAttribute('waterDepth')).toBeDefined()
      expect(water.getAttribute('waterFlowDir')).toBeDefined()
      expect(water.getAttribute('position').array).toBe(transferred.water.attributes.position.array)
      water.dispose()
    }
    geometry.dispose()
  })

  it('retains water appearance attributes through transfer for an analytic pond', () => {
    const pond = waterLandmarks(-2, -2).find(basin => basin.pond)!
    const originX = Math.floor(pond.x / CHUNK_SIZE) * CHUNK_SIZE
    const originZ = Math.floor(pond.z / CHUNK_SIZE) * CHUNK_SIZE
    const payload = generateTerrainGeometry(originX, originZ, 0)
    expect(payload.water).not.toBeNull()
    const transferred = structuredClone(payload, { transfer: terrainTransferables(payload) })
    const water = deserializeTerrainGeometry(transferred.water!)
    for (const attribute of ['position', 'normal', 'waterDepth', 'waterFlow', 'waterFlowDir', 'waterKind', 'waterDrop']) {
      expect(water.getAttribute(attribute).count).toBe(water.getAttribute('position').count)
      expect([...water.getAttribute(attribute).array].every(Number.isFinite)).toBe(true)
    }
    water.dispose()
  })

  it('bounds the broad far terrain grid even where analytic rivers cross it', () => {
    expect(waterSegsForLod(0, CHUNK_SIZE)).toBe(56)
    expect(waterSegsForLod(2, CHUNK_SIZE * 32)).toBe(16)
    const payload = generateTerrainGeometry(-CHUNK_SIZE * 16, -CHUNK_SIZE * 16, 2, 32)
    expect(payload.segs).toBeLessThanOrEqual(16)
    expect(payload.heights.length).toBeLessThanOrEqual(17 * 17)
    expect(payload.heights.every(Number.isFinite)).toBe(true)
  })

  it('produces identical payloads after returning to the same seed', () => {
    const first = generateTerrainGeometry(-CHUNK_SIZE, CHUNK_SIZE, 2)
    setWorldSeed(9001)
    generateTerrainGeometry(-CHUNK_SIZE, CHUNK_SIZE, 2)
    setWorldSeed(1)
    const replay = generateTerrainGeometry(-CHUNK_SIZE, CHUNK_SIZE, 2)
    expect(replay).toEqual(first)
  })
})
