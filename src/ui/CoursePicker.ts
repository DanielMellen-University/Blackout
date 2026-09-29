import {
  MAX_BEST_SCORE,
  courseMasteryTierLabel,
  formatTime,
  landingQualityLabel,
  medalForScore,
  nextMedalTargetForScore,
  type CourseHistory,
} from '../systems/ChallengeRun'
import type { CourseDefinition } from '../systems/CourseLibrary'
import type { CourseMasteryTier } from '../systems/ChallengeRun'
import type { MissionRouteProfile } from '../systems/Mission'
import { normalizeSortieStyle, sortieStyleLabel } from '../systems/FlightStyle'
import { WEATHER_LABELS, weatherIdForSeed, type WeatherId, type WindSide } from '../world/WeatherDirector'

export interface CoursePickerItem {
  id: string
  label: string
  detail: string
  meta: string
  stats: string
  category?: Exclude<CoursePickerCategory, 'all'>
  recent?: boolean
  /** Zero-based newest-first position in the bounded Recent list. */
  recentRank?: number
  favorite?: boolean
  /** Zero-based newest-first position in the bounded Favorites list. */
  favoriteRank?: number
  /** Persisted best score used only by the optional catalog sort. */
  score?: number
  /** Persisted best completion time used only by the optional time sort. */
  time?: number
  /** Persisted completion count used only by the optional runs sort. */
  runs?: number
  /** Persisted best flight distance used only by the optional distance sort. */
  distance?: number
  /** Persisted peak speed used only by the optional speed sort. */
  speed?: number
  /** Persisted best fuel reserve used only by the optional fuel sort. */
  fuel?: number
  /** Persisted best landing quality used only by the optional landing sort. */
  landing?: number
  /** Persisted peak altitude used only by the optional altitude sort. */
  altitude?: number
  /** Persisted best clean-flight combo used only by the optional combo sort. */
  combo?: number
  /** Persisted best runway approach score used only by the optional approach sort. */
  approach?: number
  /** Persisted best stunt-roll count used only by the optional stunts sort. */
  stunts?: number
  /** Persisted distinct discovery total used only by the optional discoveries sort. */
  discoveries?: number
  /** Persisted contract-win count used only by the optional contract sort. */
  contractWins?: number
  /** Persisted best clean-run streak used only by the optional streak sort. */
  streak?: number
  /** Persisted best contract streak used only by the optional contract streak sort. */
  contractStreak?: number
  /** Persisted distinct biome count used only by the optional biome sort. */
  biomes?: number
  /** Stable authored route difficulty used only by the optional difficulty sort. */
  difficulty?: CoursePickerDifficulty
  /** Persisted per-course mastery tier used only by the optional mastery sort. */
  mastery?: CourseMasteryTier
}

export type CoursePickerCategory = 'all' | 'ops' | 'routes' | 'contracts' | 'explore' | 'recent' | 'favorites' | 'unplayed' | 'mastered'
export type CoursePickerDifficulty = 'relaxed' | 'standard' | 'technical'
export type CoursePickerSort = 'catalog' | 'score' | 'time' | 'runs' | 'distance' | 'speed' | 'fuel' | 'landing' | 'altitude' | 'combo' | 'approach' | 'stunts' | 'discoveries' | 'contracts' | 'streak' | 'contractStreak' | 'biomes' | 'difficulty' | 'mastery' | 'name'
export const COURSE_PICKER_CATEGORY_STORAGE_KEY = 'blackout.coursePickerCategory'
export const COURSE_PICKER_SORT_STORAGE_KEY = 'blackout.coursePickerSort'
const COURSE_PICKER_FILTER_MAX_LENGTH = 80
const COURSE_PICKER_CATEGORY_LABELS: Readonly<Record<CoursePickerCategory, string>> = {
  all: 'All courses',
  ops: 'Ops',
  routes: 'Routes',
  contracts: 'Contracts',
  explore: 'Explore',
  recent: 'Recent',
  favorites: 'Favorites',
  unplayed: 'Unplayed',
  mastered: 'Mastered',
}
const COURSE_PICKER_SORT_LABELS: Readonly<Record<CoursePickerSort, string>> = {
  catalog: 'Catalog order',
  score: 'Best score',
  time: 'Best time',
  runs: 'Most runs',
  distance: 'Longest flight',
  speed: 'Top speed',
  fuel: 'Fuel reserve',
  landing: 'Best landing',
  altitude: 'Highest altitude',
  combo: 'Best combo',
  approach: 'Best approach',
  stunts: 'Most stunts',
  discoveries: 'Most discoveries',
  contracts: 'Most contract wins',
  streak: 'Best run streak',
  contractStreak: 'Best contract streak',
  biomes: 'Most biomes',
  difficulty: 'Difficulty',
  mastery: 'Mastery',
  name: 'A–Z',
}

/** Keep the growing catalog understandable without making authored course data carry UI-only labels. */
export function coursePickerCategoryForCourse(
  course: Pick<CourseDefinition, 'id' | 'seed' | 'profile' | 'contractCatalog' | 'daily' | 'weekly' | 'monthly'>,
): Exclude<CoursePickerCategory, 'all'> {
  if (course.daily || course.weekly || course.monthly || course.id === 'daily-ops' || course.id === 'weekly-ops' || course.id === 'monthly-ops') return 'ops'
  if (course.id === 'random' || course.id === 'free-flight' || (course.seed === null && course.profile === 'free')) {
    return 'explore'
  }
  if (course.contractCatalog) return 'contracts'
  return 'routes'
}

