import { describe, expect, it } from 'vitest'
import {
  afterburnerHeatIntensity,
  canopyTintIntensity,
  formatAudioState,
  formatGForce,
  formatHeading,
  formatHudNumber,
  formatVerticalSpeed,
  gateProximityHudActive,
  gearTransitionActive,
  gForceTone,
  headingTapeLabel,
  headingTapeOffset,
  normalizeBannerTone,
  quantizeHudNumber,
  safeHudValue,
  speedWarningLevel,
  speedJuiceIntensity,
  speedNeedleKts,
  verticalSpeedTone,
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

  it('keeps malformed live telemetry finite', () => {
    expect(safeHudValue(4.5)).toBe(4.5)
    expect(safeHudValue(Number.NaN)).toBe(0)
    expect(safeHudValue(Number.POSITIVE_INFINITY, -1)).toBe(-1)
  })

  it('keeps high-speed edge juice restrained and bounded', () => {
    expect(speedJuiceIntensity(0)).toBe(0)
    expect(speedJuiceIntensity(500)).toBe(0)
    expect(speedJuiceIntensity(1800)).toBeGreaterThan(0)
    expect(speedJuiceIntensity(3000)).toBeCloseTo(.42)
    expect(speedJuiceIntensity(5000)).toBeCloseTo(.42)
  })

  it('marks the airspeed redline without hiding true overspeed', () => {
    expect(speedWarningLevel(2800)).toBe('normal')
    expect(speedWarningLevel(2820)).toBe('redline')
    expect(speedWarningLevel(3000)).toBe('redline')
    expect(speedWarningLevel(3000.1)).toBe('overspeed')
    expect(speedWarningLevel(Number.NaN)).toBe('normal')
  })

  it('coalesces the speed needle to the displayed knot resolution', () => {
    expect(speedNeedleKts(1200.49)).toBe(1200)
    expect(speedNeedleKts(1200.5)).toBe(1201)
    expect(speedNeedleKts(-12)).toBe(0)
    expect(speedNeedleKts(Number.NaN)).toBe(0)
  })

  it('formats climb and sink rates with a readable sign', () => {
    expect(formatVerticalSpeed(12.4)).toBe('+12')
    expect(formatVerticalSpeed(-3.6)).toBe('-4')
    expect(formatVerticalSpeed(0.2)).toBe('0')
    expect(formatVerticalSpeed(Number.NaN)).toBe('0')
  })

  it('formats bounded fighter G-load cues with distinct stress tones', () => {
    expect(formatGForce(1)).toBe('+1.0G')
    expect(formatGForce(-0.45)).toBe('-0.5G')
    expect(formatGForce(Number.NaN)).toBe('+1.0G')
    expect(gForceTone(3.9)).toBe('normal')
    expect(gForceTone(4)).toBe('high')
    expect(gForceTone(-0.1)).toBe('negative')
  })

  it('keeps vertical-speed color changes inside a deadband', () => {
    expect(verticalSpeedTone(2.01)).toBe('climb')
    expect(verticalSpeedTone(-2.01)).toBe('sink')
    expect(verticalSpeedTone(2)).toBe('level')
    expect(verticalSpeedTone(-2)).toBe('level')
    expect(verticalSpeedTone(Number.NaN)).toBe('level')
  })

  it('wraps aircraft heading into a compact compass readout', () => {
    expect(formatHeading(0)).toBe('000°')
    expect(formatHeading(Math.PI / 2)).toBe('090°')
    expect(formatHeading(-Math.PI / 2)).toBe('270°')
    expect(formatHeading(2 * Math.PI)).toBe('000°')
    expect(formatHeading(Number.NaN)).toBe('000°')
  })

  it('keeps the wrapped heading tape centered across north', () => {
    expect(headingTapeOffset(0, 56)).toBeCloseTo(1372)
    expect(headingTapeOffset(Math.PI / 2, 56)).toBeCloseTo(1708)
    expect(headingTapeOffset(-Math.PI / 2, 56)).toBeCloseTo(2380)
    expect(headingTapeLabel(0)).toBe('N')
    expect(headingTapeLabel(90)).toBe('E')
    expect(headingTapeLabel(360)).toBe('N')
    expect(headingTapeLabel(-30)).toBe('330')
  })

  it('keeps the audio state label compact', () => {
    expect(formatAudioState(false)).toBe('LIVE')
    expect(formatAudioState(true)).toBe('MUTE')
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

  it('normalizes banner tones to the supported visual states', () => {
    expect(normalizeBannerTone('success')).toBe('success')
    expect(normalizeBannerTone('danger')).toBe('danger')
    expect(normalizeBannerTone('warning')).toBe('info')
    expect(normalizeBannerTone(null)).toBe('info')
  })
})
