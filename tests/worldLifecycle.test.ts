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
      const settlements = world.settlements as unknown as { detailRadius: number; roadDetailRadius: number }
      expect(terrain.waterDetailScale.value).toBe(.35)
      expect(terrain.terrainDetailScale.value).toBe(.42)
      expect(terrain.vegetationScale).toBe(.45)
      expect(terrain.uploadBudgetMs).toBe(1.25)
      expect(terrain.maxUploadsPerFrame).toBe(8)
      expect(settlements.detailRadius).toBe(2800)
      expect(settlements.roadDetailRadius).toBe(12000)
      expect(atmosphere.precipitationScale).toBe(.42)
      expect(atmosphere.cloudDensityScale).toBe(.5)
      expect(world.traffic.count).toBe(3)
    } finally {
      world.dispose()
    }
  }, 60_000)

  it('does not reapply an unchanged quality preset', () => {
    const world = new World('low')
    const viewRadius = vi.spyOn(world.terrain, 'setViewRadius')
    const detailRadius = vi.spyOn(world.settlements, 'setDetailRadius')
    try {
      world.setRenderQuality('low')
      expect(viewRadius).not.toHaveBeenCalled()
      expect(detailRadius).not.toHaveBeenCalled()

      world.setRenderQuality('balanced')
      expect(viewRadius).toHaveBeenCalledTimes(1)
      expect(detailRadius).toHaveBeenCalledTimes(1)

      world.setRenderQuality('balanced')
      expect(viewRadius).toHaveBeenCalledTimes(1)
      expect(detailRadius).toHaveBeenCalledTimes(1)
    } finally {
      world.dispose()
    }
  }, 60_000)

  it('normalizes malformed quality requests before applying the shared envelope', () => {
    const world = new World('low')
    try {
      world.setRenderQuality('ultra' as never)

      const state = world as unknown as {
        renderQuality: string | null
        terrain: { viewRadius: number }
        traffic: { count: number }
      }
      expect(state.renderQuality).toBe('balanced')
      expect(state.terrain.viewRadius).toBe(80)
      expect(state.traffic.count).toBe(5)

      const before = state.terrain.viewRadius
      world.setRenderQuality('invalid' as never)
      expect(state.terrain.viewRadius).toBe(before)
    } finally {
      world.dispose()
    }
  }, 60_000)

  it('fails closed when a world frame reports malformed timing or position', () => {
    const world = new World('low')
    try {
      world.update(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN, Number.NaN, Number.POSITIVE_INFINITY)
      expect(Number.isFinite(world.atmosphere.timeOfDay)).toBe(true)
      expect(Number.isFinite(world.atmosphere.daylight)).toBe(true)
      expect(world.scene.fog?.near).toBeGreaterThan(0)
      expect(world.scene.fog?.far).toBeGreaterThan(world.scene.fog?.near ?? 0)
    } finally {
      world.dispose()
    }
  }, 60_000)

  it('scales moving terrain and water detail with adaptive resolution', () => {
    const world = new World('balanced')
    try {
      const terrain = world.terrain as unknown as {
        waterDetailScale: { value: number }
        terrainDetailScale: { value: number }
        vegetationScale: number
      }
      const atmosphere = world.atmosphere as unknown as {
        precipitationScale: number
        cloudDensityScale: number
      }
      expect(terrain.waterDetailScale.value).toBe(.72)
      expect(terrain.terrainDetailScale.value).toBe(.75)
      expect(terrain.vegetationScale).toBe(.75)
      expect(atmosphere.precipitationScale).toBe(.72)
      expect(atmosphere.cloudDensityScale).toBe(.78)

      world.setAdaptiveDetailScale(.5)
      expect(terrain.waterDetailScale.value).toBeCloseTo(.36)
      expect(terrain.terrainDetailScale.value).toBeCloseTo(.375)
      expect(terrain.vegetationScale).toBeCloseTo(.375)
      expect(atmosphere.precipitationScale).toBeCloseTo(.36)
      expect(atmosphere.cloudDensityScale).toBeCloseTo(.39)

      world.setAdaptiveDetailScale(Number.NaN)
      expect(terrain.waterDetailScale.value).toBeCloseTo(.72)
      expect(terrain.terrainDetailScale.value).toBeCloseTo(.75)
      expect(terrain.vegetationScale).toBe(.75)
      expect(atmosphere.precipitationScale).toBe(.72)
      expect(atmosphere.cloudDensityScale).toBe(.78)

      world.setAdaptiveDetailScale(.6)
      world.setRenderQuality('low')
      expect(terrain.waterDetailScale.value).toBeCloseTo(.21)
      expect(terrain.terrainDetailScale.value).toBeCloseTo(.252)
      expect(terrain.vegetationScale).toBeCloseTo(.27)
      expect(atmosphere.precipitationScale).toBeCloseTo(.252)
      expect(atmosphere.cloudDensityScale).toBeCloseTo(.3)
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

  it('fails closed on malformed obstacle sweep coordinates', () => {
    const world = Object.create(World.prototype) as World
    ;(world as unknown as { disposed: boolean }).disposed = false
    const settlementHit = vi.fn(() => true)
    ;(world as unknown as { settlements: { hitObstacle: typeof settlementHit } }).settlements = {
      hitObstacle: settlementHit,
    }

    expect(world.hitObstacle(Number.NaN, 10, 0)).toBe(false)
    expect(world.hitObstacleSegment(
      { x: 0, y: 10, z: 0 },
      { x: Number.POSITIVE_INFINITY, y: 10, z: 0 },
    )).toBe(false)
    expect(settlementHit).not.toHaveBeenCalled()
  })

  it('uses a padded aircraft envelope for airfield buildings without inflating camera probes', () => {
    const world = Object.create(World.prototype) as World
    ;(world as unknown as { disposed: boolean }).disposed = false
    const settlementHit = vi.fn(() => false)
    ;(world as unknown as { settlements: { hitObstacle: typeof settlementHit } }).settlements = {
      hitObstacle: settlementHit,
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
      expect(settlementHit).toHaveBeenLastCalledWith(
        hangarEdge - 0.25,
        5.8,
        2,
        expect.objectContaining({ x: 5.5, y: 2.5, z: 5.5 }),
      )
    } finally {
      clearOpsPad()
    }
  })

  it('skips detailed settlement probes when the whole sweep misses loaded plans', () => {
    const world = Object.create(World.prototype) as World
    ;(world as unknown as { disposed: boolean }).disposed = false
    const settlementHit = vi.fn(() => false)
    const segmentMayHitObstacle = vi.fn(() => false)
    ;(world as unknown as { settlements: {
      hitObstacle: typeof settlementHit
      segmentMayHitObstacle: typeof segmentMayHitObstacle
    } }).settlements = { hitObstacle: settlementHit, segmentMayHitObstacle }
    ;(world as unknown as { obstaclePad: { x: number; y: number; z: number; yaw: number } }).obstaclePad = {
      x: 10_000,
      y: 0,
      z: 10_000,
      yaw: 0,
    }
    ;(world as unknown as { spawn: { yaw: number } }).spawn = { yaw: 0 }
    setOpsPad(10_000, 10_000, 0, 0)

    try {
      expect(world.hitObstacleSegment(
        { x: 0, y: 80, z: 0 },
        { x: 240, y: 80, z: 0 },
      )).toBe(false)
      expect(segmentMayHitObstacle).toHaveBeenCalledOnce()
      expect(settlementHit).not.toHaveBeenCalled()
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
    expect(world.lastReseedUsedFallback).toBe(true)
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

  it('pins authored crosswind courses to the runway-relative wind side', () => {
    const world = new World('low')
    try {
      world.reseed(29, 'approach', 'storm', undefined, 'right')
      const weather = world.atmosphere.weatherSnapshot
      const crosswind = weather.windX * Math.cos(world.spawn.yaw) - weather.windZ * Math.sin(world.spawn.yaw)
      expect(crosswind).toBeGreaterThan(20)
      expect(world.atmosphere.authoredWindHeading).not.toBeNull()
    } finally {
      world.dispose()
    }
  }, 60_000)

  it('starts authored front courses inside a deterministic weather transition', () => {
    const world = new World('low')
    try {
      world.reseed(259, 'storm', 'rain', undefined, undefined, 'storm')
      expect(world.atmosphere.weather).toBe('storm')
      expect(world.atmosphere.weatherTransitioning).toBe(true)
      expect(world.weatherCycleLocked).toBe(true)
      expect(world.atmosphere.weatherSnapshot.rain).toBeGreaterThan(0.2)
      expect(world.cycleWeather()).toBe('storm')
      world.update(world.spawn.x, world.spawn.y, world.spawn.z, 0.5, 0.5)
      expect(world.atmosphere.weatherTransitioning).toBe(true)
    } finally {
      world.dispose()
    }
  }, 60_000)
})
