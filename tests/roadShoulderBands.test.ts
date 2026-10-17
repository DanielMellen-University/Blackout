import { afterEach, expect, it, vi } from 'vitest'
import { Mesh, Scene } from 'three'
import { SettlementSystem } from '../src/world/SettlementSystem'
import type { SettlementPlan, SettlementRoad } from '../src/world/SettlementPlan'
import * as terrain from '../src/world/terrainSample'
import { createClimateSample } from '../src/world/Geography'

const road: SettlementRoad = { width: 10, points: [
  { x: -150, y: 100.45, z: 0, structure: 'ground', groundY: 100 },
  { x: 150, y: 100.45, z: 0, structure: 'ground', groundY: 100 },
] }
const plan: SettlementPlan = { id: '0,0', kind: 'village', biome: 'plains', radius: 1000,
  x: 0, y: 100, z: 0, buildings: [], roads: [road] }
afterEach(() => vi.restoreAllMocks())

it.each(['local', 'regional'] as const)('keeps %s gravel triangles outside the asphalt lane', kind => {
  vi.spyOn(terrain, 'sampleClimate').mockImplementation((_x, _z, out) =>
    Object.assign(out ?? createClimateSample(), { height: 100, waterLevel: 0 }))
  const system = new SettlementSystem(new Scene())
  try {
    const internal = system as unknown as {
      build(plan: SettlementPlan): unknown
      buildRegionalRoad(road: SettlementRoad, from: SettlementPlan, to: SettlementPlan): unknown
    }
    if (kind === 'local') internal.build(plan)
    else internal.buildRegionalRoad(road, { ...plan, x: -150 }, { ...plan, id: '1,0', x: 150 })
    const mesh = system.root.getObjectByName(kind === 'local' ? 'SettlementRoadShoulders' : 'RegionalRoadShoulder') as Mesh
    expect(mesh).toBeDefined()
    const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.getIndex()!
    const originZ = mesh.parent!.position.z
    let left = false, right = false
    for (let i = 0; i < indices.count; i += 3) {
      const zs = [0, 1, 2].map(j => positions.getZ(indices.getX(i + j)) + originZ)
      // A gravel triangle must occupy one outer band, never span the lane.
      expect(zs.every(z => z >= road.width / 2 - .001) || zs.every(z => z <= -road.width / 2 + .001)).toBe(true)
      left ||= zs.every(z => z > 0); right ||= zs.every(z => z < 0)
    }
    expect(left && right).toBe(true)
    expect(indices.count).toBeLessThanOrEqual((road.points.length - 1) * 12)
    expect(positions.count).toBeLessThanOrEqual(road.points.length * 4)
  } finally { system.dispose() }
})
