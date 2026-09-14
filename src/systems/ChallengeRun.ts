import { MAX_STUNT_ROLLS } from './StuntTracker'

export type ChallengePhase =
  | 'ready'
  | 'running'
  | 'returning'
  | 'complete'
  | 'failed'

export type Medal = 'gold' | 'silver' | 'bronze' | 'complete'
export type ChallengeScoringFocus = 'balanced' | 'gates' | 'pace' | 'landing'
export type MasteryBadgeId = 'first-flight' | 'gate-master' | 'landing-ace' | 'streak-hunter' | 'gold-run'
export type LandingQualityLabel = 'BUTTER' | 'SMOOTH' | 'FIRM' | 'HARD'

export interface LandingMetrics {
  /** Downward speed at first contact, in m/s (negative = descending). */
  verticalSpeed: number
  /** Horizontal speed at first contact, in m/s. */
  groundSpeed: number
  pitchRad: number
  rollRad: number
}

export interface ChallengeResult {
  elapsedSec: number
  gateScore: number
  timeScore: number
  landingScore: number
  landingQuality: number
  /** Human-readable touchdown quality band. */
  landingLabel?: LandingQualityLabel
  totalScore: number
  medal: Medal
  bestScore: number
  isNewBest: boolean
  /** Gate split trace for this run, captured only when a gate is cleared. */
  gateSplits?: number[]
  /** Persisted best-run gate split trace, if this course has one. */
  bestGateSplits?: number[]
  /** Signed final pace delta versus the persisted trace, in seconds. */
  paceDeltaSec?: number
  /** Human-readable final pace comparison. */
  paceLabel?: string
  /** Number of completed runs recorded for this course. */
  completionCount?: number
  /** Fastest completed time recorded for this course. */
  bestTimeSec?: number
  /** Route-selected scoring emphasis used for this run. */
  scoringFocus?: ChallengeScoringFocus
  /** All mastery badges earned on this course after this run. */
  masteryBadges?: MasteryBadgeId[]
  /** Badges earned for the first time on this run. */
  newMasteryBadges?: MasteryBadgeId[]
  /** Remaining fuel at touchdown, rounded to a whole percent. */
  fuelRemainingPercent?: number
  /** Fuel spent during this sortie, rounded to a whole percent. */
  fuelUsedPercent?: number
  /** Longest consecutive high-center gate streak in this sortie. */
  bestPrecisionStreak?: number
  /** Longest precision streak ever recorded for this course. */
  courseBestPrecisionStreak?: number
  /** Highest finite airspeed reached during this sortie, in knots. */
  peakSpeedKts?: number
  /** Highest finite height above the home strip reached during this sortie. */
  peakAltitudeM?: number
  /** Fastest peak speed ever recorded for this course, in knots. */
  courseBestPeakSpeedKts?: number
  /** Highest altitude ever recorded for this course, in metres. */
  courseBestPeakAltitudeM?: number
  /** Whether this sortie set a new course peak-speed record. */
  newPeakSpeedRecord?: boolean
  /** Whether this sortie set a new course peak-altitude record. */
  newPeakAltitudeRecord?: boolean
  /** Number of completed airborne barrel rolls in this sortie. */
  stuntRolls?: number
  /** Bounded score bonus awarded for completed barrel rolls. */
  stuntScore?: number
  /** Highest completed barrel-roll count ever recorded for this course. */
  courseBestStuntRolls?: number
  /** Whether this sortie set a new course barrel-roll record. */
  newStuntRecord?: boolean
}

export interface ScoreStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const COURSE_BEST_STORAGE_PREFIX = 'blackout.best.'
export const COURSE_STREAK_STORAGE_PREFIX = 'blackout.streak.'
const TRACE_KEY = 'blackout.trace.'
export const COURSE_HISTORY_STORAGE_PREFIX = 'blackout.history.'
export const COURSE_BADGES_STORAGE_PREFIX = 'blackout.badges.'
export const MAX_COMPLETION_COUNT = 100_000
export const MAX_BEST_SCORE = 110_000
export const MAX_PRECISION_STREAK = 1_000
export const MAX_PEAK_SPEED_KTS = 20_000
export const MAX_PEAK_ALTITUDE_M = 100_000

