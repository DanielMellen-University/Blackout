import {
  formatSplitTrace,
  formatTime,
  MASTERY_BADGE_COUNT,
  masteryBadgeLabel,
  nextMedalTargetForScore,
  type ChallengeResult,
} from '../systems/ChallengeRun'
import { pilotRankLabel, type PilotRank } from '../systems/CareerProgression'
import { sortieStyleForResult, sortieStyleLabel } from '../systems/FlightStyle'
import { formatWorldSeed, type ClipboardWriter } from '../core/WorldSeed'
import { failedLandingCorrection } from '../systems/LandingAssessment'

/** Return the compact course records that deserve a touchdown cue. */
export function flightRecordCueLabel(
  result: Pick<ChallengeResult, 'newFlightDistanceRecord' | 'newPositiveGRecord' | 'newNegativeGRecord' | 'newLandingQualityRecord' | 'newFuelRecord' | 'newMedalRecord' | 'newRunStreakRecord' | 'newContractStreakRecord'>,
): string {
  return [
    result.newFlightDistanceRecord ? 'DISTANCE' : '',
    result.newPositiveGRecord ? 'POS G' : '',
    result.newNegativeGRecord ? 'NEG G' : '',
    result.newLandingQualityRecord ? 'LANDING' : '',
    result.newFuelRecord ? 'FUEL' : '',
    result.newMedalRecord ? 'MEDAL' : '',
    result.newRunStreakRecord ? 'RUN STREAK' : '',
    result.newContractStreakRecord ? 'CONTRACT STREAK' : '',
  ].filter(Boolean).join(' / ')
}

/** Keep the replay identity visible without exposing malformed seed values. */
export function resultSeedLabel(seed: number | undefined): string {
  return Number.isFinite(seed) ? `SEED ${formatWorldSeed(seed!)}` : ''
}

/** Explain the score delta against the persisted course best without leaking malformed values. */
export function resultScoreComparisonLabel(
  result: Pick<ChallengeResult, 'totalScore' | 'bestScore' | 'previousBestScore' | 'isNewBest'>,
): string {
  if (!Number.isFinite(result.previousBestScore)) return ''
  const score = Number.isFinite(result.totalScore) ? Math.max(0, Math.floor(result.totalScore)) : 0
  const best = Number.isFinite(result.bestScore) ? Math.max(0, Math.floor(result.bestScore)) : score
  const previous = Math.max(0, Math.floor(result.previousBestScore!))
  if (result.isNewBest) {
    const improvement = Math.max(0, score - previous)
    return improvement > 0 ? `PB +${improvement.toLocaleString()}` : 'PB'
  }
  const gap = Math.max(0, best - score)
  return gap > 0 ? `BEST +${gap.toLocaleString()}` : ''
}

