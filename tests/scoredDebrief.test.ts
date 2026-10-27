// Full DOM assertions live in runResults.test.ts; these verify the scoring
// contract through durable storage, independently of the browser pilot.
import { describe, expect, it } from 'vitest'
import { ChallengeRun, readBestCourseScore, readCourseHistory } from '../src/systems/ChallengeRun'
import { courseSortieGoal } from '../src/ui/CourseBriefing'

describe('durable scored goals', () => {
  it('changes from medals to fastest final-gate time and preserves gold after a slower bronze retry', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) }
    const id = 'seed:42:orbit:daily:2026-10-19'
    function complete(seconds: number) {
      const run = new ChallengeRun(storage)
      run.reset(id, 1, 'balanced', undefined, false, 90)
      for (let i = 0; i < seconds; i++) run.update(1, 100)
      run.recordGate(1)
      return run.finishAirborne()!
    }
    const gold = complete(90)
    const bronze = complete(175)
    expect(gold.medal).toBe('gold')
    expect(bronze.medal).toBe('bronze')
    expect(bronze.courseBestMedal).toBe('gold')
    expect(bronze.bestTimeSec).toBe(90)
    expect(bronze.paceDeltaSec).toBe(85)
    expect(bronze.isNewBestTime).toBe(false)
    const history = readCourseHistory(storage, id)!
    expect(courseSortieGoal({ id, label: 'Daily', detail: '', meta: '', stats: '', runs: history.completionCount, time: history.bestTimeSec, score: readBestCourseScore(storage, id) })).toMatchObject({ kind: 'time', title: 'Beat your 1:30.00 best time' })
  })
})
