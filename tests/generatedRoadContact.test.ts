import { afterEach, expect, it, vi } from 'vitest'
import { Mesh, Scene, Vector3 } from 'three'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, findPlayableSpawn, sampleClimate, setOpsPad } from '../src/world/terrainSample'
import { settlementForCell, type SettlementPlan, type SettlementRoad } from '../src/world/SettlementPlan'
import { buildableRegionalLinksForSettlement, roadBetweenSettlements, type RegionalRoadEndpoint } from '../src/world/RegionalRoads'
import { SettlementSystem } from '../src/world/SettlementSystem'
import { SurfaceDraper, MAX_DRAPE_VERTICES_PER_FRAME } from '../src/world/SurfaceDraper'
import { generateTerrainGeometry, CHUNK_SIZE } from '../src/world/TerrainGeometry'
import { interpolateGridHeight } from '../src/world/TerrainSystem'

afterEach(() => { clearOpsPad(); vi.restoreAllMocks() })

it.each([
  { seed: 73, cx: -3, cz: -2, focus: 'junction' },
  { seed: 1337, cx: 1, cz: 1, focus: 'junction' },
  { seed: 1, cx: -7, cz: -5, focus: 'steep' },
  { seed: 73, cx: -5, cz: -3, focus: 'coastal' },
])('refits $focus seed-$seed asphalt and shoulders through far, near and far terrain', ({ seed, cx, cz, focus }) => {
  clearOpsPad(); setWorldSeed(seed)
  if (seed === 1337) {
    const spawn = findPlayableSpawn()!
    setOpsPad(spawn.x, spawn.z, spawn.y, spawn.yaw)
  }
  const plan = settlementForCell(cx, cz)!
  if (seed === 1337) { expect(plan.kind).toBe('city'); expect(plan.buildings).toHaveLength(1196) }
  const profiles = new Map<string, SettlementRoad>()
  const local = focus === 'coastal'
  const links = local ? [] : buildableRegionalLinksForSettlement(plan, settlementForCell, [], link => {
    const road = roadBetweenSettlements(link.from, link.to, settlementForCell)
    if (road) profiles.set(link.key, road)
    return road
  })
  if (!local) expect(links.length).toBeGreaterThan(0)
  const link = links[0], road = local ? plan.roads[0]! : profiles.get(link!.key)!
  let start = road.points[0]!
  if (local) {
    start = plan.roads.flatMap(r => r.points).filter(p => p.structure === 'ground')
      .reduce((a, b) => a.y < b.y ? a : b)
    expect(start.y).toBeLessThan(10)
    expect(sampleClimate(start.x, start.z).coastal).toBeGreaterThan(.9)
  } else if (focus === 'steep') {
    let steepest = 0
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1]!, b = road.points[i]!
      if (a.structure !== 'ground' || b.structure !== 'ground') continue
      const grade = Math.abs(b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z)
      if (grade > steepest) { steepest = grade; start = a }
    }
    expect(steepest).toBeGreaterThan(.2)
  }
  const originX = Math.floor(start.x / CHUNK_SIZE) * CHUNK_SIZE
  const originZ = Math.floor(start.z / CHUNK_SIZE) * CHUNK_SIZE
  const near = generateTerrainGeometry(originX, originZ, 0)
  const farX = Math.floor(start.x / (CHUNK_SIZE * 32)) * CHUNK_SIZE * 32
  const farZ = Math.floor(start.z / (CHUNK_SIZE * 32)) * CHUNK_SIZE * 32
  const far = generateTerrainGeometry(farX, farZ, 2, 32)
  let revision = 1, active = far, tileX = farX, tileZ = farZ, span = CHUNK_SIZE * 32
  const sample = (x: number, z: number) => x < tileX || x > tileX + span || z < tileZ || z > tileZ + span ? null :
    Math.max(interpolateGridHeight(active.heights, active.segs, tileX, tileZ, x, z, span),
      interpolateGridHeight(active.waterLevels, active.segs, tileX, tileZ, x, z, span))
  const system = new SettlementSystem(new Scene())
  const draper = new SurfaceDraper(sample, () => revision)
  try {
    const internal = system as unknown as {
      build(plan: SettlementPlan): unknown
      buildRegionalRoad(road: SettlementRoad, from: RegionalRoadEndpoint, to: RegionalRoadEndpoint): unknown
    }
    if (local) internal.build(plan)
    else internal.buildRegionalRoad(road, link!.from, link!.to)
    const meshes = (local ? ['SettlementRoads', 'SettlementRoadShoulders'] : ['RegionalRoadAsphalt', 'RegionalRoadShoulder'])
      .map(name => system.root.getObjectByName(name) as Mesh)
    const surfaces = meshes.map(mesh => {
      expect(mesh).toBeDefined()
      const root = { position: mesh.getWorldPosition(new Vector3()) }, positions = mesh.geometry.getAttribute('position')
      const offsets = mesh.geometry.getAttribute('groundOffset')
      const originalY = Float32Array.from({ length: positions.count }, (_, i) => positions.getY(i))
      draper.add(mesh.geometry, root.position.x, root.position.y, root.position.z)
      return { root, positions, offsets, originalY }
    })
    const vertices = surfaces.reduce((sum, s) => sum + s.positions.count, 0)
    // Remove clock variance without relaxing the shared per-update vertex/probe cap.
    vi.spyOn(performance, 'now').mockReturnValue(0)
    for (const lod of ['far', 'near', 'far'] as const) {
      active = lod === 'near' ? near : far
      tileX = lod === 'near' ? originX : farX; tileZ = lod === 'near' ? originZ : farZ
      span = CHUNK_SIZE * (lod === 'near' ? 1 : 32); revision++
      for (let i = 0; i <= Math.ceil(vertices / MAX_DRAPE_VERTICES_PER_FRAME); i++) {
        expect(draper.update()).toBeLessThanOrEqual(MAX_DRAPE_VERTICES_PER_FRAME)
      }
      for (const { root, positions, offsets, originalY } of surfaces) {
        let checked = 0
        for (let i = 0; i < positions.count; i++) {
          if (offsets.getX(i) < 0) { expect(positions.getY(i)).toBe(originalY[i]); continue }
          const height = sample(positions.getX(i) + root.position.x, positions.getZ(i) + root.position.z)
          if (height === null) continue
          expect(positions.getY(i) + root.position.y).toBeCloseTo(height + offsets.getX(i), 3)
          checked++
        }
        expect(checked).toBeGreaterThan(2)
      }
    }
    draper.clear()
  } finally { system.dispose() }
}, 60_000)
