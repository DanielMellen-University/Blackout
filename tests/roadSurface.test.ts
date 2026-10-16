import { describe, expect, it } from 'vitest'
import { groundRoad, ROAD_APPROACH_GRADE, ROAD_BRIDGE_CLEARANCE, ROAD_GROUND_OFFSET,
  MAX_ROAD_PROFILE_POINTS, ROAD_SURFACE_STEP } from '../src/world/RoadSurface'
import { roadStructureGeometry } from '../src/world/SettlementSystem'

describe('grounded roads and explicit river crossings', () => {
  it('follows hilly ground and independent shoulders without lifting dry valleys', () => {
    const sample = (x: number, z: number) => ({ height: 100 + Math.sin(x / 120) * 55 + z * .1, waterLevel: 0 })
    const road = groundRoad([{ x: 0, z: 0 }, { x: 1200, z: 0 }], 10, sample)!
    expect(road.points.length).toBeGreaterThan(40)
    for (const point of road.points) {
      expect(point.y).toBeCloseTo(sample(point.x, point.z).height + ROAD_GROUND_OFFSET)
      expect(point.leftY).toBeCloseTo(sample(point.leftX!, point.leftZ!).height + ROAD_GROUND_OFFSET)
      expect(point.rightY).toBeCloseTo(sample(point.rightX!, point.rightZ!).height + ROAD_GROUND_OFFSET)
      expect(point.shoulderLeftY).toBeCloseTo(sample(point.x, 7.75).height + .3)
      expect(point.structure).toBe('ground'); expect(point.bridge).toBe(false)
    }
  })

  it('creates a level, water-clear deck and graded supported approaches', () => {
    const sample = (x: number) => ({ height: Math.abs(x) < 70 ? 90 : 100, waterLevel: 97 })
    const road = groundRoad([{ x: -300, z: 0 }, { x: 300, z: 0 }], 10, sample)!
    const wet = road.points.filter(point => point.bridge)
    expect(wet.length).toBeGreaterThan(2)
    expect(new Set(wet.map(point => point.y)).size).toBe(1)
    expect(wet[0]!.y).toBeGreaterThanOrEqual(97 + ROAD_BRIDGE_CLEARANCE)
    expect(road.points.some(point => point.structure === 'embankment')).toBe(true)
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]!, b = road.points[i]!
      expect(Math.abs(b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThanOrEqual(ROAD_APPROACH_GRADE + 1e-8)
    }
    const sides = roadStructureGeometry(road, 0, 0, true)!
    const fill = roadStructureGeometry(road, 0, 0, false)!
    expect(sides.getAttribute('position').count).toBeGreaterThan(0)
    const normals = sides.getAttribute('normal')
    expect(Array.from({ length: normals.count }, (_, i) => normals.getY(i)).some(y => y < -.9)).toBe(true)
    expect(fill.getAttribute('position').count).toBeGreaterThan(0)
    sides.dispose(); fill.dispose()
  })

  it('marks higher dry approaches as viaducts instead of unsupported floating ground roads', () => {
    const sample = (x: number) => ({ height: x >= 0 && x <= 120 ? -10 : x < 0 ? 2 : 25, waterLevel: 0 })
    const road = groundRoad([{ x: -400, z: 0 }, { x: 500, z: 0 }], 12, sample)!
    const elevated = road.points.filter(point => point.structure === 'viaduct')
    expect(elevated.length).toBeGreaterThan(0)
    expect(elevated.every(point => !point.bridge && point.y - point.groundY! > 8)).toBe(true)
    const geometry = roadStructureGeometry(road, 0, 0, true)!
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
    geometry.dispose()
  })

  it('detects water touching a shoulder even when the centreline remains on land', () => {
    const sample = (x: number, z: number) => ({ height: z > 4 && x > 100 && x < 160 ? -3 : 3, waterLevel: 0 })
    const road = groundRoad([{ x: 0, z: 0 }, { x: 300, z: 0 }], 12, sample)!
    expect(road.points.some(point => point.bridge)).toBe(true)
    expect(road.points.filter(point => point.bridge).every(point => point.leftY === point.y && point.rightY === point.y)).toBe(true)
    expect(road.points[0]!.structure).toBe('ground')
    expect(road.points.at(-1)!.structure).toBe('ground')
  })

  it('rejects unbounded crossings, over-budget profiles and malformed surfaces', () => {
    expect(groundRoad([{ x: -2500, z: 0 }, { x: 2500, z: 0 }], 10,
      () => ({ height: -10, waterLevel: 0 }))).toBeNull()
    expect(groundRoad([{ x: 0, z: 0 }, { x: MAX_ROAD_PROFILE_POINTS * ROAD_SURFACE_STEP, z: 0 }], 10,
      () => ({ height: 100, waterLevel: 0 }))).toBeNull()
    expect(groundRoad([{ x: 0, z: 0 }, { x: 100, z: 0 }], 10,
      () => ({ height: NaN }))).toBeNull()
    expect(groundRoad([{ x: 0, z: 0 }, { x: 200, z: 0 }], 10,
      x => ({ height: x > 100 ? -10 : 2, waterLevel: 0 }))).toBeNull()
  })
})
