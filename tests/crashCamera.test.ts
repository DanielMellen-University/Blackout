import { afterEach, describe, expect, it, vi } from 'vitest'
import { Vector3 } from 'three'
import { Aircraft } from '../src/aircraft/Aircraft'
import { CameraSystem } from '../src/camera/CameraSystem'
import { setContactHeightSampler } from '../src/world/ground'

afterEach(() => { vi.unstubAllGlobals(); setContactHeightSampler(null) })

function setup() {
  const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('window', target)
  setContactHeightSampler(() => 0)
  const camera = new CameraSystem({ ...target, style: {} } as unknown as HTMLCanvasElement)
  const aircraft = new Aircraft()
  aircraft.position.set(0, 2, 0)
  aircraft.snapDisplay()
  camera.setMode('chase', aircraft)
  return { camera, aircraft }
}

describe('impact camera', () => {
  it('pulls back and rises while holding the impact in frame without changing the jet', () => {
    const { camera, aircraft } = setup()
    try {
      aircraft.crash()
      camera.beginCrashShot(aircraft)
      const start = camera.camera.position.clone(), impact = aircraft.position.clone()
      for (let i = 0; i < 192; i++) {
        camera.setCrashProgress(i / 192)
        camera.update(aircraft, 1 / 60)
      }
      expect(camera.camera.position.distanceTo(impact)).toBeGreaterThan(start.distanceTo(impact) + 12)
      expect(camera.camera.position.y).toBeGreaterThan(start.y + 6)
      const direction = camera.camera.getWorldDirection(new Vector3())
      const target = impact.clone().add(new Vector3(0, 2, 0)).sub(camera.camera.position).normalize()
      expect(direction.dot(target)).toBeCloseTo(1, 3)
      expect(aircraft.position).toEqual(impact)
      expect(aircraft.mesh.visible).toBe(false)
    } finally { camera.dispose(); aircraft.dispose() }
  })

  it.each(['reduced', 'effects-off', 'paused'] as const)('keeps %s camera motion stationary', mode => {
    const { camera, aircraft } = setup()
    try {
      if (mode === 'reduced') camera.setReducedMotion(true)
      if (mode === 'effects-off') camera.setCameraEffectsEnabled(false)
      aircraft.crash()
      camera.beginCrashShot(aircraft)
      const position = camera.camera.position.clone(), orientation = camera.camera.quaternion.clone()
      camera.setCrashProgress(0.8)
      camera.update(aircraft, mode === 'paused' ? 0 : 1)
      expect(camera.camera.position).toEqual(position)
      expect(camera.camera.quaternion.toArray()).toEqual(orientation.toArray())
    } finally { camera.dispose(); aircraft.dispose() }
  })

  it('exits cockpit on impact and restores it on retry without reviving the dead model', () => {
    const { camera, aircraft } = setup()
    try {
      camera.setMode('cockpit', aircraft)
      aircraft.crash()
      camera.beginCrashShot(aircraft)
      expect(camera.mode).toBe('chase')
      camera.update(aircraft, 0.1)
      expect(aircraft.mesh.visible).toBe(false)
      aircraft.status = 'ok'
      camera.setMode('cockpit', aircraft)
      camera.update(aircraft, 0.1)
      expect(camera.mode).toBe('cockpit')
      expect(aircraft.mesh.visible).toBe(false)
      camera.setMode('chase', aircraft)
      expect(aircraft.mesh.visible).toBe(true)
    } finally { camera.dispose(); aircraft.dispose() }
  })

  it('keeps the cinematic lens above terrain', () => {
    const { camera, aircraft } = setup()
    try {
      aircraft.crash()
      camera.beginCrashShot(aircraft)
      setContactHeightSampler(() => 8)
      camera.setCrashProgress(0.8)
      camera.update(aircraft, 0.1)
      expect(camera.camera.position.y).toBeGreaterThanOrEqual(9.15)
    } finally { camera.dispose(); aircraft.dispose() }
  })
})
