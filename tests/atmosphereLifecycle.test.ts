import { describe, expect, it } from 'vitest'
import { Atmosphere, DEFAULT_ATMOSPHERE_TIME } from '../src/world/Atmosphere'
import type { WeatherSnapshot } from '../src/world/WeatherDirector'

describe('atmosphere lifecycle boundary', () => {
  it('uses a stable pre-reseed clock', () => {
    expect(DEFAULT_ATMOSPHERE_TIME).toBe(.5)
  })

  it('fails closed for public calls after disposal', () => {
    const atmosphere = Object.create(Atmosphere.prototype) as Atmosphere
    ;(atmosphere as unknown as { disposed: boolean }).disposed = true
    ;(atmosphere as unknown as { weather: 'clear' }).weather = 'clear'

    expect(atmosphere.cycleWeather()).toBe('clear')
    expect(() => atmosphere.setPrecipitationScale(0.5)).not.toThrow()
    expect(() => atmosphere.setCloudDensityScale(0.5)).not.toThrow()
    expect(() => atmosphere.setWeather('rain')).not.toThrow()
    expect(() => atmosphere.setWeatherLocked(true)).not.toThrow()
    expect(() => atmosphere.setTimeOfDayLocked(true)).not.toThrow()
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
    atmosphere.setReducedMotion('true' as never)
    expect(atmosphere.prefersReducedMotion).toBe(false)
    atmosphere.setReducedMotion(true)
    expect(atmosphere.prefersReducedMotion).toBe(true)
    expect(atmosphere.lightningActive).toBe(false)
    expect((atmosphere as unknown as { lightningFlash: number }).lightningFlash).toBe(0)
  })

  it('keeps the public weather state valid when an external ID is malformed', () => {
    const atmosphere = Object.create(Atmosphere.prototype) as Atmosphere
    const calls: string[] = []
    ;(atmosphere as unknown as { disposed: boolean }).disposed = false
    ;(atmosphere as unknown as { weather: string }).weather = 'clear'
    ;(atmosphere as unknown as { dirty: boolean }).dirty = false
    ;(atmosphere as unknown as { weatherDirector: { setWeather(id: string, instant: boolean): void } }).weatherDirector = {
      setWeather(id, instant) {
        calls.push(`${id}:${instant}`)
      },
    }

    atmosphere.setWeather('invalid' as never, true)

    expect(atmosphere.weather).toBe('clear')
    expect(calls).toEqual(['clear:true'])
    expect((atmosphere as unknown as { dirty: boolean }).dirty).toBe(true)
  })

  it('reuses a clean weather snapshot until the director changes', () => {
    const atmosphere = Object.create(Atmosphere.prototype) as Atmosphere
    let calls = 0
    const state = {} as WeatherSnapshot
    const director = {
      snapshotInto(out: typeof state) {
        calls += 1
        out.rain = calls
        return out
      },
    }
    ;(atmosphere as unknown as { disposed: boolean }).disposed = false
    ;(atmosphere as unknown as { weatherSnapshotDirty: boolean }).weatherSnapshotDirty = true
    ;(atmosphere as unknown as { weatherState: typeof state }).weatherState = state
    ;(atmosphere as unknown as { weatherDirector: typeof director }).weatherDirector = director

    const first = atmosphere.weatherSnapshot
    const second = atmosphere.weatherSnapshot

    expect(first).toBe(state)
    expect(second).toBe(first)
    expect(second.rain).toBe(1)
    expect(calls).toBe(1)
  })
})
