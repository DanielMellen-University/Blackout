import { describe, expect, it } from 'vitest'
import {
  defaultRenderQuality,
  normalizeRenderQuality,
  readRenderQuality,
  renderQualityProfile,
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
    expect(low.shadows).toBe(false)
    expect(balanced.shadows).toBe(true)
    expect(low.precipitationScale).toBeLessThan(balanced.precipitationScale)
    expect(balanced.precipitationScale).toBeLessThan(high.precipitationScale)
    expect(low.cloudScale).toBeLessThan(balanced.cloudScale)
    expect(balanced.cloudScale).toBeLessThan(high.cloudScale)
  })
})
