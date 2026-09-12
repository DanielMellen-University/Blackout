import { describe, expect, it } from 'vitest'
import { Atmosphere } from '../src/world/Atmosphere'

describe('atmosphere lifecycle boundary', () => {
  it('fails closed for public calls after disposal', () => {
    const atmosphere = Object.create(Atmosphere.prototype) as Atmosphere
    ;(atmosphere as unknown as { disposed: boolean }).disposed = true
    ;(atmosphere as unknown as { weather: 'clear' }).weather = 'clear'

    expect(atmosphere.cycleWeather()).toBe('clear')
    expect(() => atmosphere.setPrecipitationScale(0.5)).not.toThrow()
    expect(() => atmosphere.setCloudDensityScale(0.5)).not.toThrow()
    expect(() => atmosphere.setWeather('rain')).not.toThrow()
    expect(() => atmosphere.randomizeWeather(42)).not.toThrow()
    expect(() => atmosphere.update(1 / 60, 0, 0, 0)).not.toThrow()
    expect(() => atmosphere.dispose()).not.toThrow()
  })
})
