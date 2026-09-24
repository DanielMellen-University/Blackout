import { describe, expect, it } from 'vitest'
import {
  STORM_AIRFRAME_RAD,
  STORM_CAMERA_TRAVEL_M,
  STORM_COCKPIT_SCALE,
  STORM_EXTERNAL_SCALE,
  STORM_GUST_ENTER,
  STORM_LOW_QUALITY_SCALE,
  STORM_PRECIP_ENTER,
  stormAirframeWobble,
  stormBuffetAllowed,
  stormBuffetDrive,
  stormBuffetIntensity,
  stormBuffetOffset,
  stormBuffetOffsetInto,
  stormBuffetViewScale,
} from '../src/systems/StormBuffet'

describe('storm buffet gating', () => {
  it('stays quiet below meaningful precip and strong-gust floors', () => {
    expect(stormBuffetIntensity(0, 0, 0)).toBe(0)
    expect(stormBuffetIntensity(STORM_PRECIP_ENTER - 0.01, 0, 0)).toBe(0)
    expect(stormBuffetIntensity(0, STORM_PRECIP_ENTER - 0.01, 0)).toBe(0)
    expect(stormBuffetIntensity(0, 0, STORM_GUST_ENTER - 0.01)).toBe(0)
    expect(stormBuffetIntensity(0.2, 0.2, 0.4)).toBe(0)
  })

  it('engages for meaningful rain, snow, or strong gusts', () => {
    expect(stormBuffetIntensity(0.76, 0, 0.38)).toBeGreaterThan(0.35)
    expect(stormBuffetIntensity(0, 0.66, 0.3)).toBeGreaterThan(0.25)
    expect(stormBuffetIntensity(0, 0, 0.85)).toBeGreaterThan(0.35)
    expect(stormBuffetIntensity(0.55, 0, 0.9)).toBeGreaterThan(
      stormBuffetIntensity(0.55, 0, 0.2),
    )
    expect(stormBuffetIntensity(1, 0, 1)).toBeLessThanOrEqual(1)
  })

  it('fails closed for malformed weather and motion gates', () => {
    expect(stormBuffetIntensity(Number.NaN, Number.POSITIVE_INFINITY, -2)).toBe(0)
    expect(stormBuffetAllowed({ reducedMotion: true })).toBe(false)
    expect(stormBuffetAllowed({ paused: true })).toBe(false)
    expect(stormBuffetAllowed({ playing: false })).toBe(false)
    expect(stormBuffetAllowed({ reducedMotion: false, paused: false, playing: true })).toBe(true)
    expect(stormBuffetDrive(1, 0, 1, { reducedMotion: true })).toBe(0)
    expect(stormBuffetDrive(1, 0, 1, { paused: true })).toBe(0)
    expect(stormBuffetDrive(1, 0, 1, { playing: false })).toBe(0)
    expect(stormBuffetDrive(1, 0, 1, { playing: true })).toBeGreaterThan(0.5)
  })

  it('keeps cockpit slightly stronger and Low graphics cheaper', () => {
    expect(stormBuffetViewScale(false)).toBe(STORM_EXTERNAL_SCALE)
    expect(stormBuffetViewScale(true)).toBe(STORM_COCKPIT_SCALE)
    expect(stormBuffetViewScale(true)).toBeGreaterThan(stormBuffetViewScale(false))
    expect(stormBuffetViewScale(false, true)).toBeCloseTo(STORM_LOW_QUALITY_SCALE)
    expect(stormBuffetViewScale(true, true)).toBeCloseTo(
      STORM_COCKPIT_SCALE * STORM_LOW_QUALITY_SCALE,
    )
  })

  it('fills smooth bounded offsets into caller-owned records', () => {
    const first = stormBuffetOffset(0.8, 1)
    const next = stormBuffetOffset(0.82, 1)
    const target = { x: 0, y: 0, z: 0 }
    expect(Math.abs(first.x)).toBeLessThanOrEqual(STORM_CAMERA_TRAVEL_M + 1e-9)
    expect(Math.abs(first.y)).toBeLessThanOrEqual(STORM_CAMERA_TRAVEL_M * 0.62 + 1e-9)
    expect(Math.abs(first.z)).toBeLessThanOrEqual(STORM_CAMERA_TRAVEL_M * 0.9 + 1e-9)
    expect(Math.hypot(next.x - first.x, next.y - first.y, next.z - first.z)).toBeLessThan(0.01)
    expect(stormBuffetOffsetInto(target, 0.8, 1)).toBe(target)
    expect(target).toEqual(first)
    expect(stormBuffetOffset(0.8, 0)).toEqual({ x: 0, y: 0, z: 0 })
    expect(stormBuffetOffset(Number.NaN, Number.NaN)).toEqual({ x: 0, y: 0, z: 0 })

    const air = stormAirframeWobble(1.1, 1)
    expect(Math.abs(air.x)).toBeLessThanOrEqual(STORM_AIRFRAME_RAD + 1e-9)
    expect(Math.abs(air.y)).toBeLessThanOrEqual(STORM_AIRFRAME_RAD * 0.62 + 1e-9)
    expect(Math.abs(air.z)).toBeLessThanOrEqual(STORM_AIRFRAME_RAD * 0.9 + 1e-9)
  })
})
