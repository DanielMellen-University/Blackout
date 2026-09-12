import { afterEach, describe, expect, it, vi } from 'vitest'
import { Quaternion, Scene, Vector3 } from 'three'
import { Aircraft } from '../src/aircraft/Aircraft'
import {
  cameraBoostOffset,
  cameraBoostOffsetInto,
  cameraShakeOffset,
  cameraShakeOffsetInto,
  cameraOcclusionSampleCount,
  cameraModeCue,
  cameraViewportAspect,
  CAMERA_FAR,
  cameraRelativeBearing,
  CameraSystem,
  resolveExternalSpeedFraming,
  resolveExternalSpeedFramingInto,
  TOUCHDOWN_IMPULSE,
} from '../src/camera/CameraSystem'
import { CAMERA_MODES } from '../src/core/types'
import { cameraMinY, setContactHeightSampler, setGroundHeightSampler } from '../src/world/ground'

describe('external camera framing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setContactHeightSampler(null)
    setGroundHeightSampler(null)
  })

  it('toggles only between external and cockpit views', () => {
    expect(CAMERA_MODES).toEqual(['chase', 'cockpit'])
    expect(cameraModeCue('chase')).toBe('EXTERNAL VIEW')
    expect(cameraModeCue('cockpit')).toBe('COCKPIT VIEW')
  })

  it('seeds the external rig immediately when an aircraft is supplied', () => {
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

    cameras.setMode('chase', aircraft)

    expect(cameras.camera.position.distanceTo(aircraft.displayPosition)).toBeGreaterThan(5)
    expect(cameras.camera.position.y).toBeGreaterThan(aircraft.displayPosition.y - 1)
    cameras.dispose()
  })

  it('holds a three-quarter title showcase until gameplay resets the rig', () => {
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

    cameras.setMode('chase', aircraft)
    cameras.setTitleFraming(aircraft)
    const showcaseYaw = (cameras as unknown as { yaw: number }).yaw
    expect(showcaseYaw).toBeCloseTo(0.55)

    for (let i = 0; i < 600; i++) cameras.update(aircraft, 1 / 60)
    expect((cameras as unknown as { yaw: number }).yaw).toBeCloseTo(showcaseYaw)

    cameras.setMode('chase', aircraft)
    expect((cameras as unknown as { yaw: number }).yaw).toBeCloseTo(0)
    cameras.dispose()
  })

  it('keeps the depth range tight around the streamed world', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)

    expect(cameras.camera.far).toBe(CAMERA_FAR)
    expect(cameras.camera.far).toBeGreaterThan(16_800)
    expect(cameras.camera.far).toBeLessThan(30_000)
    cameras.dispose()
  })

  it('keeps malformed viewport sizes out of the projection matrix', () => {
    expect(cameraViewportAspect(1280, 720)).toBeCloseTo(1280 / 720)
    expect(cameraViewportAspect(0, 0)).toBe(1)
    expect(cameraViewportAspect(Number.NaN, 720)).toBeCloseTo(1 / 720)
    expect(cameraViewportAspect(1280, Infinity)).toBeCloseTo(1280)
  })

  it('keeps the aircraft readable at maximum speed', () => {
    const framing = resolveExternalSpeedFraming(17, 60, 10, 1)
    expect(framing.distance).toBeCloseTo(19.38)
    expect(framing.fov).toBe(66)
    expect(framing.lookLeadLimit).toBe(10)
  })

  it('keeps close chase rigs cheap while preserving full long-sightline coverage', () => {
    expect(cameraOcclusionSampleCount(6)).toBe(6)
    expect(cameraOcclusionSampleCount(10)).toBe(6)
    expect(cameraOcclusionSampleCount(10.01)).toBe(8)
    expect(cameraOcclusionSampleCount(22)).toBe(8)
    expect(cameraOcclusionSampleCount(22.01)).toBe(10)
    expect(cameraOcclusionSampleCount(Number.NaN)).toBe(10)
  })

  it('computes camera-local navigation bearings without matrix refreshes', () => {
    const camera = new Vector3(0, 10, 0)
    const target = new Vector3(100, 40, 0)
    expect(cameraRelativeBearing(camera, new Quaternion(), target)).toBeCloseTo(Math.PI / 2)

    const yawed = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2)
    expect(cameraRelativeBearing(camera, yawed, target)).toBeCloseTo(0)
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

  it('attaches and detaches the camera so camera children render safely', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const scene = new Scene()

    cameras.attachToScene(scene)
    expect(cameras.camera.parent).toBe(scene)
    cameras.dispose()
    cameras.dispose()
    cameras.attachToScene(scene)
    expect(cameras.camera.parent).toBeNull()
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

  it('does not probe ground occlusion while the frame is frozen', () => {
    let samples = 0
    setGroundHeightSampler(() => {
      samples++
      return 0
    })
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
    cameras.update(aircraft, 1 / 60)
    cameras.update(aircraft, 1 / 60)
    const beforeFrozen = samples

    cameras.update(aircraft, 0)
    expect(samples).toBe(beforeFrozen)
    cameras.dispose()
  })

  it('uses render time for camera auto-return instead of a wall-clock read', () => {
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

    cameras.update(aircraft, 1 / 60)
    ;(cameras as unknown as { yaw: number }).yaw = 0.9
    cameras.update(aircraft, 1 / 60)
    expect((cameras as unknown as { yaw: number }).yaw).toBeCloseTo(0.9)

    for (let i = 0; i < 420; i++) cameras.update(aircraft, 1 / 60)
    expect((cameras as unknown as { yaw: number }).yaw).toBeLessThan(0.9)
    cameras.dispose()
  })

  it('keeps impact and boost camera effects above the terrain floor', () => {
    setGroundHeightSampler(() => 10)
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 12, 0)
    aircraft.snapDisplay()

    // The first update initializes the mode. Force a steep low-altitude rig
    // so the post-effect clamp is exercised at the edge of the terrain.
    cameras.update(aircraft, 1 / 60)
    ;(cameras as unknown as { pitch: number }).pitch = -1.4
    cameras.impulse(1)

    const floor = cameraMinY(0, 0, 1.15)
    let lowest = Number.POSITIVE_INFINITY
    for (let i = 0; i < 24; i++) {
      cameras.update(aircraft, 1 / 60)
      lowest = Math.min(lowest, cameras.camera.position.y)
    }

    expect(lowest).toBeGreaterThanOrEqual(floor - 1e-6)
    cameras.dispose()
  })
})
