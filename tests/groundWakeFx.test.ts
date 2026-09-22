import { Scene, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  GROUND_WAKE_MAX_ALTITUDE_M,
  GROUND_WAKE_MIN_SPEED_MPS,
  GroundWakeFx,
  groundWakeActive,
  groundWakeIntensity,
  groundWakeTint,
} from '../src/systems/GroundWakeFx'

describe('ground wake effect', () => {
  it('ramps through a bounded fast low-pass envelope', () => {
    expect(groundWakeIntensity(Number.NaN, 20)).toBe(0)
    expect(groundWakeIntensity(GROUND_WAKE_MIN_SPEED_MPS - 1, 20)).toBe(0)
    expect(groundWakeIntensity(360, GROUND_WAKE_MAX_ALTITUDE_M)).toBeGreaterThan(0)
    expect(groundWakeIntensity(9999, 0)).toBeLessThanOrEqual(1)
  })

  it('requires an airborne external land pass', () => {
    expect(groundWakeActive(false, false, 180, 40)).toBe(true)
    expect(groundWakeActive(true, false, 180, 40)).toBe(false)
    expect(groundWakeActive(false, true, 180, 40)).toBe(false)
    expect(groundWakeActive(false, false, 30, 40)).toBe(false)
  })

  it('keeps weather tint finite and visibly distinct', () => {
    expect(groundWakeTint(0, 0)).toBe(0xb6a17e)
    expect(groundWakeTint(1, 0)).not.toBe(groundWakeTint(0, 0))
    expect(groundWakeTint(0, 1)).not.toBe(groundWakeTint(0, 0))
    expect(groundWakeTint(Number.NaN, Number.NaN)).toBe(0xb6a17e)
  })

  it('keeps one pooled batch across motion and disposal', () => {
    const scene = new Scene()
    const fx = new GroundWakeFx(scene)
    const position = new Vector3(5, 80, -4)
    const velocity = new Vector3(0, 0, 180)
    fx.setRenderQuality('high')
    fx.setWeather(0.8, 0)
    fx.update(position, velocity, 40, false, false, true)
    expect(fx.isActive).toBe(true)
    expect(fx.root.visible).toBe(true)
    expect(scene.children).toHaveLength(1)
    fx.setReducedMotion(true)
    expect(fx.isActive).toBe(false)
    expect(fx.root.visible).toBe(false)
    fx.setRenderQuality('low')
    fx.update(position, velocity, 40, false, false, true)
    expect(fx.isActive).toBe(false)
    fx.dispose()
    expect(scene.children).toHaveLength(0)
  })

  it('ignores malformed velocity vectors without throwing', () => {
    const fx = new GroundWakeFx(new Scene())
    expect(() => fx.update(new Vector3(), new Vector3(Number.NaN, 0, 10), 40, false, false, true)).not.toThrow()
    fx.dispose()
  })
})
