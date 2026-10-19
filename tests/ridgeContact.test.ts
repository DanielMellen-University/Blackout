import { readFileSync } from 'node:fs'
import { Scene, Vector3 } from 'three'
import { afterEach, expect, it } from 'vitest'
import { TerrainSystem } from '../src/world/TerrainSystem'
import { generateTerrainGeometry } from '../src/world/TerrainGeometry'
import { clearOpsPad, sampleTerrainSurfaceHeightFast } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'
import { classifyContactOutcome } from '../src/systems/Collision'
import { flightConfig } from '../src/aircraft/flightConfig'

const contact = JSON.parse(readFileSync(new URL('../docs/reviews/ridge-10.938/contact.json', import.meta.url), 'utf8'))
afterEach(clearOpsPad)

it('keeps actual seed-73 ridge contact on visible dry ground, with no streamed height jump', () => {
  setWorldSeed(73); clearOpsPad()
  const terrain = new TerrainSystem(new Scene())
  const internal = terrain as any
  try {
    const [x, , z] = contact.position
    const cx = Math.floor(x / 420), cz = Math.floor(z / 420), key = `${cx},${cz}`
    internal.desiredTiles.set(key, { cx, cz, size: 1, dist: 0 })
    internal.install({ cx, cz, size: 1, lod: 0, generation: internal.generation },
      generateTerrainGeometry(cx * 420, cz * 420, 0, 1))
    const resident = terrain.sampleMeshSurface(x, z)!
    expect(resident.kind).toBe('land')
    expect(resident.height).toBeCloseTo(contact.residentHeight, 4)
    expect(Math.abs(resident.height - sampleTerrainSurfaceHeightFast(x, z))).toBeLessThan(.02)
  } finally { terrain.dispose() }
})

it('classifies the captured climbing ridge strike from its pre-resolution impact, not its positive vertical speed', () => {
  const hit = contact.impact
  const normal = new Vector3().fromArray(hit.normal), velocity = new Vector3().fromArray(hit.velocity)
  expect(normal.length()).toBeCloseTo(1, 10)
  expect(velocity.y).toBeGreaterThan(30)
  expect(velocity.dot(normal)).toBeCloseTo(hit.normalVelocity, 8)
  expect(hit.normalVelocity).toBeLessThan(-38)
  expect(Math.acos(normal.y)).toBeGreaterThan(flightConfig.maxLandingSlope)
  const outcome = classifyContactOutcome({
    airborne: true, onPad: false, gearDown: hit.gearDown,
    impact: { ...hit, point: new Vector3().fromArray(hit.point), surfacePoint: new Vector3().fromArray(hit.surfacePoint),
      surfaceNormal: normal, preImpactVelocity: velocity },
    vy: velocity.y, groundSpeed: Math.hypot(velocity.x, velocity.z),
    pitch: contact.attitude.pitch, roll: contact.attitude.roll,
    upY: Math.cos(contact.attitude.pitch) * Math.cos(contact.attitude.roll), obstacle: false, surface: 'land',
  })
  expect(outcome).toEqual({ result: 'crash', reason: 'slope' })
})
