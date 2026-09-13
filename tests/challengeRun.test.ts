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
    run.update(0.5, 8)
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
    expect(store.get('blackout.history.seed:trace')).toBe('{"completionCount":1,"bestTimeSec":2}')

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
    expect(formatSplitTrace(retryResult.gateSplits, retryResult.bestGateSplits))
      .toBe('G1 0:00.50 -0.50 · G2 0:01.00 -1.00')
    expect(formatPaceDelta(0)).toBe('ON PACE')
    expect(formatPaceDelta(Number.NaN)).toBe('FIRST RUN')
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

  it('awards mastery badges from finite run quality thresholds', () => {
    expect(masteryBadgesForRun(1, 1, 1, 'gold')).toEqual([
      'first-flight',
      'gate-master',
      'landing-ace',
      'gold-run',
    ])
    expect(masteryBadgesForRun(0, Number.NaN, 0.89, 'complete')).toEqual([])
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
})
