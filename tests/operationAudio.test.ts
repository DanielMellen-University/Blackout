import { describe, expect, it } from 'vitest'
import { operationAudioInputs } from '../src/ui/operation/audio'

describe('operation audio inputs', () => {
  it('uses resolved throttle, nitro state, engine power and speed from the stepped aircraft', () => {
    expect(operationAudioInputs({
      x: 0, y: 500, z: 100, qx: 0, qy: 0, qz: 0, qw: 1,
      throttle: 0.72, effectivePower: 0.92, boost: true, speed: 318,
    })).toEqual({ throttle: 0.72, effectivePower: 0.92, boost: true, speed: 318 })
  })

  it('returns no override when the operation aircraft is unavailable', () => {
    expect(operationAudioInputs(null)).toBeNull()
  })
})
