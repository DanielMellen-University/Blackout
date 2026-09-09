import { afterEach, describe, expect, it, vi } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, findPlayableSpawn, sampleClimate, setOpsPad } from '../src/world/terrainSample'
import { settlementForCell } from '../src/world/SettlementPlan'
import type { SettlementPlan } from '../src/world/SettlementPlan'
import * as terrain from '../src/world/terrainSample'
vi.setConfig({ testTimeout: 60000 })

function region(radius = 7): SettlementPlan[] {
  const plans: SettlementPlan[] = []
  for (let x = -radius; x <= radius; x++) for (let z = -radius; z <= radius; z++) {
    const plan = settlementForCell(x, z)
    if (plan) plans.push(plan)
  }
  return plans
}

afterEach(() => { clearOpsPad(); vi.restoreAllMocks() })

describe('procedural settlements', () => {
  it('reconstructs deterministically after eviction and reseeding', () => {
    setWorldSeed(1)
    const plans = region()
    const first = plans[0]!
    const [cx, cz] = first.id.split(',').map(Number)
    expect(first).toBeDefined()
    expect(settlementForCell(cx!, cz!)).toEqual(first)
    setWorldSeed(73)
    expect(settlementForCell(cx!, cz!)).not.toEqual(first)
    setWorldSeed(1)
    expect(settlementForCell(cx!, cz!)).toEqual(first)
  })

  it('keeps cities rare and villages more common across varied biomes', () => {
    let cities = 0, villages = 0
    const biomes = new Set<string>()
    const shapes = new Set<string>()
    for (const seed of [1, 73, 1337]) {
      setWorldSeed(seed)
      for (const plan of region()) {
        for (const building of plan.buildings) shapes.add(building.shape)
        if (plan.kind === 'city') cities++
        else { villages++; biomes.add(plan.biome) }
      }
    }
    expect(cities).toBeGreaterThan(0)
    expect(cities / 675).toBeLessThan(.02)
    expect(villages / 675).toBeGreaterThan(.14)
    expect(villages / 675).toBeLessThan(.35)
    expect(villages).toBeGreaterThan(cities * 12)
    expect(biomes.size).toBeGreaterThanOrEqual(7)
    expect(shapes).toEqual(new Set(['block', 'slab', 'tower', 'stepped', 'hangar']))
  })

  it('anchors one reachable village and city around an active airfield', () => {
    const base = sampleClimate(0, 0)
    const sample = vi.spyOn(terrain, 'sampleClimate')
    sample.mockImplementation((x, z) => ({
      ...base,
      height: 180 + ((x + z) % 3),
      waterLevel: 0,
      biome: 'plains',
      biomeB: 'plains',
      biomeMix: 0,
      land: 1,
      coastal: 0,
    }))
    setWorldSeed(2026)
    setOpsPad(0, 0, 180)
    const plans = region(3)
    expect(plans.some(plan => plan.kind === 'village')).toBe(true)
    expect(plans.some(plan => plan.kind === 'city')).toBe(true)
    const anchors = plans.filter(plan => plan.anchor)
    expect(anchors.map(plan => plan.anchor)).toEqual(expect.arrayContaining(['village', 'city']))
    expect(Math.max(...anchors.map(plan => Math.hypot(plan.x, plan.z)))).toBeLessThan(14000)
  })

  it('keeps the guaranteed village and city in separate spawn cells', () => {
    const base = sampleClimate(0, 0)
    const sample = vi.spyOn(terrain, 'sampleClimate')
    sample.mockImplementation((x, z) => ({
      ...base,
      height: 180 + ((x + z) % 3),
      waterLevel: 0,
      biome: 'plains',
      biomeB: 'plains',
      biomeMix: 0,
      land: 1,
      coastal: 0,
    }))
    for (const seed of [1, 73, 1337, 2026]) {
      setWorldSeed(seed)
      setOpsPad(0, 0, 180)
      const anchors = region(3).filter(plan => plan.anchor)
      expect(new Set(anchors.map(plan => plan.anchor))).toEqual(new Set(['village', 'city']))
      expect(new Set(anchors.map(plan => plan.id)).size).toBe(2)
    }
  })

  it('keeps both guaranteed tiers discoverable on generated terrain', () => {
    setWorldSeed(1)
    clearOpsPad()
    const pad = findPlayableSpawn()
    expect(pad).toBeDefined()
    setOpsPad(pad!.x, pad!.z, pad!.y)
    const plans = region(3).filter(plan => plan.anchor)
    expect(plans.map(plan => plan.anchor)).toEqual(expect.arrayContaining(['village', 'city']))
    expect(Math.max(...plans.map(plan => Math.hypot(plan.x - pad!.x, plan.z - pad!.z)))).toBeLessThan(13000)
    expect(Math.hypot(
      plans.find(plan => plan.anchor === 'village')!.x - pad!.x,
      plans.find(plan => plan.anchor === 'village')!.z - pad!.z,
    )).toBeLessThan(6000)
  })

  it('rescues both anchor tiers on rough seeded terrain', () => {
    for (const seed of [14, 18, 22, 27]) {
      setWorldSeed(seed)
      clearOpsPad()
      const pad = findPlayableSpawn()
      expect(pad).toBeDefined()
      setOpsPad(pad!.x, pad!.z, pad!.y)
      const anchors = region(3).filter(plan => plan.anchor)
      expect(new Set(anchors.map(plan => plan.anchor))).toEqual(new Set(['village', 'city']))
      expect(Math.max(...anchors.map(plan => Math.hypot(plan.x - pad!.x, plan.z - pad!.z)))).toBeLessThan(14000)
    }
  })

  it('keeps anchored landmarks populated when rough terrain trims their footprint', () => {
    const base = sampleClimate(0, 0)
    const sample = vi.spyOn(terrain, 'sampleClimate')
    sample.mockImplementation((x, z) => ({
      ...base,
      height: 220 + Math.sin(x * .0017) * 220 + Math.cos(z * .0013) * 180,
      waterLevel: 0,
      biome: 'plains',
      biomeB: 'plains',
      biomeMix: 0,
      land: 1,
      coastal: 0,
    }))
    setWorldSeed(73)
    setOpsPad(0, 0, 220)
    const anchors = region(3).filter(plan => plan.anchor)
    expect(anchors.map(plan => plan.anchor)).toEqual(expect.arrayContaining(['village', 'city']))
    expect(anchors.find(plan => plan.anchor === 'village')!.buildings.length).toBeGreaterThanOrEqual(6)
    expect(anchors.find(plan => plan.anchor === 'city')!.buildings.length).toBeGreaterThanOrEqual(420)
  })

  it('varies settlement scale and silhouette instead of repeating one footprint', () => {
    setWorldSeed(73)
    const plans = region()
    const villages = plans.filter(plan => plan.kind === 'village')
    const cities = plans.filter(plan => plan.kind === 'city')
    expect(new Set(villages.map(plan => Math.round(plan.radius / 500))).size).toBeGreaterThanOrEqual(3)
    const villageWidths = villages.flatMap(plan => plan.buildings.map(building => building.width))
    expect(Math.max(...villageWidths) / Math.min(...villageWidths)).toBeGreaterThan(2)
    expect(cities.every(plan => plan.radius >= 8500 && plan.buildings.length >= 650)).toBe(true)
  })

  it('keeps city towers as landmarks instead of a uniform skyline', () => {
    setWorldSeed(1337)
    const city = region(10).find(plan => plan.kind === 'city')
    expect(city).toBeDefined()
    const buildings = city!.buildings
    const towers = buildings.filter(building => building.shape === 'tower').length
    expect(towers / buildings.length).toBeLessThan(.35)
    expect(new Set(buildings.map(building => building.shape))).toEqual(
      new Set(['block', 'slab', 'tower', 'stepped', 'hangar']),
    )
    expect(new Set(buildings.map(building => building.wallColor)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(buildings.map(building => building.roofColor)).size).toBeGreaterThanOrEqual(4)
  })

  it('fits dry foundations, caps geometry and keeps roads on dry gentle ground', () => {
    setWorldSeed(1)
    for (const plan of region(5)) {
      expect(plan.buildings.length).toBeLessThanOrEqual(plan.kind === 'city' ? 1600 : 70)
      if (plan.kind === 'village') {
        expect(plan.radius).toBeGreaterThanOrEqual(900)
        expect(plan.buildings.length).toBeGreaterThanOrEqual(8)
        expect(plan.buildings.every(b => b.width >= 180 && b.depth >= 180 && b.height >= 95)).toBe(true)
      } else {
        expect(plan.radius).toBeGreaterThanOrEqual(8500)
        expect(plan.buildings.length).toBeGreaterThanOrEqual(650)
      }
      expect(plan.roads.length).toBeGreaterThan(0)
      for (const building of plan.buildings) {
        const cos = Math.cos(building.yaw), sin = Math.sin(building.yaw)
        let min = Infinity, max = -Infinity
        for (const dx of [-building.width / 2, 0, building.width / 2]) {
          for (const dz of [-building.depth / 2, 0, building.depth / 2]) {
            const x = building.x + cos * dx + sin * dz, z = building.z - sin * dx + cos * dz
            const c = sampleClimate(x, z)
            expect(c.height).toBeGreaterThan((c.waterLevel ?? 0) + 2)
            expect(c.biome).not.toMatch(/^(water|ocean)$/)
            expect(building.y).toBeLessThan(c.height)
            expect(building.y + building.height).toBeGreaterThan(c.height)
            expect(Math.hypot(x - plan.x, z - plan.z)).toBeLessThan(plan.radius)
            min = Math.min(min, c.height); max = Math.max(max, c.height)
          }
        }
        const reliefLimit = plan.kind === 'city' ? Math.min(60, Math.min(building.width, building.depth) * .22)
          : Math.min(35, Math.min(building.width, building.depth) * .15)
        expect(max - min).toBeLessThanOrEqual(reliefLimit)
      }
      for (const road of plan.roads) for (let i = 0; i < road.points.length; i++) {
        const p = road.points[i]!, c = sampleClimate(p.x, p.z)
        expect(c.height).toBeGreaterThan((c.waterLevel ?? 0) + 2)
        expect(p.y).toBeCloseTo(c.height + .25, 8)
        const prev = road.points[i - 1]
        if (prev) expect(Math.abs(p.y - prev.y) / Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThanOrEqual(.220001)
      }
    }
  })

  it('invalidates cached placement when the airfield moves or is cleared', () => {
    setWorldSeed(1)
    const plan = region(3)[0]!
    const [cx, cz] = plan.id.split(',').map(Number)
    setOpsPad(plan.x, plan.z, plan.y)
    const replacement = settlementForCell(cx!, cz!)
    if (replacement) expect(Math.hypot(replacement.x - plan.x, replacement.z - plan.z)).toBeGreaterThanOrEqual(500 + replacement.radius)
    clearOpsPad()
    expect(settlementForCell(cx!, cz!)).toEqual(plan)
  })

  it('rejects entirely wet regions and slopes too steep for settlement', () => {
    const base = sampleClimate(0, 0)
    const sample = vi.spyOn(terrain, 'sampleClimate')
    setWorldSeed(988)
    sample.mockImplementation(() => ({ ...base, biome: 'water', height: -10, waterLevel: 0 }))
    expect(region(3)).toEqual([])
    setWorldSeed(989)
    sample.mockImplementation((x, z) => ({ ...base, biome: 'plains', height: 50000 + x + z, waterLevel: 0 }))
    expect(region(3)).toEqual([])
  })

  it('keeps building footprints separate', () => {
    setWorldSeed(73)
    for (const plan of region(5)) {
      for (let i = 0; i < plan.buildings.length; i++) for (let j = 0; j < i; j++) {
        const a = plan.buildings[i]!, b = plan.buildings[j]!
        const axes = [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2]
        const separated = axes.some(angle => {
          const x = Math.cos(angle), z = -Math.sin(angle)
          const extent = (building: typeof a) =>
            Math.abs(x * Math.cos(building.yaw) - z * Math.sin(building.yaw)) * building.width / 2 +
            Math.abs(x * Math.sin(building.yaw) + z * Math.cos(building.yaw)) * building.depth / 2
          return Math.abs((a.x - b.x) * x + (a.z - b.z) * z) >= extent(a) + extent(b)
        })
        expect(separated, `${plan.id} buildings ${i}/${j}`).toBe(true)
      }
    }
  })
})
