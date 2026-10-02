import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { Aircraft } from '../src/aircraft/Aircraft'
import { CockpitMode } from '../src/camera/CockpitMode'

describe('cockpit camera presentation', () => {
  it('shows a restrained camera-attached canopy frame only in cockpit mode', () => {
    const cockpit = new CockpitMode()
    const camera = new PerspectiveCamera()
    const aircraft = new Aircraft()

    cockpit.enter(camera)
    cockpit.update(camera, aircraft)
    const frame = camera.getObjectByName('CockpitFrame')
    expect(camera.children).toHaveLength(1)
    expect(frame).toBeDefined()
    expect(frame?.visible).toBe(true)
    expect(frame?.renderOrder).toBe(20)
    expect(camera.position.length()).toBeGreaterThan(0)

    cockpit.exit(camera)
    expect(camera.children).toHaveLength(0)
    expect(camera.getObjectByName('CockpitFrame')).toBeUndefined()
    cockpit.dispose()
    cockpit.dispose()
    cockpit.enter(camera)
    expect(camera.children).toHaveLength(0)
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
  })
})