/** Copy a bounded human-readable sortie recap without leaking runtime state. */
export async function copySortieSummary(
  summary: string,
  clipboard: ClipboardWriter | null | undefined,
): Promise<boolean> {
  const text = typeof summary === 'string' ? summary.trim().slice(0, 500) : ''
  if (!text || !clipboard || typeof clipboard.writeText !== 'function') return false
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const MEDAL_CLASSES = ['medal-gold', 'medal-silver', 'medal-bronze', 'medal-complete'] as const

function gatesClearedLabel(result: ChallengeResult): string {
  if (!Number.isFinite(result.gatesCleared)) return '0'
  const cleared = Math.max(0, Math.floor(result.gatesCleared!))
  const total = Number.isFinite(result.gatesTotal) ? Math.max(0, Math.floor(result.gatesTotal!)) : 0
  return total > 0 ? `${cleared}/${total}` : String(cleared)
}

function gateMissesLabel(result: ChallengeResult): string {
  if (!Number.isFinite(result.gateMisses)) return ''
  const misses = Math.max(0, Math.floor(result.gateMisses!))
  return misses > 0 ? `${misses} MISS${misses === 1 ? '' : 'ES'}` : ''
}
const FUEL_CLASSES = ['fuel-healthy', 'fuel-low', 'fuel-critical'] as const

/** Results screen for the takeoff → circuit → landing challenge loop. */
export class RunResults {
  private readonly root: HTMLElement
  private readonly title: HTMLElement
  private readonly summary: HTMLElement
  private readonly conditions: HTMLElement | null
  private readonly seedEl: HTMLElement | null
  private readonly score: HTMLElement
  private readonly time: HTMLElement
  private readonly landing: HTMLElement
  private readonly landingDetail: HTMLElement
  private readonly coaching: HTMLElement | null
  private readonly touchdown: HTMLElement | null
  private readonly gates: HTMLElement
  private readonly streak: HTMLElement
  private readonly streakDetail: HTMLElement
  private readonly fuel: HTMLElement
  private readonly fuelDetail: HTMLElement
  private readonly scoreDetail: HTMLElement
  private readonly badges: HTMLElement
  private readonly splits: HTMLElement
  private readonly best: HTMLElement
  private readonly shareReplay: HTMLButtonElement | null
  private readonly copySummary: HTMLButtonElement | null
  private readonly copySeed: HTMLButtonElement | null
  private readonly loadSeed: HTMLButtonElement | null
  private sortieSummaryText = ''
  private returnFocus: HTMLElement | null = null
  private disposed = false
  private shareReplayHandler: (() => void) | null = null
  private copySummaryHandler: (() => void) | null = null
  private copySeedHandler: (() => void) | null = null
  private loadSeedHandler: (() => void) | null = null
  private readonly onShareReplay = (): void => {
    if (this.disposed) return
    this.shareReplayHandler?.()
  }
  private readonly onCopySeed = (): void => {
    if (this.disposed) return
    this.copySeedHandler?.()
  }
  private readonly onCopySummary = (): void => {
    if (this.disposed) return
    this.copySummaryHandler?.()
  }
  private readonly onLoadSeed = (): void => {
    if (this.disposed) return
    this.loadSeedHandler?.()
  }
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || !this.open || event.key !== 'Tab') return
    const focusable = this.activeFocusable()
    if (focusable.length === 0) return

    const active = document.activeElement
    const index = active instanceof HTMLElement ? focusable.indexOf(active) : -1
    if (event.shiftKey && index <= 0) {
      event.preventDefault()
      focusable[focusable.length - 1]!.focus({ preventScroll: true })
    } else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
      event.preventDefault()
      focusable[0]!.focus({ preventScroll: true })
    }
  }

  constructor(root: Document = document) {
    this.root = must(root, 'run-results')
    this.title = must(root, 'result-title')
    this.summary = must(root, 'result-summary')
    this.conditions = root.getElementById('result-conditions')
    this.seedEl = root.getElementById('result-seed')
    this.score = must(root, 'result-score')
    this.time = must(root, 'result-time')
    this.landing = must(root, 'result-landing')
    this.landingDetail = must(root, 'result-landing-detail')
    this.coaching = root.getElementById('result-coaching')
    this.touchdown = root.getElementById('result-touchdown')
    this.gates = must(root, 'result-gates')
    this.streak = must(root, 'result-streak')
    this.streakDetail = must(root, 'result-streak-detail')
    this.fuel = must(root, 'result-fuel')
    this.fuelDetail = must(root, 'result-fuel-detail')
    this.scoreDetail = must(root, 'result-score-detail')
    this.badges = must(root, 'result-badges')
    this.splits = must(root, 'result-splits')
    this.best = must(root, 'result-best')
    this.shareReplay = root.getElementById('btn-share-replay') as HTMLButtonElement | null
    this.copySummary = root.getElementById('btn-copy-summary') as HTMLButtonElement | null
    this.copySeed = root.getElementById('btn-copy-seed') as HTMLButtonElement | null
    this.loadSeed = root.getElementById('btn-load-seed') as HTMLButtonElement | null
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', 'result-title')
    this.root.setAttribute('aria-describedby', this.coaching ? 'result-summary result-coaching' : 'result-summary')
    this.root.addEventListener('keydown', this.onKeyDown)
    this.shareReplay?.addEventListener('click', this.onShareReplay)
    this.copySummary?.addEventListener('click', this.onCopySummary)
    this.copySeed?.addEventListener('click', this.onCopySeed)
    this.loadSeed?.addEventListener('click', this.onLoadSeed)
  }

  get open(): boolean {
    return !this.disposed && !this.root.hidden
  }

  setShareReplayHandler(handler: (() => void) | null): void {
    if (this.disposed) return
    this.shareReplayHandler = handler
  }

  setCopySeedHandler(handler: (() => void) | null): void {
    if (this.disposed) return
    this.copySeedHandler = handler
  }

  setCopySummaryHandler(handler: (() => void) | null): void {
    if (this.disposed) return
    this.copySummaryHandler = handler
  }

  get summaryText(): string {
    return this.sortieSummaryText
  }

  setCopySummaryFeedback(copied: boolean): void {
    if (this.disposed || !this.copySummary) return
    this.copySummary.textContent = copied ? 'Summary copied' : 'Copy sortie summary'
    this.copySummary.setAttribute(
      'aria-label',
      copied ? 'Sortie summary copied' : 'Copy sortie summary blocked by browser permissions',
    )
  }

  setLoadSeedHandler(handler: (() => void) | null): void {
    if (this.disposed) return
    this.loadSeedHandler = handler
  }

  setCopySeedFeedback(copied: boolean): void {
    if (this.disposed || !this.copySeed) return
    this.copySeed.textContent = copied ? 'World seed copied' : 'Copy world seed'
    this.copySeed.setAttribute(
      'aria-label',
      copied ? 'World seed copied' : 'Copy world seed blocked by browser permissions',
    )
  }

  show(
    result: ChallengeResult,
    pilotRank?: PilotRank,
    pilotRankPromoted = false,
    newCareerCommendations: readonly string[] = [],
    courseLabel?: string,
    courseConditions?: string,
    worldSeed?: number,
  ): void {
    if (this.disposed) return
    if (this.shareReplay) {
      this.shareReplay.textContent = 'Copy replay link'
      this.shareReplay.setAttribute('aria-label', 'Copy replay link for this sortie')
    }
    this.setCopySummaryFeedback(false)
    this.setCopySeedFeedback(false)
    const active = document.activeElement
    this.returnFocus = active instanceof HTMLElement ? active : null
    for (const className of MEDAL_CLASSES) this.root.classList.remove(className)
    const crashed = result.endedByCrash === true
    const ditched = crashed && result.ditched === true
    const label = typeof courseLabel === 'string' ? courseLabel.trim() : ''
    const rawCourse = result.courseId && result.courseId.trim().length > 0 ? result.courseId.trim() : ''
    const course = label || rawCourse || 'SORTIE'
    const summaryCourse = label || (rawCourse && !rawCourse.startsWith('seed:') ? rawCourse : 'SORTIE')
    const conditions = typeof courseConditions === 'string' ? courseConditions.trim() : ''
    const courseEl = this.root.querySelector('#result-course')
    if (courseEl) courseEl.textContent = course
    if (this.conditions) {
      this.conditions.textContent = conditions
      this.conditions.hidden = conditions.length === 0
      if (conditions) this.conditions.setAttribute('aria-label', `Sortie conditions ${conditions.replaceAll(' / ', ', ')}`)
      else this.conditions.removeAttribute('aria-label')
    }
    if (this.seedEl) {
      const seedLabel = resultSeedLabel(worldSeed)
      this.seedEl.textContent = seedLabel
      this.seedEl.hidden = seedLabel.length === 0
      if (seedLabel) this.seedEl.setAttribute('aria-label', `World seed ${seedLabel.slice(5)}`)
      else this.seedEl.removeAttribute('aria-label')
      if (this.loadSeed) this.loadSeed.hidden = seedLabel.length === 0
    }
    this.title.textContent = crashed
      ? (ditched ? 'DITCHED' : 'CRASH')
      : result.freeFlight
        ? 'FREE FLIGHT COMPLETE'
        : 'COMPLETE'
    this.score.textContent = result.totalScore.toLocaleString()
    this.score.setAttribute('aria-label', `Total score ${result.totalScore.toLocaleString()}`)
    this.time.textContent = formatTime(result.elapsedSec)
    const failureLabel = crashed
      ? (typeof result.failureReason === 'string' && result.failureReason.trim().length > 0
        ? result.failureReason.trim().toUpperCase()
        : ditched ? 'DITCHED' : 'CRASH')
      : ''
    const landingName = crashed
      ? failureLabel
      : (result.landingLabel ?? 'HARD')
    this.landing.textContent = crashed ? landingName : `${Math.round(result.landingQuality * 100)}%`
    this.landingDetail.textContent = crashed ? 'FLIGHT FAILURE' : landingName
    this.landingDetail.setAttribute('aria-label', crashed ? `${landingName} flight failure` : `Landing quality ${landingName}`)
    const correction = crashed
      ? failedLandingCorrection(result.failureReason, result.ditched)
      : result.landingDebrief?.correction ?? ''
    const touchdown = crashed ? '' : result.landingDebrief?.telemetry ?? ''
    if (this.coaching) {
      this.coaching.textContent = correction
      this.coaching.hidden = correction.length === 0
    }
    if (this.touchdown) {
      this.touchdown.textContent = touchdown
      this.touchdown.hidden = touchdown.length === 0
    }
    const gatesLabel = gatesClearedLabel(result)
    const gateMisses = gateMissesLabel(result)
    this.gates.textContent = gatesLabel
    this.gates.setAttribute('aria-label', `${gatesLabel} gates cleared${gateMisses ? `, ${gateMisses.toLowerCase()}` : ''}`)
    const precisionStreak = Number.isFinite(result.bestPrecisionStreak)
      ? Math.max(0, Math.floor(result.bestPrecisionStreak!))
      : 0
    const courseBestPrecisionStreak = Number.isFinite(result.courseBestPrecisionStreak)
      ? Math.max(0, Math.floor(result.courseBestPrecisionStreak!))
      : precisionStreak
    this.streak.textContent = precisionStreak >= 2 ? `X${precisionStreak}` : 'NONE'
    this.streakDetail.textContent = courseBestPrecisionStreak >= 2
      ? `COURSE BEST X${courseBestPrecisionStreak}`
      : 'NO COURSE STREAK'
    this.streak.setAttribute(
      'aria-label',
      precisionStreak >= 2
        ? `Best sortie precision streak ${precisionStreak} gates; course best ${courseBestPrecisionStreak}`
        : courseBestPrecisionStreak >= 2
          ? `No precision streak this sortie; course best ${courseBestPrecisionStreak}`
          : 'No precision streak',
    )
    const fuelRemaining = Number.isFinite(result.fuelRemainingPercent)
      ? Math.max(0, Math.min(100, Math.round(result.fuelRemainingPercent!)))
      : 100
    const fuelUsed = Number.isFinite(result.fuelUsedPercent)
      ? Math.max(0, Math.min(100, Math.round(result.fuelUsedPercent!)))
      : 100 - fuelRemaining
    this.fuel.textContent = `${fuelRemaining}%`
    this.fuel.setAttribute('aria-label', `${fuelRemaining}% remaining, ${fuelUsed}% used`)
    this.fuelDetail.textContent = fuelUsed > 0 ? `${fuelUsed}% USED` : 'NO BURN'
    const fuelClass = resultFuelBandClass(fuelRemaining)
    for (const className of FUEL_CLASSES) this.fuel.classList.remove(className)
    this.fuel.classList.add(fuelClass)
    const outcome = crashed
      ? landingName
      : result.freeFlight
        ? 'SCENIC SORTIE COMPLETE'
        : 'ROUTE COMPLETE'
    this.summary.textContent = `${course}${conditions ? ` · ${conditions.replaceAll(' / ', ' · ')}` : ''} · ${outcome} · ${formatTime(result.elapsedSec)} · ${gatesLabel} GATES${gateMisses ? ` · ${gateMisses}` : ''} · ${landingName}`
    const summaryScore = Number.isFinite(result.totalScore)
      ? Math.max(0, Math.floor(result.totalScore))
      : 0
    const summaryTime = Number.isFinite(result.elapsedSec) ? Math.max(0, result.elapsedSec) : 0
    const summaryMedal = !crashed && result.medal && result.medal !== 'complete'
      ? `MEDAL ${result.medal.toUpperCase()}`
      : ''
    const contractLabel = typeof result.contractLabel === 'string'
      ? result.contractLabel.trim().replace(/^CONTRACT\s+/i, '').slice(0, 72)
      : ''
    const contractState = result.contractFailed
      ? 'FAILED'
      : result.contractComplete
        ? 'COMPLETE'
        : 'OPEN'
    const contractSummary = contractLabel ? `CONTRACT ${contractState} ${contractLabel}` : ''
    const contractDetail = typeof result.contractDetail === 'string'
      ? result.contractDetail.trim().slice(0, 96)
      : ''
    const contractProgress = !result.contractComplete && Number.isFinite(result.contractProgress)
      ? `CONTRACT PROGRESS ${Math.round(Math.max(0, Math.min(1, result.contractProgress!)) * 100)}%`
      : ''
    this.sortieSummaryText = [
      'BLACKOUT',
      summaryCourse,
      conditions ? conditions.replaceAll(' / ', ' · ') : '',
      `OUTCOME ${outcome}`,
      `SCORE ${summaryScore.toLocaleString()}`,
      `TIME ${formatTime(summaryTime)}`,
      `${gatesLabel} GATES`,
      `LAND ${landingName}`,
      `FUEL ${fuelRemaining}%`,
      summaryMedal,
      contractSummary,
      contractDetail,
      contractProgress,
    ].filter(Boolean).join(' · ').slice(0, 500)
    const scoreParts = [
      `GATE +${result.gateScore.toLocaleString()}`,
      `TIME +${result.timeScore.toLocaleString()}`,
      `LAND +${result.landingScore.toLocaleString()}`,
    ]
    const sortieStyle = result.sortieStyle
      ? {
          label: sortieStyleLabel(result.sortieStyle),
          detail: result.sortieStyleDetail ?? '',
        }
      : sortieStyleForResult(result)
    scoreParts.push(`STYLE ${sortieStyle.label}`, sortieStyle.detail)
    if (result.newSortieStyleRecord) scoreParts.push('STYLE RECORD')
    if (result.scoreCapped) scoreParts.push('SCORE CAP')
    if (pilotRank) scoreParts.push(`CAREER ${pilotRankLabel(pilotRank)}${pilotRankPromoted ? ' UP' : ''}`)
    if (result.newMedalRecord) scoreParts.push('NEW MEDAL')
    const scoreComparison = resultScoreComparisonLabel(result)
    if (scoreComparison) scoreParts.push(scoreComparison)
    if (!crashed && Number.isFinite(result.totalScore) && result.totalScore > 0) {
      const nextTarget = nextMedalTargetForScore(result.bestScore)
      if (nextTarget) scoreParts.push(`NEXT ${nextTarget.medal.toUpperCase()} ${nextTarget.score.toLocaleString()}`)
    }
    if (result.courseBestMedal && result.courseBestMedal !== result.medal) {
      scoreParts.push(`COURSE ${result.courseBestMedal.toUpperCase()}`)
    }
    if (result.paceLabel) scoreParts.push(`PACE ${result.paceLabel}`)
    if (gateMisses) scoreParts.push(gateMisses)
    if (result.scoringFocus) scoreParts.push(`${result.scoringFocus.toUpperCase()} FOCUS`)
    if (Number.isFinite(result.peakSpeedKts)) {
      scoreParts.push(`TOP ${Math.max(0, Math.round(result.peakSpeedKts!))}KT`)
    }
    if (Number.isFinite(result.peakAltitudeM)) {
      scoreParts.push(`ALT ${Math.max(0, Math.round(result.peakAltitudeM!)).toLocaleString()}M`)
    }
    if (Number.isFinite(result.flightDistanceM) && result.flightDistanceM! > 0) {
      scoreParts.push(`DIST ${formatDistance(result.flightDistanceM!)}`)
    }
    if (Number.isFinite(result.peakPositiveG) || Number.isFinite(result.peakNegativeG)) {
      const positive = Number.isFinite(result.peakPositiveG) ? Math.max(0, result.peakPositiveG!) : 1
      const negative = Number.isFinite(result.peakNegativeG) ? Math.min(0, result.peakNegativeG!) : 0
      scoreParts.push(`G +${positive.toFixed(1)}/${negative.toFixed(1)}`)
    }
    if (Number.isFinite(result.courseBestFlightDistanceM) && result.courseBestFlightDistanceM! > (result.flightDistanceM ?? 0)) {
      scoreParts.push(`COURSE DIST ${formatDistance(result.courseBestFlightDistanceM!)}`)
    }
    if (Number.isFinite(result.courseBestPositiveG) && result.courseBestPositiveG! > (result.peakPositiveG ?? 0)) {
      scoreParts.push(`COURSE G+${result.courseBestPositiveG!.toFixed(1)}`)
    }
    if (Number.isFinite(result.courseBestNegativeG) && result.courseBestNegativeG! < (result.peakNegativeG ?? 0)) {
      scoreParts.push(`COURSE G${result.courseBestNegativeG!.toFixed(1)}`)
    }
    if (Number.isFinite(result.altitudeMilestoneM) && result.altitudeMilestoneM! > 0) {
      scoreParts.push(`CLIMB ${Math.max(0, Math.floor(result.altitudeMilestoneM!)).toLocaleString()}M`)
    }
    const altitudeScore = Number.isFinite(result.altitudeScore)
      ? Math.max(0, Math.floor(result.altitudeScore!))
      : 0
    if (altitudeScore > 0) scoreParts.push(`CLIMB +${altitudeScore.toLocaleString()}`)
    const stuntRolls = Number.isFinite(result.stuntRolls)
      ? Math.max(0, Math.floor(result.stuntRolls!))
      : 0
    const stuntScore = Number.isFinite(result.stuntScore)
      ? Math.max(0, Math.floor(result.stuntScore!))
      : 0
    if (stuntRolls > 0) {
      scoreParts.push(`ROLLS X${stuntRolls}`)
      if (stuntScore > 0) scoreParts.push(`ROLL +${stuntScore.toLocaleString()}`)
    }
    const bestCombo = Number.isFinite(result.bestCombo)
      ? Math.max(0, Math.floor(result.bestCombo!))
      : 0
    const comboScore = Number.isFinite(result.comboScore)
      ? Math.max(0, Math.floor(result.comboScore!))
      : 0
    if (bestCombo > 1) {
      scoreParts.push(`COMBO X${bestCombo}`)
      if (comboScore > 0) scoreParts.push(`COMBO +${comboScore.toLocaleString()}`)
    }
    const fuelScore = Number.isFinite(result.fuelScore)
      ? Math.max(0, Math.floor(result.fuelScore!))
      : 0
    if (fuelScore > 0) scoreParts.push(`FUEL +${fuelScore.toLocaleString()}`)
    const runStreakScore = Number.isFinite(result.runStreakScore)
      ? Math.max(0, Math.floor(result.runStreakScore!))
      : 0
    if (runStreakScore > 0) scoreParts.push(`RUN STREAK +${runStreakScore.toLocaleString()}`)
    const deadstickScore = Number.isFinite(result.deadstickScore)
      ? Math.max(0, Math.floor(result.deadstickScore!))
      : 0
    if (deadstickScore > 0) scoreParts.push(`DEADSTICK +${deadstickScore.toLocaleString()}`)
    const approachScore = Number.isFinite(result.approachScore)
      ? Math.max(0, Math.floor(result.approachScore!))
      : 0
    if (approachScore > 0) scoreParts.push(`APPROACH +${approachScore.toLocaleString()}`)
    const weatherScore = Number.isFinite(result.weatherScore)
      ? Math.max(0, Math.floor(result.weatherScore!))
      : 0
    if (weatherScore > 0) scoreParts.push(`WEATHER +${weatherScore.toLocaleString()}`)
    const nightScore = Number.isFinite(result.nightScore)
      ? Math.max(0, Math.floor(result.nightScore!))
      : 0
    if (nightScore > 0) scoreParts.push(`NIGHT +${nightScore.toLocaleString()}`)
    const destinationCount = Number.isFinite(result.destinationCount)
      ? Math.max(0, Math.floor(result.destinationCount!))
      : 0
    const destinationScore = Number.isFinite(result.destinationScore)
      ? Math.max(0, Math.floor(result.destinationScore!))
      : 0
    if (destinationCount > 0) scoreParts.push(`DEST X${destinationCount}`)
    if (destinationScore > 0) scoreParts.push(`DEST +${destinationScore.toLocaleString()}`)
    const biomeCount = Number.isFinite(result.biomeCount)
      ? Math.max(0, Math.floor(result.biomeCount!))
      : 0
    const biomeScore = Number.isFinite(result.biomeScore)
      ? Math.max(0, Math.floor(result.biomeScore!))
      : 0
    if (biomeCount > 0) scoreParts.push(`BIOMES X${biomeCount}`)
    if (biomeScore > 0) scoreParts.push(`BIOME +${biomeScore.toLocaleString()}`)
    const waterBodyCount = Number.isFinite(result.waterBodyCount)
      ? Math.max(0, Math.floor(result.waterBodyCount!))
      : 0
    if (waterBodyCount > 0) scoreParts.push(`WATERWAYS X${waterBodyCount}`)
    const courseBestWaterBodyCount = Number.isFinite(result.courseBestWaterBodyCount)
      ? Math.max(0, Math.floor(result.courseBestWaterBodyCount!))
      : 0
    if (result.newWaterBodyRecord) scoreParts.push('NEW WATERWAY RECORD')
    if (courseBestWaterBodyCount > waterBodyCount) {
      scoreParts.push(`COURSE WATERWAYS X${courseBestWaterBodyCount}`)
    }
    const courseBestDestinationCount = Number.isFinite(result.courseBestDestinationCount)
      ? Math.max(0, Math.floor(result.courseBestDestinationCount!))
      : 0
    if (courseBestDestinationCount > destinationCount) {
      scoreParts.push(`COURSE DEST X${courseBestDestinationCount}`)
    }
    const courseBestBiomeCount = Number.isFinite(result.courseBestBiomeCount)
      ? Math.max(0, Math.floor(result.courseBestBiomeCount!))
      : 0
    if (courseBestBiomeCount > biomeCount) {
      scoreParts.push(`COURSE BIOMES X${courseBestBiomeCount}`)
    }
    const runStreak = Number.isFinite(result.runStreak)
      ? Math.max(0, Math.floor(result.runStreak!))
      : 0
    if (runStreak > 1) scoreParts.push(`RUN STREAK X${runStreak}`)
    const courseBestRunStreak = Number.isFinite(result.courseBestRunStreak)
      ? Math.max(0, Math.floor(result.courseBestRunStreak!))
      : 0
    if (courseBestRunStreak > runStreak && courseBestRunStreak > 1) {
      scoreParts.push(`COURSE RUN STREAK X${courseBestRunStreak}`)
    }
    if (result.contractLabel) {
      const contractState = result.contractFailed
        ? 'CONTRACT FAILED'
        : result.contractComplete ? 'CONTRACT COMPLETE' : 'CONTRACT OPEN'
      scoreParts.push(`${contractState} · ${result.contractLabel}`)
      if (result.contractDetail) scoreParts.push(result.contractDetail)
      if (!result.contractComplete && !result.contractFailed && Number.isFinite(result.contractProgress)) {
        scoreParts.push(`PROGRESS ${Math.round(Math.max(0, Math.min(1, result.contractProgress!)) * 100)}%`)
      }
      const contractScore = Number.isFinite(result.contractScore)
        ? Math.max(0, Math.floor(result.contractScore!))
        : 0
      if (contractScore > 0) scoreParts.push(`CONTRACT +${contractScore.toLocaleString()}`)
      const contractStreakBonus = Number.isFinite(result.contractStreakBonus)
        ? Math.max(0, Math.floor(result.contractStreakBonus!))
        : 0
      if (contractStreakBonus > 0) scoreParts.push(`CHAIN +${contractStreakBonus.toLocaleString()}`)
    }
    const contractWins = Number.isFinite(result.contractWins)
      ? Math.max(0, Math.floor(result.contractWins!))
      : 0
    if (contractWins > 0) scoreParts.push(`CONTRACT WINS X${contractWins}`)
    const courseBestContractWins = Number.isFinite(result.courseBestContractWins)
      ? Math.max(0, Math.floor(result.courseBestContractWins!))
      : 0
    if (courseBestContractWins > contractWins) {
      scoreParts.push(`COURSE CONTRACTS X${courseBestContractWins}`)
    }
    const contractStreak = Number.isFinite(result.contractStreak)
      ? Math.max(0, Math.floor(result.contractStreak!))
      : 0
    const courseBestContractStreak = Number.isFinite(result.courseBestContractStreak)
      ? Math.max(0, Math.floor(result.courseBestContractStreak!))
      : 0
    if (contractStreak > 1) scoreParts.push(`CONTRACT STREAK X${contractStreak}`)
    if (courseBestContractStreak > contractStreak && courseBestContractStreak > 1) {
      scoreParts.push(`COURSE CONTRACT STREAK X${courseBestContractStreak}`)
    }
    if (result.courseMasteryTierLabel) {
      scoreParts.push(`COURSE TIER ${result.courseMasteryTierLabel}`)
    }
    if (result.masteryTierPromoted && result.courseMasteryTierLabel) {
      scoreParts.push(`PROMOTED ${result.courseMasteryTierLabel}`)
    }
    const courseBestCombo = Number.isFinite(result.courseBestCombo)
      ? Math.max(0, Math.floor(result.courseBestCombo!))
      : 0
    if (courseBestCombo > bestCombo) {
      scoreParts.push(`COURSE COMBO X${courseBestCombo}`)
    }
    const courseBestStuntRolls = Number.isFinite(result.courseBestStuntRolls)
      ? Math.max(0, Math.floor(result.courseBestStuntRolls!))
      : 0
    if (courseBestStuntRolls > stuntRolls) {
      scoreParts.push(`COURSE ROLLS X${courseBestStuntRolls}`)
    }
    if (Number.isFinite(result.courseBestPeakSpeedKts) && result.courseBestPeakSpeedKts! > (result.peakSpeedKts ?? 0)) {
      scoreParts.push(`COURSE TOP ${Math.max(0, Math.round(result.courseBestPeakSpeedKts!)).toLocaleString()}KT`)
    }
    if (Number.isFinite(result.courseBestPeakAltitudeM) && result.courseBestPeakAltitudeM! > (result.peakAltitudeM ?? 0)) {
      scoreParts.push(`COURSE ALT ${Math.max(0, Math.round(result.courseBestPeakAltitudeM!)).toLocaleString()}M`)
    }
    if (Number.isFinite(result.courseBestApproachScore) && result.courseBestApproachScore! > (result.approachScore ?? 0)) {
      scoreParts.push(`COURSE APPROACH +${Math.max(0, Math.floor(result.courseBestApproachScore!)).toLocaleString()}`)
    }
    if (Number.isFinite(result.courseBestLandingQuality) && result.courseBestLandingQuality! > result.landingQuality) {
      scoreParts.push(`COURSE LAND ${Math.round(Math.max(0, Math.min(1, result.courseBestLandingQuality!)) * 100)}%`)
    }
    if (Number.isFinite(result.courseBestFuelRemainingPercent) && result.courseBestFuelRemainingPercent! > (result.fuelRemainingPercent ?? 0)) {
      scoreParts.push(`COURSE FUEL ${Math.round(Math.max(0, Math.min(100, result.courseBestFuelRemainingPercent!)))}%`)
    }
    this.scoreDetail.textContent = scoreParts.join(' · ')
    const newBadges = result.newMasteryBadges ?? []
    const allBadges = result.masteryBadges ?? []
    const newRecords = [
      result.newPeakSpeedRecord ? 'SPEED' : '',
      result.newPeakAltitudeRecord ? 'ALTITUDE' : '',
      result.newFlightDistanceRecord ? 'DISTANCE' : '',
      result.newPositiveGRecord ? 'POS G' : '',
      result.newNegativeGRecord ? 'NEG G' : '',
      result.newStuntRecord ? 'ROLLS' : '',
      result.newComboRecord ? 'COMBO' : '',
      result.newApproachRecord ? 'APPROACH' : '',
      result.newLandingQualityRecord ? 'LANDING' : '',
      result.newFuelRecord ? 'FUEL' : '',
      result.newMedalRecord ? 'MEDAL' : '',
      result.masteryTierPromoted ? 'MASTERY' : '',
      result.newDestinationRecord ? 'DESTINATIONS' : '',
      result.newBiomeRecord ? 'BIOMES' : '',
      result.newRunStreakRecord ? 'RUN STREAK' : '',
      result.newContractRecord ? 'CONTRACTS' : '',
      result.newContractStreakRecord ? 'CONTRACT STREAK' : '',
    ].filter(Boolean)
    const recordLabel = newRecords.length > 0
      ? `NEW RECORD${newRecords.length === 1 ? '' : 'S'} · ${newRecords.join(' / ')}`
      : ''
    const badgeLabel = newBadges.length > 0
      ? `NEW BADGE${newBadges.length === 1 ? '' : 'S'} · ${newBadges.map(masteryBadgeLabel).join(' · ')}`
      : ''
    const commendationLabel = newCareerCommendations.length > 0
      ? `NEW COMMENDATION${newCareerCommendations.length === 1 ? '' : 'S'} · ${newCareerCommendations.join(' / ')}`
      : ''
    const feedbackLabels = [
      badgeLabel,
      recordLabel,
      commendationLabel,
    ].filter(Boolean)
    this.badges.textContent = feedbackLabels.length > 0
      ? feedbackLabels.join(' · ')
      : allBadges.length > 0
        ? `BADGES ${allBadges.length}/${MASTERY_BADGE_COUNT}`
        : ''
    this.splits.textContent = formatSplitTrace(result.gateSplits, result.bestGateSplits)
    const bestBits = [
      result.isNewBest ? 'NEW BEST' : 'BEST',
      result.bestScore.toLocaleString(),
    ]
    if (Number.isFinite(result.completionCount)) bestBits.push(`RUN ${Math.max(1, Math.floor(result.completionCount!))}`)
    if (Number.isFinite(result.bestTimeSec)) bestBits.push(`FASTEST ${formatTime(result.bestTimeSec!)}`)
    this.best.textContent = bestBits.join(' · ')
    this.best.classList.toggle('new-best', result.isNewBest)
    this.root.hidden = false
    document.getElementById('btn-retry')?.focus({ preventScroll: true })
  }

  hide(): void {
    if (this.disposed) return
    this.root.hidden = true
    const target = this.returnFocus
    this.returnFocus = null
    if (target?.isConnected && !target.closest('[hidden]')) {
      target.focus({ preventScroll: true })
    }
  }

  /** Release the results-owned keyboard trap during runtime teardown. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeEventListener('keydown', this.onKeyDown)
    this.shareReplay?.removeEventListener('click', this.onShareReplay)
    this.copySummary?.removeEventListener('click', this.onCopySummary)
    this.copySeed?.removeEventListener('click', this.onCopySeed)
    this.loadSeed?.removeEventListener('click', this.onLoadSeed)
    this.shareReplayHandler = null
    this.copySummaryHandler = null
    this.copySeedHandler = null
    this.loadSeedHandler = null
    this.returnFocus = null
  }

  private activeFocusable(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>(
      'button:not([hidden]):not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden && element.tabIndex >= 0)
  }
}

function must(root: Document, id: string): HTMLElement {
  const el = root.getElementById(id)
  if (!el) throw new Error(`results missing #${id}`)
  return el
}

/** Keep the flight-log distance compact on results without hiding short sorties. */
export function formatDistance(distanceM: number): string {
  const safe = Number.isFinite(distanceM) ? Math.max(0, Math.min(2_000_000, distanceM)) : 0
  if (safe < 1_000) return `${Math.round(safe)}M`
  return `${(safe / 1_000).toFixed(safe < 10_000 ? 1 : 0)}KM`
}

/** Keep result fuel emphasis aligned with the in-flight reserve thresholds. */
export function resultFuelBandClass(remainingPercent: number): typeof FUEL_CLASSES[number] {
  const safe = Number.isFinite(remainingPercent) ? Math.max(0, Math.min(100, remainingPercent)) : 0
  if (safe <= 10) return 'fuel-critical'
  if (safe <= 25) return 'fuel-low'
  return 'fuel-healthy'
}
