import { afterEach, describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, setOpsPad } from '../src/world/terrainSample'
import { hydrologyWaterLevelAt } from '../src/world/Hydrology'
import { sampleGeography } from '../src/world/Geography'
import { generateTerrainGeometry, type TerrainGeometryBuffers, type TerrainLod } from '../src/world/TerrainGeometry'
import { shoreBedSteps } from '../src/world/TerrainWaterBed'

function heightAt(g: TerrainGeometryBuffers, x: number, z: number): number {
  const p = g.attributes.position!.array, indices = g.index
  let height = -Infinity
  for (let i = 0; i < (indices?.length ?? p.length / 3); i += 3) {
    const a = (indices ? indices[i]! : i) * 3, b = (indices ? indices[i + 1]! : i + 1) * 3
    const c = (indices ? indices[i + 2]! : i + 2) * 3
    const ax = p[a]!, az = p[a + 2]!, bx = p[b]!, bz = p[b + 2]!, cx = p[c]!, cz = p[c + 2]!
    const determinant = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
    if (Math.abs(determinant) < 1e-8) continue
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / determinant
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / determinant, w = 1 - u - v
    if (Math.min(u, v, w) >= -1e-6) height = Math.max(height, p[a + 1]! * u + p[b + 1]! * v + p[c + 1]! * w)
  }
  return height
}

afterEach(clearOpsPad)

describe('shoreline terrain interpolation', () => {
  it('keeps the actual drawn bed below the wetland bend at every terrain LOD', () => {
    setWorldSeed(73); clearOpsPad()
    const points = [[-7850.95817180948, -20197.634218662613], [-7816.296173994579, -20236.499769103517],
      [-7831.266449150687, -20251.47004425858], [-7782.063757207311, -20274.883642075285],
      [-7718.681215220668, -20283.222967459285]]
    for (const lod of [0, 1, 2] as TerrainLod[]) {
      const size = lod === 2 ? 4 : 1, span = 420 * size, tiles = new Map<string, ReturnType<typeof generateTerrainGeometry>>()
      for (const [x, z] of points) {
        const climate = sampleGeography(x!, z!)
        expect(climate.height).toBeLessThan(climate.waterLevel!)
        const ox = Math.floor(x! / span) * span, oz = Math.floor(z! / span) * span, key = `${ox},${oz}`
        let tile = tiles.get(key)
        if (!tile) { tile = generateTerrainGeometry(ox, oz, lod, size); tiles.set(key, tile) }
        const lx = x! - ox - span / 2, lz = z! - oz - span / 2
        expect(tile.water).not.toBeNull()
        const water = heightAt(tile.water!, lx, lz)
        expect(water).toBeCloseTo(climate.waterLevel!, 1)
        expect(heightAt(tile.ground, lx, lz)).toBeLessThan(water)
      }
    }
  })

  it('keeps corrected heights and normals identical across neighboring wet tiles', () => {
    setWorldSeed(73); clearOpsPad()
    const left = generateTerrainGeometry(-8400, -20580, 1), right = generateTerrainGeometry(-7980, -20580, 1)
    expect(left.segs).toBe(right.segs)
    const stride = left.segs + 1
    for (let z = 0; z <= left.segs; z++) {
      const a = z * stride + left.segs, b = z * stride
      expect(left.heights[a]).toBe(right.heights[b])
      expect([...left.ground.attributes.normal!.array.slice(a * 3, a * 3 + 3)])
        .toEqual([...right.ground.attributes.normal!.array.slice(b * 3, b * 3 + 3)])
    }
  })

  it('lowers a dry-corner cell when a narrow river crosses its interior', () => {
    const heights = new Float32Array(4).fill(10), levels = new Float32Array(4)
    const steps = shoreBedSteps(heights, levels, 1, 100, 0, 0,
      out => { out.height = 10; out.waterLevel = 0 },
      (x, z) => Math.abs(x - 50) < 2 && Math.abs(z - 50) < 2 ? 5 : -Infinity,
      undefined, (minX, minZ, maxX, maxZ) => minX <= 50 && maxX >= 50 && minZ <= 50 && maxZ >= 50)
    let result = steps.next()
    while (!result.done) result = steps.next()
    const bed = result.value
    expect(bed.heights[2 * bed.stride + 2]).toBeLessThan(5)
    expect(bed.heights[3 * bed.stride + 3]).toBeLessThan(5)
  })

  it('leaves dry land and flat deep beds unchanged', () => {
    for (const h of [50, -20]) {
      const source = new Float32Array(9).fill(h), levels = new Float32Array(9)
      const steps = shoreBedSteps(source, levels, 2, 420, 0, 0, out => { out.height = h; out.waterLevel = 0 },
        () => h < 0 ? 0 : -Infinity)
      let result = steps.next()
      while (!result.done) result = steps.next()
      expect([...result.value.heights]).toEqual(new Array(49).fill(h))
      expect([...source]).toEqual(new Array(9).fill(h))
    }
  })

  it('preserves a graded airfield core even beside a coarse wet shoreline', () => {
    setWorldSeed(73); clearOpsPad()
    setOpsPad(-7770, -20265, 200)
    const tile = generateTerrainGeometry(-8400, -21840, 2, 4)
    const ix = Math.round(630 / (1680 / tile.segs)), iz = Math.round(1575 / (1680 / tile.segs))
    expect(tile.heights[iz * (tile.segs + 1) + ix]).toBe(200)
  })

  it('matches the water-only probe to full geography across inland and coastal fixtures', () => {
    let wet = 0, dry = 0
    for (const seed of [1, 42, 73]) {
      setWorldSeed(seed); clearOpsPad()
      for (const [cx, cz] of [[-7800, -20200], [-64000, 8800], [0, 0]]) {
        for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) {
          const wx = cx! + x * 210, wz = cz! + z * 210, full = sampleGeography(wx, wz)
          const level = hydrologyWaterLevelAt(wx, wz)
          if (full.height < full.waterLevel!) {
            wet++; expect(level).toBeCloseTo(full.waterLevel!, 6)
          } else { dry++; expect(level).toBe(-Infinity) }
        }
      }
    }
    expect(wet).toBeGreaterThan(30); expect(dry).toBeGreaterThan(100)
  })
})
