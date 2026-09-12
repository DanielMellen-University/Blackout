import { describe, expect, it } from 'vitest'
import { rainLateralVelocity } from '../src/world/Atmosphere'
import { weatherEffectsChanged, type WeatherEffectState } from '../src/world/World'

const base: WeatherEffectState = {
  rain: .2,
  snow: 0,
  windX: 4,
  windZ: -2,
  cloudCover: .6,
  daylight: .8,
}

describe('world weather propagation', () => {
  it('keeps pooled rain drift finite without per-frame trigonometry', () => {
    expect(rainLateralVelocity(1, 4, 1)).toBeCloseTo(4.52)
    expect(rainLateralVelocity(-1, -2, 0.5)).toBeCloseTo(-2.26)
    expect(rainLateralVelocity(Number.NaN, Number.NaN, Number.NaN)).toBe(0)
  })

  it('applies the first snapshot and meaningful transitions', () => {
    expect(weatherEffectsChanged(null, base)).toBe(true)
    expect(weatherEffectsChanged(base, { ...base, rain: .202 })).toBe(true)
  })

  it('ignores sub-epsilon drift', () => {
    expect(weatherEffectsChanged(base, { ...base, windX: 4.0002 })).toBe(false)
    expect(weatherEffectsChanged(base, { ...base, daylight: .8004 })).toBe(false)
  })
})
