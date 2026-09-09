import { describe, expect, it } from 'vitest'
import {
  formatHudNumber,
  gearTransitionActive,
  quantizeHudNumber,
  speedJuiceIntensity,
} from '../src/ui/HUD'

describe('HUD value formatting', () => {
  it('removes float noise at a bounded visual precision', () => {
    expect(quantizeHudNumber(0.12349, 100)).toBe(0.12)
    expect(quantizeHudNumber(0.12501, 100)).toBe(0.13)
    expect(formatHudNumber(0.99994, 1000)).toBe('1')
  })

  it('returns a safe zero for invalid precision or values', () => {
    expect(quantizeHudNumber(Number.NaN, 100)).toBe(0)
    expect(quantizeHudNumber(3, 0)).toBe(0)
    expect(formatHudNumber(Infinity, 100)).toBe('0')
  })

  it('keeps high-speed edge juice restrained and bounded', () => {
    expect(speedJuiceIntensity(0)).toBe(0)
    expect(speedJuiceIntensity(500)).toBe(0)
    expect(speedJuiceIntensity(1800)).toBeGreaterThan(0)
    expect(speedJuiceIntensity(3000)).toBeCloseTo(.42)
    expect(speedJuiceIntensity(5000)).toBeCloseTo(.42)
  })

  it('keeps gear transition emphasis inside its short timing window', () => {
    expect(gearTransitionActive(100, 700)).toBe(true)
    expect(gearTransitionActive(700, 700)).toBe(false)
    expect(gearTransitionActive(800, 700)).toBe(false)
    expect(gearTransitionActive(Number.NaN, 700)).toBe(false)
  })
})
