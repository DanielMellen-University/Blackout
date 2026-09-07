import { describe, expect, it } from 'vitest'
import { setWorldSeed } from '../src/world/noise'
import { regionalRoadKey, roadBetweenSettlements, shouldConnectSettlements } from '../src/world/RegionalRoads'
import type { SettlementPlan } from '../src/world/SettlementPlan'

function plan(id: string, x: number, z: number, kind: 'city' | 'village' = 'village'): SettlementPlan {
  return {
    id, x, y: 120, z, kind, radius: kind === 'city' ? 9000 : 1400, biome: 'plains', buildings: [],
    roads: [{ width: 20, points: [
      { x: x - 500, y: 120, z }, { x, y: 120, z }, { x: x + 500, y: 120, z },
    ] }],
  }
}

function connectedPair(): [SettlementPlan, SettlementPlan] {
  const a = plan('0,0', -12000, 2000)
  for (let i = 1; i < 20; i++) {
    const b = plan(`${i},1`, 16000 + i * 700, 11000 + i * 110)
    if (shouldConnectSettlements(a, b)) return [a, b]
  }
  throw new Error('Expected at least one seeded regional connection')
}

describe('regional settlement roads', () => {
  it('selects a sparse deterministic subset and gives links a stable key', () => {
    setWorldSeed(1)
    const a = plan('0,0', 0, 0)
    const decisions = Array.from({ length: 20 }, (_, i) => {
      const b = plan(`${i + 1},0`, 44000 + i * 700, 8000)
      return shouldConnectSettlements(a, b)
    })
    expect(decisions.filter(Boolean).length).toBeGreaterThan(0)
    expect(decisions.filter(Boolean).length).toBeLessThan(decisions.length)
    expect(decisions).toEqual(Array.from({ length: 20 }, (_, i) =>
      shouldConnectSettlements(a, plan(`${i + 1},0`, 44000 + i * 700, 8000))))
    expect(regionalRoadKey(a, plan('2,0', 20000, 0))).toBe(regionalRoadKey(plan('2,0', 20000, 0), a))
  })

  it('builds a curved terrain-following route with bounded grades', () => {
    setWorldSeed(1)
    const [a, b] = connectedPair()
    const road = roadBetweenSettlements(a, b)
    expect(road).not.toBeNull()
    expect(road!.points.length).toBeGreaterThan(100)
    expect(road!.width).toBe(26)
    const start = road!.points[0]!, end = road!.points.at(-1)!
    expect(start.x).toBeGreaterThan(a.x)
    expect(end.x).toBeLessThan(b.x)
    let bend = 0
    const dx = end.x - start.x, dz = end.z - start.z, length = Math.hypot(dx, dz)
    for (let i = 1; i < road!.points.length; i++) {
      const previous = road!.points[i - 1]!, point = road!.points[i]!
      const step = Math.hypot(point.x - previous.x, point.z - previous.z)
      expect(Math.abs(point.y - previous.y) / step).toBeLessThanOrEqual(.120001)
      bend = Math.max(bend, Math.abs((point.x - start.x) * dz - (point.z - start.z) * dx) / length)
      expect(point.leftX).toBeTypeOf('number')
      expect(point.rightX).toBeTypeOf('number')
    }
    expect(bend).toBeGreaterThan(100)
  })

  it('uses wider highways whenever a city is an endpoint', () => {
    setWorldSeed(1)
    const [a, b] = connectedPair()
    a.kind = 'city'; a.radius = 9000
    const road = roadBetweenSettlements(a, b)
    expect(road).not.toBeNull()
    expect(road!.width).toBe(42)
  })
})
