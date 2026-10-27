import { afterEach, expect, it } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import { flightStart } from '../src/systems/AirborneStart'
import { CollisionSystem } from '../src/systems/Collision'
import { setContactHeightSampler, setGroundHeightSampler, setGroundSurfaceSampler } from '../src/world/ground'

afterEach(() => {
  setContactHeightSampler(null)
  setGroundHeightSampler(null)
  setGroundSurfaceSampler(null)
})

it('starts Free flight on its runway and accepts a subsequent gentle touchdown', () => {
  setContactHeightSampler(() => 100)
  setGroundHeightSampler(() => 100)
  setGroundSurfaceSampler((_x, _z, out) => { out.height = 100; out.kind = 'land'; return true })
  const jet = new Aircraft()
  const runway = { x: 0, y: 101.4, z: 0, yaw: 0 }
  jet.reset(flightStart(runway, null, () => 100))
  expect(jet.onGround).toBe(true)
  expect(jet.position.y).toBeCloseTo(runway.y)
  expect(jet.speed).toBe(0)
  // Script a short final approach, then let the flight model generate contact.
  jet.position.set(0, 102, 0)
  jet.velocity.set(0, -2, 40)
  expect(jet.onGround).toBe(false)
  const collision = new CollisionSystem()
  let contact = 'air'
  for (let i = 0; i < 120 && contact === 'air'; i++) {
    jet.step(1 / 120)
    contact = collision.check(jet)
  }
  expect(contact).toBe('landed')
  jet.markLanded()
  expect(jet.status).toBe('landed')
  jet.dispose()
})
