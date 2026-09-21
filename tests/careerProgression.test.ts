import { describe, expect, it } from 'vitest'
import {
  pilotRankAriaLabel,
  pilotRankForProgress,
  pilotRankLabel,
  pilotRankNextGoalLabel,
  pilotRankRank,
  type PilotCareerProgress,
} from '../src/systems/CareerProgression'

const base: PilotCareerProgress = {
  completedCourses: 0,
  totalRuns: 0,
  totalBestScore: 0,
  totalBadges: 0,
  totalContractWins: 0,
  legendCourses: 0,
}

describe('CareerProgression', () => {
  it('keeps rank thresholds ordered and bounded', () => {
    expect(pilotRankForProgress(base)).toBe('cadet')
    expect(pilotRankForProgress({ ...base, totalRuns: 1 })).toBe('wingman')
    expect(pilotRankForProgress({
      ...base,
      completedCourses: 2,
      totalRuns: 5,
      totalBestScore: 130_000,
      totalBadges: 6,
      totalContractWins: 3,
    })).toBe('flight-lead')
    expect(pilotRankForProgress({
      ...base,
      completedCourses: 4,
      totalRuns: 12,
      totalBestScore: 300_000,
      totalBadges: 18,
      totalContractWins: 10,
    })).toBe('ace')
    expect(pilotRankForProgress({
      ...base,
      completedCourses: 7,
      totalRuns: 30,
      totalBestScore: 600_000,
      totalBadges: 36,
      totalContractWins: 24,
      legendCourses: 7,
    })).toBe('legend')
  })

  it('rejects malformed progress instead of granting a rank', () => {
    expect(pilotRankForProgress({
      completedCourses: Number.NaN,
      totalRuns: Number.POSITIVE_INFINITY,
      totalBestScore: -5,
      totalBadges: Number.NaN,
      totalContractWins: Number.NaN,
      legendCourses: Number.NaN,
    })).toBe('cadet')
  })

  it('keeps labels compact and accessible', () => {
    expect(pilotRankLabel('flight-lead')).toBe('FLIGHT LEAD')
    expect(pilotRankRank('cadet')).toBeLessThan(pilotRankRank('wingman'))
    expect(pilotRankRank('ace')).toBeLessThan(pilotRankRank('legend'))
    expect(pilotRankNextGoalLabel('wingman')).toBe('NEXT FLIGHT LEAD / 2 COURSES / 5 RUNS / 130K SCORE')
    expect(pilotRankNextGoalLabel('legend')).toBe('')
    expect(pilotRankAriaLabel('ace', {
      ...base,
      completedCourses: 4,
      totalRuns: 12,
      totalBestScore: 300_000,
    })).toContain('Pilot rank ACE')
  })
})
