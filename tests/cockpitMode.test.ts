import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PerspectiveCamera } from 'three'
import { Aircraft } from '../src/aircraft/Aircraft'
import { CockpitMode } from '../src/camera/CockpitMode'

describe('cockpit camera presentation', () => {
  it('keeps first person unobstructed without camera-attached geometry', () => {
    const cockpit = new CockpitMode()
    const camera = new PerspectiveCamera()
    const aircraft = new Aircraft()

    cockpit.enter(camera)
    cockpit.update(camera, aircraft)
    expect(camera.children).toHaveLength(0)
    expect(camera.fov).toBe(74)
    expect(camera.near).toBe(0.12)
    expect(camera.position.length()).toBeGreaterThan(0)

    cockpit.exit(camera)
    expect(camera.children).toHaveLength(0)
    expect(camera.near).toBe(0.2)
    cockpit.dispose()
    cockpit.dispose()
    cockpit.enter(camera)
    expect(camera.children).toHaveLength(0)
    aircraft.dispose()
  })

  it('removes canopy tint, weather streaks, and vignette plumbing', () => {
    for (const path of ['index.html', 'src/ui/HUD.ts', 'src/style.css', 'src/camera/CockpitMode.ts']) {
      const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
      expect(source).not.toMatch(/canopy-tint|canopyTint|canopyCloudIntensity|canopyWeatherIntensity|CockpitFrame|ShapeGeometry/)
    }
  })

  it('holds the last safe lens pose when aircraft telemetry is malformed', () => {
    const cockpit = new CockpitMode()
    const camera = new PerspectiveCamera()
    const aircraft = new Aircraft()

    cockpit.enter(camera)
    cockpit.update(camera, aircraft)
    const position = camera.position.clone()
    const orientation = camera.quaternion.clone()

    aircraft.displayPosition.x = Number.NaN
    cockpit.update(camera, aircraft)

    expect(camera.position).toEqual(position)
    expect(camera.quaternion.x).toBe(orientation.x)
    expect(camera.quaternion.y).toBe(orientation.y)
    expect(camera.quaternion.z).toBe(orientation.z)
    expect(camera.quaternion.w).toBe(orientation.w)
    cockpit.dispose()
    aircraft.dispose()
  })
})