/** Keep difficulty sorting deterministic without rebuilding a route just to browse the catalog. */
export function coursePickerDifficultyForCourse(
  course: Pick<CourseDefinition, 'profile'>,
): CoursePickerDifficulty {
  const profile = course.profile as MissionRouteProfile | null
  if (profile === 'free' || profile === 'orbit' || profile === 'approach') return 'relaxed'
  if (
    profile === 'slalom' || profile === 'ridge' || profile === 'canyon' || profile === 'fjord' ||
    profile === 'volcanic' || profile === 'alpine' || profile === 'storm' || profile === 'night' ||
    profile === 'glacier' || profile === 'badlands' || profile === 'thermal'
  ) return 'technical'
  return 'standard'
}

/** Keep the authored difficulty readable in compact card metadata. */
export function coursePickerDifficultyLabel(value: CoursePickerDifficulty): string {
  switch (value) {
    case 'relaxed': return 'RELAXED'
    case 'technical': return 'TECHNICAL'
    default: return 'STANDARD'
  }
}

/** Keep persisted course mastery readable in compact card metadata. */
export function coursePickerMasteryLabel(value: CourseMasteryTier): string {
  return courseMasteryTierLabel(value)
}

/** Keep the most useful persisted flight telemetry compact on picker cards. */
export function coursePickerFlightLogLabel(history: CourseHistory | null): string {
  if (!history) return ''
  const parts: string[] = []
  if (Number.isFinite(history.flightDistanceM) && history.flightDistanceM! > 0) {
    parts.push(`DIST ${formatCourseDistance(history.flightDistanceM!)}`)
  }
  if (Number.isFinite(history.peakSpeedKts) && history.peakSpeedKts! > 0) {
    parts.push(`TOP ${Math.min(20_000, Math.floor(history.peakSpeedKts!)).toLocaleString()}KT`)
  }
  if (Number.isFinite(history.peakAltitudeM) && history.peakAltitudeM! > 0) {
    parts.push(`ALT ${Math.min(100_000, Math.floor(history.peakAltitudeM!)).toLocaleString()}M`)
  }
  if (Number.isFinite(history.fuelRemainingPercent) && history.fuelRemainingPercent! > 0) {
    parts.push(`FUEL ${Math.min(100, Math.floor(history.fuelRemainingPercent!))}%`)
  }
  return parts.length > 0 ? `LOG ${parts.join(' · ')}` : ''
}

/** Keep filter counts compact and finite as the authored catalog grows. */
export function coursePickerCategoryLabel(category: CoursePickerCategory, count: number): string {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return `${COURSE_PICKER_CATEGORY_LABELS[category]} (${safeCount})`
}

/** Keep the bounded sort control readable and stable if a caller supplies bad input. */
export function coursePickerSortLabel(sort: CoursePickerSort): string {
  return COURSE_PICKER_SORT_LABELS[sort] ?? COURSE_PICKER_SORT_LABELS.catalog
}

/** Repair persisted catalog browsing state without allowing unknown values into the UI. */
export function normalizeCoursePickerCategory(value: unknown): CoursePickerCategory {
  return value === 'ops' || value === 'routes' || value === 'contracts' || value === 'explore' ||
    value === 'recent' || value === 'favorites' || value === 'unplayed' || value === 'mastered'
    ? value
    : 'all'
}

export function normalizeCoursePickerSort(value: unknown): CoursePickerSort {
  return value === 'score' || value === 'time' || value === 'runs' || value === 'distance' || value === 'speed' || value === 'fuel' || value === 'landing' || value === 'altitude' || value === 'combo' || value === 'approach' || value === 'stunts' || value === 'discoveries' || value === 'contracts' || value === 'streak' || value === 'contractStreak' || value === 'biomes' || value === 'difficulty' || value === 'mastery' || value === 'name' ? value : 'catalog'
}

/** Keep the live title/pause search bounded without persisting a stale query. */
export function normalizeCoursePickerFilter(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, COURSE_PICKER_FILTER_MAX_LENGTH) : ''
}

export function readCoursePickerCategory(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): CoursePickerCategory {
  try {
    return normalizeCoursePickerCategory(storage?.getItem(COURSE_PICKER_CATEGORY_STORAGE_KEY))
  } catch {
    return 'all'
  }
}

export function writeCoursePickerCategory(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  category: CoursePickerCategory,
): void {
  try {
    storage?.setItem(COURSE_PICKER_CATEGORY_STORAGE_KEY, normalizeCoursePickerCategory(category))
  } catch {
    /* Storage is optional. */
  }
}

export function readCoursePickerSort(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): CoursePickerSort {
  try {
    return normalizeCoursePickerSort(storage?.getItem(COURSE_PICKER_SORT_STORAGE_KEY))
  } catch {
    return 'catalog'
  }
}

export function writeCoursePickerSort(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  sort: CoursePickerSort,
): void {
  try {
    storage?.setItem(COURSE_PICKER_SORT_STORAGE_KEY, normalizeCoursePickerSort(sort))
  } catch {
    /* Storage is optional. */
  }
}

