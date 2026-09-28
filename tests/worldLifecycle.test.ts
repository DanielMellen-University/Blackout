import { describe, expect, it, vi } from 'vitest'
import { World } from '../src/world/World'

describe('world lifecycle boundary', () => {
  it('fails closed for public calls after disposal', () => {
    const world = Object.create(World.prototype) as World
    ;(world as unknown as { disposed: boolean }).disposed = true
    ;(world as unknown as { seed: number }).seed = 42
    ;(world as unknown as { atmosphere: { weather: 'clear' } }).atmosphere = { weather: 'clear' }

    expect(world.reseed()).toBe(42)
    expect(world.hitObstacle(0, 0, 0)).toBe(false)
    expect(world.cycleWeather()).toBe('clear')
    expect(() => world.setSettlementsVisible(true)).not.toThrow()
  })

  it('rebuilds a usable previous world when replacement fails after clearing terrain', () => {
    const world = new World()
    const previousSeed = world.worldSeed
    const originalClear = world.terrain.clearAll.bind(world.terrain)
    const clear = vi.spyOn(world.terrain, 'clearAll').mockImplementationOnce(() => {
      originalClear()
      throw new Error('synthetic terrain rebuild failure')
    })

    expect(world.reseed(73)).toBe(previousSeed)
    expect(clear).toHaveBeenCalledTimes(2)
    expect(world.worldSeed).toBe(previousSeed)
    expect(Number.isFinite(world.spawn.x)).toBe(true)
    expect(Number.isFinite(world.spawn.z)).toBe(true)
    expect(world.terrain.streamingStats.pending + world.terrain.streamingStats.loaded).toBeGreaterThan(0)
    world.dispose()
  }, 60_000)

  it('can start a curated run with a deterministic weather override', () => {
    const world = new World()
    world.reseed(10, 'storm', 'storm')
    expect(world.worldSeed).toBe(10)
    expect(world.mission.routeProfile).toBe('storm')
    expect(world.atmosphere.weather).toBe('storm')
    world.dispose()
  }, 60_000)

  it('can start a curated run with deterministic night conditions', () => {
    const world = new World()
    world.reseed(11, 'night', 'fog', 0.84)
    expect(world.worldSeed).toBe(11)
    expect(world.mission.routeProfile).toBe('night')
    expect(world.atmosphere.weather).toBe('fog')
    expect(world.atmosphere.timeOfDay).toBeCloseTo(0.84)
    world.dispose()
  }, 60_000)
})
