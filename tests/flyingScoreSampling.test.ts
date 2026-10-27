import { describe, expect, it } from 'vitest'
import { ChallengeRun } from '../src/systems/ChallengeRun'

describe('gated flying bonus sampling', () => {
  it('samples airborne running time and freezes at the final gate', () => {
    const run = new ChallengeRun(null)
    run.reset('test', 1)
    run.update(1, 200, 150, 0, 0, false, true, 0, 0, 1, 1, false, false, 50)
    run.update(1, 200, 150, 0, 0, false, false, 0, 0, 1, 1, false, false, 50)
    run.recordGate()
    run.update(3, 100, 300, 0, 0, false, true, 0, 0, 1, 1, false, false, 100)
    const result = run.finishAirborne()!
    expect(result.flyingBonuses).toEqual({ lowScore: 5000, terrainScore: 5000, speedScore: 6667 })
    run.reset('test', 1)
    run.recordGate()
    expect(run.finishAirborne()!.flyingBonuses).toEqual({ lowScore: 0, terrainScore: 0, speedScore: 0 })
  })

  it('does not produce a gated finish for Free flight', () => {
    const run = new ChallengeRun(null)
    run.reset('free-flight', 0)
    run.update(1, 200, 0)
    expect(run.finishAirborne()).toBeNull()
  })
})
