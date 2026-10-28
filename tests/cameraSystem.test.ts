import { afterEach, describe, expect, it, vi } from 'vitest'
import { Quaternion, Scene, Vector3 } from 'three'
import { Aircraft } from '../src/aircraft/Aircraft'
import {
  cameraBoostOffset,
  cameraBoostOffsetInto,
  cameraBankAngle,
  stableBank,
  cameraFarForQuality,
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
import {
  cameraMinY,
  createGroundHeightCache,
  sampleGroundHeightCached,
  setContactHeightSampler,
  setGroundHeightSampler,
} from '../src/world/ground'

describe('external camera framing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setContactHeightSampler(null)
    setGroundHeightSampler(null)
  })

  it('reveals the burner only during boost and restores dry chase framing', () => {
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.stubGlobal('window', target)
    const cameras = new CameraSystem({ ...target, style: {} } as unknown as HTMLCanvasElement)
    const aircraft = new Aircraft()
    try {
      aircraft.position.set(0, 15000, 0); aircraft.snapDisplay()
      cameras.setMode('chase', aircraft)
      const dry = cameras.camera.position.distanceTo(aircraft.displayPosition)
      aircraft.engineState.afterburnerActive = true; for (let i = 0; i < 240; i++) cameras.update(aircraft, 1 / 60)
      expect(cameras.camera.position.distanceTo(aircraft.displayPosition)).toBeGreaterThan(dry + 9)
      aircraft.engineState.afterburnerActive = false; for (let i = 0; i < 240; i++) cameras.update(aircraft, 1 / 60)
      expect(cameras.camera.position.distanceTo(aircraft.displayPosition)).toBeCloseTo(dry, 1)
      cameras.setMode('orbit', aircraft)
      const orbit = cameras.camera.position.clone()
      aircraft.engineState.afterburnerActive = true; for (let i = 0; i < 240; i++) cameras.update(aircraft, 1 / 60)
      expect(cameras.camera.position.distanceTo(orbit)).toBeLessThan(.2)
    } finally { cameras.dispose(); aircraft.dispose() }
  })

  it('toggles between chase, wide orbit, and cockpit views', () => {
    expect(CAMERA_MODES).toEqual(['chase', 'orbit', 'cockpit'])
    expect(cameraModeCue('chase')).toBe('EXTERNAL VIEW')
    expect(cameraModeCue('orbit')).toBe('ORBIT VIEW')
    expect(cameraModeCue('cockpit')).toBe('COCKPIT VIEW')
  })

  it('shrinks the external frustum with the Low terrain envelope', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    try {
      expect(cameras.camera.far).toBe(CAMERA_FAR)
      expect(cameraFarForQuality('low')).toBeLessThan(CAMERA_FAR)
      cameras.setRenderQuality('low')
      expect(cameras.camera.far).toBe(cameraFarForQuality('low'))
      cameras.setRenderQuality('high')
      expect(cameras.camera.far).toBe(CAMERA_FAR)
      cameras.setRenderQuality('ultra' as never)
      expect(cameras.camera.far).toBe(cameraFarForQuality('balanced'))
      expect((cameras as unknown as { renderQuality: string }).renderQuality).toBe('balanced')
    } finally {
      cameras.dispose()
    }
  })

  it('keeps the orbit view wide and horizon-stable', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 15_000, 0)
    aircraft.snapDisplay()

    cameras.setMode('orbit', aircraft)
    expect(cameras.mode).toBe('orbit')
    expect(cameras.camera.fov).toBe(57)
    expect(cameras.camera.position.distanceTo(aircraft.displayPosition)).toBeGreaterThan(25)
    expect(cameras.camera.up.y).toBe(1)

    cameras.setMode('cockpit', aircraft)
    expect(cameras.camera.fov).toBe(74)
    cameras.dispose()
  })

  it('eases A/D yaw only in the wheel-zoomed-out chase view; middle and orbit views stay rigid/unchanged', () => {
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.stubGlobal('window', target)
    const fly = (mode: 'chase' | 'orbit', fps: number, distance?: number) => {
      const cameras = new CameraSystem({ ...target, style: {} } as unknown as HTMLCanvasElement)
      const aircraft = new Aircraft()
      try {
        aircraft.reset({ x: 0, y: 3000, z: 0, yaw: 0 })
        aircraft.controls.gearDown = false; aircraft.controls.throttle = 0.8
        aircraft.velocity.copy(new Vector3(0, 0, 1).applyQuaternion(aircraft.orientation)).multiplyScalar(180)
        aircraft.snapDisplay()
        cameras.setMode(mode, aircraft); cameras.update(aircraft, 1 / fps)
        const state = cameras as unknown as { distance: number; orbitHeading: number }
        if (distance) state.distance = distance
        const orbitHeading = state.orbitHeading
        const yaw: number[] = []
        const dir = new Vector3()
        let acc = 0
        let rigidError = 0
        for (let f = 0; f < fps * 3; f++) {
          const t = f / fps
          acc += 1 / fps
          while (acc >= 1 / 60) { acc -= 1 / 60; aircraft.capturePrevious(); aircraft.controls.yaw = t > .5 && t < 2 ? 1 : 0; aircraft.step(1 / 60) }
          aircraft.present(acc * 60)
          cameras.update(aircraft, 1 / fps)
          const up = new Vector3(0, 1, 0).applyQuaternion(aircraft.displayOrientation)
          rigidError = Math.max(rigidError, cameras.camera.up.distanceTo(up))
          cameras.camera.getWorldDirection(dir)
          yaw.push(Math.atan2(dir.x, dir.z))
        }
        const rate = yaw.slice(1).map((v, i) => (v - yaw[i]!) * fps)
        const jerk = Math.max(...rate.slice(1).map((v, i) => Math.abs(v - rate[i]!) * fps))
        return { jerk, rigidError, orbitDrift: Math.abs(state.orbitHeading - orbitHeading), finalYaw: yaw[Math.round(2.5 * fps) - 1]! }
      } finally { cameras.dispose(); aircraft.dispose() }
    }
    // Middle (default chase) view stays rigid to the airframe, exactly as before.
    const middle = fly('chase', 60)
    expect(middle.rigidError).toBe(0)
    expect(middle.jerk).toBeGreaterThan(10)
    // Orbit keeps its heading captured on open.
    expect(fly('orbit', 60).orbitDrift).toBe(0)
    // Furthest wheel zoom eases the swing and is frame-rate independent.
    const far60 = fly('chase', 60, 24)
    const far144 = fly('chase', 144, 24)
    expect(far60.jerk).toBeLessThan(4)
    expect(far144.jerk).toBeLessThan(4)
    expect(far144.finalYaw).toBeCloseTo(far60.finalYaw, 2)
  })

  it('opens behind and a bit above the jet after a cockpit toggle', () => {
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
    const state = cameras as unknown as { yaw: number; pitch: number; distance: number }
    state.yaw = -0.72
    state.pitch = 0.41
    state.distance = 27

    cameras.setMode('cockpit', aircraft)
    expect(cameras.camera.fov).toBe(74)
    cameras.setMode('chase', aircraft)

    expect(state.yaw).toBeCloseTo(0)
    expect(state.pitch).toBeCloseTo(0.2)
    expect(state.distance).toBeCloseTo(14)
    expect(cameras.camera.fov).toBe(60)
    cameras.setMode('orbit', aircraft)
    expect(state.yaw).toBeCloseTo(0)
    expect(state.pitch).toBeCloseTo(0.34)
    cameras.dispose()
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
    expect(cameras.camera.far).toBeGreaterThan(33_600)
    expect(cameras.camera.far).toBeLessThan(55_000)
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

  it('scales high-speed external framing without changing the base envelope', () => {
    const standard = resolveExternalSpeedFraming(17, 60, 10, 1, 24, 1)
    const subtle = resolveExternalSpeedFraming(17, 60, 10, 1, 24, 0.55)
    const wide = resolveExternalSpeedFraming(17, 60, 10, 1, 24, 1.35)
    expect(subtle.fov).toBeLessThan(standard.fov)
    expect(wide.fov).toBeGreaterThan(standard.fov)
    expect(subtle.distance).toBeLessThan(standard.distance)
    expect(wide.distance).toBeGreaterThan(standard.distance)
    expect(resolveExternalSpeedFraming(17, 60, 10, 0, 24, 1.35)).toEqual({
      distance: 17,
      fov: 60,
      lookLeadLimit: 4.5,
    })
  })

  it('rolls the chase horizon with the jet without dumping it on its side', () => {
    const identity = new Quaternion()
    expect(cameraBankAngle(identity)).toBeCloseTo(0)
    const banked = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)
    expect(cameraBankAngle(banked, 0.14)).toBeCloseTo(-0.14)
    expect(cameraBankAngle(banked, 0)).toBeCloseTo(0)
    const rolled = cameraBankAngle(banked)
    expect(rolled).toBeLessThan(-0.45)
    expect(rolled).toBeGreaterThan(-Math.PI / 3)
    expect(cameraBankAngle(banked, Number.NaN)).toBeCloseTo(rolled)
  })

  it('keeps close chase rigs cheap while preserving full long-sightline coverage', () => {
    expect(cameraOcclusionSampleCount(6)).toBe(6)
    expect(cameraOcclusionSampleCount(10)).toBe(6)
    expect(cameraOcclusionSampleCount(10.01)).toBe(8)
    expect(cameraOcclusionSampleCount(22)).toBe(8)
    expect(cameraOcclusionSampleCount(22.01)).toBe(10)
    expect(cameraOcclusionSampleCount(Number.NaN)).toBe(10)
    expect(cameraOcclusionSampleCount(16, 'ultra' as never)).toBe(8)
  })

  it('uses a smaller bounded occlusion budget on Low', () => {
    expect(cameraOcclusionSampleCount(6, 'low')).toBe(4)
    expect(cameraOcclusionSampleCount(16, 'low')).toBe(5)
    expect(cameraOcclusionSampleCount(40, 'low')).toBe(6)
  })

  it('computes camera-local navigation bearings without matrix refreshes', () => {
    const camera = new Vector3(0, 10, 0)
    const target = new Vector3(100, 40, 0)
    expect(cameraRelativeBearing(camera, new Quaternion(), target)).toBeCloseTo(Math.PI / 2)

    const yawed = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2)
    expect(cameraRelativeBearing(camera, yawed, target)).toBeCloseTo(0)
  })

  it('keeps cockpit gate cues aligned with the camera projection', () => {
    const noseFlip = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)
    const rightWingTarget = new Vector3(100, 0, 0)
    // CockpitMode applies the 180° nose flip because Three.js cameras look -Z.
    // A target on the airframe +X side therefore projects to screen-left.
    expect(cameraRelativeBearing(new Vector3(), noseFlip, rightWingTarget))
      .toBeCloseTo(-Math.PI / 2)
  })

  it('clamps invalid speed input into the designed envelope', () => {
    const stopped = resolveExternalSpeedFraming(17, 60, 10, -1)
    const overspeed = resolveExternalSpeedFraming(17, 60, 10, 2)
    expect(stopped).toEqual({ distance: 17, fov: 60, lookLeadLimit: 4.5 })
    expect(overspeed.distance).toBeCloseTo(19.38)
    expect(overspeed.fov).toBe(66)
    expect(overspeed.lookLeadLimit).toBe(10)
  })

  it('contains malformed camera telemetry without emitting non-finite framing', () => {
    const framing = resolveExternalSpeedFraming(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, Number.NaN)
    expect(framing).toEqual({ distance: 17, fov: 60, lookLeadLimit: 4.5 })

    expect(cameraRelativeBearing(
      new Vector3(Number.NaN, 0, 0),
      new Quaternion(),
      new Vector3(),
    )).toBe(0)
    expect(cameraBankAngle(new Quaternion(Number.NaN, 0, 0, 1))).toBe(0)
    expect(cameraShakeOffset(Number.NaN, Number.NaN)).toEqual({ x: 0, y: 0, z: 0 })
    expect(cameraBoostOffset(Number.NaN, Number.NaN)).toEqual({ x: 0, y: 0, z: 0 })
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

  it('normalizes reduced-motion input and ignores late updates after disposal', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)

    cameras.setReducedMotion('true' as never)
    expect(cameras.prefersReducedMotion).toBe(false)
    cameras.setReducedMotion(true)
    expect(cameras.prefersReducedMotion).toBe(true)
    cameras.dispose()
    cameras.setReducedMotion(false)
    expect(cameras.prefersReducedMotion).toBe(true)
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

  it('keeps the external camera where the pilot left it when auto-return is disabled', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 15_000, 0)
    aircraft.snapDisplay()
    cameras.setAutoReturnEnabled(false)
    cameras.update(aircraft, 1 / 60)
    ;(cameras as unknown as { yaw: number }).yaw = 0.9
    cameras.update(aircraft, 1 / 60)
    for (let i = 0; i < 720; i++) cameras.update(aircraft, 1 / 60)
    expect((cameras as unknown as { yaw: number }).yaw).toBeCloseTo(0.9)
    expect(cameras.autoReturnPreferenceEnabled).toBe(false)
    cameras.dispose()
  })

  it('suppresses cinematic camera motion while retaining the external rig', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 15_000, 0)
    aircraft.snapDisplay()
    cameras.setCameraEffectsEnabled(false)
    cameras.impulse(1)
    cameras.setStormBuffet(1)
    cameras.update(aircraft, 1 / 60)
    const first = cameras.camera.position.clone()
    cameras.update(aircraft, 1 / 60)
    expect(cameras.camera.position).toEqual(first)
    expect(cameras.cameraEffectsAreEnabled).toBe(false)
    cameras.dispose()
  })

  it('clamps external look sensitivity without affecting cockpit mode', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    expect(cameras.setLookSensitivity(0.009)).toBeCloseTo(0.009)
    expect(cameras.lookSensitivity).toBeCloseTo(0.009)
    expect(cameras.setLookSensitivity(-1)).toBeCloseTo(0.0015)
    expect(cameras.setLookSensitivity(Number.NaN)).toBeCloseTo(0.005)
    cameras.setMode('cockpit')
    expect(cameras.lookSensitivity).toBeCloseTo(0.005)
    cameras.dispose()
  })

  it('clamps the live speed-framing scale to a finite envelope', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    expect(cameras.setSpeedFramingScale(1.35)).toBeCloseTo(1.35)
    expect(cameras.speedFramingScaleValue).toBeCloseTo(1.35)
    expect(cameras.setSpeedFramingScale(-1)).toBe(0)
    expect(cameras.setSpeedFramingScale(Number.NaN)).toBe(1)
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

  it('stops the external rig before a loaded obstacle on the sightline', () => {
    setGroundHeightSampler(() => 0)
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 20, 0)
    aircraft.snapDisplay()
    cameras.setObstacleSampler((_x, _y, z) => z < -8)
    cameras.setMode('chase', aircraft)

    expect(cameras.camera.position.z).toBeGreaterThan(-8)
    cameras.dispose()
  })

  it('eases occlusion recovery instead of snapping through a cleared obstacle', () => {
    setGroundHeightSampler(() => 0)
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', target)
    const canvas = { ...target, style: {} } as unknown as HTMLCanvasElement
    const cameras = new CameraSystem(canvas)
    const aircraft = new Aircraft()
    aircraft.position.set(0, 20, 0)
    aircraft.snapDisplay()
    let blocked = true
    cameras.setObstacleSampler(() => blocked)
    cameras.setMode('chase', aircraft)
    cameras.update(aircraft, 1 / 60)

    const blockedDistance = cameras.camera.position.distanceTo(aircraft.displayPosition)
    blocked = false
    cameras.update(aircraft, 1 / 60)
    const firstClearDistance = cameras.camera.position.distanceTo(aircraft.displayPosition)
    for (let i = 0; i < 12; i++) cameras.update(aircraft, 1 / 60)
    const settlingDistance = cameras.camera.position.distanceTo(aircraft.displayPosition)
    for (let i = 0; i < 108; i++) cameras.update(aircraft, 1 / 60)
    const recoveredDistance = cameras.camera.position.distanceTo(aircraft.displayPosition)

    expect(firstClearDistance).toBeGreaterThan(blockedDistance)
    expect(firstClearDistance).toBeLessThan(settlingDistance)
    expect(recoveredDistance).toBeGreaterThan(blockedDistance + 1)
    cameras.dispose()
  })
})