export interface CourseHistory {
  completionCount: number
  bestTimeSec: number
  peakSpeedKts?: number
  peakAltitudeM?: number
  stuntRolls?: number
}

interface ScoringWeights {
  gate: number
  time: number
  landing: number
  minimumTime: number
}

export function scoringWeightsForFocus(focus: ChallengeScoringFocus): ScoringWeights {
  if (focus === 'gates') return { gate: 30_000, time: 60_000, landing: 10_000, minimumTime: 5_000 }
  if (focus === 'pace') return { gate: 18_000, time: 76_000, landing: 6_000, minimumTime: 6_000 }
  if (focus === 'landing') return { gate: 18_000, time: 60_000, landing: 22_000, minimumTime: 5_000 }
  return { gate: 20_000, time: 70_000, landing: 10_000, minimumTime: 5_000 }
}

export function landingQualityLabel(quality: number): LandingQualityLabel {
  const safe = Number.isFinite(quality) ? Math.max(0, Math.min(1, quality)) : 0
  if (safe >= 0.92) return 'BUTTER'
  if (safe >= 0.78) return 'SMOOTH'
  if (safe >= 0.6) return 'FIRM'
  return 'HARD'
}

type HistoryReadStore = Pick<ScoreStore, 'getItem'> | null
type HistoryRepairStore = Pick<ScoreStore, 'getItem'> & Partial<Pick<ScoreStore, 'setItem'>>

interface ParsedCourseHistory {
  history: CourseHistory
  needsRepair: boolean
}

export function courseHistoryStorageKey(courseId: string): string {
  return COURSE_HISTORY_STORAGE_PREFIX + courseId
}

export function courseBadgesStorageKey(courseId: string): string {
  return COURSE_BADGES_STORAGE_PREFIX + courseId
}

export function courseBestScoreStorageKey(courseId: string): string {
  return COURSE_BEST_STORAGE_PREFIX + courseId
}

export function courseBestPrecisionStreakStorageKey(courseId: string): string {
  return COURSE_STREAK_STORAGE_PREFIX + courseId
}

export function readBestCourseScore(storage: HistoryReadStore, courseId: string): number {
  try {
    const parsed = Number(storage?.getItem(courseBestScoreStorageKey(courseId)) ?? 0)
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(MAX_BEST_SCORE, Math.floor(parsed)) : 0
  } catch {
    return 0
  }
}

export function repairBestCourseScore(
  storage: HistoryRepairStore | null,
  courseId: string,
): number {
  try {
    const raw = storage?.getItem(courseBestScoreStorageKey(courseId))
    if (raw === null || raw === undefined) return 0
    const score = readBestCourseScore(storage, courseId)
    const canonical = String(score)
    if (raw !== canonical) storage?.setItem?.(courseBestScoreStorageKey(courseId), canonical)
    return score
  } catch {
    return 0
  }
}

export function readBestCoursePrecisionStreak(storage: HistoryReadStore, courseId: string): number {
  try {
    const parsed = Number(storage?.getItem(courseBestPrecisionStreakStorageKey(courseId)) ?? 0)
    return Number.isFinite(parsed) && parsed > 0
      ? Math.min(MAX_PRECISION_STREAK, Math.floor(parsed))
      : 0
  } catch {
    return 0
  }
}

export function repairBestCoursePrecisionStreak(
  storage: HistoryRepairStore | null,
  courseId: string,
): number {
  try {
    const raw = storage?.getItem(courseBestPrecisionStreakStorageKey(courseId))
    if (raw === null || raw === undefined) return 0
    const streak = readBestCoursePrecisionStreak(storage, courseId)
    const canonical = String(streak)
    if (raw !== canonical) {
      storage?.setItem?.(courseBestPrecisionStreakStorageKey(courseId), canonical)
    }
    return streak
  } catch {
    return 0
  }
}

const MASTERY_BADGES: readonly MasteryBadgeId[] = [
  'first-flight',
  'gate-master',
  'landing-ace',
  'streak-hunter',
  'gold-run',
]
export const MASTERY_BADGE_COUNT = MASTERY_BADGES.length