/** Sort only the already-filtered catalog so search and category semantics stay unchanged. */
export function sortCoursePickerItems(
  items: readonly CoursePickerItem[],
  sort: CoursePickerSort = 'catalog',
): CoursePickerItem[] {
  const safeSort = sort === 'score' || sort === 'time' || sort === 'runs' || sort === 'distance' || sort === 'speed' || sort === 'fuel' || sort === 'landing' || sort === 'altitude' || sort === 'combo' || sort === 'approach' || sort === 'stunts' || sort === 'discoveries' || sort === 'contracts' || sort === 'streak' || sort === 'contractStreak' || sort === 'biomes' || sort === 'difficulty' || sort === 'mastery' || sort === 'name' ? sort : 'catalog'
  if (safeSort === 'catalog') return items.slice()
  return items.slice().sort((a, b) => {
    if (safeSort === 'score') {
      const aScore = finiteScore(a.score)
      const bScore = finiteScore(b.score)
      if (aScore !== bScore) return bScore - aScore
    } else if (safeSort === 'time') {
      const aTime = finiteTime(a.time)
      const bTime = finiteTime(b.time)
      if (aTime !== bTime) return aTime - bTime
    } else if (safeSort === 'runs') {
      const aRuns = finiteCount(a.runs)
      const bRuns = finiteCount(b.runs)
      if (aRuns !== bRuns) return bRuns - aRuns
    } else if (safeSort === 'distance') {
      const aDistance = finiteDistance(a.distance)
      const bDistance = finiteDistance(b.distance)
      if (aDistance !== bDistance) return bDistance - aDistance
    } else if (safeSort === 'speed') {
      const aSpeed = finiteSpeed(a.speed)
      const bSpeed = finiteSpeed(b.speed)
      if (aSpeed !== bSpeed) return bSpeed - aSpeed
    } else if (safeSort === 'fuel') {
      const aFuel = finiteFuel(a.fuel)
      const bFuel = finiteFuel(b.fuel)
      if (aFuel !== bFuel) return bFuel - aFuel
    } else if (safeSort === 'landing') {
      const aLanding = finiteLanding(a.landing)
      const bLanding = finiteLanding(b.landing)
      if (aLanding !== bLanding) return bLanding - aLanding
    } else if (safeSort === 'altitude') {
      const aAltitude = finiteAltitude(a.altitude)
      const bAltitude = finiteAltitude(b.altitude)
      if (aAltitude !== bAltitude) return bAltitude - aAltitude
    } else if (safeSort === 'combo') {
      const aCombo = finiteCombo(a.combo)
      const bCombo = finiteCombo(b.combo)
      if (aCombo !== bCombo) return bCombo - aCombo
    } else if (safeSort === 'approach') {
      const aApproach = finiteApproach(a.approach)
      const bApproach = finiteApproach(b.approach)
      if (aApproach !== bApproach) return bApproach - aApproach
    } else if (safeSort === 'stunts') {
      const aStunts = finiteStunts(a.stunts)
      const bStunts = finiteStunts(b.stunts)
      if (aStunts !== bStunts) return bStunts - aStunts
    } else if (safeSort === 'discoveries') {
      const aDiscoveries = finiteDiscoveries(a.discoveries)
      const bDiscoveries = finiteDiscoveries(b.discoveries)
      if (aDiscoveries !== bDiscoveries) return bDiscoveries - aDiscoveries
    } else if (safeSort === 'contracts') {
      const aContracts = finiteContractWins(a.contractWins)
      const bContracts = finiteContractWins(b.contractWins)
      if (aContracts !== bContracts) return bContracts - aContracts
    } else if (safeSort === 'streak') {
      const aStreak = finiteStreak(a.streak)
      const bStreak = finiteStreak(b.streak)
      if (aStreak !== bStreak) return bStreak - aStreak
    } else if (safeSort === 'contractStreak') {
      const aContractStreak = finiteStreak(a.contractStreak)
      const bContractStreak = finiteStreak(b.contractStreak)
      if (aContractStreak !== bContractStreak) return bContractStreak - aContractStreak
    } else if (safeSort === 'biomes') {
      const aBiomes = finiteBiomes(a.biomes)
      const bBiomes = finiteBiomes(b.biomes)
      if (aBiomes !== bBiomes) return bBiomes - aBiomes
    } else if (safeSort === 'difficulty') {
      const aDifficulty = difficultyRank(a.difficulty)
      const bDifficulty = difficultyRank(b.difficulty)
      if (aDifficulty !== bDifficulty) return aDifficulty - bDifficulty
    } else if (safeSort === 'mastery') {
      const aMastery = masteryRank(a.mastery)
      const bMastery = masteryRank(b.mastery)
      if (aMastery !== bMastery) return bMastery - aMastery
    } else {
      const labelOrder = a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      if (labelOrder !== 0) return labelOrder
    }
    return 0
  })
}

/** Filter the bounded course catalog without changing its authored order. */
export function filterCoursePickerItems(
  items: readonly CoursePickerItem[],
  query: string,
  category: CoursePickerCategory = 'all',
): CoursePickerItem[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const categorized = category === 'all'
    ? items
    : category === 'recent'
      ? items.filter(item => item.recent === true).sort(coursePickerRankCompare('recentRank'))
      : category === 'favorites'
        ? items.filter(item => item.favorite === true).sort(coursePickerRankCompare('favoriteRank'))
      : category === 'unplayed'
        ? items.filter(item => finiteCount(item.runs) === 0)
      : category === 'mastered'
        ? items.filter(item => item.mastery === 'legend')
      : items.filter(item => item.category === category)
  if (terms.length === 0) return categorized.slice()
  return categorized.filter(item => {
    const haystack = `${item.label} ${item.detail} ${item.meta} ${item.stats}`.toLocaleLowerCase()
    return terms.every(term => haystack.includes(term))
  })
}

/** Resolve a two-column course-grid key without escaping the filtered list. */
export function coursePickerNavigationIndex(
  key: string,
  index: number,
  visibleCount: number,
  columns = 2,
): number | null {
  const count = Number.isFinite(visibleCount) ? Math.max(0, Math.floor(visibleCount)) : 0
  if (count === 0) return null
  const current = Number.isFinite(index)
    ? Math.min(count - 1, Math.max(0, Math.floor(index)))
    : 0
  const step = Number.isFinite(columns) ? Math.max(1, Math.floor(columns)) : 2
  switch (key) {
    case 'ArrowRight': return Math.min(count - 1, current + 1)
    case 'ArrowLeft': return Math.max(0, current - 1)
    case 'ArrowDown': return Math.min(count - 1, current + step)
    case 'ArrowUp': return Math.max(0, current - step)
    case 'Home': return 0
    case 'End': return count - 1
    default: return null
  }
}

