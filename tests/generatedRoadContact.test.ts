import { afterEach, expect, it, vi } from 'vitest'
import { Mesh, Scene } from 'three'
import { setWorldSeed } from '../src/world/noise'
import { clearOpsPad, findPlayableSpawn, setOpsPad } from '../src/world/terrainSample'
import { settlementForCell, type SettlementRoad } from '../src/world/SettlementPlan'
import { buildableRegionalLinksForSettlement, roadBetweenSettlements, type RegionalRoadEndpoint } from '../src/world/RegionalRoads'
import { SettlementSystem } from '../src/world/SettlementSystem'
import { SurfaceDraper, MAX_DRAPE_VERTICES_PER_FRAME } from '../src/world/SurfaceDraper'
import { generateTerrainGeometry, CHUNK_SIZE } from '../src/world/TerrainGeometry'
import { interpolateGridHeight } from '../src/world/TerrainSystem'

afterEach(() => { clearOpsPad(); vi.restoreAllMocks() })

it.each([[73, -3, -2], [1337, 1, 1]])('refits actual seed-%i road vertices through far, near and far terrain payloads', (seed, cx, cz) => {
  clearOpsPad(); setWorldSeed(seed!)
  if (seed === 1337) {
    const spawn = findPlayableSpawn()!
    setOpsPad(spawn.x, spawn.z, spawn.y, spawn.yaw)
  }
  const plan = settlementForCell(cx!, cz!)!
  if (seed === 1337) { expect(plan.kind).toBe('city'); expect(plan.buildings).toHaveLength(1196) }
  const profiles = new Map<string, SettlementRoad>()
  const links = buildableRegionalLinksForSettlement(plan, settlementForCell, [], link => {
    const road = roadBetweenSettlements(link.from, link.to, settlementForCell)
    if (road) profiles.set(link.key, road)
    return road
  })
  expect(links.length).toBeGreaterThan(0)
  const link = links[0]!, road = profiles.get(link.key)!, start = road.points[0]!
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
    ;(system as unknown as { buildRegionalRoad(road: SettlementRoad, from: RegionalRoadEndpoint, to: RegionalRoadEndpoint): unknown })
      .buildRegionalRoad(road, link.from, link.to)
    const mesh = system.root.getObjectByName('RegionalRoadAsphalt') as Mesh
    const root = mesh.parent!, positions = mesh.geometry.getAttribute('position')
    const offsets = mesh.geometry.getAttribute('groundOffset')
    const originalY = Float32Array.from({ length: positions.count }, (_, i) => positions.getY(i))
    draper.add(mesh.geometry, root.position.x, root.position.y, root.position.z)
    // Remove clock variance without relaxing the per-update vertex/probe cap.
    vi.spyOn(performance, 'now').mockReturnValue(0)
    for (const lod of ['far', 'near', 'far'] as const) {
      active = lod === 'near' ? near : far
      tileX = lod === 'near' ? originX : farX; tileZ = lod === 'near' ? originZ : farZ
      span = CHUNK_SIZE * (lod === 'near' ? 1 : 32); revision++
      for (let i = 0; i <= Math.ceil(positions.count / MAX_DRAPE_VERTICES_PER_FRAME); i++) {
        expect(draper.update()).toBeLessThanOrEqual(MAX_DRAPE_VERTICES_PER_FRAME)
      }
      let checked = 0
      for (let i = 0; i < positions.count; i++) {
        if (offsets.getX(i) < 0) { expect(positions.getY(i)).toBe(originalY[i]); continue }
        const x = positions.getX(i) + root.position.x, z = positions.getZ(i) + root.position.z
        const height = sample(x, z)
        if (height === null) continue
        expect(positions.getY(i) + root.position.y).toBeCloseTo(height + .45, 3)
        checked++
      }
      expect(checked).toBeGreaterThan(2)
    }
    draper.clear()
  } finally { system.dispose() }
}, 60_000)
