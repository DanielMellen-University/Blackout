/** Cross-course pilot progression derived from the records already on disk. */
export type PilotRank = 'cadet' | 'wingman' | 'flight-lead' | 'ace' | 'legend'

export interface PilotCareerProgress {
  completedCourses: number
  totalRuns: number
  totalBestScore: number
  totalBadges: number
  totalContractWins: number
  legendCourses: number
  totalFlightDistanceM?: number
  bestPeakSpeedKts?: number
  bestPeakAltitudeM?: number
}

export type PilotCommendationId = 'first-sortie' | 'course-collector' | 'speed-demon' | 'high-flyer' | 'long-haul'
export const PILOT_COMMENDATION_COUNT = 5

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

/** Compare ranks without relying on their display labels. */
export function pilotRankRank(rank: PilotRank): number {
  if (rank === 'legend') return 4
  if (rank === 'ace') return 3
  if (rank === 'flight-lead') return 2
  if (rank === 'wingman') return 1
  return 0
}

/** Keep the next rank target visible without exposing raw storage details. */
export function pilotRankNextGoalLabel(rank: PilotRank): string {
  if (rank === 'cadet') return 'NEXT WINGMAN / 1 RUN'
  if (rank === 'wingman') return 'NEXT FLIGHT LEAD / 2 COURSES / 5 RUNS / 130K SCORE'
  if (rank === 'flight-lead') return 'NEXT ACE / 4 COURSES / 12 RUNS / 300K SCORE'
  if (rank === 'ace') return 'NEXT LEGEND / 7 COURSES / 30 RUNS / 600K SCORE'
  return ''
}

/** Derive bounded cross-course commendations from existing flight records. */
export function pilotCommendationsForProgress(progress: PilotCareerProgress): PilotCommendationId[] {
  const commendations: PilotCommendationId[] = []
  const courses = safeCount(progress.completedCourses, MAX_COURSES)
  const runs = safeCount(progress.totalRuns, MAX_RUNS)
  const distance = safeMetric(progress.totalFlightDistanceM, 128_000_000)
  const speed = safeMetric(progress.bestPeakSpeedKts, 20_000)
  const altitude = safeMetric(progress.bestPeakAltitudeM, 100_000)
  if (runs >= 1) commendations.push('first-sortie')
  if (courses >= 7) commendations.push('course-collector')
  if (speed >= 900) commendations.push('speed-demon')
  if (altitude >= 6_000) commendations.push('high-flyer')
  if (distance >= 100_000) commendations.push('long-haul')
  return commendations
}

export function pilotCommendationLabel(id: PilotCommendationId): string {
  if (id === 'first-sortie') return 'FIRST SORTIE'
  if (id === 'course-collector') return 'COURSE COLLECTOR'
  if (id === 'speed-demon') return 'SPEED DEMON'
  if (id === 'high-flyer') return 'HIGH FLYER'
  return 'LONG HAUL'
}

/** Keep earned commendation names compact for title and accessibility copy. */
export function pilotCommendationsLabel(ids: readonly PilotCommendationId[]): string {
  const labels = ids.slice(0, PILOT_COMMENDATION_COUNT).map(pilotCommendationLabel)
  return labels.length > 0 ? `EARNED · ${labels.join(' · ')}` : 'EARNED · NONE'
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

function safeMetric(value: number | undefined, cap: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(cap, Math.max(0, value))
    : 0
}
