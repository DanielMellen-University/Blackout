import { describe, expect, it } from 'vitest'
import {
  ChallengeRun,
  formatPaceDelta,
  formatSplitTrace,
  formatTime,
  repairCourseHistory,
  readCourseHistory,
  readBestCourseScore,
  resultMedalClass,
  scoringWeightsForFocus,
  masteryBadgesForRun,
  readMasteryBadges,
  repairBestCourseScore,
  repairMasteryBadges,
  MAX_BEST_SCORE,
  MAX_COMPLETION_COUNT,
  MAX_PEAK_ALTITUDE_M,
  MAX_PEAK_SPEED_KTS,
  MAX_PRECISION_STREAK,
  MASTERY_BADGE_COUNT,
  readBestCoursePrecisionStreak,
  repairBestCoursePrecisionStreak,
} from '../src/systems/ChallengeRun'

describe('ChallengeRun', () => {
  it('starts the clock on the takeoff roll and scores a completed landing', () => {
    const store = new Map<string, string>()
    const run = new ChallengeRun({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value)
      },
    })
    run.reset('seed:1', 2)
    expect(run.phase).toBe('ready')
    run.update(0.5, 0)
    expect(run.phase).toBe('ready')
    run.update(0.5, 8, 140)
    expect(run.phase).toBe('running')
    expect(run.elapsedSec).toBeCloseTo(0.5)

    run.recordGate(1)
    run.recordGate(0.5)
    expect(run.phase).toBe('returning')

    const result = run.finishLanding({
      verticalSpeed: -2,
      groundSpeed: 28,
      pitchRad: 0.1,
      rollRad: 0.05,
    })
    expect(result).not.toBeNull()
    expect(result!.gateScore).toBe(15_000)
    expect(result!.totalScore).toBeGreaterThan(0)
    expect(result!.isNewBest).toBe(true)
    expect(result!.peakSpeedKts).toBe(16)
    expect(result!.peakAltitudeM).toBe(140)
    expect(result!.newMasteryBadges).toEqual(['first-flight', 'landing-ace', 'gold-run'])
    expect(readMasteryBadges({ getItem: (key) => store.get(key) ?? null }, 'seed:1'))
      .toEqual(['first-flight', 'landing-ace', 'gold-run'])
    expect(run.phase).toBe('complete')
  })

  it('does not score a landing before the circuit is done', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:1', 2)
    run.recordGate(1)
    expect(
      run.finishLanding({
        verticalSpeed: -1,
        groundSpeed: 20,
        pitchRad: 0,
        rollRad: 0,
      }),
    ).toBeNull()
  })

  it('tracks meaningful consecutive precision gate streaks without changing score state', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:streak', 3)
    run.recordGate(0.9)
    expect(run.gateStreakLabel).toBe('')
    run.recordGate(0.82)
    expect(run.gateStreakLabel).toBe('STREAK X2')
    run.recordGate(0.4)
    expect(run.gateStreakLabel).toBe('')
    const result = run.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    })
    expect(result?.bestPrecisionStreak).toBe(2)
  })

  it('formats time with centiseconds', () => {
    expect(formatTime(75.5)).toBe('1:15.50')
    expect(formatTime(Number.NaN)).toBe('0:00.00')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00.00')
  })

  it('keeps malformed telemetry from poisoning a run result', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:malformed', 1)
    run.update(Number.NaN, Number.NaN)
    expect(run.phase).toBe('ready')
    expect(run.elapsedSec).toBe(0)

    run.update(Number.POSITIVE_INFINITY, 8)
    expect(run.phase).toBe('running')
    expect(run.elapsedSec).toBe(0)
    run.recordGate(Number.NaN)
    const result = run.finishLanding({
      verticalSpeed: Number.NaN,
      groundSpeed: Number.POSITIVE_INFINITY,
      pitchRad: Number.NaN,
      rollRad: Number.NEGATIVE_INFINITY,
    })
    expect(result).not.toBeNull()
    expect(Number.isFinite(result!.totalScore)).toBe(true)
    expect(result!.gateScore).toBe(0)
  })

  it('maps every result medal to a stable presentation class', () => {
    expect(resultMedalClass('gold')).toBe('medal-gold')
    expect(resultMedalClass('silver')).toBe('medal-silver')
    expect(resultMedalClass('bronze')).toBe('medal-bronze')
    expect(resultMedalClass('complete')).toBe('medal-complete')
  })

  it('reuses the clock label while the displayed centiseconds stay unchanged', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:clock', 1)
    const first = run.clockLabel
    run.update(0.001, 0)
    expect(run.clockLabel).toBe(first)
    run.update(0.01, 8)
    expect(run.clockLabel).not.toBe(first)
  })

  it('keeps peak sortie telemetry finite and outside score math', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:telemetry', 1)
    run.update(0.1, 120, 300)
    run.update(0.1, 80, 900)
    run.recordGate(1)
    const result = run.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    })!
    expect(result.peakSpeedKts).toBe(233)
    expect(result.peakAltitudeM).toBe(900)
    expect(Number.isFinite(result.totalScore)).toBe(true)
  })

  it('persists gate splits and reports ahead or behind pace on retry', () => {
    const store = new Map<string, string>()
    const scoreStore = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    }
    const first = new ChallengeRun(scoreStore)
    first.reset('seed:trace', 2)
    first.update(1, 8)
    first.recordGate(1)
    first.update(1, 8)
    first.recordGate(1)
    const firstResult = first.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    })!
    expect(firstResult.paceLabel).toBe('FIRST RUN')
    expect(firstResult.gateSplits).toEqual([1, 2])
    expect(firstResult.completionCount).toBe(1)
    expect(firstResult.bestTimeSec).toBe(2)
    expect(store.get('blackout.trace.seed:trace')).toBe('[1,2]')
    expect(store.get('blackout.history.seed:trace')).toBe('{"completionCount":1,"bestTimeSec":2,"peakSpeedKts":16}')

    const retry = new ChallengeRun(scoreStore)
    retry.reset('seed:trace', 2)
    retry.update(0.5, 8)
    retry.recordGate(1)
    expect(retry.gatePaceLabel).toBe('AHEAD 0.50S')
    retry.update(0.5, 8)
    retry.recordGate(1)
    const retryResult = retry.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    })!
    expect(retryResult.paceLabel).toBe('AHEAD 1.00S')
    expect(retryResult.bestGateSplits).toEqual([1, 2])
    expect(retryResult.completionCount).toBe(2)
    expect(retryResult.bestTimeSec).toBe(1)
    expect(retryResult.courseBestPeakSpeedKts).toBe(16)
    expect(formatSplitTrace(retryResult.gateSplits, retryResult.bestGateSplits))
      .toBe('G1 0:00.50 -0.50 · G2 0:01.00 -1.00')
    expect(formatPaceDelta(0)).toBe('ON PACE')
    expect(formatPaceDelta(Number.NaN)).toBe('FIRST RUN')
  })

  it('persists the best precision streak per course without changing score math', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('seed:streak-record', 3)
    run.recordGate(0.9)
    run.recordGate(0.82)
    run.recordGate(0.4)
    const result = run.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    })!
    expect(result.bestPrecisionStreak).toBe(2)
    expect(result.courseBestPrecisionStreak).toBe(2)
    expect(readBestCoursePrecisionStreak(storage, 'seed:streak-record')).toBe(2)

    const retry = new ChallengeRun(storage)
    retry.reset('seed:streak-record', 3)
    retry.recordGate(0.9)
    retry.recordGate(0.4)
    retry.recordGate(0.9)
    const retryResult = retry.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    })!
    expect(retryResult.bestPrecisionStreak).toBe(1)
    expect(retryResult.courseBestPrecisionStreak).toBe(2)
  })

  it('fails closed when completion history storage is malformed', () => {
    const storage = {
      getItem: () => '{"completionCount":"bad","bestTimeSec":null}',
    }
    expect(readCourseHistory(storage, 'seed:bad:orbit')).toEqual({
      completionCount: 0,
      bestTimeSec: Number.POSITIVE_INFINITY,
    })
    expect(readCourseHistory(null, 'seed:none:orbit')).toBeNull()
  })

  it('repairs malformed completion history once and keeps a canonical record', () => {
    const values = new Map<string, string>([
      ['blackout.history.seed:repair:orbit', '{"completionCount":2.9,"bestTimeSec":null,"debug":"drop"}'],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(repairCourseHistory(storage, 'seed:repair:orbit')).toEqual({
      completionCount: 2,
      bestTimeSec: Number.POSITIVE_INFINITY,
    })
    expect(values.get('blackout.history.seed:repair:orbit')).toBe('{"completionCount":2}')
    expect(repairCourseHistory(storage, 'seed:repair:orbit')).toEqual({
      completionCount: 2,
      bestTimeSec: Number.POSITIVE_INFINITY,
    })
    expect(values.get('blackout.history.seed:repair:orbit')).toBe('{"completionCount":2}')
  })

  it('keeps course peak records bounded across completed runs', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const first = new ChallengeRun(storage)
    first.reset('seed:peaks', 1)
    first.update(0.1, 120, 300)
    first.recordGate(1)
    const firstResult = first.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    })!
    expect(firstResult.courseBestPeakSpeedKts).toBe(233)
    expect(firstResult.courseBestPeakAltitudeM).toBe(300)
    expect(values.get('blackout.history.seed:peaks')).toBe(
      '{"completionCount":1,"bestTimeSec":0.1,"peakSpeedKts":233,"peakAltitudeM":300}',
    )

    const retry = new ChallengeRun(storage)
    retry.reset('seed:peaks', 1)
    retry.update(0.1, 80, 100)
    retry.recordGate(1)
    const retryResult = retry.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    })!
    expect(retryResult.courseBestPeakSpeedKts).toBe(233)
    expect(retryResult.courseBestPeakAltitudeM).toBe(300)
  })

  it('keeps route scoring emphasis explicit and sum-stable', () => {
    for (const focus of ['balanced', 'gates', 'pace', 'landing'] as const) {
      const weights = scoringWeightsForFocus(focus)
      expect(weights.gate + weights.time + weights.landing).toBe(100_000)
      expect(weights.minimumTime).toBeGreaterThan(0)
    }
    expect(scoringWeightsForFocus('gates').gate).toBeGreaterThan(scoringWeightsForFocus('balanced').gate)
    expect(scoringWeightsForFocus('pace').time).toBeGreaterThan(scoringWeightsForFocus('balanced').time)
    expect(scoringWeightsForFocus('landing').landing).toBeGreaterThan(scoringWeightsForFocus('balanced').landing)
  })

  it('captures sanitized fuel usage in a completed result without changing scores', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:fuel-result', 1)
    run.recordGate(1)
    const result = run.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    }, 0.72)!
    expect(result.fuelRemainingPercent).toBe(72)
    expect(result.fuelUsedPercent).toBe(28)
    expect(Number.isFinite(result.totalScore)).toBe(true)

    run.reset('seed:fuel-result-2', 1)
    run.recordGate(1)
    const malformed = run.finishLanding({
      verticalSpeed: -1,
      groundSpeed: 20,
      pitchRad: 0,
      rollRad: 0,
    }, Number.NaN)!
    expect(malformed.fuelRemainingPercent).toBe(0)
    expect(malformed.fuelUsedPercent).toBe(100)
  })

  it('awards mastery badges from finite run quality thresholds', () => {
    expect(masteryBadgesForRun(1, 1, 1, 'gold')).toEqual([
      'first-flight',
      'gate-master',
      'landing-ace',
      'gold-run',
    ])
    expect(masteryBadgesForRun(0, Number.NaN, 0.89, 'complete')).toEqual([])
    expect(masteryBadgesForRun(1, 1, 1, 'gold', 3)).toEqual([
      'first-flight',
      'gate-master',
      'landing-ace',
      'streak-hunter',
      'gold-run',
    ])
    expect(MASTERY_BADGE_COUNT).toBe(5)
  })

  it('filters malformed and duplicate persisted badges', () => {
    const storage = {
      getItem: () => '["gold-run","unknown","gold-run","landing-ace"]',
    }
    expect(readMasteryBadges(storage, 'seed:badges')).toEqual(['gold-run', 'landing-ace'])
  })

  it('reads a finite persisted best score without leaking malformed values', () => {
    const values = new Map<string, string>([
      ['blackout.best.seed:score', '91234.8'],
    ])
    const storage = { getItem: (key: string) => values.get(key) ?? null }
    expect(readBestCourseScore(storage, 'seed:score')).toBe(91234)
    values.set('blackout.best.seed:score', 'not-a-score')
    expect(readBestCourseScore(storage, 'seed:score')).toBe(0)
    expect(readBestCourseScore(null, 'seed:none')).toBe(0)
  })

  it('repairs malformed best scores and badge arrays to canonical records', () => {
    const values = new Map<string, string>([
      ['blackout.best.seed:repair', '91234.8'],
      ['blackout.badges.seed:repair', '["gold-run","bad","gold-run"]'],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(repairBestCourseScore(storage, 'seed:repair')).toBe(91234)
    expect(values.get('blackout.best.seed:repair')).toBe('91234')
    expect(repairMasteryBadges(storage, 'seed:repair')).toEqual(['gold-run'])
    expect(values.get('blackout.badges.seed:repair')).toBe('["gold-run"]')
    expect(repairMasteryBadges(storage, 'seed:repair')).toEqual(['gold-run'])

    values.set('blackout.streak.seed:repair', '4.7')
    expect(repairBestCoursePrecisionStreak(storage, 'seed:repair')).toBe(4)
    expect(values.get('blackout.streak.seed:repair')).toBe('4')
  })

  it('prunes oversized local records to game-sized bounds', () => {
    const values = new Map<string, string>([
      ['blackout.best.seed:huge', String(Number.MAX_SAFE_INTEGER)],
      ['blackout.history.seed:huge', JSON.stringify({
        completionCount: Number.MAX_SAFE_INTEGER,
        bestTimeSec: 12,
      })],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    expect(repairBestCourseScore(storage, 'seed:huge')).toBe(MAX_BEST_SCORE)
    expect(values.get('blackout.best.seed:huge')).toBe(String(MAX_BEST_SCORE))
    expect(repairCourseHistory(storage, 'seed:huge')).toEqual({
      completionCount: MAX_COMPLETION_COUNT,
      bestTimeSec: 12,
    })
    expect(values.get('blackout.history.seed:huge')).toBe('{"completionCount":100000,"bestTimeSec":12}')
    values.set('blackout.history.seed:huge', JSON.stringify({
      completionCount: Number.MAX_SAFE_INTEGER,
      bestTimeSec: 12,
      peakSpeedKts: Number.MAX_SAFE_INTEGER,
      peakAltitudeM: Number.MAX_SAFE_INTEGER,
    }))
    expect(repairCourseHistory(storage, 'seed:huge')).toEqual({
      completionCount: MAX_COMPLETION_COUNT,
      bestTimeSec: 12,
      peakSpeedKts: MAX_PEAK_SPEED_KTS,
      peakAltitudeM: MAX_PEAK_ALTITUDE_M,
    })
    expect(values.get('blackout.history.seed:huge')).toBe(
      '{"completionCount":100000,"bestTimeSec":12,"peakSpeedKts":20000,"peakAltitudeM":100000}',
    )
    values.set('blackout.streak.seed:huge', String(Number.MAX_SAFE_INTEGER))
    expect(repairBestCoursePrecisionStreak(storage, 'seed:huge')).toBe(MAX_PRECISION_STREAK)
    expect(values.get('blackout.streak.seed:huge')).toBe(String(MAX_PRECISION_STREAK))
  })
})
