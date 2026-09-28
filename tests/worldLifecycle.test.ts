import { describe, expect, it, vi } from 'vitest'
import { World } from '../src/world/World'
import { clearOpsPad, setOpsPad } from '../src/world/terrainSample'

describe('world lifecycle boundary', () => {
  it('applies the complete quality envelope during construction', () => {
    const world = new World('low')
    try {
      const terrain = world.terrain as unknown as {
        waterDetailScale: { value: number }
        terrainDetailScale: { value: number }
        vegetationScale: number
        uploadBudgetMs: number
        maxUploadsPerFrame: number
      }
      const atmosphere = world.atmosphere as unknown as {
        precipitationScale: number
        cloudDensityScale: number
      }
      const settlements = world.settlements as unknown as { detailRadius: number }
      expect(terrain.waterDetailScale.value).toBe(.35)
      expect(terrain.terrainDetailScale.value).toBe(.42)
      expect(terrain.vegetationScale).toBe(.45)
      expect(terrain.uploadBudgetMs).toBe(1.25)
      expect(terrain.maxUploadsPerFrame).toBe(8)
      expect(settlements.detailRadius).toBe(2800)
      expect(atmosphere.precipitationScale).toBe(.42)
      expect(atmosphere.cloudDensityScale).toBe(.5)
      expect(world.traffic.count).toBe(3)
    } finally {
      world.dispose()
    }
  }, 60_000)

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

  it('sweeps fast obstacle paths instead of checking only the endpoint', () => {
    const world = Object.create(World.prototype) as World
    ;(world as unknown as { disposed: boolean }).disposed = false
    const hit = vi.fn((x: number) => x >= 4.5 && x <= 5.5)
    ;(world as unknown as { hitObstacle: typeof hit }).hitObstacle = hit

    expect(world.hitObstacleSegment(
      { x: 0, y: 10, z: 0 },
      { x: 10, y: 10, z: 0 },
    )).toBe(true)
    expect(hit).toHaveBeenCalledWith(5, 10, 0, expect.anything())
  })

  it('uses a padded aircraft envelope for airfield buildings without inflating camera probes', () => {
    const world = Object.create(World.prototype) as World
    ;(world as unknown as { disposed: boolean }).disposed = false
    ;(world as unknown as { settlements: { hitObstacle: () => boolean } }).settlements = {
      hitObstacle: () => false,
    }
    ;(world as unknown as { obstaclePad: { x: number; y: number; z: number; yaw: number } }).obstaclePad = {
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
    }
    ;(world as unknown as { spawn: { yaw: number } }).spawn = { yaw: 0 }
    setOpsPad(0, 0, 0, 0)

    try {
      const hangarEdge = 39.2 - 18
      expect(world.hitObstacle(hangarEdge - 0.25, 5.8, 2)).toBe(false)
      expect(world.hitObstacleSegment(
        { x: hangarEdge - 0.25, y: 5.8, z: 2 },
        { x: hangarEdge - 0.25, y: 5.8, z: 2 },
      )).toBe(true)
    } finally {
      clearOpsPad()
    }
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
    expect(world.weatherCycleLocked).toBe(true)
    expect(world.atmosphere.timeOfDayLocked).toBe(false)
    expect(world.cycleWeather()).toBe('storm')
    world.dispose()
  }, 60_000)

  it('can start a curated run with deterministic night conditions', () => {
    const world = new World()
    world.reseed(11, 'night', 'fog', 0.84)
    expect(world.worldSeed).toBe(11)
    expect(world.mission.routeProfile).toBe('night')
    expect(world.atmosphere.weather).toBe('fog')
    expect(world.atmosphere.timeOfDay).toBeCloseTo(0.84)
    expect(world.weatherCycleLocked).toBe(true)
    expect(world.atmosphere.timeOfDayLocked).toBe(true)
    world.dispose()
  }, 60_000)
})
