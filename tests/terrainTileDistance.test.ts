import { describe, expect, it } from 'vitest'
import { terrainBuildPriority, tileDistance, tileKey } from '../src/world/TerrainLayout'

describe('tileDistance', () => {
  it('is zero anywhere inside or on the tile', () => {
    expect(tileDistance(0, 0, 4, 2, 2)).toBe(0)
    expect(tileDistance(0, 0, 4, 4, 0)).toBe(0)
  })

  it('measures to the nearest edge or corner in cell units', () => {
    expect(tileDistance(0, 0, 4, 7, 2)).toBe(3)
    expect(tileDistance(0, 0, 4, -2, 1)).toBe(2)
    expect(tileDistance(0, 0, 4, 7, 8)).toBe(5)
  })
})

describe('terrain tile keys and priority', () => {
  it('omits the size suffix only for single-cell tiles', () => {
    expect(tileKey(3, -2)).toBe('3,-2')
    expect(tileKey(3, -2, 8)).toBe('3,-2:8')
  })

  it('builds contact tiles first, then missing coverage, then LOD rebuilds', () => {
    const contact = terrainBuildPriority({ dist: 3, size: 1, rebuild: true })
    const missing = terrainBuildPriority({ dist: 40, size: 8, rebuild: false })
    const rebuild = terrainBuildPriority({ dist: 6, size: 2, rebuild: true })
    expect(contact).toBeLessThan(missing)
    expect(missing).toBeLessThan(rebuild)
  })
})