/** Keep empty filtered states explicit so a quiet list is never mistaken for a loading failure. */
export function coursePickerEmptyMessage(category: CoursePickerCategory, query: string): string {
  if (query.trim()) return 'NO MATCHING COURSES'
  if (category === 'favorites') return 'NO FAVORITES YET · SELECT A COURSE AND PRESS F'
  if (category === 'recent') return 'NO RECENT COURSES YET'
  if (category === 'unplayed') return 'NO UNPLAYED COURSES · YOU HAVE FLOWN THE CATALOG'
  if (category === 'mastered') return 'NO MASTERED COURSES · REACH LEGEND TIER'
  return 'NO COURSES AVAILABLE'
}

/** Keep pinned cards recognizable even when the Favorites filter is not active. */
export function coursePickerMetaLabel(meta: string, favorite: boolean): string {
  const safeMeta = meta.trim()
  return favorite ? `★ ${safeMeta || 'FAVORITE'}` : safeMeta
}

export interface CoursePickerCopyInput {
  course: Pick<CourseDefinition, 'seed' | 'profile' | 'detail' | 'weather' | 'weatherShift' | 'timeOfDay' | 'windSide'>
  history: CourseHistory | null
  bestScore: number
  badgeCount: number
  bestPrecisionStreak: number
  /** Optional deterministic bonus-task preview for seeded courses. */
  contractLabel?: string
  contractDetail?: string
}

/** Format the bounded title-screen count of fully mastered curated courses. */
export function courseMasteryProgressLabel(mastered: number, total: number): string {
  const safeTotal = finiteCount(total)
  const safeMastered = Math.min(safeTotal, finiteCount(mastered))
  return `LEGEND ${safeMastered}/${safeTotal}`
}

/** Compact card meta plus a selected-world stats line, never a stuffed option label. */
export function coursePickerCopy(input: CoursePickerCopyInput): {
  detail: string
  meta: string
  stats: string
} {
  const baseDetail = input.course.detail.trim() || 'Choose a world'
  const conditions = [
    input.course.weather
      ? `WEATHER ${courseWeatherPreviewLabel(input.course.seed ?? undefined, input.course.weather)}`
      : '',
    input.course.weatherShift
      ? `SHIFT ${WEATHER_LABELS[input.course.weatherShift] ?? ''}`
      : '',
    courseTimePreviewLabel(input.course.timeOfDay)
      ? `TIME ${courseTimePreviewLabel(input.course.timeOfDay)}`
      : '',
    courseWindPreviewLabel(input.course.windSide),
    input.contractLabel?.trim()
      ? `TASK ${input.contractLabel.trim()}`
      : '',
    input.contractDetail?.trim() ?? '',
  ].filter(Boolean)
  const detail = [baseDetail, ...conditions].join(' / ')
  const runs = finiteCount(input.history?.completionCount)

  let meta = 'NEW'
  if (runs > 0) {
    meta = `${runs} RUN${runs === 1 ? '' : 'S'}`
  } else if (input.course.profile === 'free') {
    meta = 'EXPLORE'
  } else if (input.course.seed === null) {
    meta = 'INFINITE'
  }

  const statsParts: string[] = []
  if (runs > 0) {
    const bestTime = input.history?.bestTimeSec
    statsParts.push(Number.isFinite(bestTime) ? formatTime(bestTime!) : 'NO TIME')
  }
  const bestScore = Number.isFinite(input.bestScore)
    ? Math.min(MAX_BEST_SCORE, Math.max(0, Math.floor(input.bestScore)))
    : 0
  if (bestScore > 0) {
    statsParts.push(`SCORE ${bestScore.toLocaleString()}`)
    const target = nextMedalTargetForScore(bestScore)
    if (target) statsParts.push(`NEXT ${target.medal.toUpperCase()} ${target.score.toLocaleString()}`)
  }
  const landingQuality = input.history?.landingQuality
  if (Number.isFinite(landingQuality) && landingQuality! > 0) {
    const safeLanding = Math.max(0, Math.min(1, landingQuality!))
    statsParts.push(`LAND ${landingQualityLabel(safeLanding)}`)
  }
  const medal = medalForScore(input.bestScore)
  if (medal !== 'complete') statsParts.push(`MEDAL ${medal.toUpperCase()}`)
  const badges = finiteCount(input.badgeCount)
  if (badges > 0) statsParts.push(`BADGES X${badges}`)
  const precisionStreak = finiteCount(input.bestPrecisionStreak)
  if (precisionStreak > 1) statsParts.push(`GATE STREAK X${precisionStreak}`)
  const contractWins = finiteCount(input.history?.contractWins)
  if (contractWins > 0) statsParts.push(`CONTRACT WINS X${Math.min(1_000, contractWins)}`)
  const contractStreakRecord = Number.isFinite(input.history?.contractStreakRecord)
    ? Math.max(0, Math.floor(input.history?.contractStreakRecord ?? 0))
    : finiteCount(input.history?.contractStreak)
  if (contractStreakRecord > 1) statsParts.push(`CONTRACT STREAK X${Math.min(1_000, contractStreakRecord)}`)
  const sortieStyle = normalizeSortieStyle(input.history?.sortieStyle)
  if (sortieStyle) statsParts.push(`STYLE ${sortieStyleLabel(sortieStyle)}`)

  return { detail, meta, stats: statsParts.join(' · ') }
}

