import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { Aircraft } from '../src/aircraft/Aircraft'
import { CockpitMode } from '../src/camera/CockpitMode'

describe('cockpit camera presentation', () => {
  it('attaches a restrained frame only while cockpit mode is active', () => {
    const cockpit = new CockpitMode()
    const camera = new PerspectiveCamera()
    const aircraft = new Aircraft()

    cockpit.enter(camera)
    cockpit.update(camera, aircraft)
    const frame = camera.getObjectByName('CockpitFrame')
    expect(frame).toBeTruthy()
    expect(frame?.visible).toBe(true)
    expect(frame?.children).toHaveLength(4)

    cockpit.exit(camera)
    expect(frame?.visible).toBe(false)
    cockpit.dispose()
    expect(camera.getObjectByName('CockpitFrame')).toBeUndefined()
  })
})
