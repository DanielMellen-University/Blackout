import { describe, expect, it } from 'vitest'
import { commandPilot, pilotForStage, type PilotPose } from '../src/systems/operation/pilot'

const level: PilotPose = {
  altitudeErrorM: 0,
  verticalSpeed: 0,
  pitchRad: 0,
  rollRad: 0,
  headingRad: 0,
  lateralErrorM: 0,
}

describe('operation pilot', () => {
  it('raises the nose when the jet is below the band', () => {
    expect(commandPilot({ ...level, altitudeErrorM: 80 }, 0.5, false).pitch).toBeGreaterThan(0)
  })
})