/** Keep persistent telemetry readable on the selected course line without exposing storage details. */
export function courseFlightLogLabel(history: CourseHistory | null): string {
  if (!history) return ''
  const parts: string[] = []
  if (Number.isFinite(history.flightDistanceM) && history.flightDistanceM! > 0) {
    parts.push(formatCourseDistance(history.flightDistanceM!))
  }
  if (Number.isFinite(history.peakSpeedKts) && history.peakSpeedKts! > 0) {
    parts.push(`TOP ${Math.min(20_000, Math.floor(history.peakSpeedKts!)).toLocaleString()}KT`)
  }
  if (Number.isFinite(history.peakAltitudeM) && history.peakAltitudeM! > 0) {
    parts.push(`ALT ${Math.min(100_000, Math.floor(history.peakAltitudeM!)).toLocaleString()}M`)
  }
  if (Number.isFinite(history.peakPositiveG) && history.peakPositiveG! > 1) {
    parts.push(`G+${history.peakPositiveG!.toFixed(1)}`)
  }
  if (Number.isFinite(history.peakNegativeG) && history.peakNegativeG! < 0) {
    parts.push(`G${history.peakNegativeG!.toFixed(1)}`)
  }
  if (Number.isFinite(history.landingQuality) && history.landingQuality! > 0) {
    const landingQuality = Math.max(0, Math.min(1, history.landingQuality!))
    parts.push(`LAND ${landingQualityLabel(landingQuality)} ${Math.round(landingQuality * 100)}%`)
  }
  if (Number.isFinite(history.fuelRemainingPercent) && history.fuelRemainingPercent! > 0) {
    parts.push(`FUEL ${Math.min(100, Math.floor(history.fuelRemainingPercent!))}%`)
  }
  if (Number.isFinite(history.approachScore) && history.approachScore! > 0) {
    parts.push(`APP +${Math.min(500, Math.floor(history.approachScore!))}`)
  }
  if (Number.isFinite(history.destinations) && history.destinations! > 0) {
    parts.push(`DEST X${Math.min(6, Math.floor(history.destinations!))}`)
  }
  if (Number.isFinite(history.biomes) && history.biomes! > 0) {
    parts.push(`BIOMES X${Math.min(15, Math.floor(history.biomes!))}`)
  }
  if (Number.isFinite(history.waterBodies) && history.waterBodies! > 0) {
    parts.push(`WATERWAYS X${Math.min(3, Math.floor(history.waterBodies!))}`)
  }
  if (Number.isFinite(history.stuntRolls) && history.stuntRolls! > 0) {
    parts.push(`ROLLS X${Math.min(12, Math.floor(history.stuntRolls!))}`)
  }
  if (Number.isFinite(history.combo) && history.combo! > 1) {
    parts.push(`COMBO X${Math.min(20, Math.floor(history.combo!))}`)
  }
  const runStreakRecord = Number.isFinite(history.runStreakRecord)
    ? history.runStreakRecord!
    : history.runStreak
  if (Number.isFinite(runStreakRecord) && runStreakRecord! > 1) {
    parts.push(`RUN STREAK X${Math.min(1_000, Math.floor(runStreakRecord!))}`)
  }
  if (Number.isFinite(history.contractWins) && history.contractWins! > 0) {
    parts.push(`CONTRACT WINS X${Math.min(1_000, Math.floor(history.contractWins!))}`)
  }
  const contractStreakRecord = Number.isFinite(history.contractStreakRecord)
    ? history.contractStreakRecord!
    : history.contractStreak
  if (Number.isFinite(contractStreakRecord) && contractStreakRecord! > 1) {
    parts.push(`CONTRACT STREAK X${Math.min(1_000, Math.floor(contractStreakRecord!))}`)
  }
  const sortieStyle = normalizeSortieStyle(history.sortieStyle)
  if (sortieStyle) parts.push(`STYLE ${sortieStyleLabel(sortieStyle)}`)
  return parts.length > 0 ? `LOG ${parts.join(' ')}` : ''
}

/** Keep the launch card honest about the deterministic weather waiting in the world. */
export function courseWeatherPreviewLabel(
  seed: number | undefined,
  forcedWeather?: WeatherId,
): string {
  const weather = forcedWeather ?? (Number.isFinite(seed) ? weatherIdForSeed(seed!) : null)
  return weather ? WEATHER_LABELS[weather] ?? '' : ''
}

/** Keep authored night conditions explicit without exposing raw clock fractions. */
export function courseTimePreviewLabel(timeOfDay: number | undefined): string {
  if (!Number.isFinite(timeOfDay)) return ''
  const normalized = ((timeOfDay! % 1) + 1) % 1
  return normalized < 0.22 || normalized > 0.78 ? 'NIGHT' : ''
}

/** Keep authored runway wind pressure explicit before the sortie starts. */
export function courseWindPreviewLabel(windSide: WindSide | undefined): string {
  if (windSide !== 'left' && windSide !== 'right') return ''
  const crab = windSide === 'left' ? 'R' : 'L'
  return `CROSSWIND ${windSide === 'left' ? 'L' : 'R'} / CRAB ${crab}`
}

/** Keep authored conditions readable after the launch card is gone. */
export function courseConditionSummary(
  course: Pick<CourseDefinition, 'weather' | 'weatherShift' | 'timeOfDay' | 'windSide'>,
  periodLabel?: string,
): string {
  const conditions = [
    coursePeriodLabel(periodLabel),
    course.weather
      ? `WEATHER ${WEATHER_LABELS[course.weather] ?? ''}`
      : '',
    course.weatherShift
      ? `SHIFT ${WEATHER_LABELS[course.weatherShift] ?? ''}`
      : '',
    courseTimePreviewLabel(course.timeOfDay)
      ? `TIME ${courseTimePreviewLabel(course.timeOfDay)}`
      : '',
    courseWindPreviewLabel(course.windSide),
  ].filter(Boolean)
  return conditions.join(' / ')
}

