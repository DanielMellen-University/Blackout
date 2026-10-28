import { flightRecordId } from '../src/core/FlightRevision'
import { describe, expect, it } from 'vitest'
import {
  ChallengeRun,
  courseMasteryTierForProgress,
  courseMasteryTierLabel,
  courseMasteryNextTierLabel,
  courseMasteryNextTierGoalLabel,
  altitudeMilestoneScore,
  boundedScore,
  formatPaceDelta,
  formatSplitTrace,
  formatTime,
  fuelEfficiencyScore,
  landingQualityLabel,
  landingQualityForMetrics,
  medalForScore,
  nextMedalTargetForScore,
  medalRank,
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
  MAX_APPROACH_SCORE,
  MAX_LANDING_QUALITY,
  MAX_DESTINATION_COUNT,
  MAX_BIOME_COUNT,
  MAX_WATER_BODY_COUNT,
  MAX_CONTRACT_WINS,
  MAX_CONTRACT_STREAK,
  MAX_CONTRACT_STREAK_BONUS,
  contractStreakBonusForStreak,
  runStreakBonusForStreak,
  MAX_RUN_STREAK_SCORE,
  MAX_RUN_STREAK,
  MAX_ALTITUDE_MILESTONE_SCORE,
  MAX_COMPLETION_COUNT,
  MAX_PEAK_ALTITUDE_M,
  MAX_PEAK_SPEED_KTS,
  MAX_PRECISION_STREAK,
  MAX_STORED_GATE_SPLITS,
  MASTERY_BADGE_COUNT,
  readBestCoursePrecisionStreak,
  repairBestCoursePrecisionStreak,
} from '../src/systems/ChallengeRun'

