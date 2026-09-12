import { describe, expect, it } from 'vitest'
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
})
