import { describe, expect, it } from 'vitest'
import { nightWeatherReadability, sceneExposure } from '../src/core/SceneExposure'

describe('scene exposure', () => {
  it('lifts only dark stormy nights for readability', () => {
    expect(nightWeatherReadability(1, 1, 1)).toBe(0)
    expect(nightWeatherReadability(0, 0, 0)).toBe(0)
    expect(nightWeatherReadability(0, 1, 0)).toBeCloseTo(0.55)
    expect(nightWeatherReadability(0, 0, 1)).toBeCloseTo(0.35)
    expect(nightWeatherReadability(0, 1, 1)).toBeCloseTo(0.9)
    expect(nightWeatherReadability(0.5, 1, 1)).toBeCloseTo(0.45)
  })

  it('clamps out-of-range weather inputs instead of overshooting the lift', () => {
    expect(nightWeatherReadability(0, 2, 2)).toBeCloseTo(0.9)
    expect(nightWeatherReadability(-1, -1, -1)).toBe(0)
    expect(nightWeatherReadability(Number.NaN, 1, 0)).toBeCloseTo(0.55)
    expect(nightWeatherReadability(0, Number.NaN, Number.NaN)).toBe(0)
  })

  it('keeps the authored deep-night base and adds bounded daylight, bloom and readability', () => {
    expect(sceneExposure(0, 0, 0)).toBeCloseTo(0.95)
    expect(sceneExposure(1, 0, 0)).toBeCloseTo(1.15)
    expect(sceneExposure(0.5, 0, 0)).toBeCloseTo(1.05)
    expect(sceneExposure(0, 1, 0)).toBeCloseTo(2.3)
    expect(sceneExposure(0, 0, 1)).toBeCloseTo(1.23)
    expect(sceneExposure(1, 0, 1)).toBeCloseTo(1.15)
  })

  it('clamps malformed exposure inputs to the safe base instead of NaN', () => {
    expect(sceneExposure(Number.NaN, Number.NaN, Number.NaN)).toBeCloseTo(0.95)
    expect(sceneExposure(2, 2, 2)).toBeCloseTo(2.5)
    expect(sceneExposure(-1, -1, -1)).toBeCloseTo(0.95)
  })
})
