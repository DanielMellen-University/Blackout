import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Group, Mesh, Scene } from 'three'
import { expect, it } from 'vitest'
import { SettlementSystem } from '../src/world/SettlementSystem'
import type { SettlementRoad } from '../src/world/SettlementPlan'
import type { RegionalRoadEndpoint } from '../src/world/RegionalRoads'

it('preserves every regional road buffer through streamed row preparation', () => {
  const system = new SettlementSystem(new Scene())
  const road: SettlementRoad = { width: 18, points: Array.from({ length: 180 }, (_, i) => ({
    x: 100000 + i * 20, z: -120000 + Math.sin(i / 30) * 100,
    y: 110 + i * .1, groundY: 100 + i * .1, leftY: 111 + i * .1, rightY: 109 + i * .1,
    shoulderLeftY: 108 + i * .1, shoulderRightY: 107 + i * .1,
    structure: i > 65 && i < 100 ? 'viaduct' : i > 45 && i < 120 ? 'embankment' : 'ground',
  })) }
  const from = { id: 'a', x: 100000, z: -120000, biome: 'plains' } as RegionalRoadEndpoint
  const to = { ...from, id: 'b', x: 104000 }
  try {
    const { root } = (system as unknown as { buildRegionalRoad(r: SettlementRoad,
      a: RegionalRoadEndpoint, b: RegionalRoadEndpoint): { root: Group } }).buildRegionalRoad(road, from, to)
    const pier = root.getObjectByName('RegionalBridgePiers') as Mesh
    const deck = root.getObjectByName('RegionalBridgeDeck') as Mesh
    expect(pier.material).not.toBe(deck.material)
    const hashes: Record<string, string> = {}
    let meshIndex = 0
    root.traverse(object => {
      if (!(object instanceof Mesh)) return
      const hash = createHash('sha256')
      for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
        hash.update(name); hash.update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength))
      }
      if (object.geometry.index) hash.update(Buffer.from(object.geometry.index.array.buffer))
      hashes[`${meshIndex++}:${object.name}`] = hash.digest('hex')
    })
    const fixture = new URL('./fixtures/road-assembly-10.916.json', import.meta.url)
    expect(hashes).toEqual(JSON.parse(readFileSync(fixture, 'utf8')))
  } finally { system.dispose() }
})