describe('ground query cache', () => {
  afterEach(() => {
    setContactHeightSampler(null)
    setGroundHeightSampler(null)
  })

  it('reuses exact probes without surviving a sampler replacement', () => {
    let samples = 0
    setGroundHeightSampler(() => {
      samples++
      return 42
    })
    const cache = createGroundHeightCache(2)

    expect(sampleGroundHeightCached(12, -8, cache)).toBe(42)
    expect(sampleGroundHeightCached(12, -8, cache)).toBe(42)
    expect(samples).toBe(1)

    setGroundHeightSampler(() => {
      samples++
      return 84
    })
    expect(sampleGroundHeightCached(12, -8, cache)).toBe(84)
    expect(samples).toBe(2)
  })
})


describe('storm buffet camera drive', () => {
  it('suppresses storm buffet when reduced motion is enabled', () => {
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
    cameras.setStormBuffet(1)
    cameras.update(aircraft, 1 / 60)
    const before = cameras.camera.position.clone()
    cameras.update(aircraft, 1 / 60)
    expect(cameras.camera.position).toEqual(before)
    cameras.dispose()
  })
})

it("keeps the chase bank on one side while rolling through inverted", () => {
  const cap = 0.62
  let bank = 0
  for (let deg = 0; deg <= 265; deg += 5) {
    const roll = Math.atan2(Math.sin(deg * Math.PI / 180), Math.cos(deg * Math.PI / 180))
    const next = stableBank(roll, bank, cap)
    expect(Math.abs(next - bank)).toBeLessThan(cap + 1e-9)
    if (deg > 90 && deg < 270) expect(Math.sign(next)).toBe(1)
    bank = next
  }
  expect(stableBank(-2.5, -0.62, cap)).toBeCloseTo(-0.62)
  expect(stableBank(0.3, 0.5, cap)).toBeCloseTo(0.3)
})
