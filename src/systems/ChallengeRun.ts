import { MAX_STUNT_ROLLS } from './StuntTracker'
import { MAX_COMBO_COUNT } from './FlightCombo'
import { SortieContractTracker, type SortieContractKind } from './SortieContract'
import type { Biome } from '../world/terrainSample'

export type ChallengePhase =
  | 'ready'
  | 'running'
  | 'returning'
  | 'complete'
  | 'failed'

export type Medal = 'gold' | 'silver' | 'bronze' | 'complete'
export type ChallengeScoringFocus = 'balanced' | 'gates' | 'pace' | 'landing'
export type MasteryBadgeId = 'first-flight' | 'gate-master' | 'landing-ace' | 'approach-ace' | 'streak-hunter' | 'gold-run'
export type LandingQualityLabel = 'BUTTER' | 'SMOOTH' | 'FIRM' | 'HARD'

export interface LandingMetrics {
  /** Downward speed at first contact, in m/s (negative = descending). */
  verticalSpeed: number
  /** Horizontal speed at first contact, in m/s. */
  groundSpeed: number
  pitchRad: number
  rollRad: number
  /** Horizontal distance from the home-strip center at touchdown. */
  baseDistanceM?: number
  /** Signed runway-local lateral offset at touchdown. */
  runwayLateralM?: number
  /** Absolute heading error from the runway centerline at touchdown. */
  headingErrorRad?: number
  /** Normalized precipitation and gust risk at touchdown. */
  weatherRisk?: number
  /** Atmosphere daylight at touchdown: 0 night … 1 day. */
  daylight?: number
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
  /** Bounded distance flown during this sortie, in metres. */
  flightDistanceM?: number
  /** Highest positive load factor reached during this sortie. */
  peakPositiveG?: number
  /** Lowest negative load factor reached during this sortie. */
  peakNegativeG?: number
  /** Best distance record retained for this course, in metres. */
  courseBestFlightDistanceM?: number
  /** Best positive-G record retained for this course. */
  courseBestPositiveG?: number
  /** Lowest negative-G record retained for this course. */
  courseBestNegativeG?: number
  /** Whether this sortie set a new course distance record. */
  newFlightDistanceRecord?: boolean
  /** Whether this sortie set a new course positive-G record. */
  newPositiveGRecord?: boolean
  /** Whether this sortie set a new course negative-G record. */
  newNegativeGRecord?: boolean
  /** Number of completed airborne barrel rolls in this sortie. */
  stuntRolls?: number
  /** Bounded score bonus awarded for completed barrel rolls. */
  stuntScore?: number
  /** Highest completed barrel-roll count ever recorded for this course. */
  courseBestStuntRolls?: number
  /** Whether this sortie set a new course barrel-roll record. */
  newStuntRecord?: boolean
  /** Whether this result came from the no-checkpoint exploration course. */
  freeFlight?: boolean
  /** Highest climb milestone reached during this sortie, in metres. */
  altitudeMilestoneM?: number
  /** Longest clean gate and stunt chain reached during this sortie. */
  bestCombo?: number
  /** Capped score bonus awarded for combo milestones. */
  comboScore?: number
  /** Capped score bonus awarded for preserving fuel through touchdown. */
  fuelScore?: number
  /** Capped score bonus awarded for a centered, aligned home-strip approach. */
  approachScore?: number
  /** Capped score bonus awarded for landing through active weather. */
  weatherScore?: number
  /** Capped score bonus awarded for a clean night or dusk touchdown. */
  nightScore?: number
  /** Capped score bonus awarded for reaching streamed city or village targets. */
  destinationScore?: number
  /** Number of streamed settlement targets reached during this sortie. */
  destinationCount?: number
  /** Highest streamed settlement count recorded for this course. */
  courseBestDestinationCount?: number
  /** Whether this sortie set a new course destination record. */
  newDestinationRecord?: boolean
  /** Number of distinct natural biomes surveyed during this sortie. */
  biomeCount?: number
  /** Capped score bonus awarded for surveying distinct biomes. */
  biomeScore?: number
  /** Highest distinct-biome count ever recorded for this course. */
  courseBestBiomeCount?: number
  /** Whether this sortie set a new course biome-survey record. */
  newBiomeRecord?: boolean
  /** Consecutive completed sorties for this course after this run. */
  runStreak?: number
  /** Highest consecutive completed-sortie streak recorded for this course. */
  courseBestRunStreak?: number
  /** Whether this sortie set a new course run-streak record. */
  newRunStreakRecord?: boolean
  /** Deterministic bonus contract assigned to this sortie. */
  contractKind?: SortieContractKind
  /** Short contract name for HUD and results. */
  contractLabel?: string
  /** Contract completion instruction. */
  contractDetail?: string
  /** Whether the assigned contract was completed. */
  contractComplete?: boolean
  /** Whether the assigned contract became impossible during the sortie. */
  contractFailed?: boolean
  /** Contract progress at touchdown, normalized to 0..1. */
  contractProgress?: number
  /** Finite bonus awarded for completing the assigned contract. */
  contractScore?: number
  /** Capped bonus awarded for completing a contract while a chain is active. */
  contractStreakBonus?: number
  /** Capped bonus for a successful landing after fuel exhaustion. */
  deadstickScore?: number
  /** Number of completed bonus contracts on this course after this run. */
  contractWins?: number
  /** Highest completed-contract count recorded for this course. */
  courseBestContractWins?: number
  /** Whether this sortie set a new completed-contract record. */
  newContractRecord?: boolean
  /** Consecutive completed bonus contracts for this course after this run. */
  contractStreak?: number
  /** Highest consecutive completed-contract streak recorded for this course. */
  courseBestContractStreak?: number
  /** Whether this sortie set a new contract-streak record. */
  newContractStreakRecord?: boolean
  /** Derived long-term mastery tier for this course. */
  courseMasteryTier?: CourseMasteryTier
  /** Human-readable mastery tier label. */
  courseMasteryTierLabel?: string
  /** Best centered, aligned home-strip approach bonus recorded for this course. */
  courseBestApproachScore?: number
  /** Whether this sortie set a new course approach record. */
  newApproachRecord?: boolean
  /** Best touchdown-quality score retained for this course. */
  courseBestLandingQuality?: number
  /** Whether this sortie set a new course touchdown-quality record. */
  newLandingQualityRecord?: boolean
  /** Highest combo ever recorded for this course. */
  courseBestCombo?: number
  /** Whether this sortie set a new course combo record. */
  newComboRecord?: boolean
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
export const MAX_BEST_SCORE = 117_500
export const MAX_PRECISION_STREAK = 1_000
export const MAX_PEAK_SPEED_KTS = 20_000
export const MAX_PEAK_ALTITUDE_M = 100_000
export const MAX_FUEL_EFFICIENCY_SCORE = 1_000
export const MAX_APPROACH_SCORE = 500
export const MAX_LANDING_QUALITY = 1
export const MAX_WEATHER_SCORE = 500
export const MAX_NIGHT_SCORE = 500
export const MAX_DESTINATION_SCORE = 1_200
export const MAX_DESTINATION_COUNT = 6
export const MAX_BIOME_SCORE = 1_800
export const MAX_BIOME_COUNT = 15
export const MAX_RUN_STREAK = 1_000
export const MAX_CONTRACT_WINS = 1_000
export const MAX_CONTRACT_STREAK = 1_000
export const MAX_CONTRACT_STREAK_BONUS = 1_000
export const MAX_DEADSTICK_SCORE = 1_500
export const MAX_STORED_GATE_SPLITS = 8
export const MAX_FLIGHT_DISTANCE_M = 2_000_000
export const MAX_PEAK_POSITIVE_G = 20
export const MIN_PEAK_NEGATIVE_G = -9

const SURVEYABLE_BIOMES: readonly Biome[] = [
  'plains', 'forest', 'rainforest', 'desert', 'mesa', 'swamp', 'hills',
  'mountain', 'snow', 'water', 'ocean', 'tundra', 'savanna', 'volcanic', 'saltflat',
]

export type CourseMasteryTier = 'rookie' | 'pilot' | 'veteran' | 'ace' | 'legend'

export interface CourseMasteryProgress {
  completionCount?: number
  bestScore?: number
  badgeCount?: number
  contractWins?: number
}

/** Derive a stable, bounded course rank from the records already in storage. */
export function courseMasteryTierForProgress(progress: CourseMasteryProgress): CourseMasteryTier {
  const runs = safeCount(progress.completionCount, MAX_COMPLETION_COUNT)
  const score = safeCount(progress.bestScore, MAX_BEST_SCORE)
  const badges = safeCount(progress.badgeCount, MASTERY_BADGE_COUNT)
  const contracts = safeCount(progress.contractWins, MAX_CONTRACT_WINS)
  if (runs >= 10 && score >= 100_000 && badges >= MASTERY_BADGE_COUNT && contracts >= 5) return 'legend'
  if (runs >= 5 && score >= 88_000 && badges >= 3 && contracts >= 2) return 'ace'
  if (runs >= 3 && score >= 76_000 && badges >= 2) return 'veteran'
  if (runs >= 1) return 'pilot'
  return 'rookie'
}

export function courseMasteryTierLabel(tier: CourseMasteryTier): string {
  if (tier === 'pilot') return 'PILOT'
  if (tier === 'veteran') return 'VETERAN'
  if (tier === 'ace') return 'ACE'
  if (tier === 'legend') return 'LEGEND'
  return 'ROOKIE'
}

export interface CourseHistory {
  completionCount: number
  bestTimeSec: number
  peakSpeedKts?: number
  peakAltitudeM?: number
  stuntRolls?: number
  combo?: number
  approachScore?: number
  landingQuality?: number
  destinations?: number
  biomes?: number
  runStreak?: number
  runStreakRecord?: number
  contractWins?: number
  contractStreak?: number
  contractStreakRecord?: number
  flightDistanceM?: number
  peakPositiveG?: number
  peakNegativeG?: number
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

/** Compute the finite touchdown-quality score shared by results and approach preview. */
export function landingQualityForMetrics(
  metrics: Pick<LandingMetrics, 'verticalSpeed' | 'groundSpeed' | 'pitchRad' | 'rollRad'>,
): number {
  const verticalSpeed = finiteOr(metrics.verticalSpeed)
  const groundSpeed = Math.max(0, finiteOr(metrics.groundSpeed))
  const rollRad = finiteOr(metrics.rollRad)
  const pitchRad = finiteOr(metrics.pitchRad)
  const sinkPenalty = Math.max(0, Math.max(0, -verticalSpeed) - 1.2) / 5
  const speedPenalty = Math.max(0, groundSpeed - 32) / 38
  const bankPenalty = Math.abs(rollRad) / (Math.PI / 5)
  const pitchPenalty = Math.max(0, Math.abs(pitchRad) - 0.22) / 0.65
  return clamp01(
    1 - sinkPenalty * 0.45 - speedPenalty * 0.3 - bankPenalty * 0.2 - pitchPenalty * 0.05,
  )
}

/** Reward a completed landing for preserving fuel, with a finite cap. */
export function fuelEfficiencyScore(fraction: number): number {
  return Math.round(clamp01(fraction) * MAX_FUEL_EFFICIENCY_SCORE)
}

/** Reward a safe runway approach without making off-field landings fail. */
export function landingApproachScore(metrics: Pick<LandingMetrics, 'baseDistanceM' | 'runwayLateralM' | 'headingErrorRad'>): number {
  if (
    !Number.isFinite(metrics.baseDistanceM)
    || !Number.isFinite(metrics.runwayLateralM)
    || !Number.isFinite(metrics.headingErrorRad)
  ) return 0
  const distance = Math.max(0, metrics.baseDistanceM!)
  const lateral = Math.abs(metrics.runwayLateralM!)
  const heading = Math.abs(metrics.headingErrorRad!)
  const distanceFactor = 1 - clamp01(distance / 180)
  const lateralFactor = 1 - clamp01(lateral / 55)
  const headingFactor = 1 - clamp01(heading / (Math.PI / 3))
  return Math.round(MAX_APPROACH_SCORE * distanceFactor * lateralFactor * headingFactor)
}

/** Reward a clean touchdown through bounded precipitation or gust risk. */
export function weatherLandingScore(risk: number, landingQuality = 1): number {
  if (!Number.isFinite(risk) || !Number.isFinite(landingQuality)) return 0
  return Math.round(MAX_WEATHER_SCORE * clamp01(risk) * clamp01(landingQuality))
}

/** Reward a clean night or dusk touchdown using the shared daylight envelope. */
export function nightLandingScore(daylight: number, landingQuality = 1): number {
  if (!Number.isFinite(daylight) || !Number.isFinite(landingQuality)) return 0
  const nightFactor = clamp01((0.42 - daylight) / 0.42)
  return Math.round(MAX_NIGHT_SCORE * nightFactor * clamp01(landingQuality))
}

/** Reward a controlled touchdown after the engine has run dry. */
export function deadstickLandingScore(fuelFraction: number, landingQuality = 1): number {
  if (!Number.isFinite(fuelFraction) || !Number.isFinite(landingQuality)) return 0
  if (fuelFraction < 0 || fuelFraction > 0.001) return 0
  return Math.round(MAX_DEADSTICK_SCORE * clamp01(landingQuality))
}

/** Reward an active contract chain without allowing runaway score growth. */
export function contractStreakBonusForStreak(streak: number): number {
  if (!Number.isFinite(streak)) return 0
  return Math.min(MAX_CONTRACT_STREAK_BONUS, Math.max(0, Math.floor(streak)) * 250)
}

/** Collapse the active front into one finite touchdown-risk scalar. */
export function landingWeatherRisk(weather: { rain: number; snow: number; gust: number }): number {
  const rain = clamp01(weather.rain)
  const snow = clamp01(weather.snow)
  const gust = Math.max(0, clamp01(weather.gust) - 0.18)
  return Math.max(rain, snow, gust)
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
  'approach-ace',
  'streak-hunter',
  'gold-run',
]
export const MASTERY_BADGE_COUNT = MASTERY_BADGES.length

const GATE_STREAK_THRESHOLD = 0.82
const STREAK_HUNTER_THRESHOLD = 3
const APPROACH_ACE_THRESHOLD = 400

export function masteryBadgeLabel(badge: MasteryBadgeId): string {
  if (badge === 'first-flight') return 'FIRST FLIGHT'
  if (badge === 'gate-master') return 'GATE MASTER'
  if (badge === 'landing-ace') return 'LANDING ACE'
  if (badge === 'approach-ace') return 'APPROACH ACE'
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
  approachScore = 0,
): MasteryBadgeId[] {
  const badges: MasteryBadgeId[] = []
  if (completionCount >= 1) badges.push('first-flight')
  if (gateQuality >= 0.9) badges.push('gate-master')
  if (landingQuality >= 0.9) badges.push('landing-ace')
  if (Number.isFinite(approachScore) && approachScore >= APPROACH_ACE_THRESHOLD && landingQuality >= 0.78) {
    badges.push('approach-ace')
  }
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
  const rawCombo = record.combo
  const rawApproachScore = record.approachScore
  const rawLandingQuality = record.landingQuality
  const rawDestinations = record.destinations
  const rawBiomes = record.biomes
  const rawRunStreak = record.runStreak
  const rawRunStreakRecord = record.runStreakRecord
  const rawContractWins = record.contractWins
  const rawContractStreak = record.contractStreak
  const rawContractStreakRecord = record.contractStreakRecord
  const rawFlightDistanceM = record.flightDistanceM
  const rawPeakPositiveG = record.peakPositiveG
  const rawPeakNegativeG = record.peakNegativeG
  const hasBestTime = Object.prototype.hasOwnProperty.call(record, 'bestTimeSec')
  const hasPeakSpeed = Object.prototype.hasOwnProperty.call(record, 'peakSpeedKts')
  const hasPeakAltitude = Object.prototype.hasOwnProperty.call(record, 'peakAltitudeM')
  const hasStuntRolls = Object.prototype.hasOwnProperty.call(record, 'stuntRolls')
  const hasCombo = Object.prototype.hasOwnProperty.call(record, 'combo')
  const hasApproachScore = Object.prototype.hasOwnProperty.call(record, 'approachScore')
  const hasLandingQuality = Object.prototype.hasOwnProperty.call(record, 'landingQuality')
  const hasDestinations = Object.prototype.hasOwnProperty.call(record, 'destinations')
  const hasBiomes = Object.prototype.hasOwnProperty.call(record, 'biomes')
  const hasRunStreak = Object.prototype.hasOwnProperty.call(record, 'runStreak')
  const hasRunStreakRecord = Object.prototype.hasOwnProperty.call(record, 'runStreakRecord')
  const hasContractWins = Object.prototype.hasOwnProperty.call(record, 'contractWins')
  const hasContractStreak = Object.prototype.hasOwnProperty.call(record, 'contractStreak')
  const hasContractStreakRecord = Object.prototype.hasOwnProperty.call(record, 'contractStreakRecord')
  const hasFlightDistance = Object.prototype.hasOwnProperty.call(record, 'flightDistanceM')
  const hasPeakPositiveG = Object.prototype.hasOwnProperty.call(record, 'peakPositiveG')
  const hasPeakNegativeG = Object.prototype.hasOwnProperty.call(record, 'peakNegativeG')
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
  const combo = typeof rawCombo === 'number' && Number.isFinite(rawCombo) && rawCombo > 0
    ? Math.min(MAX_COMBO_COUNT, Math.floor(rawCombo))
    : 0
  const approachScore = typeof rawApproachScore === 'number' && Number.isFinite(rawApproachScore) && rawApproachScore > 0
    ? Math.min(MAX_APPROACH_SCORE, Math.floor(rawApproachScore))
    : 0
  const landingQuality = typeof rawLandingQuality === 'number' && Number.isFinite(rawLandingQuality) && rawLandingQuality > 0
    ? Math.min(MAX_LANDING_QUALITY, Number(rawLandingQuality.toFixed(3)))
    : 0
  const destinations = typeof rawDestinations === 'number' && Number.isFinite(rawDestinations) && rawDestinations > 0
    ? Math.min(MAX_DESTINATION_COUNT, Math.floor(rawDestinations))
    : 0
  const biomes = typeof rawBiomes === 'number' && Number.isFinite(rawBiomes) && rawBiomes > 0
    ? Math.min(MAX_BIOME_COUNT, Math.floor(rawBiomes))
    : 0
  const runStreak = typeof rawRunStreak === 'number' && Number.isFinite(rawRunStreak) && rawRunStreak > 0
    ? Math.min(MAX_RUN_STREAK, Math.floor(rawRunStreak))
    : 0
  const runStreakRecord = Math.max(
    runStreak,
    typeof rawRunStreakRecord === 'number' && Number.isFinite(rawRunStreakRecord) && rawRunStreakRecord > 0
      ? Math.min(MAX_RUN_STREAK, Math.floor(rawRunStreakRecord))
      : 0,
  )
  const contractWins = typeof rawContractWins === 'number' && Number.isFinite(rawContractWins) && rawContractWins > 0
    ? Math.min(MAX_CONTRACT_WINS, Math.floor(rawContractWins))
    : 0
  const contractStreak = typeof rawContractStreak === 'number' && Number.isFinite(rawContractStreak) && rawContractStreak > 0
    ? Math.min(MAX_CONTRACT_STREAK, Math.floor(rawContractStreak))
    : 0
  const contractStreakRecord = Math.max(
    contractStreak,
    typeof rawContractStreakRecord === 'number' && Number.isFinite(rawContractStreakRecord) && rawContractStreakRecord > 0
      ? Math.min(MAX_CONTRACT_STREAK, Math.floor(rawContractStreakRecord))
      : 0,
  )
  const flightDistanceM = typeof rawFlightDistanceM === 'number' && Number.isFinite(rawFlightDistanceM) && rawFlightDistanceM > 0
    ? Math.min(MAX_FLIGHT_DISTANCE_M, Math.floor(rawFlightDistanceM))
    : 0
  const peakPositiveG = typeof rawPeakPositiveG === 'number' && Number.isFinite(rawPeakPositiveG) && rawPeakPositiveG > 1
    ? Math.min(MAX_PEAK_POSITIVE_G, Number(rawPeakPositiveG.toFixed(2)))
    : 0
  const peakNegativeG = typeof rawPeakNegativeG === 'number' && Number.isFinite(rawPeakNegativeG) && rawPeakNegativeG < 0
    ? Math.max(MIN_PEAK_NEGATIVE_G, Number(rawPeakNegativeG.toFixed(2)))
    : 0
  const history: CourseHistory = { completionCount, bestTimeSec }
  if (peakSpeedKts > 0) history.peakSpeedKts = peakSpeedKts
  if (peakAltitudeM > 0) history.peakAltitudeM = peakAltitudeM
  if (stuntRolls > 0) history.stuntRolls = stuntRolls
  if (combo > 0) history.combo = combo
  if (approachScore > 0) history.approachScore = approachScore
  if (landingQuality > 0) history.landingQuality = landingQuality
  if (destinations > 0) history.destinations = destinations
  if (biomes > 0) history.biomes = biomes
  if (runStreak > 0) history.runStreak = runStreak
  if (runStreakRecord > 0) history.runStreakRecord = runStreakRecord
  if (contractWins > 0) history.contractWins = contractWins
  if (contractStreak > 0) history.contractStreak = contractStreak
  if (contractStreakRecord > 0) history.contractStreakRecord = contractStreakRecord
  if (flightDistanceM > 0) history.flightDistanceM = flightDistanceM
  if (peakPositiveG > 1) history.peakPositiveG = peakPositiveG
  if (peakNegativeG < 0) history.peakNegativeG = peakNegativeG
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
    (hasCombo && (typeof rawCombo !== 'number' || !Number.isFinite(rawCombo) || rawCombo <= 0 || rawCombo !== combo)) ||
    (hasApproachScore && (typeof rawApproachScore !== 'number' || !Number.isFinite(rawApproachScore) || rawApproachScore <= 0 || rawApproachScore !== approachScore)) ||
    (hasLandingQuality && (typeof rawLandingQuality !== 'number' || !Number.isFinite(rawLandingQuality) || rawLandingQuality <= 0 || rawLandingQuality !== landingQuality)) ||
    (hasDestinations && (typeof rawDestinations !== 'number' || !Number.isFinite(rawDestinations) || rawDestinations <= 0 || rawDestinations !== destinations)) ||
    (hasBiomes && (typeof rawBiomes !== 'number' || !Number.isFinite(rawBiomes) || rawBiomes <= 0 || rawBiomes !== biomes)) ||
    (hasRunStreak && (typeof rawRunStreak !== 'number' || !Number.isFinite(rawRunStreak) || rawRunStreak <= 0 || rawRunStreak !== runStreak)) ||
    (hasRunStreakRecord && (typeof rawRunStreakRecord !== 'number' || !Number.isFinite(rawRunStreakRecord) || rawRunStreakRecord <= 0 || rawRunStreakRecord !== runStreakRecord)) ||
    (!hasRunStreakRecord && runStreak > 0) ||
    (hasContractWins && (typeof rawContractWins !== 'number' || !Number.isFinite(rawContractWins) || rawContractWins <= 0 || rawContractWins !== contractWins)) ||
    (hasContractStreak && (typeof rawContractStreak !== 'number' || !Number.isFinite(rawContractStreak) || rawContractStreak <= 0 || rawContractStreak !== contractStreak)) ||
    (hasContractStreakRecord && (typeof rawContractStreakRecord !== 'number' || !Number.isFinite(rawContractStreakRecord) || rawContractStreakRecord <= 0 || rawContractStreakRecord !== contractStreakRecord)) ||
    (!hasContractStreakRecord && contractStreak > 0) ||
    (hasFlightDistance && (typeof rawFlightDistanceM !== 'number' || !Number.isFinite(rawFlightDistanceM) || rawFlightDistanceM <= 0 || rawFlightDistanceM !== flightDistanceM)) ||
    (hasPeakPositiveG && (typeof rawPeakPositiveG !== 'number' || !Number.isFinite(rawPeakPositiveG) || rawPeakPositiveG <= 1 || rawPeakPositiveG !== peakPositiveG)) ||
    (hasPeakNegativeG && (typeof rawPeakNegativeG !== 'number' || !Number.isFinite(rawPeakNegativeG) || rawPeakNegativeG >= 0 || rawPeakNegativeG !== peakNegativeG)) ||
    Object.keys(record).some((key) =>
      key !== 'completionCount' && key !== 'bestTimeSec' && key !== 'peakSpeedKts' && key !== 'peakAltitudeM' && key !== 'stuntRolls' && key !== 'combo' && key !== 'approachScore' && key !== 'landingQuality' && key !== 'destinations' && key !== 'biomes' && key !== 'runStreak' && key !== 'runStreakRecord' && key !== 'contractWins' && key !== 'contractStreak' && key !== 'contractStreakRecord' && key !== 'flightDistanceM' && key !== 'peakPositiveG' && key !== 'peakNegativeG',
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
  if (Number.isFinite(history.flightDistanceM) && history.flightDistanceM! > 0) {
    record.flightDistanceM = Math.min(MAX_FLIGHT_DISTANCE_M, Math.floor(history.flightDistanceM!))
  }
  if (Number.isFinite(history.peakPositiveG) && history.peakPositiveG! > 1) {
    record.peakPositiveG = Math.min(MAX_PEAK_POSITIVE_G, Number(history.peakPositiveG!.toFixed(2)))
  }
  if (Number.isFinite(history.peakNegativeG) && history.peakNegativeG! < 0) {
    record.peakNegativeG = Math.max(MIN_PEAK_NEGATIVE_G, Number(history.peakNegativeG!.toFixed(2)))
  }
  if (Number.isFinite(history.stuntRolls) && history.stuntRolls! > 0) {
    record.stuntRolls = Math.min(MAX_STUNT_ROLLS, Math.floor(history.stuntRolls!))
  }
  if (Number.isFinite(history.combo) && history.combo! > 0) {
    record.combo = Math.min(MAX_COMBO_COUNT, Math.floor(history.combo!))
  }
  if (Number.isFinite(history.approachScore) && history.approachScore! > 0) {
    record.approachScore = Math.min(MAX_APPROACH_SCORE, Math.floor(history.approachScore!))
  }
  if (Number.isFinite(history.landingQuality) && history.landingQuality! > 0) {
    record.landingQuality = Math.min(MAX_LANDING_QUALITY, Number(history.landingQuality!.toFixed(3)))
  }
  if (Number.isFinite(history.destinations) && history.destinations! > 0) {
    record.destinations = Math.min(MAX_DESTINATION_COUNT, Math.floor(history.destinations!))
  }
  if (Number.isFinite(history.biomes) && history.biomes! > 0) {
    record.biomes = Math.min(MAX_BIOME_COUNT, Math.floor(history.biomes!))
  }
  const runStreak = Number.isFinite(history.runStreak) && history.runStreak! > 0
    ? Math.min(MAX_RUN_STREAK, Math.floor(history.runStreak!))
    : 0
  const runStreakRecord = Number.isFinite(history.runStreakRecord) && history.runStreakRecord! > 0
    ? Math.min(MAX_RUN_STREAK, Math.floor(history.runStreakRecord!))
    : 0
  if (runStreak > 0) record.runStreak = runStreak
  if (Math.max(runStreak, runStreakRecord) > 0) {
    record.runStreakRecord = Math.max(runStreak, runStreakRecord)
  }
  if (Number.isFinite(history.contractWins) && history.contractWins! > 0) {
    record.contractWins = Math.min(MAX_CONTRACT_WINS, Math.floor(history.contractWins!))
  }
  const contractStreak = Number.isFinite(history.contractStreak) && history.contractStreak! > 0
    ? Math.min(MAX_CONTRACT_STREAK, Math.floor(history.contractStreak!))
    : 0
  const contractStreakRecord = Number.isFinite(history.contractStreakRecord) && history.contractStreakRecord! > 0
    ? Math.min(MAX_CONTRACT_STREAK, Math.floor(history.contractStreakRecord!))
    : 0
  if (contractStreak > 0) record.contractStreak = contractStreak
  if (Math.max(contractStreak, contractStreakRecord) > 0) {
    record.contractStreakRecord = Math.max(contractStreak, contractStreakRecord)
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
  private freeFlight = false
  private altitudeMilestone = 0
  private gateQualityTotal = 0
  private gateQualityStreak = 0
  private bestGateQualityStreak = 0
  private destinationScore = 0
  private destinationCount = 0
  private surveyedBiomeMask = 0
  private surveyedBiomeCount = 0
  private surveyedBiomeCue: Biome | null = null
  private peakSpeedMps = 0
  private peakAltitudeM = 0
  private flightDistanceM = 0
  private peakPositiveG = 1
  private peakNegativeG = 0
  private stuntRollCount = 0
  private bestCombo = 0
  private contractStreakValue = 0
  private readonly contract = new SortieContractTracker()
  private contractCuePending = false
  private contractFailureCuePending = false
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

  reset(
    courseId: string,
    totalGates: number,
    scoringFocus: ChallengeScoringFocus = 'balanced',
    contractSeed?: number,
  ): void {
    this.courseId = courseId
    this.totalGates = Math.max(0, Math.floor(totalGates))
    this.scoringFocus = scoringFocus
    this.freeFlight = courseId === 'free-flight'
    this.altitudeMilestone = 0
    this.phase = 'ready'
    this.elapsedSec = 0
    this.gatesPassed = 0
    this.gateQualityTotal = 0
    this.gateQualityStreak = 0
    this.bestGateQualityStreak = 0
    this.destinationScore = 0
    this.destinationCount = 0
    this.surveyedBiomeMask = 0
    this.surveyedBiomeCount = 0
    this.surveyedBiomeCue = null
    this.peakSpeedMps = 0
    this.peakAltitudeM = 0
    this.flightDistanceM = 0
    this.peakPositiveG = 1
    this.peakNegativeG = 0
    this.stuntRollCount = 0
    this.bestCombo = 0
    this.contract.reset(contractSeed, this.totalGates)
    const history = this.readHistory()
    this.contractStreakValue = this.contract.enabled
      ? Math.min(MAX_CONTRACT_STREAK, Math.max(0, Math.floor(history.contractStreak ?? 0)))
      : 0
    this.contractCuePending = false
    this.contractFailureCuePending = false
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
  update(
    dt: number,
    speed: number,
    altitudeM = 0,
    rain = 0,
    snow = 0,
    airbrake = false,
    airborne = true,
    engineHeat = 0,
    crosswindMps = 0,
    loadFactor = 1,
    fuelFraction = 1,
    weatherTransitioning = false,
    afterburner = false,
    terrainClearanceM = altitudeM,
    daylight = 1,
    distanceM = 0,
  ): void {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 5)) : 0
    const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
    const safeAltitude = Number.isFinite(altitudeM) ? Math.max(0, altitudeM) : 0
    const safeTerrainClearance = Number.isFinite(terrainClearanceM)
      ? Math.max(0, Math.min(100_000, terrainClearanceM))
      : safeAltitude
    const safeLoadFactor = Number.isFinite(loadFactor)
      ? Math.max(-9, Math.min(20, loadFactor))
      : 1
    const safeDistance = Number.isFinite(distanceM)
      ? Math.max(0, Math.min(2_000_000, distanceM))
      : 0
    this.peakSpeedMps = Math.max(this.peakSpeedMps, Math.min(safeSpeed, 10_000))
    this.peakAltitudeM = Math.max(this.peakAltitudeM, Math.min(safeAltitude, 100_000))
    this.peakPositiveG = Math.max(this.peakPositiveG, safeLoadFactor)
    this.peakNegativeG = Math.min(this.peakNegativeG, safeLoadFactor)
    const wasContractComplete = this.contract.complete
    this.contract.recordLowLevel(safeTerrainClearance, safeDt, safeSpeed > 5)
    this.contract.recordSpeedBand(safeSpeed, safeDt, safeSpeed > 5)
    this.contract.recordWeather(rain, snow, safeDt, safeSpeed > 5)
    this.contract.recordBrake(safeSpeed, safeDt, airbrake, airborne)
    this.contract.recordHeat(engineHeat, safeSpeed, safeDt, airborne)
    this.contract.recordCrosswind(crosswindMps, safeDt, airborne)
    this.contract.recordGControl(safeLoadFactor, safeSpeed, safeDt, airborne)
    this.contract.recordDeadstick(fuelFraction, airborne)
    this.contract.recordFront(weatherTransitioning, safeDt, airborne)
    this.contract.recordBoost(afterburner, safeSpeed, safeDt, airborne)
    this.contract.recordMach(safeSpeed, safeDt, airborne)
    this.contract.recordLevelFlight(safeAltitude, safeDt, airborne)
    this.contract.recordNight(daylight, safeDt, airborne)
    this.contract.recordDry(afterburner, safeSpeed, safeDt, airborne)
    this.contractCuePending ||= !wasContractComplete && this.contract.complete
    if (this.phase === 'ready' && safeSpeed > 5) {
      this.phase = this.totalGates > 0 ? 'running' : 'returning'
    }
    if (this.phase === 'running' || this.phase === 'returning') {
      this.elapsedSec += safeDt
      this.flightDistanceM = Math.min(2_000_000, this.flightDistanceM + safeDistance)
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
    const wasContractComplete = this.contract.complete
    this.contract.recordPrecisionGate(safeQuality)
    this.contract.recordCleanGate(false, this.gatesPassed, this.totalGates)
    this.contractCuePending ||= !wasContractComplete && this.contract.complete
    const bestSplit = this.bestGateSplits[gateIndex]
    this.lastPaceDeltaSec = Number.isFinite(bestSplit) ? split - bestSplit! : Number.NaN
    this.gatePaceLabelDelta = Number.NaN
    if (this.totalGates > 0 && this.gatesPassed >= this.totalGates) {
      this.phase = 'returning'
    }
  }

  /** Record a missed gate for the optional no-miss circuit contract. */
  recordGateMiss(): void {
    if (this.phase === 'complete' || this.phase === 'failed') return
    const wasContractFailed = this.contract.failed
    this.contract.recordCleanGate(true, this.gatesPassed, this.totalGates)
    this.contractFailureCuePending ||= !wasContractFailed && this.contract.failed
  }

  /** Consume the one-shot label for a contract that became permanently failed. */
  consumeContractFailureCue(): string | null {
    if (!this.contractFailureCuePending) return null
    this.contractFailureCuePending = false
    return this.contract.label || null
  }

  /** Record a completed airshow maneuver without touching the flight loop. */
  recordStunt(rolls = 1): void {
    if (this.phase === 'complete' || this.phase === 'failed') return
    if (this.phase === 'ready') this.phase = 'running'
    const safeRolls = Number.isFinite(rolls)
      ? Math.max(0, Math.min(MAX_STUNT_ROLLS, Math.floor(rolls)))
      : 0
    const wasComplete = this.contract.complete
    this.stuntRollCount = Math.min(MAX_STUNT_ROLLS, this.stuntRollCount + safeRolls)
    this.contract.recordStunt(this.stuntRollCount)
    this.contractCuePending ||= !wasComplete && this.contract.complete
  }

  /** Retain the highest reached climb milestone without affecting scoring. */
  recordAltitudeMilestone(altitudeM: number): void {
    if (this.phase === 'complete' || this.phase === 'failed') return
    if (!Number.isFinite(altitudeM)) return
    const wasComplete = this.contract.complete
    this.altitudeMilestone = Math.max(0, Math.min(100_000, Math.floor(altitudeM)))
    this.contract.recordAltitude(this.altitudeMilestone)
    this.contractCuePending ||= !wasComplete && this.contract.complete
  }

  /** Retain the highest event-driven clean-flight combo without trusting input. */
  recordCombo(combo: number): void {
    if (this.phase === 'complete' || this.phase === 'failed' || !Number.isFinite(combo)) return
    const wasContractComplete = this.contract.complete
    this.bestCombo = Math.max(this.bestCombo, Math.min(MAX_COMBO_COUNT, Math.floor(combo)))
    this.contract.recordCombo(this.bestCombo)
    this.contractCuePending ||= !wasContractComplete && this.contract.complete
  }

  /** Add one bounded reward when a selected streamed settlement is reached. */
  recordDestination(kind: 'city' | 'village'): void {
    if (this.phase !== 'running' && this.phase !== 'returning') return
    if (kind !== 'city' && kind !== 'village') return
    if (this.destinationCount >= MAX_DESTINATION_COUNT) return
    const reward = kind === 'city' ? 600 : 300
    const wasComplete = this.contract.complete
    this.destinationScore = Math.min(MAX_DESTINATION_SCORE, this.destinationScore + reward)
    this.destinationCount += 1
    this.contract.recordDestination(this.destinationCount, kind)
    this.contractCuePending ||= !wasComplete && this.contract.complete
  }

  /** Record one distinct natural biome encountered during the sortie. */
  recordBiome(biome: string): void {
    if (this.phase === 'complete' || this.phase === 'failed') return
    if (typeof biome !== 'string') return
    const index = SURVEYABLE_BIOMES.indexOf(biome as Biome)
    if (index < 0) return
    const bit = 1 << index
    if ((this.surveyedBiomeMask & bit) !== 0) return
    this.surveyedBiomeMask |= bit
    this.surveyedBiomeCount = Math.min(MAX_BIOME_COUNT, this.surveyedBiomeCount + 1)
    const wasContractComplete = this.contract.complete
    this.contract.recordBiome(this.surveyedBiomeCount)
    this.contractCuePending ||= !wasContractComplete && this.contract.complete
    if (this.phase === 'running' || this.phase === 'returning') {
      this.surveyedBiomeCue = biome as Biome
    }
  }

  /** Record one bounded water-surface interval for the optional water-run contract. */
  recordWater(isWater: boolean, dt: number, airborne = true): void {
    if (this.phase === 'complete' || this.phase === 'failed') return
    const wasContractComplete = this.contract.complete
    this.contract.recordWater(isWater, dt, airborne)
    this.contractCuePending ||= !wasContractComplete && this.contract.complete
  }

  /** Number of unique natural biomes seen so far in this sortie. */
  get biomeCount(): number {
    return this.surveyedBiomeCount
  }

  get currentFlightDistanceM(): number {
    return this.flightDistanceM
  }

  get currentPeakPositiveG(): number {
    return this.peakPositiveG
  }

  get currentPeakNegativeG(): number {
    return this.peakNegativeG
  }

  /** Consume one event-driven cue for the latest newly surveyed biome. */
  consumeBiomeSurveyCue(): Biome | null {
    const cue = this.surveyedBiomeCue
    this.surveyedBiomeCue = null
    return cue
  }

  finishLanding(metrics: LandingMetrics, fuelFraction = 1): ChallengeResult | null {
    if (this.phase !== 'returning') return null

    const elapsedSec = Number.isFinite(this.elapsedSec) ? Math.max(0, this.elapsedSec) : 0
    const fuelRemainingPercent = Math.round(clamp01(fuelFraction) * 100)
    const fuelUsedPercent = 100 - fuelRemainingPercent
    const fuelScore = fuelEfficiencyScore(fuelFraction)
    const approachScore = landingApproachScore(metrics)
    const gateQuality =
      this.totalGates > 0 ? this.gateQualityTotal / this.totalGates : 0
    const weights = scoringWeightsForFocus(this.scoringFocus)
    const gateScore = Math.round(weights.gate * clamp01(gateQuality))

    // A brisk, clean circuit scores well; time can never erase completion.
    const timeScore = Math.round(Math.max(weights.minimumTime, weights.time - elapsedSec * 320))

    const landingQuality = landingQualityForMetrics(metrics)
    const landingScore = Math.round(weights.landing * landingQuality)
    const weatherScore = weatherLandingScore(metrics.weatherRisk ?? Number.NaN, landingQuality)
    const nightScore = nightLandingScore(metrics.daylight ?? Number.NaN, landingQuality)
    const deadstickScore = deadstickLandingScore(fuelFraction, landingQuality)
    const stuntScore = Math.min(3_000, this.stuntRollCount * 750)
    const comboScore = this.bestCombo > 1
      ? Math.min(6_000, (this.bestCombo - 1) * 300)
      : 0
    const biomeScore = Math.min(MAX_BIOME_SCORE, this.surveyedBiomeCount * 120)
    const contractScore = this.contract.finish(elapsedSec, fuelFraction, approachScore, landingQuality)
    const contractComplete = this.contract.enabled && this.contract.complete
    const history = this.readHistory()
    const contractStreakBonus = contractComplete
      ? contractStreakBonusForStreak(history.contractStreak ?? 0)
      : 0
    const totalScore = gateScore + timeScore + landingScore + stuntScore + comboScore + fuelScore + approachScore + weatherScore + nightScore + deadstickScore + this.destinationScore + biomeScore + contractScore + contractStreakBonus
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
    const peakSpeedKts = Math.round(this.peakSpeedMps * 1.943844492)
    const peakAltitudeM = Math.round(this.peakAltitudeM)
    const flightDistanceM = Math.round(this.flightDistanceM)
    const peakPositiveG = Number(this.peakPositiveG.toFixed(2))
    const peakNegativeG = Number(this.peakNegativeG.toFixed(2))
    const previousPeakSpeedKts = history.peakSpeedKts ?? 0
    const previousPeakAltitudeM = history.peakAltitudeM ?? 0
    const previousStuntRolls = history.stuntRolls ?? 0
    const previousCombo = history.combo ?? 0
    const previousApproachScore = history.approachScore ?? 0
    const previousLandingQuality = history.landingQuality ?? 0
    const previousDestinationCount = history.destinations ?? 0
    const previousBiomeCount = history.biomes ?? 0
    const previousRunStreak = history.runStreak ?? 0
    const previousRunStreakRecord = history.runStreakRecord ?? 0
    const previousContractWins = history.contractWins ?? 0
    const previousContractStreak = history.contractStreak ?? 0
    const previousContractStreakRecord = history.contractStreakRecord ?? 0
    const previousFlightDistanceM = history.flightDistanceM ?? 0
    const previousPeakPositiveG = history.peakPositiveG ?? 0
    const previousPeakNegativeG = history.peakNegativeG ?? 0
    const newPeakSpeedRecord = peakSpeedKts > previousPeakSpeedKts
    const newPeakAltitudeRecord = peakAltitudeM > previousPeakAltitudeM
    const newStuntRecord = this.stuntRollCount > previousStuntRolls
    const courseBestPeakSpeedKts = Math.max(previousPeakSpeedKts, peakSpeedKts)
    const courseBestPeakAltitudeM = Math.max(previousPeakAltitudeM, peakAltitudeM)
    const courseBestStuntRolls = Math.max(previousStuntRolls, this.stuntRollCount)
    const newComboRecord = this.bestCombo > previousCombo
    const courseBestCombo = Math.max(previousCombo, this.bestCombo)
    const newApproachRecord = approachScore > previousApproachScore
    const courseBestApproachScore = Math.max(previousApproachScore, approachScore)
    const newLandingQualityRecord = landingQuality > previousLandingQuality
    const courseBestLandingQuality = Math.max(previousLandingQuality, landingQuality)
    const newDestinationRecord = this.destinationCount > previousDestinationCount
    const courseBestDestinationCount = Math.max(previousDestinationCount, this.destinationCount)
    const newBiomeRecord = this.surveyedBiomeCount > previousBiomeCount
    const courseBestBiomeCount = Math.max(previousBiomeCount, this.surveyedBiomeCount)
    const runStreak = Math.min(MAX_RUN_STREAK, previousRunStreak + 1)
    const courseBestRunStreak = Math.max(previousRunStreakRecord, runStreak)
    const newRunStreakRecord = runStreak >= 2 && runStreak > previousRunStreakRecord
    const contractWins = Math.min(MAX_CONTRACT_WINS, previousContractWins + (contractComplete ? 1 : 0))
    const courseBestContractWins = contractWins
    const newContractRecord = contractComplete && contractWins > previousContractWins
    const contractStreak = contractComplete
      ? Math.min(MAX_CONTRACT_STREAK, previousContractStreak + 1)
      : 0
    const courseBestContractStreak = Math.max(previousContractStreakRecord, contractStreak)
    const newContractStreakRecord = contractComplete && contractStreak >= 2 && contractStreak > previousContractStreakRecord
    const courseBestFlightDistanceM = Math.max(previousFlightDistanceM, flightDistanceM)
    const courseBestPositiveG = Math.max(previousPeakPositiveG, peakPositiveG > 1 ? peakPositiveG : 0)
    const courseBestNegativeG = peakNegativeG < 0
      ? Math.min(previousPeakNegativeG < 0 ? previousPeakNegativeG : 0, peakNegativeG)
      : previousPeakNegativeG
    const newFlightDistanceRecord = courseBestFlightDistanceM > previousFlightDistanceM
    const newPositiveGRecord = courseBestPositiveG > previousPeakPositiveG
    const newNegativeGRecord = courseBestNegativeG < previousPeakNegativeG
    if (courseBestPeakSpeedKts > 0) history.peakSpeedKts = courseBestPeakSpeedKts
    if (courseBestPeakAltitudeM > 0) history.peakAltitudeM = courseBestPeakAltitudeM
    if (courseBestStuntRolls > 0) history.stuntRolls = courseBestStuntRolls
    if (courseBestCombo > 0) history.combo = courseBestCombo
    if (courseBestApproachScore > 0) history.approachScore = courseBestApproachScore
    if (courseBestLandingQuality > 0) history.landingQuality = courseBestLandingQuality
    if (courseBestDestinationCount > 0) history.destinations = courseBestDestinationCount
    if (courseBestBiomeCount > 0) history.biomes = courseBestBiomeCount
    history.runStreak = runStreak
    history.runStreakRecord = courseBestRunStreak
    if (contractWins > 0) history.contractWins = contractWins
    history.contractStreak = contractStreak
    history.contractStreakRecord = courseBestContractStreak
    if (courseBestFlightDistanceM > 0) history.flightDistanceM = courseBestFlightDistanceM
    if (courseBestPositiveG > 1) history.peakPositiveG = courseBestPositiveG
    if (courseBestNegativeG < 0) history.peakNegativeG = courseBestNegativeG
    this.contractStreakValue = contractStreak
    history.completionCount = Math.min(MAX_COMPLETION_COUNT, history.completionCount + 1)
    history.bestTimeSec = Math.min(history.bestTimeSec, elapsedSec)
    this.writeHistory(history)
    const earnedBadges = masteryBadgesForRun(
      history.completionCount,
      clamp01(gateQuality),
      landingQuality,
      medalFor(totalScore),
      this.bestGateQualityStreak,
      approachScore,
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
    const courseMasteryTier = courseMasteryTierForProgress({
      completionCount: history.completionCount,
      bestScore,
      badgeCount: allBadges.length,
      contractWins: history.contractWins,
    })

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
      flightDistanceM,
      peakPositiveG,
      peakNegativeG,
      courseBestFlightDistanceM: courseBestFlightDistanceM > 0 ? courseBestFlightDistanceM : undefined,
      courseBestPositiveG: courseBestPositiveG > 1 ? courseBestPositiveG : undefined,
      courseBestNegativeG: courseBestNegativeG < 0 ? courseBestNegativeG : undefined,
      newFlightDistanceRecord,
      newPositiveGRecord,
      newNegativeGRecord,
      courseBestPeakSpeedKts,
      courseBestPeakAltitudeM,
      newPeakSpeedRecord,
      newPeakAltitudeRecord,
      stuntRolls: this.stuntRollCount,
      stuntScore,
      courseBestStuntRolls,
      newStuntRecord,
      freeFlight: this.freeFlight,
      altitudeMilestoneM: this.altitudeMilestone,
      bestCombo: this.bestCombo > 0 ? this.bestCombo : undefined,
      comboScore: comboScore > 0 ? comboScore : undefined,
      fuelScore: fuelScore > 0 ? fuelScore : undefined,
      approachScore: approachScore > 0 ? approachScore : undefined,
      weatherScore: weatherScore > 0 ? weatherScore : undefined,
      nightScore: nightScore > 0 ? nightScore : undefined,
      destinationScore: this.destinationScore > 0 ? this.destinationScore : undefined,
      destinationCount: this.destinationCount > 0 ? this.destinationCount : undefined,
      courseBestDestinationCount: courseBestDestinationCount > 0 ? courseBestDestinationCount : undefined,
      newDestinationRecord,
      biomeCount: this.surveyedBiomeCount > 0 ? this.surveyedBiomeCount : undefined,
      biomeScore: biomeScore > 0 ? biomeScore : undefined,
      courseBestBiomeCount: courseBestBiomeCount > 0 ? courseBestBiomeCount : undefined,
      newBiomeRecord,
      runStreak,
      courseBestRunStreak,
      newRunStreakRecord,
      contractKind: this.contract.kind ?? undefined,
      contractLabel: this.contract.enabled ? this.contract.label : undefined,
      contractDetail: this.contract.enabled ? this.contract.detail : undefined,
      contractComplete: this.contract.enabled ? this.contract.complete : undefined,
      contractFailed: this.contract.enabled ? this.contract.failed : undefined,
      contractProgress: this.contract.enabled ? this.contract.progress : undefined,
      contractScore: contractScore > 0 ? contractScore : undefined,
      contractStreakBonus: contractStreakBonus > 0 ? contractStreakBonus : undefined,
      deadstickScore: deadstickScore > 0 ? deadstickScore : undefined,
      contractWins: contractWins > 0 ? contractWins : undefined,
      courseBestContractWins: courseBestContractWins > 0 ? courseBestContractWins : undefined,
      newContractRecord,
      contractStreak: contractStreak > 0 ? contractStreak : undefined,
      courseBestContractStreak: courseBestContractStreak > 0 ? courseBestContractStreak : undefined,
      newContractStreakRecord,
      courseMasteryTier,
      courseMasteryTierLabel: courseMasteryTierLabel(courseMasteryTier),
      courseBestApproachScore: courseBestApproachScore > 0 ? courseBestApproachScore : undefined,
      newApproachRecord,
      courseBestLandingQuality: courseBestLandingQuality > 0 ? courseBestLandingQuality : undefined,
      newLandingQualityRecord,
      courseBestCombo: courseBestCombo > 0 ? courseBestCombo : undefined,
      newComboRecord,
    }
    return this.result
  }

  fail(): void {
    if (this.phase === 'complete' || this.phase === 'failed') return
    this.phase = 'failed'
    const history = this.readHistory()
    if ((history.runStreak ?? 0) > 0 || (history.contractStreak ?? 0) > 0) {
      history.runStreak = 0
      history.contractStreak = 0
      this.contractStreakValue = 0
      this.writeHistory(history)
    }
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
    if (this.phase === 'ready') return this.freeFlight ? 'FREE FLIGHT / TAKE OFF' : 'TAKE OFF'
    if (this.phase === 'returning') return this.freeFlight ? 'FREE FLIGHT / RETURN & LAND' : 'RETURN & LAND'
    if (this.phase === 'complete') return this.freeFlight ? 'FREE FLIGHT COMPLETE' : 'RUN COMPLETE'
    if (this.phase === 'failed') return 'RUN FAILED'
    return `GATE ${Math.min(this.gatesPassed + 1, this.totalGates)}/${this.totalGates}`
  }

  /** Static contract cue kept separate from the phase objective for HUD caching. */
  get contractLabel(): string {
    return this.contract.hudLabel
  }

  /** Cached contract instruction for the live HUD task detail line. */
  get contractDetail(): string {
    return this.contract.detail
  }

  /** Cached contract progress for the live HUD task row. */
  get contractProgress(): number {
    return this.contract.progress
  }

  /** Whether the current bonus contract has reached its target. */
  get contractComplete(): boolean {
    return this.contract.complete
  }

  get contractFailed(): boolean {
    return this.contract.failed
  }

  /** Cached completed-contract chain entering the current seeded sortie. */
  get contractStreak(): number {
    return this.contract.enabled ? this.contractStreakValue : 0
  }

  get contractBriefing(): string {
    return this.contract.enabled ? `${this.contract.label} / ${this.contract.detail}` : ''
  }

  /** Consume one event-driven contract-completion cue for the live HUD. */
  consumeContractCompletionCue(): string | null {
    if (!this.contractCuePending) return null
    this.contractCuePending = false
    return this.contract.label || null
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
      if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_STORED_GATE_SPLITS) return []
      const splits: number[] = []
      let previous = -Infinity
      for (const value of parsed) {
        const split = Number(value)
        if (!Number.isFinite(split) || split < 0 || split < previous) return []
        splits.push(split)
        previous = split
      }
      return splits
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

function safeCount(value: number | undefined, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value!))) : 0
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
