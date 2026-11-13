import { describe, expect, it } from 'vitest'
import {
  createRegionalWeatherSample,
  populateWeatherStructure,
} from '../src/world/RegionalWeather'

describe('weather structure envelope edges', () => {
  it('floors the cloud base at 300 m and keeps the top above it', () => {
    const out = createRegionalWeatherSample()
    populateWeatherStructure(out, 100)
    expect(out.cloudBase).toBe(300)
    expect(out.precipitationBase).toBe(out.cloudBase)
    expect(out.cloudTop).toBeGreaterThan(out.cloudBase)
  })

  it('keeps the cloud top above the base for a high base too', () => {
    const out = createRegionalWeatherSample()
    populateWeatherStructure(out, 5000)
    expect(out.cloudBase).toBe(5000)
    expect(out.cloudTop).toBeGreaterThan(5000)
  })

  it('clamps negative convection to zero instead of lowering the cloud top', () => {
    const out = createRegionalWeatherSample()
    out.lightning = -0.5
    populateWeatherStructure(out)
    expect(out.convection).toBe(0)
    expect(out.cloudTop).toBe(out.cloudBase + 650 + out.midClouds * 850)
  })

  it('keeps a playable visibility floor under heavy snow and fog', () => {
    const out = createRegionalWeatherSample()
    out.snow = 1
    out.haze = 1
    out.fogFarMul = 1
    populateWeatherStructure(out)
    expect(out.visibilityM).toBeGreaterThanOrEqual(2600)
    expect(Number.isFinite(out.visibilityM)).toBe(true)
  })
})
