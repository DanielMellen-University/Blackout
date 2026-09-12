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

  it('tracks reduced-motion preference and clears an active flash', () => {
    const atmosphere = Object.create(Atmosphere.prototype) as Atmosphere
    ;(atmosphere as unknown as { disposed: boolean }).disposed = false
    ;(atmosphere as unknown as { reducedMotion: boolean }).reducedMotion = false
    ;(atmosphere as unknown as { lightningFlash: number }).lightningFlash = 0.4
    ;(atmosphere as unknown as { lightningFlashAge: number }).lightningFlashAge = 0.2

    expect(atmosphere.prefersReducedMotion).toBe(false)
    expect(atmosphere.lightningActive).toBe(true)
    atmosphere.setReducedMotion(true)
    expect(atmosphere.prefersReducedMotion).toBe(true)
    expect(atmosphere.lightningActive).toBe(false)
    expect((atmosphere as unknown as { lightningFlash: number }).lightningFlash).toBe(0)
  })
})