const GATE_STREAK_THRESHOLD = 0.82
const STREAK_HUNTER_THRESHOLD = 3

export function masteryBadgeLabel(badge: MasteryBadgeId): string {
  if (badge === 'first-flight') return 'FIRST FLIGHT'
  if (badge === 'gate-master') return 'GATE MASTER'
  if (badge === 'landing-ace') return 'LANDING ACE'
  if (badge === 'streak-hunter') return 'STREAK HUNTER'
  return 'GOLD RUN'
}

export function readMasteryBadges(
  storage: HistoryReadStore,
  courseId: string,
): MasteryBadgeId[] {
  try {
    const raw = storage?.getItem(courseBadgesStorageKey(courseId))
    if (!raw) return []
    return parseMasteryBadges(raw)?.badges ?? []
  } catch {
    return []
  }
}

export function repairMasteryBadges(
  storage: HistoryRepairStore | null,
  courseId: string,
): MasteryBadgeId[] {
  try {
    const raw = storage?.getItem(courseBadgesStorageKey(courseId))
    if (raw === null || raw === undefined) return []
    const parsed = parseMasteryBadges(raw)
    const badges = parsed?.badges ?? []
    if (!parsed || parsed.needsRepair) {
      storage?.setItem?.(courseBadgesStorageKey(courseId), JSON.stringify(badges))
    }
    return badges
  } catch {
    return []
  }
}

interface ParsedMasteryBadges {
  badges: MasteryBadgeId[]
  needsRepair: boolean
}

function parseMasteryBadges(raw: string): ParsedMasteryBadges | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const badges = parsed.filter((value, index, values): value is MasteryBadgeId =>
    typeof value === 'string' &&
    (MASTERY_BADGES as readonly string[]).includes(value) &&
    values.indexOf(value) === index,
  ).slice(0, MASTERY_BADGE_COUNT)
  const needsRepair = badges.length !== parsed.length ||
    badges.some((badge, index) => badge !== parsed[index])
  return { badges, needsRepair }
}

function writeMasteryBadges(storage: ScoreStore | null, courseId: string, badges: readonly MasteryBadgeId[]): void {
  try {
    storage?.setItem(courseBadgesStorageKey(courseId), JSON.stringify(badges.slice(0, MASTERY_BADGE_COUNT)))
  } catch {
    // Private browsing/storage denial should never block a completed run.
  }
}

export function masteryBadgesForRun(
  completionCount: number,
  gateQuality: number,
  landingQuality: number,
  medal: Medal,
  precisionStreak = 0,
): MasteryBadgeId[] {
  const badges: MasteryBadgeId[] = []
  if (completionCount >= 1) badges.push('first-flight')
  if (gateQuality >= 0.9) badges.push('gate-master')
  if (landingQuality >= 0.9) badges.push('landing-ace')
  if (Number.isFinite(precisionStreak) && precisionStreak >= STREAK_HUNTER_THRESHOLD) {
    badges.push('streak-hunter')
  }
  if (medal === 'gold') badges.push('gold-run')
  return badges
}

export function readCourseHistory(
  storage: HistoryReadStore,
  courseId: string,
): CourseHistory | null {
  try {
    const raw = storage?.getItem(courseHistoryStorageKey(courseId))
    if (!raw) return null
    return parseCourseHistory(raw)?.history ?? null
  } catch {
    return null
  }
}

/**
 * Read and repair one history record at most once. This is intentionally
 * called from setup/results paths, never from the render loop.
 */
export function repairCourseHistory(
  storage: HistoryRepairStore | null,
  courseId: string,
): CourseHistory | null {
  try {
    const raw = storage?.getItem(courseHistoryStorageKey(courseId))
    if (!raw) return null
    const parsed = parseCourseHistory(raw)
    if (!parsed) return null
    if (parsed.needsRepair) {
      storage?.setItem?.(
        courseHistoryStorageKey(courseId),
        serializeCourseHistory(parsed.history),
      )
    }
    return parsed.history
  } catch {
    return null
  }
}

