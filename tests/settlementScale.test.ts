import { afterEach, expect, it, vi } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import * as terrain from '../src/world/terrainSample'
import { settlementForCell } from '../src/world/SettlementPlan'

afterEach(() => { terrain.clearOpsPad(); vi.restoreAllMocks() })

it('uses smaller physical buildings without shrinking city extent or erasing either settlement tier', () => {
  setWorldSeed(73); terrain.clearOpsPad()
  const base = terrain.sampleClimate(0, 0)
  vi.spyOn(terrain, 'sampleClimate').mockImplementation((_x, _z, out) => {
    const value = Object.assign(out ?? { ...base }, base)
    value.height = 100; value.waterLevel = 0; value.biome = 'plains'
    return value
  })
  const village = settlementForCell(0, 0, 'village')!
  const city = settlementForCell(0, 0, 'city')!
  expect(village).not.toBeNull(); expect(city).not.toBeNull()
  expect(village.buildings.length).toBeGreaterThanOrEqual(8)
  expect(city.buildings.length).toBeGreaterThanOrEqual(420)
  expect(city.radius).toBeGreaterThan(8000)
  for (const building of village.buildings) {
    expect(building.width).toBeLessThan(100)
    expect(building.height).toBeLessThan(32)
    expect(building.width).toBeGreaterThan(10)
  }
  for (const building of city.buildings) {
    expect(building.width).toBeLessThan(100)
    expect(building.height).toBeLessThan(350)
  }
  expect(village.roads.every(road => road.width < 16)).toBe(true)
  expect(village.buildings.some(b => b.use === 'barn')).toBe(true)
  expect(village.buildings.some(b => b.use === 'gas-station' && b.service)).toBe(true)
  expect(village.ground?.some(patch => patch.use === 'field')).toBe(true)
  expect(city.ground?.some(patch => patch.use === 'park')).toBe(true)
  expect(new Set(city.buildings.map(b => b.district)))
    .toEqual(new Set(['centre', 'residential', 'commercial', 'industrial']))
})
