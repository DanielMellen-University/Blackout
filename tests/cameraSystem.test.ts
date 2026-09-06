import { afterEach, describe, expect, it, vi } from 'vitest'
import { Aircraft } from '../src/aircraft/Aircraft'
import {
  CameraSystem,
  resolveExternalSpeedFraming,
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

  it('follows aircraft translation without accumulating speed lag', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 1000, 0)
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