describe('ChallengeRun', () => {
  it('keeps score medal tiers finite and ordered', () => {
    expect(medalForScore(0)).toBe('complete')
    expect(medalForScore(63_999)).toBe('complete')
    expect(medalForScore(64_000)).toBe('bronze')
    expect(medalForScore(76_000)).toBe('silver')
    expect(medalForScore(88_000)).toBe('gold')
    expect(medalRank('complete')).toBeLessThan(medalRank('bronze'))
    expect(medalRank('bronze')).toBeLessThan(medalRank('silver'))
    expect(medalRank('silver')).toBeLessThan(medalRank('gold'))
  })

  it('returns the next finite medal threshold without overshooting gold', () => {
    expect(nextMedalTargetForScore(Number.NaN)).toEqual({ medal: 'bronze', score: 64_000 })
    expect(nextMedalTargetForScore(63_999)).toEqual({ medal: 'bronze', score: 64_000 })
    expect(nextMedalTargetForScore(64_000)).toEqual({ medal: 'silver', score: 76_000 })
    expect(nextMedalTargetForScore(76_000)).toEqual({ medal: 'gold', score: 88_000 })
    expect(nextMedalTargetForScore(88_000)).toBeNull()
  })

  it('turns climb tiers into a bounded score decision', () => {
    expect(altitudeMilestoneScore(Number.NaN)).toBe(0)
    expect(altitudeMilestoneScore(499)).toBe(0)
    expect(altitudeMilestoneScore(500)).toBe(200)
    expect(altitudeMilestoneScore(1_500)).toBe(500)
    expect(altitudeMilestoneScore(3_000)).toBe(900)
    expect(altitudeMilestoneScore(6_000)).toBe(MAX_ALTITUDE_MILESTONE_SCORE)
    expect(altitudeMilestoneScore(99_999)).toBe(MAX_ALTITUDE_MILESTONE_SCORE)
  })

  it('keeps legacy activities out of the new score and persists the result', () => {
    expect(boundedScore(117_500)).toBe(117_500)
    expect(boundedScore(117_501)).toBe(MAX_BEST_SCORE)
    expect(boundedScore(Number.NaN)).toBe(0)

    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    values.set('blackout.history.seed:score-cap', '{"completionCount":9,"bestTimeSec":2,"runStreak":9,"contractStreak":4}')
    run.reset('seed:score-cap', 1, 'balanced', 1, true)
    run.update(0.1, 8)
    run.recordAltitudeMilestone(6_000)
    run.recordStunt(12)
    run.recordCombo(20)
    for (let index = 0; index < 6; index += 1) run.recordDestination('city')
    for (const biome of ['plains', 'forest', 'rainforest', 'desert', 'mesa', 'swamp', 'hills', 'mountain', 'snow', 'water', 'ocean', 'tundra', 'savanna', 'volcanic', 'saltflat']) {
      run.recordBiome(biome)
    }
    run.recordGate(1)
    const result = run.finishAirborne(1)!
    expect(result.scoreCapped).toBe(false)
    expect(result.totalScore).toBe(94_968)
    expect(readBestCourseScore(storage, 'seed:score-cap')).toBe(result.totalScore)
  })

  it('tracks repeat completions without adding a streak payout', () => {
    expect(runStreakBonusForStreak(0)).toBe(0)
    expect(runStreakBonusForStreak(1)).toBe(0)
    expect(runStreakBonusForStreak(2)).toBe(250)
    expect(runStreakBonusForStreak(99)).toBe(MAX_RUN_STREAK_SCORE)
    expect(runStreakBonusForStreak(Number.NaN)).toBe(0)

    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const land = (run: ChallengeRun): NonNullable<ChallengeRun['result']> => {
      run.reset('seed:run-streak-score', 1)
      run.update(0.1, 8)
      run.recordGate(1)
      return run.finishAirborne()!
    }
    const first = land(new ChallengeRun(storage))
    const second = land(new ChallengeRun(storage))
    expect(first.runStreak).toBe(1)
    expect(first.runStreakScore).toBeUndefined()
    expect(second.runStreak).toBe(2)
    expect(second.runStreakScore).toBeUndefined()
  })

  it('starts the clock on the takeoff roll and scores the final gate airborne', () => {
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
    run.update(0.5, 8, 140, 0, 0, false, true, 0, 0, 4.25, 1, false, false, 140, 1, 160)
    expect(run.phase).toBe('running')
    expect(run.elapsedSec).toBeCloseTo(0.5)

    run.recordGate(1)
    run.recordGate(0.5)
    expect(run.phase).toBe('running')

    const result = run.finishAirborne()
    expect(result).not.toBeNull()
    expect(result!.gateScore).toBe(0)
    expect(result!.gatesCleared).toBe(2)
    expect(result!.gatesTotal).toBe(2)
    expect(result!.gatesCleared).not.toBe(result!.gateScore)
    expect(result!.totalScore).toBeGreaterThan(0)
    expect(result!.previousBestScore).toBe(0)
    expect(result!.isNewBest).toBe(true)
    expect(result!.courseBestMedal).toBe(result!.medal)
    expect(result!.newMedalRecord).toBe(true)

    const crashed = new ChallengeRun(null)
    crashed.reset('ridge', 5)
    crashed.update(1, 40, 180, 0, 0, false, true, 0, 0, 4.25, 1, false, false, 180, 1, 200)
    crashed.recordGate(1)
    const crash = crashed.crashDebrief(false)
    expect(crash.endedByCrash).toBe(true)
    expect(crash.failureReason).toBeUndefined()
    expect(crash.gatesCleared).toBe(1)
    expect(crash.gatesTotal).toBe(5)
    expect(crash.totalScore).toBe(0)
    expect(crash.courseId).toBe('ridge')

    const contractedCrash = new ChallengeRun(null)
    contractedCrash.reset('seed:contract-crash', 1, 'balanced', 0, true)
    contractedCrash.update(0.1, 8)
    const contractCrash = contractedCrash.crashDebrief(false, 'OBSTACLE')
    expect(contractCrash.contractKind).toBe('pace')
    expect(contractCrash.contractLabel).toBe('SPEED RUN')
    expect(contractCrash.contractDetail).toContain('FINISH UNDER')
    expect(contractCrash.contractComplete).toBe(false)
    expect(contractCrash.contractFailed).toBe(true)
    expect(contractCrash.contractProgress).toBeGreaterThan(0)
    expect(contractCrash.contractProgress).toBeLessThan(1)
    expect(contractCrash.contractScore).toBeUndefined()

    const ditch = new ChallengeRun(null)
    ditch.reset('coastal', 3)
    expect(ditch.crashDebrief(true).ditched).toBe(true)
    expect(ditch.crashDebrief(true, 'WATER CONTACT').failureReason).toBe('WATER CONTACT')
    expect(result!.peakSpeedKts).toBe(16)
    expect(result!.peakAltitudeM).toBe(140)
    expect(result!.flightDistanceM).toBe(160)
    expect(result!.peakPositiveG).toBe(4.25)
    expect(result!.peakNegativeG).toBe(0)
    expect(result!.newMasteryBadges).toEqual(['first-flight'])
    expect(result!.courseMasteryTier).toBe('pilot')
    expect(result!.courseMasteryTierLabel).toBe('PILOT')
    expect(result!.masteryTierPromoted).toBe(true)
    expect(readMasteryBadges({ getItem: (key) => store.get(key) ?? null }, 'seed:1'))
      .toEqual(['first-flight'])
    expect(run.phase).toBe('complete')
  })

  it('keeps an earned score preview separate from finish-only payouts', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:live-score', 2)
    expect(run.currentScorePreview).toBe(0)
    run.update(0.1, 8)
    run.recordGate(1)
    run.recordStunt(2)
    run.recordAltitudeMilestone(1_500)
    run.recordCombo(2)
    run.recordDestination('city')
    run.recordBiome('plains')
    expect(run.currentScorePreview).toBe(74_968)
    expect(run.currentScorePreview).toBeLessThan(MAX_BEST_SCORE)
  })

  it('keeps the completed-gate quality average separate from final score weighting', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:precision-average', 3)
    expect(run.currentGateQuality).toBeNaN()
    run.recordGate(1)
    run.recordGate(0.5)
    expect(run.currentGateQuality).toBeCloseTo(0.75)
    run.recordGate(0.25)
    expect(run.currentGateQuality).toBeCloseTo((1 + 0.5 + 0.25) / 3)
  })

  it('does not finish before the final gate', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:1', 2)
    run.recordGate(1)
    expect(
      run.finishAirborne(),
    ).toBeNull()
  })

  it.each(['free-flight', flightRecordId('free-flight')])('keeps free flight unscored and open after landing without altering saved mission records for %s', (freeId) => {
    const values = new Map([['blackout.history.free-flight', '{"runStreak":3,"runs":4}']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const saved = [...values]
    const run = new ChallengeRun(storage)
    run.reset(freeId, 0, 'balanced', 42, true)
    expect(run.objectiveLabel).toBe('Explore freely')
    expect(run.contractLabel).toBe('')
    run.update(0.5, 0)
    expect(run.phase).toBe('ready')
    run.update(0.5, 8, 160)
    expect(run.phase).toBe('running')
    expect(run.currentScorePreview).toBe(0)
    const result = run.finishAirborne()
    expect(result).toBeNull()
    expect(run.phase).toBe('running')
    run.update(1, 100, 1_500)
    expect(run.currentScorePreview).toBe(0)
    expect(run.peakAltitudeM).toBe(1_500)
    const crash = run.crashDebrief(true)
    expect(crash.freeFlight).toBe(true)
    expect(crash.endedByCrash).toBe(true)
    expect(crash.contractLabel).toBeUndefined()
    expect([...values]).toEqual(saved)
    run.reset('training-orbit', 1, 'balanced', 42)
    run.update(0.5, 100)
    run.recordGate(1)
    expect(run.phase).toBe('running')
    expect(run.finishAirborne()).not.toBeNull()
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
    const result = run.finishAirborne()
    expect(result?.bestPrecisionStreak).toBe(2)
  })

  it('tracks barrel rolls without a legacy score payout', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:stunt', 1)
    run.update(0.1, 8)
    run.recordStunt(2)
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.stuntRolls).toBe(2)
    expect(result.stuntScore).toBe(0)
    expect(result.totalScore).toBe(result.timeScore + result.flyingBonuses!.lowScore + result.flyingBonuses!.terrainScore + result.flyingBonuses!.speedScore)
  })

  it('tracks combos without a legacy score payout', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:combo', 1)
    run.update(0.1, 8)
    run.recordCombo(2)
    run.recordCombo(999)
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.bestCombo).toBe(20)
    expect(result.comboScore).toBeUndefined()
    expect(result.totalScore).toBe(result.timeScore + result.flyingBonuses!.lowScore + result.flyingBonuses!.terrainScore + result.flyingBonuses!.speedScore)
  })

  it('keeps fuel efficiency rewards finite and capped', () => {
    expect(fuelEfficiencyScore(1)).toBe(1_000)
    expect(fuelEfficiencyScore(0.72)).toBe(720)
    expect(fuelEfficiencyScore(-1)).toBe(0)
    expect(fuelEfficiencyScore(Number.NaN)).toBe(0)
    expect(fuelEfficiencyScore(99)).toBe(1_000)
  })




  it('awards no weather-landing bonus at the airborne finish', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:weather-score', 1)
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.weatherScore).toBeUndefined()
    expect(result.totalScore).toBe(result.timeScore + result.flyingBonuses!.lowScore + result.flyingBonuses!.terrainScore + result.flyingBonuses!.speedScore)
  })


  it('awards no night-landing bonus at the airborne finish', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:night-score', 1)
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.nightScore).toBeUndefined()
    expect(result.totalScore).toBe(result.timeScore + result.flyingBonuses!.lowScore + result.flyingBonuses!.terrainScore + result.flyingBonuses!.speedScore)
  })


  it('awards no deadstick bonus when an empty tank reaches the final gate', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:deadstick', 1)
    run.recordGate(1)
    const result = run.finishAirborne(0)!
    expect(result.deadstickScore).toBeUndefined()
    expect(result.totalScore).toBe(result.timeScore + result.flyingBonuses!.lowScore + result.flyingBonuses!.terrainScore + result.flyingBonuses!.speedScore)
  })

  it('tracks city and village destinations without a legacy score payout', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('seed:destination-score', 1)
    run.recordDestination('city')
    run.update(0.1, 8)
    run.recordDestination('city')
    run.recordDestination('village')
    run.recordDestination('invalid' as 'city')
    for (let index = 0; index < MAX_DESTINATION_COUNT + 2; index += 1) run.recordDestination('city')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.destinationCount).toBe(MAX_DESTINATION_COUNT)
    expect(result.destinationScore).toBeUndefined()
    expect(result.courseBestDestinationCount).toBe(MAX_DESTINATION_COUNT)
    expect(result.newDestinationRecord).toBe(true)
    expect(values.get('blackout.history.seed:destination-score')).toContain('"destinations":6')
    expect(result.totalScore).toBe(result.timeScore + result.flyingBonuses!.lowScore + result.flyingBonuses!.terrainScore + result.flyingBonuses!.speedScore)

    const retry = new ChallengeRun(storage)
    retry.reset('seed:destination-score', 1)
    retry.update(0.1, 8)
    retry.recordDestination('village')
    retry.recordGate(1)
    const retryResult = retry.finishAirborne()!
    expect(retryResult.courseBestDestinationCount).toBe(MAX_DESTINATION_COUNT)
    expect(retryResult.newDestinationRecord).toBe(false)

    values.set(
      'blackout.history.seed:destination-score',
      '{"completionCount":2,"bestTimeSec":4,"destinations":999,"extra":true}',
    )
    expect(repairCourseHistory(storage, 'seed:destination-score')?.destinations).toBe(MAX_DESTINATION_COUNT)
    expect(values.get('blackout.history.seed:destination-score')).toBe(
      '{"completionCount":2,"bestTimeSec":4,"destinations":6}',
    )
  })

  it('counts each identified settlement only once per sortie', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:destination-unique', 1)
    run.update(0.1, 8)
    run.recordDestination('city', 'cell-1')
    run.recordDestination('city', 'cell-1')
    run.recordDestination('village', 'cell-2')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.destinationCount).toBe(2)
    expect(result.destinationScore).toBeUndefined()
  })

  it('tracks distinct natural biomes without a legacy score payout', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('seed:biome-survey', 1)
    run.recordBiome('plains')
    expect(run.consumeBiomeSurveyCue()).toBeNull()
    run.update(0.1, 8)
    run.recordBiome('forest')
    expect(run.consumeBiomeSurveyCue()).toBe('forest')
    expect(run.consumeBiomeSurveyCue()).toBeNull()
    for (const biome of [
      'plains', 'forest', 'rainforest', 'desert', 'mesa', 'swamp', 'hills',
      'mountain', 'snow', 'water', 'ocean', 'tundra', 'savanna', 'volcanic', 'saltflat',
      'plains', 'runway', 'unknown',
    ]) run.recordBiome(biome)
    expect(run.biomeCount).toBe(MAX_BIOME_COUNT)
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.biomeCount).toBe(MAX_BIOME_COUNT)
    expect(result.biomeScore).toBeUndefined()
    expect(result.courseBestBiomeCount).toBe(MAX_BIOME_COUNT)
    expect(result.newBiomeRecord).toBe(true)
    expect(values.get('blackout.history.seed:biome-survey')).toContain(`"biomes":${MAX_BIOME_COUNT}`)
    expect(result.totalScore).toBe(result.timeScore + result.flyingBonuses!.lowScore + result.flyingBonuses!.terrainScore + result.flyingBonuses!.speedScore)

    const retry = new ChallengeRun(storage)
    retry.reset('seed:biome-survey', 1)
    retry.update(0.1, 8)
    retry.recordBiome('plains')
    retry.recordGate(1)
    const retryResult = retry.finishAirborne()!
    expect(retryResult.courseBestBiomeCount).toBe(MAX_BIOME_COUNT)
    expect(retryResult.newBiomeRecord).toBe(false)

    values.set(
      'blackout.history.seed:biome-survey',
      '{"completionCount":2,"bestTimeSec":4,"biomes":999,"extra":true}',
    )
    expect(repairCourseHistory(storage, 'seed:biome-survey')?.biomes).toBe(MAX_BIOME_COUNT)
    expect(values.get('blackout.history.seed:biome-survey')).toBe(
      `{"completionCount":2,"bestTimeSec":4,"biomes":${MAX_BIOME_COUNT}}`,
    )
  })

  it('tracks distinct waterway families without double-counting crossings', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('seed:water-survey', 1)
    expect(run.waterBodyCount).toBe(0)
    run.recordWaterBody('stream')
    expect(run.waterBodyCount).toBe(1)
    run.update(0.1, 8)
    expect(run.consumeWaterBodySurveyCue()).toBeNull()
    run.recordWaterBody('lake')
    expect(run.waterBodyCount).toBe(2)
    expect(run.consumeWaterBodySurveyCue()).toBe('lake')
    expect(run.consumeWaterBodySurveyCue()).toBeNull()
    run.recordWaterBody('river')
    run.recordWaterBody('sea')
    run.recordWaterBody('pond')
    expect(run.waterBodyCount).toBe(MAX_WATER_BODY_COUNT)
    expect(run.consumeWaterBodySurveyCue()).toBe('sea')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.waterBodyCount).toBe(MAX_WATER_BODY_COUNT)
    expect(result.courseBestWaterBodyCount).toBe(MAX_WATER_BODY_COUNT)
    expect(result.newWaterBodyRecord).toBe(true)
    expect(values.get('blackout.history.seed:water-survey')).toContain(`"waterBodies":${MAX_WATER_BODY_COUNT}`)
    values.set(
      'blackout.history.seed:water-survey',
      '{"completionCount":2,"bestTimeSec":4,"waterBodies":999,"extra":true}',
    )
    expect(repairCourseHistory(storage, 'seed:water-survey')?.waterBodies).toBe(MAX_WATER_BODY_COUNT)
    expect(values.get('blackout.history.seed:water-survey')).toBe(
      `{"completionCount":2,"bestTimeSec":4,"waterBodies":${MAX_WATER_BODY_COUNT}}`,
    )
  })

  it('tracks consecutive completed sorties, resets on failure, and repairs oversized records', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const complete = (run: ChallengeRun): NonNullable<ReturnType<ChallengeRun['finishAirborne']>> => {
      run.reset('seed:run-streak', 1)
      run.update(0.1, 8)
      run.recordGate(1)
      return run.finishAirborne()!
    }

    const first = complete(new ChallengeRun(storage))
    expect(first.runStreak).toBe(1)
    expect(first.courseBestRunStreak).toBe(1)
    expect(first.newRunStreakRecord).toBe(false)

    const second = complete(new ChallengeRun(storage))
    expect(second.runStreak).toBe(2)
    expect(second.courseBestRunStreak).toBe(2)
    expect(second.newRunStreakRecord).toBe(true)
    expect(values.get('blackout.history.seed:run-streak')).toContain('"runStreak":2')
    expect(values.get('blackout.history.seed:run-streak')).toContain('"runStreakRecord":2')

    const failed = new ChallengeRun(storage)
    failed.reset('seed:run-streak', 1)
    failed.update(0.1, 8)
    failed.fail()
    expect(readCourseHistory(storage, 'seed:run-streak')?.runStreak).toBeUndefined()
    expect(readCourseHistory(storage, 'seed:run-streak')?.runStreakRecord).toBe(2)

    const afterFailure = complete(new ChallengeRun(storage))
    expect(afterFailure.runStreak).toBe(1)
    expect(afterFailure.courseBestRunStreak).toBe(2)
    expect(afterFailure.newRunStreakRecord).toBe(false)

    values.set(
      'blackout.history.seed:run-streak',
      '{"completionCount":2,"bestTimeSec":4,"runStreak":9999,"runStreakRecord":-4,"extra":true}',
    )
    expect(repairCourseHistory(storage, 'seed:run-streak')?.runStreak).toBe(MAX_RUN_STREAK)
    expect(repairCourseHistory(storage, 'seed:run-streak')?.runStreakRecord).toBe(MAX_RUN_STREAK)
    expect(values.get('blackout.history.seed:run-streak')).toBe(
      `{"completionCount":2,"bestTimeSec":4,"runStreak":${MAX_RUN_STREAK},"runStreakRecord":${MAX_RUN_STREAK}}`,
    )
  })

  it('keeps timer-band tasks off a normal sortie', () => {
    const run = new ChallengeRun(null)
    for (let seed = 0; seed < 48; seed += 1) {
      run.reset('seed:live-pool', 5, 'balanced', seed)
      const label = run.contractLabel
      expect(label).not.toContain('THERMAL SURF')
      expect(label).not.toContain('ENERGY BAND')
      expect(label).not.toContain('GUST RIDER')
      expect(label).not.toContain('TRAFFIC WATCH')
      expect(label).not.toContain('FUEL SAVER')
    }
  })

  it('tracks a deterministic contract at the airborne finish', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:contract', 1, 'balanced', 0, true)
    expect(run.contractLabel).toBe('CONTRACT SPEED RUN')
    expect(run.contractProgress).toBe(0)
    expect(run.contractComplete).toBe(false)
    expect(run.contractBriefing).toContain('FINISH UNDER')
    run.update(0.1, 8)
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('pace')
    expect(result.contractComplete).toBe(true)
    expect(result.contractProgress).toBe(1)
    expect(result.contractScore).toBeUndefined()
    expect(result.contractWins).toBe(1)
    expect(result.courseBestContractWins).toBe(1)
    expect(result.newContractRecord).toBe(true)
    expect(result.totalScore).toBe(result.timeScore + result.flyingBonuses!.lowScore + result.flyingBonuses!.terrainScore + result.flyingBonuses!.speedScore)
  })

  it('shows elapsed speed-run budget during the sortie', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:speed-live', 5, 'balanced', 0, true)
    expect(run.contractLabel).toBe('CONTRACT SPEED RUN')
    run.update(4, 8)
    run.update(5, 8)
    run.update(3, 8)
    expect(run.contractProgress).toBeCloseTo(12 / 68)
    expect(run.contractDetail).toContain('ELAPSED 12S')
    expect(run.contractComplete).toBe(false)
  })

  it('shows live fuel reserve progress before the FUEL SAVER finish', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:fuel-live', 1, 'balanced', 1, true)
    expect(run.contractLabel).toBe('CONTRACT FUEL SAVER')
    run.update(0.1, 8, 180, 0, 0, false, true, 0, 0, 1, 0.5)
    expect(run.contractProgress).toBeCloseTo(2 / 3)
    expect(run.contractDetail).toContain('CURRENT 50%')
    expect(run.contractComplete).toBe(false)
    run.update(0.1, 8, 180, 0, 0, false, true, 0, 0, 1, 0.8)
    expect(run.contractDetail).toContain('CURRENT 80%')
    expect(run.contractComplete).toBe(false)
    run.recordGate(1)
    expect(run.finishAirborne(0.8)!.contractComplete).toBe(true)
  })

  it('emits one live cue when an event contract is completed', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:contract-event', 1, 'balanced', 6, true)
    expect(run.contractLabel).toBe('CONTRACT AIRSHOW')
    run.recordStunt(2)
    expect(run.consumeContractCompletionCue()).toBe('AIRSHOW')
    expect(run.consumeContractCompletionCue()).toBeNull()
  })

  it('requires a selected radar destination for the radar-run contract', () => {
    const run = new ChallengeRun(null)
    let targetSeed = -1
    for (let seed = 0; seed < 4_096; seed += 1) {
      run.reset('seed:radar-run', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT RADAR RUN') {
        targetSeed = seed
        break
      }
    }
    expect(targetSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:radar-run', 1, 'balanced', targetSeed, true)
    expect(run.contractBriefing).toContain('LOCK ONE RADAR CONTACT')
    run.update(0.1, 8)
    run.recordDestination('city', 'city-1')
    expect(run.contractComplete).toBe(false)
    run.recordRadarLock(true, 'city', 'city-1')
    expect(run.contractProgress).toBeCloseTo(0.5)
    run.recordDestination('city', 'city-1')
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('RADAR RUN')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('target')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires weather gust telemetry into the gust-rider contract', () => {
    const run = new ChallengeRun(null)
    let gustSeed = -1
    for (let seed = 0; seed < 4_096; seed += 1) {
      run.reset('seed:gust-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT GUST RIDER') {
        gustSeed = seed
        break
      }
    }
    expect(gustSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:gust-contract', 1, 'balanced', gustSeed, true)
    expect(run.contractBriefing).toContain('FLY THROUGH STRONG GUSTS')
    run.update(4, 8, 180, 0, 0, false, true, 0, 0, 1, 1, false, false, 180, 1, 0, 0.8)
    expect(run.contractProgress).toBeCloseTo(0.4)
    run.update(6, 8, 180, 0, 0, false, true, 0, 0, 1, 1, false, false, 180, 1, 0, 0.8)
    run.update(1, 8, 180, 0, 0, false, true, 0, 0, 1, 1, false, false, 180, 1, 0, 0.8)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('GUST RIDER')
  })

  it('wires fixed-step flight distance into the range-run contract', () => {
    const run = new ChallengeRun(null)
    let rangeSeed = -1
    for (let seed = 0; seed < 4_096; seed += 1) {
      run.reset('seed:range-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT RANGE RUN') {
        rangeSeed = seed
        break
      }
    }
    expect(rangeSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:range-contract', 1, 'balanced', rangeSeed, true)
    expect(run.contractBriefing).toContain('FLY 12KM BEFORE THE FINAL GATE')
    run.update(0.1, 8)
    run.update(1, 8, 180, 0, 0, false, false, 0, 0, 1, 1, false, false, 180, 1, 5_000)
    expect(run.contractProgress).toBe(0)
    run.update(1, 8, 180, 0, 0, false, true, 0, 0, 1, 1, false, false, 180, 1, 5_000)
    expect(run.contractProgress).toBeCloseTo(5 / 12)
    run.update(1, 8, 180, 0, 0, false, true, 0, 0, 1, 1, false, false, 180, 1, 7_000)
    expect(run.contractComplete).toBe(false)
    expect(run.consumeContractCompletionCue()).toBeNull()
    run.recordGate(1)
    expect(run.finishAirborne()!.contractComplete).toBe(true)
  })

  it('turns low-level contract time into a bounded terrain-hugger reward', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:low-level', 1, 'balanced', 11, true)
    expect(run.contractLabel).toBe('CONTRACT TERRAIN HUGGER')
    run.update(4, 8, 180)
    expect(run.contractProgress).toBeCloseTo(0.4)
    run.update(5, 8, 180)
    run.update(1, 8, 180)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('TERRAIN HUGGER')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('low-level')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('uses rendered terrain clearance for terrain-hugger progress', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:terrain-clearance-contract', 1, 'balanced', 11, true)
    expect(run.contractLabel).toBe('CONTRACT TERRAIN HUGGER')
    run.update(4, 8, 180, 0, 0, false, true, 0, 0, 1, 1, false, false, 480)
    expect(run.contractProgress).toBe(0)
    run.update(4, 8, 180, 0, 0, false, true, 0, 0, 1, 1, false, false, 180)
    expect(run.contractProgress).toBeCloseTo(0.4)
  })

  it('wires distinct biome progress into the biome-tour contract', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:biome-contract', 1, 'balanced', 8, true)
    expect(run.contractLabel).toBe('CONTRACT BIOME TOUR')
    run.recordBiome('plains')
    run.update(0.1, 8)
    run.recordBiome('forest')
    run.recordBiome('desert')
    run.recordBiome('mountain')
    expect(run.contractComplete).toBe(true)
    expect(run.contractProgress).toBe(1)
    expect(run.consumeContractCompletionCue()).toBe('BIOME TOUR')
    expect(run.consumeContractCompletionCue()).toBeNull()
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('biome')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires precipitation time into the storm-run contract', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:weather-contract', 1, 'balanced', 10, true)
    expect(run.contractLabel).toBe('CONTRACT STORM RUN')
    run.update(5, 8, 180, 0.6, 0)
    expect(run.contractProgress).toBeCloseTo(5 / 14)
    run.update(5, 8, 180, 0, 0.7)
    run.update(4, 8, 180, 0.6, 0)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('STORM RUN')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('weather')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires rendered water time into the water-run contract', () => {
    const run = new ChallengeRun(null)
    let waterSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:water-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT WATER RUN') {
        waterSeed = seed
        break
      }
    }
    expect(waterSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:water-contract', 1, 'balanced', waterSeed, true)
    run.update(0.1, 8)
    run.recordWater(false, 5)
    expect(run.contractProgress).toBe(0)
    run.recordWater(true, 5)
    expect(run.contractProgress).toBeCloseTo(5 / 12)
    run.recordWater(true, 5)
    run.recordWater(true, 5)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('WATER RUN')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('water')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires terrain surveys into the ridge-run contract', () => {
    const run = new ChallengeRun(null)
    let ridgeSeed = -1
    for (let seed = 0; seed < 2_048; seed += 1) {
      run.reset('seed:ridge-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT RIDGE RUN') {
        ridgeSeed = seed
        break
      }
    }
    expect(ridgeSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:ridge-contract', 1, 'balanced', ridgeSeed, true)
    expect(run.contractBriefing).toContain('HOLD RIDGE ALT')
    run.update(0.1, 8)
    run.recordRidgeRun('plains', 120, 5)
    expect(run.contractProgress).toBe(0)
    run.recordRidgeRun('mountain', 120, 4)
    expect(run.contractProgress).toBeCloseTo(0.4)
    run.recordRidgeRun('volcanic', 120, 5)
    run.recordRidgeRun('hills', 120, 1)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('RIDGE RUN')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('ridge-run')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires rendered water-body labels into WATERWAY TOUR', () => {
    const run = new ChallengeRun(null)
    let waterwaySeed = -1
    for (let seed = 0; seed < 2_048; seed += 1) {
      run.reset('seed:waterway-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT WATERWAY TOUR') {
        waterwaySeed = seed
        break
      }
    }
    expect(waterwaySeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:waterway-contract', 1, 'balanced', waterwaySeed, true)
    expect(run.contractBriefing).toContain('VISIT TWO WATERWAYS')
    run.update(0.1, 8)
    run.recordWaterBody('river')
    expect(run.contractProgress).toBeCloseTo(0.5)
    expect(run.consumeContractProgressCue()).toBe('RIVER DISCOVERED')
    run.recordWaterBody('stream')
    expect(run.contractProgress).toBeCloseTo(0.5)
    expect(run.consumeContractProgressCue()).toBeNull()
    run.recordWaterBody('lake')
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractProgressCue()).toBeNull()
    expect(run.consumeContractCompletionCue()).toBe('WATERWAY TOUR')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('waterway-tour')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('surfaces partial progress for the catalog traffic contract', () => {
    const run = new ChallengeRun(null)
    run.reset('traffic-run', 1, 'range', 348, true)
    expect(run.contractLabel).toBe('CONTRACT TRAFFIC WATCH')
    run.recordTrafficPass('traffic-1')
    expect(run.contractProgress).toBeCloseTo(1 / 3)
    expect(run.consumeContractProgressCue()).toBe('TRAFFIC CONTACT CLEARED')
    run.recordTrafficPass('traffic-1')
    expect(run.consumeContractProgressCue()).toBeNull()
    run.recordTrafficPass('traffic-2')
    run.recordTrafficPass('traffic-3')
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractProgressCue()).toBeNull()
    expect(run.consumeContractCompletionCue()).toBe('TRAFFIC WATCH')
  })

  it('wires high-speed speed-brake time into the brake-check contract', () => {
    const run = new ChallengeRun(null)
    let brakeSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:brake-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT BRAKE CHECK') {
        brakeSeed = seed
        break
      }
    }
    expect(brakeSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:brake-contract', 1, 'balanced', brakeSeed, true)
    run.update(0.1, 8)
    run.update(2, 240, 180, 0, 0, true, true)
    expect(run.contractProgress).toBeCloseTo(0.4)
    run.update(3, 240, 180, 0, 0, true, true)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('BRAKE CHECK')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('brake')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires controlled engine heat into the thermal-control contract', () => {
    const run = new ChallengeRun(null)
    let heatSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:heat-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT THERMAL CONTROL') {
        heatSeed = seed
        break
      }
    }
    expect(heatSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:heat-contract', 1, 'balanced', heatSeed, true)
    run.update(0.1, 8)
    run.update(4, 220, 180, 0, 0, false, true, 0.5)
    expect(run.contractProgress).toBeCloseTo(1 / 3)
    run.update(5, 220, 180, 0, 0, false, true, 0.5)
    run.update(5, 220, 180, 0, 0, false, true, 0.5)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('THERMAL CONTROL')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('heat')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires runway-relative wind into the crosswind contract', () => {
    const run = new ChallengeRun(null)
    let crosswindSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:crosswind-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT CROSSWIND') {
        crosswindSeed = seed
        break
      }
    }
    expect(crosswindSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:crosswind-contract', 1, 'balanced', crosswindSeed, true)
    run.update(0.1, 8)
    run.update(4, 220, 180, 0, 0, false, true, 0, 12)
    expect(run.contractProgress).toBeCloseTo(0.4)
    run.update(5, 220, 180, 0, 0, false, true, 0, 12)
    run.update(1, 220, 180, 0, 0, false, true, 0, 12)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('CROSSWIND')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('crosswind')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires smoothed load telemetry into the G-control contract', () => {
    const run = new ChallengeRun(null)
    let gControlSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:g-control-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT G CONTROL') {
        gControlSeed = seed
        break
      }
    }
    expect(gControlSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:g-control-contract', 1, 'balanced', gControlSeed, true)
    run.update(0.1, 8)
    run.update(4, 180, 180, 0, 0, false, true, 0, 0, 2)
    expect(run.contractProgress).toBeCloseTo(1 / 3)
    run.update(5, 180, 180, 0, 0, false, true, 0, 0, 2)
    run.update(3, 180, 180, 0, 0, false, true, 0, 0, 2)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('G CONTROL')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('g-control')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires fuel-out recovery into the deadstick contract', () => {
    const run = new ChallengeRun(null)
    let deadstickSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:deadstick-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT DEADSTICK') {
        deadstickSeed = seed
        break
      }
    }
    expect(deadstickSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:deadstick-contract', 1, 'balanced', deadstickSeed, true)
    run.update(0.1, 8)
    run.update(1, 180, 180, 0, 0, false, false, 0, 0, 1, 0)
    expect(run.contractComplete).toBe(false)
    run.update(1, 180, 180, 0, 0, false, true, 0, 0, 1, 0.00005)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('DEADSTICK')
    run.recordGate(1)
    const result = run.finishAirborne(0)
    expect(result?.contractKind).toBe('deadstick')
    expect(result?.contractComplete).toBe(true)
    expect(result?.contractScore).toBeUndefined()
  })

  it('wires active afterburner time into the burn-run contract', () => {
    const run = new ChallengeRun(null)
    let boostSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:boost-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT BURN RUN') {
        boostSeed = seed
        break
      }
    }
    expect(boostSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:boost-contract', 1, 'balanced', boostSeed, true)
    run.update(0.1, 8)
    run.update(3, 260, 180, 0, 0, false, true, 0, 0, 1, 1, false, true)
    expect(run.contractProgress).toBeCloseTo(3 / 8)
    run.update(5, 260, 180, 0, 0, false, true, 0, 0, 1, 1, false, true)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('BURN RUN')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('boost')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires supersonic time into the Mach-run contract', () => {
    const run = new ChallengeRun(null)
    let machSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:mach-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT MACH RUN') {
        machSeed = seed
        break
      }
    }
    expect(machSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:mach-contract', 1, 'balanced', machSeed, true)
    run.update(0.1, 8)
    run.update(4, 360, 180)
    expect(run.contractProgress).toBeCloseTo(0.4)
    run.update(5, 360, 180)
    run.update(1, 360, 180)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('MACH RUN')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('mach')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires stable altitude time into the level-flight contract', () => {
    const run = new ChallengeRun(null)
    let levelSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:level-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT LEVEL FLIGHT') {
        levelSeed = seed
        break
      }
    }
    expect(levelSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:level-contract', 1, 'balanced', levelSeed, true)
    run.update(0.1, 8)
    run.update(5, 8, 300)
    expect(run.contractProgress).toBeCloseTo(0.5)
    run.update(5, 8, 318)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('LEVEL FLIGHT')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('level')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires city and village arrivals into the settlement-tour contract', () => {
    const run = new ChallengeRun(null)
    let tourSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:tour-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT SETTLEMENT TOUR') {
        tourSeed = seed
        break
      }
    }
    expect(tourSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:tour-contract', 1, 'balanced', tourSeed, true)
    run.update(0.1, 8)
    run.recordDestination('city')
    expect(run.contractProgress).toBeCloseTo(0.5)
    expect(run.consumeContractProgressCue()).toBe('CITY VISITED')
    run.recordDestination('city')
    expect(run.contractProgress).toBeCloseTo(0.5)
    expect(run.consumeContractProgressCue()).toBeNull()
    run.recordDestination('village')
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractProgressCue()).toBeNull()
    expect(run.consumeContractCompletionCue()).toBe('SETTLEMENT TOUR')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('tour')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires the existing combo chain into the combo-run contract', () => {
    const run = new ChallengeRun(null)
    let comboSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:combo-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT COMBO RUN') {
        comboSeed = seed
        break
      }
    }
    expect(comboSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:combo-contract', 1, 'balanced', comboSeed, true)
    run.update(0.1, 8)
    run.recordCombo(2)
    expect(run.contractProgress).toBeCloseTo(2 / 3)
    run.recordCombo(3)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('COMBO RUN')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('combo')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires gate quality into the precision-chain contract', () => {
    const run = new ChallengeRun(null)
    let precisionSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:precision-contract', 5, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT PRECISION CHAIN') {
        precisionSeed = seed
        break
      }
    }
    expect(precisionSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:precision-contract', 5, 'balanced', precisionSeed, true)
    run.recordGate(0.9)
    run.recordGate(0.4)
    expect(run.contractProgress).toBe(0)
    run.recordGate(0.9)
    expect(run.contractProgress).toBeCloseTo(1 / 3)
    run.recordGate(0.9)
    run.recordGate(0.9)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('PRECISION CHAIN')
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('precision')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('wires atmosphere daylight into the night-flight contract', () => {
    const run = new ChallengeRun(null)
    let nightSeed = -1
    for (let seed = 0; seed < 2_048; seed += 1) {
      run.reset('seed:night-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT NIGHT FLIGHT') {
        nightSeed = seed
        break
      }
    }
    expect(nightSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:night-contract', 1, 'balanced', nightSeed, true)
    run.update(0.1, 8)
    run.update(4, 220, 300, 0, 0, false, true, 0, 0, 1, 1, false, false, 300, 0.2)
    expect(run.contractProgress).toBeCloseTo(1 / 3)
    run.update(5, 220, 300, 0, 0, false, true, 0, 0, 1, 1, false, false, 300, 0.2)
    run.update(3, 220, 300, 0, 0, false, true, 0, 0, 1, 1, false, false, 300, 0.2)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('NIGHT FLIGHT')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('night')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('marks a clean-circuit contract failed after a missed gate', () => {
    const run = new ChallengeRun(null)
    let cleanSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:clean-contract', 2, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT CLEAN CIRCUIT') {
        cleanSeed = seed
        break
      }
    }
    expect(cleanSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:clean-contract', 2, 'balanced', cleanSeed, true)
    run.update(0.1, 8)
    run.recordGateMiss()
    expect(run.gateMisses).toBe(1)
    expect(run.contractFailed).toBe(true)
    expect(run.consumeContractFailureCue()).toBe('CLEAN CIRCUIT')
    expect(run.consumeContractFailureCue()).toBeNull()
    run.recordGate(1)
    expect(run.contractComplete).toBe(false)
    run.recordGate(1)
    expect(run.consumeContractCompletionCue()).toBeNull()
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('clean')
    expect(result.contractFailed).toBe(true)
    expect(result.contractComplete).toBe(false)
    expect(result.contractScore).toBeUndefined()
    expect(result.gateMisses).toBe(1)
  })

  it('emits the completion cue when every clean-circuit gate is passed', () => {
    const run = new ChallengeRun(null)
    let cleanSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:clean-contract', 2, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT CLEAN CIRCUIT') {
        cleanSeed = seed
        break
      }
    }
    expect(cleanSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:clean-contract', 2, 'balanced', cleanSeed, true)
    run.update(0.1, 8)
    run.recordGate(1)
    expect(run.consumeContractCompletionCue()).toBeNull()
    run.recordGate(1)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('CLEAN CIRCUIT')
  })

  it('wires weather-front transitions into the front-chaser contract', () => {
    const run = new ChallengeRun(null)
    let frontSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      run.reset('seed:front-contract', 1, 'balanced', seed, true)
      if (run.contractLabel === 'CONTRACT FRONT CHASER') {
        frontSeed = seed
        break
      }
    }
    expect(frontSeed).toBeGreaterThanOrEqual(0)
    run.reset('seed:front-contract', 1, 'balanced', frontSeed, true)
    run.update(0.1, 8)
    run.update(4, 180, 180, 0, 0, false, true, 0, 0, 1, 1, false)
    expect(run.contractProgress).toBe(0)
    run.update(4, 180, 180, 0, 0, false, true, 0, 0, 1, 1, true)
    expect(run.contractProgress).toBeCloseTo(1 / 3)
    run.update(5, 180, 180, 0, 0, false, true, 0, 0, 1, 1, true)
    run.update(3, 180, 180, 0, 0, false, true, 0, 0, 1, 1, true)
    expect(run.contractComplete).toBe(true)
    expect(run.consumeContractCompletionCue()).toBe('FRONT CHASER')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.contractKind).toBe('front')
    expect(result.contractComplete).toBe(true)
    expect(result.contractScore).toBeUndefined()
  })

  it('assigns no runway-alignment contract to gated runs', () => {
    const run = new ChallengeRun(null)
    for (let seed = 0; seed < 1_024; seed += 1) {
      for (const catalog of [false, true]) {
        run.reset('seed:approach-contract', 5, 'balanced', seed, catalog)
        expect(run.contractLabel).not.toBe('CONTRACT PRECISION APPROACH')
        expect(run.contractDetail).not.toContain('LAND')
      }
    }
  })

  it('persists cumulative contract wins and repairs oversized counts', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const finish = (fuel: number): NonNullable<ReturnType<ChallengeRun['finishAirborne']>> => {
      const run = new ChallengeRun(storage)
      run.reset('seed:contract-wins', 1, 'balanced', 1, true)
      run.update(0.1, 8)
      run.recordGate(1)
      return run.finishAirborne(fuel)!
    }

    const first = finish(1)
    expect(first.contractKind).toBe('fuel')
    expect(first.contractWins).toBe(1)
    expect(first.newContractRecord).toBe(true)
    const second = finish(1)
    expect(second.contractWins).toBe(2)
    expect(second.courseBestContractWins).toBe(2)
    expect(second.newContractRecord).toBe(true)
    const incomplete = finish(0)
    expect(incomplete.contractComplete).toBe(false)
    expect(incomplete.contractWins).toBe(2)
    expect(incomplete.newContractRecord).toBe(false)

    values.set(
      'blackout.history.seed:contract-wins',
      '{"completionCount":3,"bestTimeSec":2,"contractWins":9999,"extra":true}',
    )
    expect(repairCourseHistory(storage, 'seed:contract-wins')?.contractWins).toBe(MAX_CONTRACT_WINS)
    expect(values.get('blackout.history.seed:contract-wins')).toBe(
      `{"completionCount":3,"bestTimeSec":2,"contractWins":${MAX_CONTRACT_WINS}}`,
    )
  })

  it('builds a contract streak and resets it after an incomplete contract', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const complete = (): NonNullable<ReturnType<ChallengeRun['finishAirborne']>> => {
      const run = new ChallengeRun(storage)
      run.reset('seed:contract-streak', 1, 'balanced', 0, true)
      run.update(0.1, 8)
      run.recordGate(1)
      return run.finishAirborne()!
    }

    const first = complete()
    expect(first.contractStreak).toBe(1)
    expect(first.courseBestContractStreak).toBe(1)
    expect(first.newContractStreakRecord).toBe(false)
    expect(first.contractStreakBonus).toBeUndefined()

    const second = complete()
    expect(second.contractStreak).toBe(2)
    expect(second.courseBestContractStreak).toBe(2)
    expect(second.newContractStreakRecord).toBe(true)
    expect(second.contractStreakBonus).toBeUndefined()
    expect(values.get('blackout.history.seed:contract-streak')).toContain('"contractStreak":2')
    expect(values.get('blackout.history.seed:contract-streak')).toContain('"contractStreakRecord":2')

    const incomplete = new ChallengeRun(storage)
    incomplete.reset('seed:contract-streak', 1, 'balanced', 0, true)
    incomplete.update(0.1, 8)
    for (let i = 0; i < 12; i += 1) incomplete.update(5, 8)
    incomplete.recordGate(1)
    const failedContract = incomplete.finishAirborne()!
    expect(failedContract.contractComplete).toBe(false)
    expect(failedContract.contractStreak).toBeUndefined()
    expect(failedContract.courseBestContractStreak).toBe(2)
    expect(failedContract.newContractStreakRecord).toBe(false)
    expect(readCourseHistory(storage, 'seed:contract-streak')?.contractStreak).toBeUndefined()
    expect(readCourseHistory(storage, 'seed:contract-streak')?.contractStreakRecord).toBe(2)

    values.set(
      'blackout.history.seed:contract-streak',
      '{"completionCount":3,"bestTimeSec":2,"contractStreak":9999,"contractStreakRecord":-4,"extra":true}',
    )
    expect(repairCourseHistory(storage, 'seed:contract-streak')?.contractStreak).toBe(MAX_CONTRACT_STREAK)
    expect(repairCourseHistory(storage, 'seed:contract-streak')?.contractStreakRecord).toBe(MAX_CONTRACT_STREAK)
    expect(values.get('blackout.history.seed:contract-streak')).toBe(
      `{"completionCount":3,"bestTimeSec":2,"contractStreak":${MAX_CONTRACT_STREAK},"contractStreakRecord":${MAX_CONTRACT_STREAK}}`,
    )

    const crashed = new ChallengeRun(storage)
    crashed.reset('seed:contract-streak', 1, 'balanced', 0, true)
    crashed.update(0.1, 8)
    crashed.fail()
    expect(readCourseHistory(storage, 'seed:contract-streak')?.contractStreak).toBeUndefined()
    expect(readCourseHistory(storage, 'seed:contract-streak')?.contractStreakRecord).toBe(MAX_CONTRACT_STREAK)
  })

  it('keeps contract chain payouts finite and capped', () => {
    expect(contractStreakBonusForStreak(0)).toBe(0)
    expect(contractStreakBonusForStreak(3)).toBe(750)
    expect(contractStreakBonusForStreak(Number.NaN)).toBe(0)
    expect(contractStreakBonusForStreak(Number.MAX_SAFE_INTEGER)).toBe(MAX_CONTRACT_STREAK_BONUS)
  })

  it('preserves historical approach and touchdown records without scoring new ones', () => {
    const values = new Map<string, string>([
      ['blackout.history.seed:legacy-landing', '{"completionCount":2,"bestTimeSec":4,"approachScore":500,"landingQuality":0.793}'],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('seed:legacy-landing', 1, 'landing')
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.landingScore).toBe(0)
    expect(result.landingQuality).toBe(0)
    expect(result.landingLabel).toBeUndefined()
    expect(result.landingDebrief).toBeUndefined()
    expect(result.approachScore).toBeUndefined()
    expect(result.courseBestApproachScore).toBe(MAX_APPROACH_SCORE)
    expect(result.courseBestLandingQuality).toBe(0.793)
    expect(result.newApproachRecord).toBe(false)
    expect(result.newLandingQualityRecord).toBe(false)
    expect(readCourseHistory(storage, 'seed:legacy-landing')).toMatchObject({ approachScore: 500, landingQuality: 0.793 })

    values.set('blackout.history.seed:legacy-landing', '{"completionCount":2,"bestTimeSec":4,"approachScore":9999,"landingQuality":9999,"extra":true}')
    expect(repairCourseHistory(storage, 'seed:legacy-landing')).toMatchObject({ approachScore: MAX_APPROACH_SCORE, landingQuality: MAX_LANDING_QUALITY })
    expect(values.get('blackout.history.seed:legacy-landing')).toBe('{"completionCount":2,"bestTimeSec":4,"approachScore":500,"landingQuality":1}')
  })

  it('ignores legacy landing quality and retired badges in mastery progression', () => {
    const values = new Map<string, string>([
      ['blackout.history.seed:legacy-mastery', '{"completionCount":5,"bestTimeSec":4,"approachScore":500,"landingQuality":0.1,"contractWins":2}'],
      ['blackout.best.seed:legacy-mastery', '88000'],
      ['blackout.badges.seed:legacy-mastery', '["first-flight","gate-master","landing-ace","approach-ace","streak-hunter"]'],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('seed:legacy-mastery', 1)
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.courseMasteryTier).toBe('ace')
    expect(result.masteryTierPromoted).toBe(false)
    expect(result.courseBestLandingQuality).toBe(0.1)
    expect(readMasteryBadges(storage, 'seed:legacy-mastery')).toEqual(['first-flight', 'gate-master', 'streak-hunter'])
    expect(values.get('blackout.badges.seed:legacy-mastery')).toBe('["first-flight","gate-master","streak-hunter"]')
  })

  it('persists the best fuel reserve and rejects malformed reserve records', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const first = new ChallengeRun(storage)
    first.reset('seed:fuel-record', 1)
    first.recordGate(1)
    const firstResult = first.finishAirborne(0.72)!
    expect(firstResult.courseBestFuelRemainingPercent).toBe(72)
    expect(firstResult.newFuelRecord).toBe(true)
    expect(values.get('blackout.history.seed:fuel-record')).toContain('"fuelRemainingPercent":72')

    const retry = new ChallengeRun(storage)
    retry.reset('seed:fuel-record', 1)
    retry.recordGate(1)
    const retryResult = retry.finishAirborne(0.4)!
    expect(retryResult.courseBestFuelRemainingPercent).toBe(72)
    expect(retryResult.newFuelRecord).toBe(false)

    values.set(
      'blackout.history.seed:fuel-record',
      '{"completionCount":2,"bestTimeSec":4,"fuelRemainingPercent":999,"extra":true}',
    )
    expect(repairCourseHistory(storage, 'seed:fuel-record')?.fuelRemainingPercent).toBe(100)
    expect(values.get('blackout.history.seed:fuel-record')).toBe(
      '{"completionCount":2,"bestTimeSec":4,"fuelRemainingPercent":100}',
    )
  })

  it('persists the best combo per course and repairs oversized records', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const first = new ChallengeRun(storage)
    first.reset('seed:combo-record', 1)
    first.update(0.1, 8)
    first.recordCombo(6)
    first.recordGate(1)
    const result = first.finishAirborne()!
    expect(result.courseBestCombo).toBe(6)
    expect(result.newComboRecord).toBe(true)
    expect(values.get('blackout.history.seed:combo-record')).toContain('"combo":6')

    values.set(
      'blackout.history.seed:combo-record',
      '{"completionCount":2,"bestTimeSec":4,"combo":999,"extra":true}',
    )
    const repaired = new ChallengeRun(storage)
    repaired.reset('seed:combo-record', 1)
    repaired.recordGate(1)
    repaired.finishAirborne()
    expect(values.get('blackout.history.seed:combo-record')).toContain('"combo":20')
    expect(values.get('blackout.history.seed:combo-record')).not.toContain('extra')
  })

  it('persists the best barrel-roll count and repairs oversized records', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const first = new ChallengeRun(storage)
    first.reset('seed:stunt-record', 1)
    first.recordStunt(3)
    first.recordGate(1)
    const firstResult = first.finishAirborne()!
    expect(firstResult.courseBestStuntRolls).toBe(3)
    expect(firstResult.newStuntRecord).toBe(true)
    expect(values.get('blackout.history.seed:stunt-record')).toBe(
      '{"completionCount":1,"bestTimeSec":0,"stuntRolls":3,"fuelRemainingPercent":100,"runStreak":1,"runStreakRecord":1,"sortieStyle":"balanced"}',
    )

    const retry = new ChallengeRun(storage)
    retry.reset('seed:stunt-record', 1)
    retry.recordGate(1)
    const retryResult = retry.finishAirborne()!
    expect(retryResult.courseBestStuntRolls).toBe(3)
    expect(retryResult.newStuntRecord).toBe(false)

    values.set(
      'blackout.history.seed:stunt-record',
      '{"completionCount":2,"bestTimeSec":4,"stuntRolls":999,"extra":true}',
    )
    expect(repairCourseHistory(storage, 'seed:stunt-record')?.stuntRolls).toBe(12)
    expect(values.get('blackout.history.seed:stunt-record')).toBe(
      '{"completionCount":2,"bestTimeSec":4,"stuntRolls":12}',
    )
  })

  it('formats time with centiseconds', () => {
    expect(formatTime(75.5)).toBe('1:15.50')
    expect(formatTime(Number.NaN)).toBe('0:00.00')
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00.00')
  })

  it('keeps landing quality bands finite and readable', () => {
    expect(landingQualityLabel(1)).toBe('BUTTER')
    expect(landingQualityLabel(0.8)).toBe('SMOOTH')
    expect(landingQualityLabel(0.6)).toBe('FIRM')
    expect(landingQualityLabel(0.2)).toBe('HARD')
    expect(landingQualityLabel(Number.NaN)).toBe('HARD')
  })

  it('shares finite touchdown-quality math between preview and results', () => {
    expect(landingQualityForMetrics({
      verticalSpeed: -1.2,
      groundSpeed: 32,
      pitchRad: 0.22,
      rollRad: 0,
    })).toBe(1)
    expect(landingQualityForMetrics({
      verticalSpeed: -20,
      groundSpeed: 400,
      pitchRad: Number.NaN,
      rollRad: Number.POSITIVE_INFINITY,
    })).toBe(0)
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
    const result = run.finishAirborne()
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
    const result = run.finishAirborne()!
    expect(result.peakSpeedKts).toBe(233)
    expect(result.peakAltitudeM).toBe(900)
    expect(Number.isFinite(result.totalScore)).toBe(true)
  })

  it('persists best distance and load-factor records without changing score math', () => {
    const store = new Map<string, string>()
    const scoreStore = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    }
    const first = new ChallengeRun(scoreStore)
    first.reset('seed:flight-log', 1)
    first.update(1, 120, 500, 0, 0, false, true, 0, 0, 4.5, 1, false, false, 500, 1, 240)
    first.recordGate(1)
    const firstResult = first.finishAirborne()!
    expect(firstResult.courseBestFlightDistanceM).toBe(240)
    expect(firstResult.courseBestPositiveG).toBe(4.5)
    expect(firstResult.courseBestNegativeG).toBeUndefined()
    expect(firstResult.newFlightDistanceRecord).toBe(true)
    expect(firstResult.newPositiveGRecord).toBe(true)
    expect(JSON.parse(store.get('blackout.history.seed:flight-log')!)).toMatchObject({
      flightDistanceM: 240,
      peakPositiveG: 4.5,
    })

    const retry = new ChallengeRun(scoreStore)
    retry.reset('seed:flight-log', 1)
    retry.update(1, 90, 500, 0, 0, false, true, 0, 0, -1.25, 1, false, false, 500, 1, 80)
    retry.recordGate(1)
    const retryResult = retry.finishAirborne()!
    expect(retryResult.courseBestFlightDistanceM).toBe(240)
    expect(retryResult.courseBestPositiveG).toBe(4.5)
    expect(retryResult.courseBestNegativeG).toBe(-1.25)
    expect(retryResult.newFlightDistanceRecord).toBe(false)
    expect(retryResult.newPositiveGRecord).toBe(false)
    expect(retryResult.newNegativeGRecord).toBe(true)
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
    const firstResult = first.finishAirborne()!
    expect(firstResult.paceLabel).toBe('FIRST RUN')
    expect(firstResult.gateSplits).toEqual([1, 2])
    expect(firstResult.completionCount).toBe(1)
    expect(firstResult.bestTimeSec).toBe(2)
    expect(store.get('blackout.trace.seed:trace')).toBe('[1,2]')
    expect(store.get('blackout.history.seed:trace')).toBe('{"completionCount":1,"bestTimeSec":2,"peakSpeedKts":16,"fuelRemainingPercent":100,"runStreak":1,"runStreakRecord":1,"sortieStyle":"balanced"}')

    const retry = new ChallengeRun(scoreStore)
    retry.reset('seed:trace', 2)
    retry.update(0.5, 8)
    retry.recordGate(1)
    expect(retry.gatePaceLabel).toBe('AHEAD 0.50S')
    retry.update(0.5, 8)
    retry.recordGate(1)
    const retryResult = retry.finishAirborne()!
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

  it('rejects oversized and non-monotonic stored gate traces', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    values.set(
      'blackout.trace.seed:oversized',
      JSON.stringify(Array.from({ length: MAX_STORED_GATE_SPLITS + 1 }, (_, index) => index)),
    )
    const oversized = new ChallengeRun(storage)
    oversized.reset('seed:oversized', 2)
    oversized.update(1, 8)
    oversized.recordGate(1)
    expect(oversized.gatePaceLabel).toBe('FIRST RUN')

    values.set('blackout.trace.seed:descending', '[2,1]')
    const descending = new ChallengeRun(storage)
    descending.reset('seed:descending', 2)
    descending.update(1, 8)
    descending.recordGate(1)
    expect(descending.gatePaceLabel).toBe('FIRST RUN')
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
    const result = run.finishAirborne()!
    expect(result.bestPrecisionStreak).toBe(2)
    expect(result.courseBestPrecisionStreak).toBe(2)
    expect(readBestCoursePrecisionStreak(storage, 'seed:streak-record')).toBe(2)

    const retry = new ChallengeRun(storage)
    retry.reset('seed:streak-record', 3)
    retry.recordGate(0.9)
    retry.recordGate(0.4)
    retry.recordGate(0.9)
    const retryResult = retry.finishAirborne()!
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

  it('persists the style attached to the best-score record', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('seed:style-record', 1)
    run.update(0.1, 120, 300)
    run.recordGate(1)
    const result = run.finishAirborne()!

    expect(result.sortieStyle).toBe('balanced')
    expect(result.courseBestSortieStyle).toBe('balanced')
    expect(result.newSortieStyleRecord).toBe(true)
    expect(JSON.parse(values.get('blackout.history.seed:style-record')!)).toMatchObject({
      sortieStyle: 'balanced',
    })
    expect(readCourseHistory(storage, 'seed:style-record')?.sortieStyle).toBe('balanced')
  })

  it('repairs an unknown persisted style without leaking it to the picker', () => {
    const values = new Map<string, string>([
      ['blackout.history.seed:style-repair', '{"completionCount":1,"bestTimeSec":12,"sortieStyle":"bogus"}'],
    ])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(repairCourseHistory(storage, 'seed:style-repair')).toEqual({
      completionCount: 1,
      bestTimeSec: 12,
    })
    expect(values.get('blackout.history.seed:style-repair')).toBe('{"completionCount":1,"bestTimeSec":12}')
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
    const firstResult = first.finishAirborne()!
    expect(firstResult.courseBestPeakSpeedKts).toBe(233)
    expect(firstResult.courseBestPeakAltitudeM).toBe(300)
    expect(firstResult.newPeakSpeedRecord).toBe(true)
    expect(firstResult.newPeakAltitudeRecord).toBe(true)
    expect(values.get('blackout.history.seed:peaks')).toBe(
      '{"completionCount":1,"bestTimeSec":0.1,"peakSpeedKts":233,"peakAltitudeM":300,"fuelRemainingPercent":100,"runStreak":1,"runStreakRecord":1,"sortieStyle":"balanced"}',
    )

    const retry = new ChallengeRun(storage)
    retry.reset('seed:peaks', 1)
    retry.update(0.1, 80, 100)
    retry.recordGate(1)
    const retryResult = retry.finishAirborne()!
    expect(retryResult.courseBestPeakSpeedKts).toBe(233)
    expect(retryResult.courseBestPeakAltitudeM).toBe(300)
    expect(retryResult.newPeakSpeedRecord).toBe(false)
    expect(retryResult.newPeakAltitudeRecord).toBe(false)
  })

  it('keeps route scoring emphasis explicit and sum-stable', () => {
    for (const focus of ['balanced', 'gates', 'pace', 'landing'] as const) {
      const weights = scoringWeightsForFocus(focus)
      expect(weights.gate + weights.time).toBe(100_000)
      expect(weights.minimumTime).toBeGreaterThan(0)
    }
    expect(scoringWeightsForFocus('gates').gate).toBeGreaterThan(scoringWeightsForFocus('balanced').gate)
    expect(scoringWeightsForFocus('pace').time).toBeGreaterThan(scoringWeightsForFocus('balanced').time)
    expect(scoringWeightsForFocus('landing')).toEqual(scoringWeightsForFocus('gates'))
  })

  it('reaches bronze, silver and gold for every scoring focus and supported gate count', () => {
    // 80% gate precision, half a tank, no contract/stunt/streak bonuses. Routes
    // retain their own allowance; modest overruns distinguish the three medals.
    for (const focus of ['balanced', 'gates', 'pace', 'landing'] as const) {
      for (let count = 1; count <= MAX_STORED_GATE_SPLITS; count += 1) {
        for (const [overrunSec, medal] of [[80, 'bronze'], [45, 'silver'], [10, 'gold']] as const) {
          const allowanceSec = count * 4
          const run = new ChallengeRun(null)
          run.reset(`medals:${focus}:${count}`, count, focus, undefined, false, allowanceSec)
          for (let gate = 0; gate < count; gate += 1) {
            let segmentSec = (allowanceSec + overrunSec) / count
            while (segmentSec > 0) {
              const step = Math.min(5, segmentSec)
              run.update(step, 150)
              segmentSec -= step
            }
            run.recordGate(0.8)
          }
          const result = run.finishAirborne(0.5)!
          expect(result.medal, `${focus}, ${count} gates, +${overrunSec}s`).toBe(medal)
          expect(result.landingScore).toBe(0)
          expect(result.landingQuality).toBe(0)
          expect(result.approachScore).toBeUndefined()
          expect(result.weatherScore).toBeUndefined()
          expect(result.nightScore).toBeUndefined()
          expect(result.deadstickScore).toBeUndefined()
          expect(result.contractScore).toBeUndefined()
        }
      }
    }
  })

  it('freezes final-gate time and telemetry before committing once with the final combo', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('final-gate', 2)
    expect(run.finishAirborne()).toBeNull()
    run.update(2, 150, 500, 0, 0, false, true, 0, 0, 1, 1, false, false, 500, 1, 300)
    run.recordGate(0.8)
    expect(run.finishAirborne()).toBeNull()
    run.update(3, 150, 500, 0, 0, false, true, 0, 0, 1, 1, false, false, 500, 1, 450)
    run.recordGate(0.8)
    run.update(5, 300, 5_000, 0, 0, false, true, 0, 0, 9, 1, false, false, 500, 1, 1_500)
    run.recordCombo(2)
    const result = run.finishAirborne(0.7)!
    expect(result.elapsedSec).toBe(5)
    expect(result.gateSplits).toEqual([2, 5])
    expect(result.flightDistanceM).toBe(750)
    expect(result.peakAltitudeM).toBe(500)
    expect(result.peakPositiveG).toBe(1)
    expect(result.comboScore).toBeUndefined()
    expect(result.fuelRemainingPercent).toBe(70)
    expect(run.phase).toBe('complete')
    const saved = [...values]
    run.update(5, 300)
    run.recordGate(1)
    expect(run.finishAirborne()).toBeNull()
    expect([...values]).toEqual(saved)
    expect(run.elapsedSec).toBe(5)
    expect(run.result).toBe(result)

    run.reset('no-gates', 0)
    run.update(1, 150)
    expect(run.finishAirborne()).toBeNull()
    run.reset('failed', 1)
    run.recordGate(1)
    run.fail()
    expect(run.finishAirborne()).toBeNull()
  })

  it('captures sanitized fuel usage in a completed result without changing scores', () => {
    const run = new ChallengeRun(null)
    run.reset('seed:fuel-result', 1)
    run.recordGate(1)
    const result = run.finishAirborne(0.72)!
    expect(result.fuelRemainingPercent).toBe(72)
    expect(result.fuelUsedPercent).toBe(28)
    expect(Number.isFinite(result.totalScore)).toBe(true)

    run.reset('seed:fuel-result-2', 1)
    run.recordGate(1)
    const malformed = run.finishAirborne(Number.NaN)!
    expect(malformed.fuelRemainingPercent).toBe(0)
    expect(malformed.fuelUsedPercent).toBe(100)
  })

  it('derives readable course mastery tiers from bounded progress', () => {
    expect(courseMasteryTierForProgress({})).toBe('rookie')
    expect(courseMasteryTierForProgress({ completionCount: 1 })).toBe('pilot')
    expect(courseMasteryTierForProgress({ completionCount: 3, bestScore: 76_000, badgeCount: 2 })).toBe('veteran')
    expect(courseMasteryTierForProgress({ completionCount: 5, bestScore: 88_000, badgeCount: 3, contractWins: 2 })).toBe('ace')
    expect(courseMasteryTierForProgress({ completionCount: 10, bestScore: 100_000, badgeCount: 4, contractWins: 5 })).toBe('legend')
    expect(courseMasteryTierForProgress({ completionCount: Number.NaN, bestScore: Number.POSITIVE_INFINITY })).toBe('rookie')
    expect(courseMasteryTierLabel('rookie')).toBe('ROOKIE')
    expect(courseMasteryTierLabel('legend')).toBe('LEGEND')
    expect(courseMasteryNextTierLabel('pilot')).toBe('VETERAN')
    expect(courseMasteryNextTierLabel('ace')).toBe('LEGEND')
    expect(courseMasteryNextTierLabel('legend')).toBe('')
    expect(courseMasteryNextTierGoalLabel('veteran')).toBe('5 RUNS / 88K / 3 BADGES / 2 CONTRACTS')
    expect(courseMasteryNextTierGoalLabel('legend')).toBe('')
  })

  it('awards only active mastery badges and keeps legend attainable', () => {
    expect(masteryBadgesForRun(1, 1, 'gold', 3)).toEqual([
      'first-flight', 'gate-master', 'streak-hunter', 'gold-run',
    ])
    expect(masteryBadgesForRun(0, Number.NaN, 'complete')).toEqual([])
    expect(MASTERY_BADGE_COUNT).toBe(4)
    expect(courseMasteryNextTierGoalLabel('ace')).toBe('10 RUNS / 100K / 4 BADGES / 5 CONTRACTS')
  })

  it('does not award landing or approach badges for an airborne finish', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    const run = new ChallengeRun(storage)
    run.reset('seed:approach-badge', 1)
    run.recordGate(1)
    const result = run.finishAirborne()!
    expect(result.newMasteryBadges).not.toContain('approach-ace')
    expect(result.newMasteryBadges).not.toContain('landing-ace')
    expect(readMasteryBadges(storage, 'seed:approach-badge')).not.toContain('approach-ace')
  })

  it('filters malformed and duplicate persisted badges', () => {
    const storage = {
      getItem: () => '["gold-run","unknown","gold-run","landing-ace"]',
    }
    expect(readMasteryBadges(storage, 'seed:badges')).toEqual(['gold-run'])
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
