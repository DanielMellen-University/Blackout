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

  it('lowers the nose when the jet is above the band', () => {
    expect(commandPilot({ ...level, altitudeErrorM: -80 }, 0.5, false).pitch).toBeLessThan(0)
  })

  it('yaws toward a line that is to the right', () => {
    expect(commandPilot({ ...level, lateralErrorM: 40 }, 0.5, false).yaw).toBeGreaterThan(0)
  })

  it('clamps axes and throttle', () => {
    const command = commandPilot({ ...level, altitudeErrorM: 10_000, lateralErrorM: -10_000 }, 4, true)
    expect(command.pitch).toBe(1)
    expect(command.yaw).toBe(-1)
    expect(command.throttle).toBe(1)
    expect(commandPilot(level, Number.NaN, false).throttle).toBe(0)
    expect(command.boost).toBe(true)
  })
})
