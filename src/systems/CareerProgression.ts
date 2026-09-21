/** Cross-course pilot progression derived from the records already on disk. */
export type PilotRank = 'cadet' | 'wingman' | 'flight-lead' | 'ace' | 'legend'

export interface PilotCareerProgress {
  completedCourses: number
  totalRuns: number
  totalBestScore: number
  totalBadges: number
  totalContractWins: number
  legendCourses: number
}

const MAX_COURSES = 64
const MAX_RUNS = 100_000
const MAX_SCORE = 7_520_000
const MAX_BADGES = 384
const MAX_CONTRACT_WINS = 64_000

/** Derive a stable rank from bounded aggregate course records. */
export function pilotRankForProgress(progress: PilotCareerProgress): PilotRank {
  const courses = safeCount(progress.completedCourses, MAX_COURSES)
  const runs = safeCount(progress.totalRuns, MAX_RUNS)
  const score = safeCount(progress.totalBestScore, MAX_SCORE)
  const badges = safeCount(progress.totalBadges, MAX_BADGES)
  const contracts = safeCount(progress.totalContractWins, MAX_CONTRACT_WINS)
  const legends = safeCount(progress.legendCourses, MAX_COURSES)
  if (legends >= 7 && courses >= 7 && runs >= 30 && score >= 600_000 && badges >= 36 && contracts >= 24) return 'legend'
  if (courses >= 4 && runs >= 12 && score >= 300_000 && badges >= 18 && contracts >= 10) return 'ace'
  if (courses >= 2 && runs >= 5 && score >= 130_000 && badges >= 6 && contracts >= 3) return 'flight-lead'
  if (runs >= 1) return 'wingman'
  return 'cadet'
}

export function pilotRankLabel(rank: PilotRank): string {
  if (rank === 'flight-lead') return 'FLIGHT LEAD'
  return rank.toUpperCase()
}

/** Keep the next rank target visible without exposing raw storage details. */
export function pilotRankNextGoalLabel(rank: PilotRank): string {
  if (rank === 'cadet') return 'NEXT WINGMAN / 1 RUN'
  if (rank === 'wingman') return 'NEXT FLIGHT LEAD / 2 COURSES / 5 RUNS / 130K SCORE'
  if (rank === 'flight-lead') return 'NEXT ACE / 4 COURSES / 12 RUNS / 300K SCORE'
  if (rank === 'ace') return 'NEXT LEGEND / 7 COURSES / 30 RUNS / 600K SCORE'
  return ''
}

/** Accessible aggregate summary for the title progression line. */
export function pilotRankAriaLabel(
  rank: PilotRank,
  progress: PilotCareerProgress,
): string {
  const label = pilotRankLabel(rank)
  const courses = safeCount(progress.completedCourses, MAX_COURSES)
  const runs = safeCount(progress.totalRuns, MAX_RUNS)
  const score = safeCount(progress.totalBestScore, MAX_SCORE)
  return `Pilot rank ${label}, ${courses} courses completed, ${runs} total runs, ${score.toLocaleString()} aggregate best score`
}

function safeCount(value: number, cap: number): number {
  return Number.isFinite(value) ? Math.min(cap, Math.max(0, Math.floor(value))) : 0
}
