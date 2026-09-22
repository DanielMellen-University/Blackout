import { describe, expect, it } from 'vitest'
import { Scene, Vector3 } from 'three'
import {
  WATER_WAKE_MAX_ALTITUDE_M,
  WaterWakeFx,
  waterWakeActive,
  waterWakeIntensity,
  waterWakeTint,
} from '../src/systems/WaterWakeFx'

describe('water skim wake presentation', () => {
  it('keeps wake intensity finite and altitude bounded', () => {
    expect(waterWakeIntensity(Number.NaN, 40)).toBe(0)
    expect(waterWakeIntensity(20, 40)).toBe(0)
    expect(waterWakeIntensity(240, WATER_WAKE_MAX_ALTITUDE_M + 1)).toBe(0)
    expect(waterWakeIntensity(280, 40)).toBeGreaterThan(0)
    expect(waterWakeIntensity(9_000, 0)).toBeLessThanOrEqual(1)
    expect(waterWakeActive(true, false, 280, 40)).toBe(true)
    expect(waterWakeActive(false, false, 280, 40)).toBe(false)
    expect(waterWakeActive(true, true, 280, 40)).toBe(false)
  })

  it('uses one pooled instanced strip batch and resets safely', () => {
    const scene = new Scene()
    const fx = new WaterWakeFx(scene)
    const position = new Vector3(4, 80, 6)
    const velocity = new Vector3(0, 0, 280)
    fx.update(1 / 60, position, velocity, 40, true, false)
    expect(fx.isActive).toBe(true)
    expect(fx.root.visible).toBe(true)
    expect(fx.root.getObjectByName('WaterWakeStrips')).toBeTruthy()
    fx.setRenderQuality('low')
    expect(fx.isActive).toBe(false)
    fx.setRenderQuality('high')
    fx.update(1 / 60, position, velocity, 40, true, false)
    expect(fx.isActive).toBe(true)
    fx.reset()
    expect(fx.root.visible).toBe(false)
    fx.dispose()
    expect(() => fx.update(1 / 60, position, velocity, 40, true, false)).not.toThrow()
  })

  it('keeps foam tint finite across clear, rain, and snow fronts', () => {
    expect(waterWakeTint(0, 0)).toBe(0xc3e9f0)
    expect(waterWakeTint(1, 0)).not.toBe(waterWakeTint(0, 0))
    expect(waterWakeTint(0, 1)).not.toBe(waterWakeTint(0, 0))
    expect(waterWakeTint(Number.NaN, Number.NaN)).toBe(0xc3e9f0)
    const fx = new WaterWakeFx(new Scene())
    expect(() => fx.setWeather(0.7, 0.1)).not.toThrow()
    fx.dispose()
  })
})
