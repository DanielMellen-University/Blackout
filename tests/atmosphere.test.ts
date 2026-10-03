import { describe, expect, it } from 'vitest'
import {
  atmosphereNeedsUpdate,
  cloudImmersionBand,
  cloudDistanceFade,
  cloudPuffBudget,
  cloudPuffCount,
  createCloudLayoutRandom,
  fogHorizonReadability,
  lightningCooldown,
  lightningFlashEnvelope,
} from '../src/world/Atmosphere'
import { FOG_FAR, STREAM_RADIUS_M } from '../src/world/TerrainSystem'
import { nightWeatherReadability, sceneExposure } from '../src/core/SceneExposure'

describe('lightning comfort', () => {
  it('turns cloud density into calm, bounded immersion bands', () => {
    expect(cloudImmersionBand(Number.NaN)).toBe('clear')
    expect(cloudImmersionBand(0)).toBe('clear')
    expect(cloudImmersionBand(0.3)).toBe('edge')
    expect(cloudImmersionBand(1)).toBe('inside')
    expect(cloudImmersionBand(-4)).toBe('clear')
  })

  it('skips cloud fade roots at full and out-of-range bounds', () => {
    const full = (FOG_FAR * 0.5) ** 2
    const out = STREAM_RADIUS_M ** 2
    const originalSqrt = Math.sqrt
    let sqrtCalls = 0
    Math.sqrt = ((value: number) => {
      sqrtCalls++
      return originalSqrt(value)
    }) as typeof Math.sqrt
    try {
      expect(cloudDistanceFade(0)).toBe(1)
      expect(cloudDistanceFade(full)).toBe(1)
      expect(cloudDistanceFade(out)).toBe(0)
      expect(cloudDistanceFade(out * 2)).toBe(0)
      expect(sqrtCalls).toBe(0)
    } finally {
      Math.sqrt = originalSqrt
    }
    expect(cloudDistanceFade((FOG_FAR * .75) ** 2)).toBeGreaterThan(0)
    expect(cloudDistanceFade((FOG_FAR * .75) ** 2)).toBeLessThan(1)
  })

  it('keeps cloud layout streams stable for replayable skies', () => {
    const first = createCloudLayoutRandom(0x434c4f55)
    const second = createCloudLayoutRandom(0x434c4f55)
    const alternate = createCloudLayoutRandom(0x12345678)
    const firstValues = Array.from({ length: 8 }, () => first())
    const secondValues = Array.from({ length: 8 }, () => second())
    const alternateValues = Array.from({ length: 8 }, () => alternate())

    expect(secondValues).toEqual(firstValues)
    expect(alternateValues).not.toEqual(firstValues)
    expect(firstValues.every((value) => value >= 0 && value < 1)).toBe(true)
  })

  it('uses a capped, eased single-flash envelope', () => {
    const peak = 0.44

    expect(lightningFlashEnvelope(0, peak)).toBe(0)
    expect(lightningFlashEnvelope(0.03, peak)).toBeGreaterThan(0)
    expect(lightningFlashEnvelope(0.03, peak)).toBeLessThan(peak * 0.3)
    expect(lightningFlashEnvelope(0.1, peak)).toBeCloseTo(peak)
    expect(lightningFlashEnvelope(0.35, peak)).toBeGreaterThan(0)
    expect(lightningFlashEnvelope(0.35, peak)).toBeLessThan(peak)
    expect(lightningFlashEnvelope(0.6, peak)).toBe(0)
    expect(lightningFlashEnvelope(0.1, 1)).toBeCloseTo(peak)
  })

  it('keeps mature-storm lightning infrequent', () => {
    expect(lightningCooldown(1, 0)).toBeGreaterThanOrEqual(8)
    expect(lightningCooldown(1, 1)).toBeLessThanOrEqual(17)
    expect(lightningCooldown(0.35, 0.5)).toBeGreaterThan(lightningCooldown(1, 0.5))
  })

  it('skips a frozen frame only when the world anchor is unchanged', () => {
    const anchor = { x: 10, y: 20, z: 30 }
    expect(atmosphereNeedsUpdate(0, 0, 10, 20, 30, anchor)).toBe(false)
    expect(atmosphereNeedsUpdate(0, 0, 10, 20, 31, anchor)).toBe(true)
    expect(atmosphereNeedsUpdate(0, 0, 10, 20, 30, null)).toBe(true)
    expect(atmosphereNeedsUpdate(0, 1 / 120, 10, 20, 30, anchor)).toBe(true)
  })

  it('treats malformed frame timing and anchors as a frozen, unchanged frame', () => {
    const anchor = { x: 10, y: 20, z: 30 }
    expect(atmosphereNeedsUpdate(Number.NaN, Number.NaN, Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, anchor)).toBe(false)
    expect(atmosphereNeedsUpdate(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 10, 20, 30, anchor)).toBe(false)
  })

  it('keeps cloud draw budgets bounded and nonzero', () => {
    expect(cloudPuffCount(100, 0.5)).toBe(50)
    expect(cloudPuffCount(100, 1.4)).toBe(100)
    expect(cloudPuffCount(100, 0)).toBe(1)
    expect(cloudPuffCount(0, 0.5)).toBe(0)
    expect(cloudPuffBudget(42, 0.65, [12, 26, 42])).toBe(26)
    expect(cloudPuffBudget(42, 0, [12, 26, 42])).toBe(12)
  })

  it('keeps scene exposure continuous and bounded across day/night values', () => {
    expect(sceneExposure(0)).toBeCloseTo(0.95)
    expect(sceneExposure(0.5)).toBeCloseTo(1.05)
    expect(sceneExposure(1)).toBeCloseTo(1.15)
    expect(sceneExposure(Number.NaN, Number.NaN)).toBeCloseTo(0.95)
    expect(sceneExposure(2, 2)).toBeCloseTo(2.5)
  })

  it('adds a bounded readability lift only for night weather', () => {
    expect(nightWeatherReadability(1, 1, 1)).toBe(0)
    expect(nightWeatherReadability(0, 0, 0)).toBe(0)
    expect(nightWeatherReadability(0, 1, 1)).toBeCloseTo(0.9)
    expect(nightWeatherReadability(Number.NaN, Number.NaN, Number.NaN)).toBe(0)
    expect(sceneExposure(0, 0, 0.9)).toBeCloseTo(1.202)
    expect(sceneExposure(1, 0, 1)).toBeCloseTo(1.15)
    expect(fogHorizonReadability(0, 1, 1)).toBeCloseTo(0.9)
    expect(fogHorizonReadability(1, 1, 1)).toBe(0)
  })
})
