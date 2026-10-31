import { afterEach, describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'
import { basinDistance, waterLandmarks, type WaterBasin } from '../src/world/Hydrology'
import { generateTerrainGeometry, type TerrainLod } from '../src/world/TerrainGeometry'
function heightAt(g: { attributes: { position?: { array: ArrayLike<number> } }; index?: ArrayLike<number> | null },  x: number, z: number): number {
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
function firstLake(seed: number, pondOnly: boolean): WaterBasin {
  for (let ring = 0; ring <= 14; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
    if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue
    const basin = waterLandmarks(dx, dz).find(c => !c.sea && (!pondOnly || c.pond))
    if (basin) return basin as WaterBasin
  }
  throw new Error(`no basin for seed ${seed}`)
}

/** Drawn ground and drawn water just inside a lake's shore, at one LOD. */
function shoreFit(seed: number, pondOnly: boolean, lod: TerrainLod): { poke: number; total: number; worst: number } {
  setWorldSeed(seed); clearOpsPad()
  const basin = firstLake(seed, pondOnly)
  const span = 420, tiles = new Map<string, ReturnType<typeof generateTerrainGeometry>>()
  let poke = 0, total = 0, worst = 0
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * Math.PI * 2
    let r = 20
    while (basinDistance(basin, basin.x + Math.cos(a) * r, basin.z + Math.sin(a) * r) < 0) r += 1
    for (const back of [1, 3, 6, 10]) {
      const x = basin.x + Math.cos(a) * (r - back), z = basin.z + Math.sin(a) * (r - back)
      const ox = Math.floor(x / span) * span, oz = Math.floor(z / span) * span, key = `${ox},${oz}`
      let tile = tiles.get(key)
      if (!tile) { tile = generateTerrainGeometry(ox, oz, lod, 1); tiles.set(key, tile) }
      if (!tile.water) continue
      const lx = x - ox - span / 2, lz = z - oz - span / 2
      const water = heightAt(tile.water, lx, lz)
      if (!Number.isFinite(water)) continue
      const ground = heightAt(tile.ground, lx, lz)
      total++
      if (ground > water + .005) { poke++; worst = Math.max(worst, ground - water) }
    }
  }
  return { poke, total, worst }
}

afterEach(clearOpsPad)

describe('lake shoreline fit', () => {
  it('keeps near terrain below the water just inside the shore', () => {
    for (const [seed, pondOnly] of [[1337, true], [1, false], [73, true]] as const) {
      const fit = shoreFit(seed, pondOnly, 0)
      expect(fit.total).toBeGreaterThan(300)
      // Before the drop-off lip 18-33% of these points showed ground above
      // the water (up to 0.22 m), drawn as a dashed line along the shore.
      expect(fit.poke / fit.total, `${seed}`).toBeLessThan(.03)
      expect(fit.worst, `${seed}`).toBeLessThan(.05)
    }
  }, 60000)

  it('keeps mid-distance terrain below the water just inside the shore', () => {
    for (const [seed, pondOnly] of [[1337, true], [1, false], [73, true]] as const) {
      const fit = shoreFit(seed, pondOnly, 1)
      expect(fit.total).toBeGreaterThan(300)
      // Coarser cells were checked at only five points; up to 16 of 384
      // samples (0.45 m) still showed bank above the surface.
      expect(fit.poke / fit.total, `${seed}`).toBeLessThan(.015)
      expect(fit.worst, `${seed}`).toBeLessThan(.1)
    }
  }, 60000)
})
