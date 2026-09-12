import { describe, expect, it } from 'vitest'
import {
  afterburnerHeatIntensity,
  canopyTintIntensity,
  formatHeading,
  formatHudNumber,
  formatVerticalSpeed,
  gateProximityHudActive,
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

  it('formats climb and sink rates with a readable sign', () => {
    expect(formatVerticalSpeed(12.4)).toBe('+12')
    expect(formatVerticalSpeed(-3.6)).toBe('-4')
    expect(formatVerticalSpeed(0.2)).toBe('0')
    expect(formatVerticalSpeed(Number.NaN)).toBe('0')
  })

  it('wraps aircraft heading into a compact compass readout', () => {
    expect(formatHeading(0)).toBe('000°')
    expect(formatHeading(Math.PI / 2)).toBe('090°')
    expect(formatHeading(-Math.PI / 2)).toBe('270°')
    expect(formatHeading(2 * Math.PI)).toBe('000°')
    expect(formatHeading(Number.NaN)).toBe('000°')
  })

  it('keeps gear transition emphasis inside its short timing window', () => {
    expect(gearTransitionActive(100, 700)).toBe(true)
    expect(gearTransitionActive(700, 700)).toBe(false)
    expect(gearTransitionActive(800, 700)).toBe(false)
    expect(gearTransitionActive(Number.NaN, 700)).toBe(false)
  })

  it('limits canopy tint to cockpit view and high IAS', () => {
    expect(canopyTintIntensity(2400, false)).toBe(0)
    expect(canopyTintIntensity(400, true)).toBe(0)
    expect(canopyTintIntensity(1800, true)).toBeGreaterThan(0)
    expect(canopyTintIntensity(3000, true)).toBeCloseTo(0.28)
    expect(canopyTintIntensity(5000, true)).toBeCloseTo(0.28)
  })

  it('keeps afterburner heat veil soft and boost-only', () => {
    expect(afterburnerHeatIntensity(2400, false)).toBe(0)
    expect(afterburnerHeatIntensity(0, true)).toBeCloseTo(0.06)
    expect(afterburnerHeatIntensity(1500, true)).toBeCloseTo(0.11)
    expect(afterburnerHeatIntensity(3000, true)).toBeCloseTo(0.16)
    expect(afterburnerHeatIntensity(5000, true)).toBeCloseTo(0.16)
  })

  it('marks the nav cue near the active gate only inside the soft window', () => {
    expect(gateProximityHudActive(0)).toBe(false)
    expect(gateProximityHudActive(180)).toBe(true)
    expect(gateProximityHudActive(220)).toBe(true)
    expect(gateProximityHudActive(221)).toBe(false)
    expect(gateProximityHudActive(Number.NaN)).toBe(false)
  })
})