function parseCourseHistory(raw: string): ParsedCourseHistory | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const record = parsed as Record<string, unknown>
  const rawCompletionCount = record.completionCount
  const rawBestTimeSec = record.bestTimeSec
  const rawPeakSpeedKts = record.peakSpeedKts
  const rawPeakAltitudeM = record.peakAltitudeM
  const rawStuntRolls = record.stuntRolls
  const hasBestTime = Object.prototype.hasOwnProperty.call(record, 'bestTimeSec')
  const hasPeakSpeed = Object.prototype.hasOwnProperty.call(record, 'peakSpeedKts')
  const hasPeakAltitude = Object.prototype.hasOwnProperty.call(record, 'peakAltitudeM')
  const hasStuntRolls = Object.prototype.hasOwnProperty.call(record, 'stuntRolls')
  const completionCount = typeof rawCompletionCount === 'number' && Number.isFinite(rawCompletionCount)
    ? Math.min(MAX_COMPLETION_COUNT, Math.max(0, Math.floor(rawCompletionCount)))
    : 0
  const bestTimeSec = typeof rawBestTimeSec === 'number' && Number.isFinite(rawBestTimeSec) && rawBestTimeSec >= 0
    ? rawBestTimeSec
    : Number.POSITIVE_INFINITY
  const peakSpeedKts = typeof rawPeakSpeedKts === 'number' && Number.isFinite(rawPeakSpeedKts) && rawPeakSpeedKts > 0
    ? Math.min(MAX_PEAK_SPEED_KTS, Math.floor(rawPeakSpeedKts))
    : 0
  const peakAltitudeM = typeof rawPeakAltitudeM === 'number' && Number.isFinite(rawPeakAltitudeM) && rawPeakAltitudeM > 0
    ? Math.min(MAX_PEAK_ALTITUDE_M, Math.floor(rawPeakAltitudeM))
    : 0
  const stuntRolls = typeof rawStuntRolls === 'number' && Number.isFinite(rawStuntRolls) && rawStuntRolls > 0
    ? Math.min(MAX_STUNT_ROLLS, Math.floor(rawStuntRolls))
    : 0
  const history: CourseHistory = { completionCount, bestTimeSec }
  if (peakSpeedKts > 0) history.peakSpeedKts = peakSpeedKts
  if (peakAltitudeM > 0) history.peakAltitudeM = peakAltitudeM
  if (stuntRolls > 0) history.stuntRolls = stuntRolls
  const needsRepair =
    typeof rawCompletionCount !== 'number' ||
    !Number.isFinite(rawCompletionCount) ||
    rawCompletionCount < 0 ||
    rawCompletionCount > MAX_COMPLETION_COUNT ||
    !Number.isInteger(rawCompletionCount) ||
    (hasBestTime && (typeof rawBestTimeSec !== 'number' || !Number.isFinite(rawBestTimeSec) || rawBestTimeSec < 0)) ||
    (hasPeakSpeed && (typeof rawPeakSpeedKts !== 'number' || !Number.isFinite(rawPeakSpeedKts) || rawPeakSpeedKts <= 0 || rawPeakSpeedKts !== peakSpeedKts)) ||
    (hasPeakAltitude && (typeof rawPeakAltitudeM !== 'number' || !Number.isFinite(rawPeakAltitudeM) || rawPeakAltitudeM <= 0 || rawPeakAltitudeM !== peakAltitudeM)) ||
    (hasStuntRolls && (typeof rawStuntRolls !== 'number' || !Number.isFinite(rawStuntRolls) || rawStuntRolls <= 0 || rawStuntRolls !== stuntRolls)) ||
    Object.keys(record).some((key) =>
      key !== 'completionCount' && key !== 'bestTimeSec' && key !== 'peakSpeedKts' && key !== 'peakAltitudeM' && key !== 'stuntRolls',
    )
  return {
    history,
    needsRepair,
  }
}

