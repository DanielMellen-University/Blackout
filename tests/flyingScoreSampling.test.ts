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

it('scores time and the sampled bonuses while keeping a prior record untouched', async () => {
  const { courseSessionId } = await import('../src/systems/CourseLibrary')
  const id = courseSessionId('training-orbit', 1, 'orbit')
  const oldId = id.replace(':s1', '')
  const values = new Map([[`blackout.best.${oldId}`, '99999']])
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  const run = new ChallengeRun(storage)
  run.reset(id, 1, 'balanced', undefined, false, 10)
  run.update(5, 250, 0, 0, 0, false, true, 0, 0, 1, 1, false, false, 0)
  run.recordGate()
  const result = run.finishAirborne()!
  expect(result.totalScore).toBe(105_000)
  expect(result.flyingBonuses).toEqual({ lowScore: 10_000, terrainScore: 10_000, speedScore: 10_000 })
  expect(values.get(`blackout.best.${oldId}`)).toBe('99999')
  expect(values.get(`blackout.best.${id}`)).toBe('105000')
})
