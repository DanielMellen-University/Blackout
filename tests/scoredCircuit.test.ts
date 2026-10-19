import { describe, expect, it } from 'vitest'
import { ChallengeRun, readCourseHistory } from '../src/systems/ChallengeRun'

const landing = { verticalSpeed: -1, groundSpeed: 30, pitchRad: 0, rollRad: 0 }
function fixture() {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
  return { values, storage }
}
function fly(run: ChallengeRun, gateTime: number, returnTime: number, quality = 1) {
  for (let time = 0; time < gateTime; time++) run.update(1, 100)
  run.recordGate(quality)
  for (let time = 0; time < returnTime; time++) run.update(1, 60)
  return run.finishLanding(landing)!
}

describe('scored complete circuits', () => {
  it('compares landing pace against the previous complete circuit, independently of best-score gate splits', () => {
    const { storage } = fixture()
    const run = new ChallengeRun(storage)
    run.reset('seed:scored:orbit', 1)
    const first = fly(run, 10, 20)
    expect(first.gateSplits).toEqual([10])
    expect(first.bestTimeSec).toBe(30)
    expect(first.isNewBestTime).toBe(true)
    run.reset('seed:scored:orbit', 1)
    const second = fly(run, 12, 10, 0.5)
    expect(second.paceDeltaSec).toBe(-8)
    expect(second.paceLabel).toBe('AHEAD 8.00S')
    expect(second.previousBestTimeSec).toBe(30)
    expect(second.isNewBestTime).toBe(true)
    expect(second.isNewBest).toBe(false)
    expect(second.bestGateSplits).toEqual([10])
    expect(readCourseHistory(storage, 'seed:scored:orbit')?.bestTimeSec).toBe(22)
    run.reset('seed:scored:orbit', 1)
    const third = fly(run, 9, 15)
    expect(third.paceDeltaSec).toBe(2)
    expect(third.paceLabel).toBe('BEHIND 2.00S')
    expect(third.bestTimeSec).toBe(22)
    expect(third.isNewBestTime).toBe(false)
  })

  it('allows departure and approach before pace deductions, then retains bronze, silver and gold records across reload', () => {
    const { storage } = fixture()
    for (const [elapsed, medal] of [[190, 'bronze'], [155, 'silver'], [90, 'gold']] as const) {
      const run = new ChallengeRun(storage)
      run.reset('seed:scored:orbit', 1, 'balanced', undefined, false, 90)
      const result = fly(run, 10, elapsed - 10)
      expect(result.medal).toBe(medal)
      expect(result.courseBestMedal).toBe(medal)
      expect(result.newMedalRecord).toBe(true)
      expect(result.isNewBestTime).toBe(true)
      expect(result.timeScore).toBe(70_000 - Math.max(0, elapsed - 90) * 320)
    }
    expect(readCourseHistory(storage, 'seed:scored:orbit')).toMatchObject({ completionCount: 3, bestTimeSec: 90 })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('rejects an invalid time allowance %s', allowance => {
    const run = new ChallengeRun(null)
    run.reset('seed:invalid:orbit', 1, 'balanced', undefined, false, allowance)
    const result = fly(run, 10, 20)
    expect(result.timeAllowanceSec).toBe(0)
    expect(result.timeScore).toBe(60_400)
  })
})