function serializeCourseHistory(history: CourseHistory): string {
  const record: Record<string, number> = {
    completionCount: Math.min(MAX_COMPLETION_COUNT, Math.max(0, Math.floor(history.completionCount))),
  }
  if (Number.isFinite(history.bestTimeSec) && history.bestTimeSec >= 0) {
    record.bestTimeSec = history.bestTimeSec
  }
  if (Number.isFinite(history.peakSpeedKts) && history.peakSpeedKts! > 0) {
    record.peakSpeedKts = Math.min(MAX_PEAK_SPEED_KTS, Math.floor(history.peakSpeedKts!))
  }
  if (Number.isFinite(history.peakAltitudeM) && history.peakAltitudeM! > 0) {
    record.peakAltitudeM = Math.min(MAX_PEAK_ALTITUDE_M, Math.floor(history.peakAltitudeM!))
  }
  if (Number.isFinite(history.stuntRolls) && history.stuntRolls! > 0) {
    record.stuntRolls = Math.min(MAX_STUNT_ROLLS, Math.floor(history.stuntRolls!))
  }
  return JSON.stringify(record)
}

/**
 * State and scoring for one repeatable circuit attempt.
 *
 * The run clock starts when the jet begins its takeoff roll. Passing every gate
 * changes the objective to returning for a landing; a clean touchdown finalizes
 * the result. World/course creation stays outside this class so a retry can use
 * the exact same seed and route.
 */
export class ChallengeRun {
  phase: ChallengePhase = 'ready'
  elapsedSec = 0
  gatesPassed = 0
  totalGates = 0
  result: ChallengeResult | null = null

  private courseId = 'default'
  private scoringFocus: ChallengeScoringFocus = 'balanced'
  private gateQualityTotal = 0
  private gateQualityStreak = 0
  private bestGateQualityStreak = 0
  private peakSpeedMps = 0
  private peakAltitudeM = 0
  private stuntRollCount = 0
  private readonly gateSplits: number[] = []
  private bestGateSplits: number[] = []
  private lastPaceDeltaSec = Number.NaN
  private gatePaceLabelDelta = Number.NaN
  private gatePaceLabelValue = 'FIRST RUN'
  private readonly storage: ScoreStore | null
  private clockLabelMinutes = -1
  private clockLabelCentis = -1
  private clockLabelValue = '0:00.00'

  constructor(storage: ScoreStore | null = browserStorage()) {
    this.storage = storage
  }

  reset(courseId: string, totalGates: number, scoringFocus: ChallengeScoringFocus = 'balanced'): void {
    this.courseId = courseId
    this.totalGates = Math.max(0, Math.floor(totalGates))
    this.scoringFocus = scoringFocus
    this.phase = 'ready'
    this.elapsedSec = 0
    this.gatesPassed = 0
    this.gateQualityTotal = 0
    this.gateQualityStreak = 0
    this.bestGateQualityStreak = 0
    this.peakSpeedMps = 0
    this.peakAltitudeM = 0
    this.stuntRollCount = 0
    this.gateSplits.length = 0
    this.bestGateSplits = this.readBestTrace()
    this.lastPaceDeltaSec = Number.NaN
    this.gatePaceLabelDelta = Number.NaN
    this.gatePaceLabelValue = 'FIRST RUN'
    this.result = null
    this.clockLabelMinutes = -1
    this.clockLabelCentis = -1
  }

