import { describe, expect, it } from 'vitest'
import {
  defaultRenderQuality,
  normalizeRenderQuality,
  readRenderQuality,
  renderQualityProfile,
  shadowUpdateDue,
  writeRenderQuality,
} from '../src/core/RenderQuality'

describe('render quality preferences', () => {
  it('selects a conservative preset for small devices', () => {
    expect(defaultRenderQuality({ hardwareConcurrency: 4, deviceMemory: 8 })).toBe('low')
    expect(defaultRenderQuality({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe('balanced')
  })

  it('normalizes invalid saved values', () => {
    expect(normalizeRenderQuality('high')).toBe('high')
    expect(normalizeRenderQuality('ultra')).toBe('balanced')
    expect(normalizeRenderQuality(null, 'low')).toBe('low')
  })

  it('round-trips a preference through storage', () => {
    let value: string | null = null
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next },
    }
    writeRenderQuality(storage, 'high')
    expect(readRenderQuality(storage)).toBe('high')
  })

  it('keeps low quality below the balanced pixel and shadow budget', () => {
    const low = renderQualityProfile('low')
    const balanced = renderQualityProfile('balanced')
    const high = renderQualityProfile('high')
    expect(low.maxPixelRatio).toBeLessThan(balanced.maxPixelRatio)
    expect(low.antialias).toBe(false)
    expect(balanced.antialias).toBe(true)
    expect(high.antialias).toBe(true)
    expect(low.shadows).toBe(false)
    expect(balanced.shadows).toBe(true)
    expect(low.shadowMapSize).toBeLessThan(balanced.shadowMapSize)
    expect(balanced.shadowMapSize).toBeLessThan(high.shadowMapSize)
    expect(low.uiBackdropBlur).toBe(false)
    expect(balanced.uiBackdropBlur).toBe(true)
    expect(high.uiBackdropBlur).toBe(true)
    expect(low.precipitationScale).toBeLessThan(balanced.precipitationScale)
    expect(balanced.precipitationScale).toBeLessThan(high.precipitationScale)
    expect(low.cloudScale).toBeLessThan(balanced.cloudScale)
    expect(balanced.cloudScale).toBeLessThan(high.cloudScale)
    expect(low.vegetationScale).toBeLessThan(balanced.vegetationScale)
    expect(balanced.vegetationScale).toBeLessThan(high.vegetationScale)
  })

  it('refreshes the directional shadow map on a bounded cadence', () => {
    expect(shadowUpdateDue(0.04, 0.01, 0.05)).toBe(true)
    expect(shadowUpdateDue(0.02, 0.01, 0.05)).toBe(false)
    expect(shadowUpdateDue(Number.NaN, 0.1, 0.05)).toBe(false)
    expect(shadowUpdateDue(0, 1, 0)).toBe(false)
  })
})
