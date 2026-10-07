import { describe, expect, it, vi } from 'vitest'
import {
  landingGlideCue, papiLightPattern, RUNWAY_PAPI_X, RUNWAY_PAPI_Z,
  runwayGlideCue, writeRunwayApproach, type RunwayApproach,
} from '../src/core/RunwayGuidance'

const approach = (): RunwayApproach => ({ height: 0, distance: 0, inApproach: false })
const origin = { x: 0, y: 0, z: 0 }

describe('shared runway guidance', () => {
  it.each([
    [1, 0, 'low'], [2, 1, 'low'], [2.75, 2, 'on-slope'], [3.2, 3, 'high'], [5.7, 4, 'high'],
  ] as const)('agrees with the %s degree PAPI pattern', (degrees, white, cue) => {
    const height = Math.tan(degrees * Math.PI / 180) * 1000
    expect(papiLightPattern(height, 1000)).toBe(white)
    expect(runwayGlideCue(height, 1000)).toBe(cue)
  })

  it.each([1.8, 2.5, 3, 3.5])('keeps both sides of the %s degree boundary consistent', degrees => {
    for (const delta of [-.00001, .00001]) {
      const height = Math.tan((degrees + delta) * Math.PI / 180) * 200
      const pattern = papiLightPattern(height, 200)
      expect(runwayGlideCue(height, 200)).toBe(pattern > 2 ? 'high' : pattern < 2 ? 'low' : 'on-slope')
    }
  })

  it.each([0, Math.PI / 2, -Math.PI / 3, Math.PI])('resolves translated, elevated pads at yaw %s', yaw => {
    const runway = { x: 300, y: 700, z: -200 }
    const localX = RUNWAY_PAPI_X + 20
    const localZ = RUNWAY_PAPI_Z - 500
    const aircraft = {
      x: runway.x + Math.cos(yaw) * localX + Math.sin(yaw) * localZ,
      y: runway.y + 25,
      z: runway.z - Math.sin(yaw) * localX + Math.cos(yaw) * localZ,
    }
    const out = approach()
    writeRunwayApproach(out, aircraft, runway, yaw)
    expect(out.inApproach).toBe(true)
    expect(out.height).toBeCloseTo(25)
    expect(out.distance).toBeCloseTo(Math.hypot(500, 20))
    expect(landingGlideCue(out, yaw + 2 * Math.PI, Math.sin(yaw) * 50, Math.cos(yaw) * 50, yaw, false)).toBe('on-slope')
  })

  it.each([
    [8, 0], [1200, 0], [100, 100], [100, -100], [-50, 0], [5000, 0],
  ])('rejects corridor boundary/outside along %s lateral %s without a root', (along, lateral) => {
    const out = { height: 99, distance: 99, inApproach: true }
    const hypot = vi.spyOn(Math, 'hypot')
    try {
      writeRunwayApproach(out, { x: RUNWAY_PAPI_X + lateral, y: 25, z: RUNWAY_PAPI_Z - along }, origin, 0)
      expect(out).toEqual(approach())
      expect(hypot).not.toHaveBeenCalled()
    } finally { hypot.mockRestore() }
  })

  it('uses horizontal distance to PAPI, not 3D distance to the elevated spawn', () => {
    const out = approach()
    writeRunwayApproach(out, { x: 0, y: 26, z: -538 }, { x: 0, y: .05, z: 0 }, 0)
    expect(out.height).toBeCloseTo(25.95)
    expect(out.distance).toBeCloseTo(Math.hypot(500, 13.5))
    expect(runwayGlideCue(out.height, out.distance)).toBe('on-slope')
  })

  it('suppresses departing, crossing, backwards, stopped and grounded cues', () => {
    const out = { height: 25, distance: 500, inApproach: true }
    expect(landingGlideCue(out, 0, 0, 50, 0, false)).toBe('on-slope')
    expect(landingGlideCue(out, 0, 0, -50, 0, false)).toBeNull()
    expect(landingGlideCue(out, Math.PI / 2, 50, 0, 0, false)).toBeNull()
    expect(landingGlideCue(out, Math.PI, 0, 50, 0, false)).toBeNull()
    expect(landingGlideCue(out, 0, 0, 0, 0, false)).toBeNull()
    expect(landingGlideCue(out, 0, 0, 50, 0, true)).toBeNull()
    expect(landingGlideCue({ ...out, inApproach: false }, 0, 0, 50, 0, false)).toBeNull()
  })

  it('fails closed for invalid coordinates, overflow, angles and velocities', () => {
    const out = { height: 25, distance: 500, inApproach: true }
    for (const invalid of [NaN, Infinity, -Infinity]) {
      Object.assign(out, { height: 25, distance: 500, inApproach: true })
      expect(papiLightPattern(invalid, 500)).toBe(2)
      expect(runwayGlideCue(invalid, 500)).toBeNull()
      expect(runwayGlideCue(25, invalid)).toBeNull()
      expect(landingGlideCue(out, invalid, 0, 50, 0, false)).toBeNull()
      expect(landingGlideCue(out, 0, invalid, 50, 0, false)).toBeNull()
      expect(landingGlideCue(out, 0, 0, invalid, 0, false)).toBeNull()
      expect(landingGlideCue(out, 0, 0, 50, invalid, false)).toBeNull()
      for (const key of ['x', 'y', 'z'] as const) {
        writeRunwayApproach(out, { x: 0, y: 25, z: -538, [key]: invalid }, origin, 0)
        expect(out).toEqual(approach())
        writeRunwayApproach(out, { x: 0, y: 25, z: -538 }, { ...origin, [key]: invalid }, 0)
        expect(out).toEqual(approach())
      }
      writeRunwayApproach(out, { x: 0, y: 25, z: -538 }, origin, invalid)
      expect(out).toEqual(approach())
    }
    writeRunwayApproach(out, { x: Number.MAX_VALUE, y: 25, z: -538 }, { x: -Number.MAX_VALUE, y: 0, z: 0 }, 0)
    expect(out).toEqual(approach())
    Object.assign(out, { height: 25, distance: 500, inApproach: true })
    expect(landingGlideCue(out, Number.MAX_VALUE, 0, 50, -Number.MAX_VALUE, false)).toBeNull()
  })
})
