import { afterEach, describe, expect, it, vi } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import {
  cameraBoostOffset,
  cameraBoostOffsetInto,
  cameraShakeOffset,
  cameraShakeOffsetInto,
  CameraSystem,
  resolveExternalSpeedFraming,
  resolveExternalSpeedFramingInto,
  TOUCHDOWN_IMPULSE,
} from '../src/camera/CameraSystem'
import { CAMERA_MODES } from '../src/core/types'

describe('external camera framing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('toggles only between external and cockpit views', () => {
    expect(CAMERA_MODES).toEqual(['chase', 'cockpit'])
  })

  it('keeps the aircraft readable at maximum speed', () => {
    const framing = resolveExternalSpeedFraming(17, 60, 10, 1)
    expect(framing.distance).toBeCloseTo(19.38)
    expect(framing.fov).toBe(66)
    expect(framing.lookLeadLimit).toBe(10)
  })

  it('clamps invalid speed input into the designed envelope', () => {
    const stopped = resolveExternalSpeedFraming(17, 60, 10, -1)
    const overspeed = resolveExternalSpeedFraming(17, 60, 10, 2)
    expect(stopped).toEqual({ distance: 17, fov: 60, lookLeadLimit: 4.5 })
    expect(overspeed.distance).toBeCloseTo(19.38)
    expect(overspeed.fov).toBe(66)
    expect(overspeed.lookLeadLimit).toBe(10)
  })

  it('fills camera envelopes into caller-owned records', () => {
    const framing = { distance: 0, fov: 0, lookLeadLimit: 0 }
    const shake = { x: 0, y: 0, z: 0 }
    expect(resolveExternalSpeedFramingInto(framing, 17, 60, 10, .75)).toBe(framing)
    expect(framing).toEqual(resolveExternalSpeedFraming(17, 60, 10, .75))
    expect(cameraShakeOffsetInto(shake, .8, 1)).toBe(shake)
    expect(shake).toEqual(cameraShakeOffset(.8, 1))
  })

  it('keeps speed stretch inside the configured zoom envelope', () => {
    const framing = resolveExternalSpeedFraming(32, 60, 10, 1, 32)
    expect(framing.distance).toBe(32)
  })

  it('uses bounded smooth impact shake instead of white-noise offsets', () => {
    const first = cameraShakeOffset(0.8, 1)
    const next = cameraShakeOffset(0.82, 1)
    expect(first.x).toBeGreaterThanOrEqual(-2.4)
    expect(first.x).toBeLessThanOrEqual(2.4)
    expect(first.y).toBeGreaterThanOrEqual(-1.6)
    expect(first.y).toBeLessThanOrEqual(1.6)
    expect(first.z).toBeGreaterThanOrEqual(-2.4)
    expect(first.z).toBeLessThanOrEqual(2.4)
    expect(Math.hypot(next.x - first.x, next.y - first.y, next.z - first.z)).toBeLessThan(.25)
  })

  it('keeps afterburner sway tiny, smooth, and caller-owned', () => {
    const first = cameraBoostOffset(.8, 1)
    const next = cameraBoostOffset(.82, 1)
    const target = { x: 0, y: 0, z: 0 }
    expect(Math.abs(first.x)).toBeLessThanOrEqual(.028)
    expect(Math.abs(first.y)).toBeLessThanOrEqual(.016)
    expect(Math.abs(first.z)).toBeLessThanOrEqual(.035)
    expect(Math.hypot(next.x - first.x, next.y - first.y, next.z - first.z)).toBeLessThan(.01)
    expect(cameraBoostOffsetInto(target, .8, 1)).toBe(target)
    expect(target).toEqual(first)
  })

  it('keeps touchdown feedback below the crash shake envelope', () => {
    expect(TOUCHDOWN_IMPULSE).toBeGreaterThan(0)
    expect(TOUCHDOWN_IMPULSE).toBeLessThanOrEqual(0.2)
  })

  it('suppresses camera shake when reduced motion is enabled', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 15000, 0)
    aircraft.snapDisplay()
    cameras.setReducedMotion(true)
    cameras.update(aircraft, 0)
    const before = cameras.camera.position.clone()
    cameras.impulse(1)
    cameras.update(aircraft, 0)
    expect(cameras.prefersReducedMotion).toBe(true)
    expect(cameras.camera.position).toEqual(before)
    cameras.dispose()
  })

  it('follows aircraft translation without accumulating speed lag', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    // Test tracking above even the new alpine terrain, not ground avoidance.
    aircraft.position.set(0, 15000, 0)
    aircraft.snapDisplay()
    cameras.update(aircraft, 1 / 60)
    const initialOffset = cameras.camera.position.clone().sub(aircraft.displayPosition)

    aircraft.position.z += 500
    aircraft.snapDisplay()
    cameras.update(aircraft, 1 / 60)
    const movedOffset = cameras.camera.position.clone().sub(aircraft.displayPosition)

    expect(movedOffset.distanceTo(initialOffset)).toBeLessThan(0.01)
    expect(movedOffset.length()).toBeLessThan(25)
    cameras.dispose()
  })
})
