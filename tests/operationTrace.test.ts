import { describe, expect, it } from 'vitest'
import type { FlightSample } from '../src/systems/operation/samples'
import { operationTracePath } from '../src/ui/operation/trace'
import { operationStepsPerFrame, operationReplayStepsPerFrame } from '../src/ui/operation/pace'
import { OPERATION_PLAY_SEED } from '../src/ui/operation/playSeed'

function sample(z: number, y: number): FlightSample {
  return { t: z, x: 0, y, z, speed: 100, clearance: 80, airborne: true }
}

describe('operation trace and pace', () => {
  it('returns an empty path when nothing has been flown', () => {
    expect(operationTracePath([])).toBe('')
  })

})