function coursePeriodLabel(value: string | undefined): string {
  if (!value) return ''
  const day = /^(?:DAY )?(\d{4}-\d{2}-\d{2})$/.exec(value)
  if (day) {
    const timestamp = Date.parse(`${day[1]}T12:00:00.000Z`)
    if (Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day[1]) {
      return `DAY ${day[1]}`
    }
    return ''
  }
  const week = /^(?:WEEK )?(\d{4}-W\d{2})$/.exec(value)
  if (!week) {
    const month = /^(?:MONTH )?(\d{4}-\d{2})$/.exec(value)
    if (!month) return ''
    const match = /^(\d{4})-(\d{2})$/.exec(month[1]!)
    if (!match) return ''
    const year = Number(match[1])
    const monthNumber = Number(match[2])
    if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return ''
    const timestamp = Date.UTC(year, monthNumber - 1, 15, 12)
    return new Date(timestamp).toISOString().slice(0, 7) === month[1]
      ? `MONTH ${month[1]}`
      : ''
  }
  const match = /^(\d{4})-W(\d{2})$/.exec(week[1]!)
  if (!match) return ''
  const year = Number(match[1])
  const weekNumber = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) return ''
  const janFourth = Date.UTC(year, 0, 4)
  const janFourthDay = new Date(janFourth).getUTCDay() || 7
  const monday = janFourth - (janFourthDay - 1) * 86_400_000 + (weekNumber - 1) * 604_800_000
  const timestamp = monday + 12 * 60 * 60 * 1000
  const date = new Date(timestamp)
  const isoDay = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - isoDay)
  const isoYear = date.getUTCFullYear()
  const isoWeek = Math.ceil((((date.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000) + 1) / 7)
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}` === week[1]
    ? `WEEK ${week[1]}`
    : ''
}

/**
 * Title and pause world picker: radio cards, short labels, selected-world copy.
 */
export class CoursePicker {
  private readonly list: HTMLElement
  private readonly detail: HTMLElement
  private readonly stats: HTMLElement
  private readonly filter: HTMLInputElement
  private readonly categorySelect: HTMLSelectElement
  private readonly sortSelect: HTMLSelectElement
  private readonly favoriteButton: HTMLButtonElement
  private readonly empty: HTMLElement
  private readonly filterStatus: HTMLElement
  private readonly categoryOptions = new Map<CoursePickerCategory, HTMLOptionElement>()
  private items: CoursePickerItem[] = []
  private selectedId = ''
  private category: CoursePickerCategory = 'all'
  private sort: CoursePickerSort = 'catalog'
  private changeHandler: ((id: string) => void) | null = null
  private favoriteHandler: ((id: string, favorite: boolean) => void) | null = null
  private browseStateHandler: ((category: CoursePickerCategory, sort: CoursePickerSort) => void) | null = null
  private filterStateHandler: ((query: string) => void) | null = null
  private disposed = false

  constructor(root: HTMLElement) {
    this.list = must(root, '.course-picker-list')
    this.detail = must(root, '.course-picker-detail')
    this.stats = must(root, '.course-picker-stats')
    this.filter = document.createElement('input')
    this.filter.type = 'search'
    this.filter.className = 'course-picker-filter'
    this.filter.placeholder = 'Filter courses'
    this.filter.setAttribute('aria-label', 'Filter courses')
    this.filter.autocomplete = 'off'
    this.filter.spellcheck = false
    this.categorySelect = document.createElement('select')
    this.categorySelect.className = 'course-picker-category'
    this.categorySelect.setAttribute('aria-label', 'Filter course category')
    for (const [value, label] of [
      ['all', 'All courses'],
      ['ops', 'Ops'],
      ['routes', 'Routes'],
      ['contracts', 'Contracts'],
      ['explore', 'Explore'],
      ['recent', 'Recent'],
      ['favorites', 'Favorites'],
      ['unplayed', 'Unplayed'],
      ['mastered', 'Mastered'],
    ] as const) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      this.categoryOptions.set(value, option)
      this.categorySelect.append(option)
    }
    this.sortSelect = document.createElement('select')
    this.sortSelect.className = 'course-picker-sort'
    this.sortSelect.setAttribute('aria-label', 'Sort courses')
    for (const value of ['catalog', 'score', 'time', 'runs', 'distance', 'speed', 'fuel', 'landing', 'altitude', 'combo', 'approach', 'stunts', 'discoveries', 'contracts', 'streak', 'contractStreak', 'biomes', 'difficulty', 'mastery', 'name'] as const) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = coursePickerSortLabel(value)
      this.sortSelect.append(option)
    }
    this.favoriteButton = document.createElement('button')
    this.favoriteButton.type = 'button'
    this.favoriteButton.className = 'course-picker-favorite'
    this.favoriteButton.setAttribute('aria-label', 'Favorite selected course')
    this.favoriteButton.setAttribute('aria-keyshortcuts', 'F')
    this.favoriteButton.disabled = true
    this.empty = document.createElement('p')
    this.empty.className = 'course-picker-empty'
    this.empty.hidden = true
    this.empty.setAttribute('aria-live', 'polite')
    this.filterStatus = document.createElement('span')
    this.filterStatus.className = 'course-picker-filter-status'
    this.filterStatus.hidden = true
    this.filterStatus.setAttribute('aria-live', 'polite')
    root.insertBefore(this.categorySelect, this.list)
    root.insertBefore(this.sortSelect, this.list)
    root.insertBefore(this.filter, this.list)
    root.insertBefore(this.filterStatus, this.list)
    root.insertBefore(this.favoriteButton, this.list)
    root.insertBefore(this.empty, this.list)
    this.list.setAttribute('role', 'radiogroup')
    this.list.addEventListener('click', this.onClick)
    this.list.addEventListener('keydown', this.onKeyDown)
    this.filter.addEventListener('input', this.onFilterInput)
    this.filter.addEventListener('keydown', this.onFilterKeyDown)
    this.categorySelect.addEventListener('change', this.onCategoryChange)
    this.sortSelect.addEventListener('change', this.onSortChange)
    this.favoriteButton.addEventListener('click', this.onFavoriteClick)
  }

  get value(): string {
    return this.selectedId
  }

  onChange(handler: ((id: string) => void) | null): void {
    this.changeHandler = handler
  }

  onFavorite(handler: ((id: string, favorite: boolean) => void) | null): void {
    this.favoriteHandler = handler
  }

  onBrowseState(handler: ((category: CoursePickerCategory, sort: CoursePickerSort) => void) | null): void {
    this.browseStateHandler = handler
  }

  onFilter(handler: ((query: string) => void) | null): void {
    this.filterStateHandler = handler
  }

  /** Apply a shared catalog view without emitting a persistence callback. */
  setBrowseState(category: CoursePickerCategory, sort: CoursePickerSort): void {
    if (this.disposed) return
    this.category = normalizeCoursePickerCategory(category)
    this.sort = normalizeCoursePickerSort(sort)
    this.categorySelect.value = this.category
    this.sortSelect.value = this.sort
    this.renderList()
  }

  /** Apply the shared in-session search without echoing the change callback. */
  setFilter(query: string): void {
    if (this.disposed) return
    const next = normalizeCoursePickerFilter(query)
    if (this.filter.value === next) return
    this.filter.value = next
    this.renderList()
  }

  setItems(items: readonly CoursePickerItem[], selectedId: string): void {
    if (this.disposed) return
    this.items = items.slice()
    this.setValue(selectedId)
    this.renderList()
  }

  setValue(id: string): void {
    if (this.disposed) return
    const next = this.items.some((item) => item.id === id)
      ? id
      : (this.items[0]?.id ?? '')
    this.selectedId = next
    this.syncSelection()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.changeHandler = null
    this.favoriteHandler = null
    this.browseStateHandler = null
    this.filterStateHandler = null
    this.list.removeEventListener('click', this.onClick)
    this.list.removeEventListener('keydown', this.onKeyDown)
    this.filter.removeEventListener('input', this.onFilterInput)
    this.filter.removeEventListener('keydown', this.onFilterKeyDown)
    this.categorySelect.removeEventListener('change', this.onCategoryChange)
    this.sortSelect.removeEventListener('change', this.onSortChange)
    this.favoriteButton.removeEventListener('click', this.onFavoriteClick)
    this.categorySelect.remove()
    this.sortSelect.remove()
    this.filter.remove()
    this.filterStatus.remove()
    this.favoriteButton.remove()
    this.empty.remove()
    this.items = []
  }

  private renderList(): void {
    this.syncCategoryOptions()
    const visible = sortCoursePickerItems(
      filterCoursePickerItems(this.items, this.filter.value, this.category),
      this.sort,
    )
    this.list.replaceChildren(...visible.map((item) => this.createOption(item)))
    this.empty.hidden = visible.length > 0
    if (visible.length === 0) this.empty.textContent = coursePickerEmptyMessage(this.category, this.filter.value)
    const query = this.filter.value.trim()
    const categoryLabel = this.category === 'all' ? '' : this.category.toUpperCase()
    this.filterStatus.textContent = query || categoryLabel
      ? [categoryLabel, `${visible.length} MATCH${visible.length === 1 ? '' : 'ES'}`].filter(Boolean).join(' · ')
      : ''
    this.filterStatus.hidden = !query && this.category === 'all'
    this.syncSelection()
  }

  private syncCategoryOptions(): void {
    const counts: Record<CoursePickerCategory, number> = {
      all: this.items.length,
      ops: this.items.filter(item => item.category === 'ops').length,
      routes: this.items.filter(item => item.category === 'routes').length,
      contracts: this.items.filter(item => item.category === 'contracts').length,
      explore: this.items.filter(item => item.category === 'explore').length,
      recent: this.items.filter(item => item.recent === true).length,
      favorites: this.items.filter(item => item.favorite === true).length,
      unplayed: this.items.filter(item => finiteCount(item.runs) === 0).length,
      mastered: this.items.filter(item => item.mastery === 'legend').length,
    }
    for (const [category, option] of this.categoryOptions) {
      option.textContent = coursePickerCategoryLabel(category, counts[category])
    }
  }

  private createOption(item: CoursePickerItem): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'course-option'
    button.dataset.courseId = item.id
    button.setAttribute('role', 'radio')
    const metaLabel = coursePickerMetaLabel(item.meta, item.favorite === true)
    const accessibleLabel = [item.label, metaLabel, item.detail, item.stats].filter(Boolean).join(', ')
    button.setAttribute('aria-label', accessibleLabel)
    const name = document.createElement('span')
    name.className = 'course-option-name'
    name.textContent = item.label
    const meta = document.createElement('span')
    meta.className = 'course-option-meta'
    meta.textContent = metaLabel
    const detail = document.createElement('span')
    detail.className = 'course-option-detail'
    detail.textContent = item.detail
    detail.hidden = item.detail.trim().length === 0
    const stats = document.createElement('span')
    stats.className = 'course-option-stats'
    stats.textContent = item.stats
    stats.hidden = item.stats.trim().length === 0
    button.append(name, meta, detail, stats)
    return button
  }

  private syncSelection(): void {
    const selected = this.items.find((item) => item.id === this.selectedId)
    for (const option of Array.from(this.list.querySelectorAll<HTMLElement>('.course-option'))) {
      const on = option.dataset.courseId === this.selectedId
      option.setAttribute('aria-checked', on ? 'true' : 'false')
      option.tabIndex = on ? 0 : -1
      option.classList.toggle('is-selected', on)
    }
    this.detail.textContent = selected?.detail ?? ''
    this.stats.textContent = selected?.stats ?? ''
    this.stats.hidden = !selected?.stats
    const favorite = selected?.favorite === true
    this.favoriteButton.disabled = !selected
    this.favoriteButton.textContent = favorite ? '★ Favorite' : '☆ Favorite'
    this.favoriteButton.setAttribute('aria-pressed', favorite ? 'true' : 'false')
    this.favoriteButton.setAttribute('aria-label', favorite ? 'Remove selected course from favorites' : 'Favorite selected course')
  }

  private select(id: string, persist: boolean): void {
    if (this.disposed || !id || id === this.selectedId) {
      this.syncSelection()
      return
    }
    this.selectedId = id
    this.syncSelection()
    const option = this.list.querySelector<HTMLElement>(`[data-course-id="${cssEscape(id)}"]`)
    option?.focus({ preventScroll: true })
    if (persist) this.changeHandler?.(id)
  }

  private onClick = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const option = target.closest('.course-option')
    if (!(option instanceof HTMLElement) || !this.list.contains(option)) return
    const id = option.dataset.courseId
    if (id) this.select(id, true)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || this.items.length === 0) return
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      this.toggleFavorite()
      return
    }
    const visible = sortCoursePickerItems(
      filterCoursePickerItems(this.items, this.filter.value, this.category),
      this.sort,
    )
    if (visible.length === 0) return
    const index = Math.max(0, visible.findIndex((item) => item.id === this.selectedId))
    const next = coursePickerNavigationIndex(event.key, index, visible.length)
    if (next === null) return
    event.preventDefault()
    const item = visible[next]
    if (item) this.select(item.id, true)
  }

  private onFilterInput = (): void => {
    if (this.disposed) return
    const normalized = normalizeCoursePickerFilter(this.filter.value)
    if (this.filter.value !== normalized) this.filter.value = normalized
    this.renderList()
    this.filterStateHandler?.(normalized)
  }

  private onCategoryChange = (): void => {
    if (this.disposed) return
    this.category = normalizeCoursePickerCategory(this.categorySelect.value)
    this.renderList()
    this.browseStateHandler?.(this.category, this.sort)
  }

  private onSortChange = (): void => {
    if (this.disposed) return
    this.sort = normalizeCoursePickerSort(this.sortSelect.value)
    this.renderList()
    this.browseStateHandler?.(this.category, this.sort)
  }

  private onFavoriteClick = (): void => {
    this.toggleFavorite()
  }

  private toggleFavorite = (): void => {
    if (this.disposed) return
    const selected = this.items.find(item => item.id === this.selectedId)
    if (!selected) return
    selected.favorite = selected.favorite !== true
    this.favoriteHandler?.(selected.id, selected.favorite)
    this.renderList()
    this.favoriteButton.focus({ preventScroll: true })
  }

  private onFilterKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.filter.value) return
    event.preventDefault()
    this.filter.value = ''
    this.renderList()
  }
}

function finiteCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0
}

function finiteScore(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0
}

function finiteTime(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? value! : Number.POSITIVE_INFINITY
}

function finiteDistance(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(2_000_000, Math.floor(value!))) : 0
}

function finiteSpeed(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(20_000, Math.floor(value!))) : 0
}

function finiteFuel(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.floor(value!))) : 0
}

function finiteLanding(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : 0
}

function finiteAltitude(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100_000, Math.floor(value!))) : 0
}

function finiteCombo(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(20, Math.floor(value!))) : 0
}

function finiteApproach(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(500, Math.floor(value!))) : 0
}

function finiteStunts(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(12, Math.floor(value!))) : 0
}

function finiteDiscoveries(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(24, Math.floor(value!))) : 0
}

function finiteContractWins(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1_000, Math.floor(value!))) : 0
}

function finiteStreak(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1_000, Math.floor(value!))) : 0
}

function finiteBiomes(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(15, Math.floor(value!))) : 0
}

function difficultyRank(value: CoursePickerDifficulty | undefined): number {
  if (value === 'relaxed') return 0
  if (value === 'technical') return 2
  return 1
}

function masteryRank(value: CourseMasteryTier | undefined): number {
  if (value === 'legend') return 4
  if (value === 'ace') return 3
  if (value === 'veteran') return 2
  if (value === 'pilot') return 1
  return 0
}

function coursePickerRankCompare(
  rank: 'recentRank' | 'favoriteRank',
): (a: CoursePickerItem, b: CoursePickerItem) => number {
  return (a, b) => {
    const aRank = Number.isFinite(a[rank]) ? Math.max(0, Math.floor(a[rank]!)) : Number.POSITIVE_INFINITY
    const bRank = Number.isFinite(b[rank]) ? Math.max(0, Math.floor(b[rank]!)) : Number.POSITIVE_INFINITY
    return aRank - bRank
  }
}

function formatCourseDistance(distanceM: number): string {
  const safe = Math.max(0, Math.min(2_000_000, distanceM))
  if (safe < 1_000) return `${Math.round(safe)}M`
  return `${(safe / 1_000).toFixed(safe < 10_000 ? 1 : 0)}KM`
}

function must(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector(sel)
  if (!(el instanceof HTMLElement)) throw new Error(`course picker missing ${sel}`)
  return el
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