  /** Advance simulation time and arm the clock once the takeoff roll begins. */
  update(dt: number, speed: number, altitudeM = 0): void {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 5)) : 0
    const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
    const safeAltitude = Number.isFinite(altitudeM) ? Math.max(0, altitudeM) : 0
    this.peakSpeedMps = Math.max(this.peakSpeedMps, Math.min(safeSpeed, 10_000))
    this.peakAltitudeM = Math.max(this.peakAltitudeM, Math.min(safeAltitude, 100_000))
    if (this.phase === 'ready' && safeSpeed > 5) this.phase = 'running'
    if (this.phase === 'running' || this.phase === 'returning') {
      this.elapsedSec += safeDt
    }
  }

  recordGate(quality = 1): void {
    if (this.phase === 'complete' || this.phase === 'failed') return
    if (this.phase === 'ready') this.phase = 'running'
    if (this.gatesPassed >= this.totalGates) return

    const gateIndex = this.gatesPassed
    this.gatesPassed += 1
    const safeQuality = clamp01(quality)
    this.gateQualityTotal += safeQuality
    this.gateQualityStreak = safeQuality >= GATE_STREAK_THRESHOLD
      ? this.gateQualityStreak + 1
      : 0
    this.bestGateQualityStreak = Math.max(this.bestGateQualityStreak, this.gateQualityStreak)
    const split = Number.isFinite(this.elapsedSec) ? Math.max(0, this.elapsedSec) : 0
    this.gateSplits[gateIndex] = split
    const bestSplit = this.bestGateSplits[gateIndex]
    this.lastPaceDeltaSec = Number.isFinite(bestSplit) ? split - bestSplit! : Number.NaN
    this.gatePaceLabelDelta = Number.NaN
    if (this.totalGates > 0 && this.gatesPassed >= this.totalGates) {
      this.phase = 'returning'
    }
  }

  /** Record a completed airshow maneuver without touching the flight loop. */
  recordStunt(rolls = 1): void {
    if (this.phase === 'complete' || this.phase === 'failed') return
    if (this.phase === 'ready') this.phase = 'running'
    const safeRolls = Number.isFinite(rolls)
      ? Math.max(0, Math.min(MAX_STUNT_ROLLS, Math.floor(rolls)))
      : 0
    this.stuntRollCount = Math.min(MAX_STUNT_ROLLS, this.stuntRollCount + safeRolls)
  }

  finishLanding(metrics: LandingMetrics, fuelFraction = 1): ChallengeResult | null {
    if (this.phase !== 'returning') return null

    const elapsedSec = Number.isFinite(this.elapsedSec) ? Math.max(0, this.elapsedSec) : 0
    const fuelRemainingPercent = Math.round(clamp01(fuelFraction) * 100)
    const fuelUsedPercent = 100 - fuelRemainingPercent
    const gateQuality =
      this.totalGates > 0 ? this.gateQualityTotal / this.totalGates : 0
    const weights = scoringWeightsForFocus(this.scoringFocus)
    const gateScore = Math.round(weights.gate * clamp01(gateQuality))

    // A brisk, clean circuit scores well; time can never erase completion.
    const timeScore = Math.round(Math.max(weights.minimumTime, weights.time - elapsedSec * 320))

    const verticalSpeed = finiteOr(metrics.verticalSpeed)
    const groundSpeed = Math.max(0, finiteOr(metrics.groundSpeed))
    const rollRad = finiteOr(metrics.rollRad)
    const pitchRad = finiteOr(metrics.pitchRad)
    const sink = Math.max(0, -verticalSpeed)
    const sinkPenalty = Math.max(0, sink - 1.2) / 5
    const speedPenalty = Math.max(0, groundSpeed - 32) / 38
    const bankPenalty = Math.abs(rollRad) / (Math.PI / 5)
    const pitchPenalty = Math.max(0, Math.abs(pitchRad) - 0.22) / 0.65
    const landingQuality = clamp01(
      1 - sinkPenalty * 0.45 - speedPenalty * 0.3 - bankPenalty * 0.2 - pitchPenalty * 0.05,
    )
    const landingScore = Math.round(weights.landing * landingQuality)
    const stuntScore = Math.min(3_000, this.stuntRollCount * 750)
    const totalScore = gateScore + timeScore + landingScore + stuntScore
    const previousBest = this.readBest()
    const isNewBest = totalScore > previousBest
    const bestScore = Math.max(previousBest, totalScore)
    const bestElapsedSec = this.bestGateSplits[this.totalGates - 1]
    const paceDeltaSec = Number.isFinite(bestElapsedSec)
      ? elapsedSec - bestElapsedSec!
      : Number.NaN
    const paceLabel = formatPaceDelta(paceDeltaSec)
    const comparisonBestSplits = this.bestGateSplits.slice()
    const previousBestPrecisionStreak = readBestCoursePrecisionStreak(this.storage, this.courseId)
    const courseBestPrecisionStreak = Math.max(
      previousBestPrecisionStreak,
      this.bestGateQualityStreak,
    )
    if (courseBestPrecisionStreak > previousBestPrecisionStreak) {
      this.writeBestPrecisionStreak(courseBestPrecisionStreak)
    }
    const history = this.readHistory()
    const peakSpeedKts = Math.round(this.peakSpeedMps * 1.943844492)
    const peakAltitudeM = Math.round(this.peakAltitudeM)
    const previousPeakSpeedKts = history.peakSpeedKts ?? 0
    const previousPeakAltitudeM = history.peakAltitudeM ?? 0
    const previousStuntRolls = history.stuntRolls ?? 0
    const newPeakSpeedRecord = peakSpeedKts > previousPeakSpeedKts
    const newPeakAltitudeRecord = peakAltitudeM > previousPeakAltitudeM
    const newStuntRecord = this.stuntRollCount > previousStuntRolls
    const courseBestPeakSpeedKts = Math.max(previousPeakSpeedKts, peakSpeedKts)
    const courseBestPeakAltitudeM = Math.max(previousPeakAltitudeM, peakAltitudeM)
    const courseBestStuntRolls = Math.max(previousStuntRolls, this.stuntRollCount)
    if (courseBestPeakSpeedKts > 0) history.peakSpeedKts = courseBestPeakSpeedKts
    if (courseBestPeakAltitudeM > 0) history.peakAltitudeM = courseBestPeakAltitudeM
    if (courseBestStuntRolls > 0) history.stuntRolls = courseBestStuntRolls
    history.completionCount = Math.min(MAX_COMPLETION_COUNT, history.completionCount + 1)
    history.bestTimeSec = Math.min(history.bestTimeSec, elapsedSec)
    this.writeHistory(history)
    const earnedBadges = masteryBadgesForRun(
      history.completionCount,
      clamp01(gateQuality),
      landingQuality,
      medalFor(totalScore),
      this.bestGateQualityStreak,
    )
    const priorBadges = repairMasteryBadges(this.storage, this.courseId)
    const allBadges = [...priorBadges]
    for (const badge of earnedBadges) {
      if (!allBadges.includes(badge)) allBadges.push(badge)
    }
    const newBadges = earnedBadges.filter((badge) => !priorBadges.includes(badge))
    writeMasteryBadges(this.storage, this.courseId, allBadges)
    if (isNewBest) {
      this.writeBest(totalScore)
      this.writeBestTrace()
      this.bestGateSplits = this.gateSplits.slice()
    }

    this.phase = 'complete'
    this.result = {
      elapsedSec,
      gateScore,
      timeScore,
      landingScore,
      landingQuality,
      landingLabel: landingQualityLabel(landingQuality),
      totalScore,
      medal: medalFor(totalScore),
      bestScore,
      isNewBest,
      gateSplits: this.gateSplits.slice(),
      bestGateSplits: comparisonBestSplits,
      paceDeltaSec,
      paceLabel,
      completionCount: history.completionCount,
      bestTimeSec: history.bestTimeSec,
      scoringFocus: this.scoringFocus,
      masteryBadges: allBadges,
      newMasteryBadges: newBadges,
      fuelRemainingPercent,
      fuelUsedPercent,
      bestPrecisionStreak: this.bestGateQualityStreak,
      courseBestPrecisionStreak,
      peakSpeedKts,
      peakAltitudeM,
      courseBestPeakSpeedKts,
      courseBestPeakAltitudeM,
      newPeakSpeedRecord,
      newPeakAltitudeRecord,
      stuntRolls: this.stuntRollCount,
      stuntScore,
      courseBestStuntRolls,
      newStuntRecord,
    }
    return this.result
  }

  fail(): void {
    if (this.phase !== 'complete') this.phase = 'failed'
  }

  get clockLabel(): string {
    const safe = Number.isFinite(this.elapsedSec) ? Math.max(0, this.elapsedSec) : 0
    const minutes = Math.floor(safe / 60)
    const centis = Math.round((safe - minutes * 60) * 100)
    if (minutes !== this.clockLabelMinutes || centis !== this.clockLabelCentis) {
      this.clockLabelMinutes = minutes
      this.clockLabelCentis = centis
      this.clockLabelValue = formatTime(this.elapsedSec)
    }
    return this.clockLabelValue
  }

  get objectiveLabel(): string {
    if (this.phase === 'ready') return 'TAKE OFF'
    if (this.phase === 'returning') return 'RETURN & LAND'
    if (this.phase === 'complete') return 'RUN COMPLETE'
    if (this.phase === 'failed') return 'RUN FAILED'
    return `GATE ${Math.min(this.gatesPassed + 1, this.totalGates)}/${this.totalGates}`
  }

  /** Compare the most recently cleared gate with the best saved trace. */
  get gatePaceLabel(): string {
    if (!Object.is(this.lastPaceDeltaSec, this.gatePaceLabelDelta)) {
      this.gatePaceLabelDelta = this.lastPaceDeltaSec
      this.gatePaceLabelValue = formatPaceDelta(this.lastPaceDeltaSec)
    }
    return this.gatePaceLabelValue
  }

  /** Keep the precision streak visible only after it becomes meaningful. */
  get gateStreakLabel(): string {
    return this.gateQualityStreak >= 2 ? `STREAK X${this.gateQualityStreak}` : ''
  }

  private readBest(): number {
    try {
      return readBestCourseScore(this.storage, this.courseId)
    } catch {
      return 0
    }
  }

  private writeBest(score: number): void {
    try {
      this.storage?.setItem(
        courseBestScoreStorageKey(this.courseId),
        String(Math.min(MAX_BEST_SCORE, Math.max(0, Math.floor(score)))),
      )
    } catch {
      // Private browsing/storage denial should never block a completed run.
    }
  }

  private writeBestPrecisionStreak(streak: number): void {
    try {
      this.storage?.setItem(
        courseBestPrecisionStreakStorageKey(this.courseId),
        String(Math.min(MAX_PRECISION_STREAK, Math.max(0, Math.floor(streak)))),
      )
    } catch {
      // Private browsing/storage denial should never block a completed run.
    }
  }

  private readBestTrace(): number[] {
    try {
      const raw = this.storage?.getItem(TRACE_KEY + this.courseId)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value >= 0)
    } catch {
      return []
    }
  }

  private writeBestTrace(): void {
    try {
      this.storage?.setItem(TRACE_KEY + this.courseId, JSON.stringify(this.gateSplits))
    } catch {
      // Private browsing/storage denial should never block a completed run.
    }
  }

  private readHistory(): CourseHistory {
    return repairCourseHistory(this.storage, this.courseId) ?? {
      completionCount: 0,
      bestTimeSec: Number.POSITIVE_INFINITY,
    }
  }

  private writeHistory(history: CourseHistory): void {
    try {
      this.storage?.setItem(courseHistoryStorageKey(this.courseId), serializeCourseHistory(history))
    } catch {
      // Private browsing/storage denial should never block a completed run.
    }
  }
}

