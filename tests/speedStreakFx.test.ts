import { Quaternion, Scene, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  SPEED_STREAK_MAX_COUNT,
  SPEED_STREAK_MAX_SPEED_MPS,
  SPEED_STREAK_MIN_SPEED_MPS,
  SpeedStreakFx,
  speedStreakActive,
  speedStreakCount,
  speedStreakIntensity,
} from '../src/systems/SpeedStreakFx'

describe('speed streak effect', () => {
  it('ramps only inside the bounded high-speed envelope', () => {
    expect(speedStreakIntensity(Number.NaN)).toBe(0)
    expect(speedStreakIntensity(SPEED_STREAK_MIN_SPEED_MPS - 1)).toBe(0)
    expect(speedStreakIntensity(SPEED_STREAK_MAX_SPEED_MPS)).toBeGreaterThan(0.8)
    expect(speedStreakIntensity(SPEED_STREAK_MAX_SPEED_MPS * 4, true)).toBeLessThanOrEqual(1)
    expect(speedStreakIntensity(SPEED_STREAK_MIN_SPEED_MPS, true)).toBeGreaterThan(0)
  })

  it('requires an airborne external view', () => {
    expect(speedStreakActive(300, false, false, true)).toBe(true)
    expect(speedStreakActive(300, false, true, true)).toBe(false)
    expect(speedStreakActive(300, false, false, false)).toBe(false)
    expect(speedStreakActive(40, true, false, true)).toBe(false)
  })

  it('keeps the instance pool fixed across quality presets', () => {
    expect(speedStreakCount('low')).toBe(0)
    expect(speedStreakCount('balanced')).toBe(8)
    expect(speedStreakCount('high')).toBe(SPEED_STREAK_MAX_COUNT)
  })

  it('updates and resets one pooled batch without adding scene children', () => {
    const scene = new Scene()
    const fx = new SpeedStreakFx(scene)
    fx.setRenderQuality('high')
    const position = new Vector3(4, 20, -8)
    const orientation = new Quaternion()
    fx.update(position, orientation, 360, true, false, true)
    expect(scene.children).toHaveLength(1)
    expect(fx.count).toBe(SPEED_STREAK_MAX_COUNT)
    expect(fx.isActive).toBe(true)
    expect(fx.root.visible).toBe(true)
    fx.setReducedMotion(true)
    expect(fx.isActive).toBe(false)
    expect(fx.root.visible).toBe(false)
    fx.dispose()
    expect(scene.children).toHaveLength(0)
  })
})
