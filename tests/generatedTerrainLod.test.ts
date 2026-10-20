import { afterEach, expect, it } from 'vitest'
import { generateMission } from '../src/systems/MissionGenerator'
import { generateTerrainGeometry, CHUNK_SIZE } from '../src/world/TerrainGeometry'
import { MISSION_THEMES, setTerrainProfile } from '../src/world/TerrainProfile'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad } from '../src/world/terrainSample'

afterEach(() => { setTerrainProfile(null); clearOpsPad() })

it.each(MISSION_THEMES)('keeps %s terrain finite and identical at shared near/far grid samples', theme => {
  const recipe = generateMission(2026, theme), t = recipe.terrain
  setWorldSeed(recipe.seed); setTerrainProfile(t); clearOpsPad()
  // Survey a shoulder, where the valley theme has many kilometres of relief.
  const right = theme === 'coastal-island-run' ? -2300 : 6500
  const forward = theme === 'coastal-island-run' ? -1900 : 0
  const x = Math.floor((t.originX + Math.cos(t.yaw) * right + Math.sin(t.yaw) * forward) / CHUNK_SIZE) * CHUNK_SIZE
  const z = Math.floor((t.originZ - Math.sin(t.yaw) * right + Math.cos(t.yaw) * forward) / CHUNK_SIZE) * CHUNK_SIZE
  const far = generateTerrainGeometry(x, z, 2), near = generateTerrainGeometry(x, z, 0)
  if (theme !== 'coastal-island-run') { expect(far.water).toBeNull(); expect(near.water).toBeNull() }
  const ratio = near.segs / far.segs
  expect(Number.isInteger(ratio)).toBe(true)
  for (let row = 0; row <= far.segs; row++) for (let col = 0; col <= far.segs; col++)
    expect(far.heights[row * (far.segs + 1) + col]).toBe(near.heights[row * ratio * (near.segs + 1) + col * ratio])
  for (const data of [far, near]) {
    expect(Number.isFinite(data.ground.bounds.radius)).toBe(true)
    for (const attribute of Object.values(data.ground.attributes))
      expect(attribute.array.every(Number.isFinite)).toBe(true)
  }
  // Reuse the normal pooled buffers across a theme change, then return.
  setTerrainProfile(generateMission(2026, theme === 'desert-run' ? 'mountain-valley-run' : 'desert-run').terrain)
  generateTerrainGeometry(x, z, 2)
  setTerrainProfile(t)
  expect(generateTerrainGeometry(x, z, 2)).toEqual(far)
})