export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const mins = Math.floor(safe / 60)
  const secs = safe - mins * 60
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`
}

export function formatPaceDelta(deltaSec: number): string {
  if (!Number.isFinite(deltaSec)) return 'FIRST RUN'
  const safe = Math.abs(deltaSec)
  if (safe < 0.005) return 'ON PACE'
  return deltaSec < 0 ? `AHEAD ${safe.toFixed(2)}S` : `BEHIND ${safe.toFixed(2)}S`
}

/** Compact result-only split strip. Live HUD code never calls this formatter. */
export function formatSplitTrace(
  current: readonly number[] | undefined,
  best: readonly number[] | undefined,
): string {
  if (!current || current.length === 0) return 'NO SPLIT TRACE'
  return current.map((split, index) => {
    const safeSplit = Number.isFinite(split) ? Math.max(0, split) : 0
    const bestSplit = best?.[index]
    const delta = Number.isFinite(bestSplit) ? safeSplit - bestSplit! : Number.NaN
    const deltaLabel = Number.isFinite(delta)
      ? ` ${delta < 0 ? '-' : '+'}${Math.abs(delta).toFixed(2)}`
      : ''
    return `G${index + 1} ${formatTime(safeSplit)}${deltaLabel}`
  }).join(' · ')
}

/** Stable class hook for medal-specific results styling. */
export function resultMedalClass(medal: Medal): string {
  return `medal-${medal}`
}

function medalFor(score: number): Medal {
  if (score >= 88_000) return 'gold'
  if (score >= 76_000) return 'silver'
  if (score >= 64_000) return 'bronze'
  return 'complete'
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function finiteOr(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function browserStorage(): ScoreStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
