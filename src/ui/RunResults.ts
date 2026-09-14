import {
  formatSplitTrace,
  formatTime,
  MASTERY_BADGE_COUNT,
  masteryBadgeLabel,
  resultMedalClass,
  type ChallengeResult,
} from '../systems/ChallengeRun'

const MEDAL_CLASSES = ['medal-gold', 'medal-silver', 'medal-bronze', 'medal-complete'] as const
const FUEL_CLASSES = ['fuel-healthy', 'fuel-low', 'fuel-critical'] as const

/** Results screen for the takeoff → circuit → landing challenge loop. */
export class RunResults {
  private readonly root: HTMLElement
  private readonly title: HTMLElement
  private readonly summary: HTMLElement
  private readonly score: HTMLElement
  private readonly time: HTMLElement
  private readonly landing: HTMLElement
  private readonly landingDetail: HTMLElement
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
  private returnFocus: HTMLElement | null = null
  private disposed = false
  private shareReplayHandler: (() => void) | null = null
  private readonly onShareReplay = (): void => {
    if (this.disposed) return
    this.shareReplayHandler?.()
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
    this.score = must(root, 'result-score')
    this.time = must(root, 'result-time')
    this.landing = must(root, 'result-landing')
    this.landingDetail = must(root, 'result-landing-detail')
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
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-labelledby', 'result-title')
    this.root.setAttribute('aria-describedby', 'result-summary')
    this.root.addEventListener('keydown', this.onKeyDown)
    this.shareReplay?.addEventListener('click', this.onShareReplay)
  }

  get open(): boolean {
    return !this.disposed && !this.root.hidden
  }

  setShareReplayHandler(handler: (() => void) | null): void {
    if (this.disposed) return
    this.shareReplayHandler = handler
  }

  show(result: ChallengeResult): void {
    if (this.disposed) return
    if (this.shareReplay) {
      this.shareReplay.textContent = 'Copy replay link'
      this.shareReplay.setAttribute('aria-label', 'Copy replay link for this sortie')
    }
    const active = document.activeElement
    this.returnFocus = active instanceof HTMLElement ? active : null
    for (const className of MEDAL_CLASSES) this.root.classList.remove(className)
    this.root.classList.add(resultMedalClass(result.medal))
    this.title.textContent = result.freeFlight
      ? 'FREE FLIGHT COMPLETE'
      : `${result.medal.toUpperCase()} RUN`
    this.score.textContent = result.totalScore.toLocaleString()
    this.score.setAttribute('aria-label', `Total score ${result.totalScore.toLocaleString()}`)
    this.time.textContent = formatTime(result.elapsedSec)
    this.landing.textContent = `${Math.round(result.landingQuality * 100)}%`
    this.landingDetail.textContent = result.landingLabel ?? 'HARD'
    this.landingDetail.setAttribute('aria-label', `Landing quality ${result.landingLabel ?? 'HARD'}`)
    this.gates.textContent = result.gateScore.toLocaleString()
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
    const outcome = result.freeFlight
      ? 'SCENIC SORTIE COMPLETE'
      : result.isNewBest ? 'NEW COURSE BEST' : 'ROUTE COMPLETE'
    this.summary.textContent = `${outcome} · SCORE ${result.totalScore.toLocaleString()} · FUEL ${fuelRemaining}% LEFT · ENTER RETRY · R NEW WORLD`
    const scoreParts = [
      `GATE +${result.gateScore.toLocaleString()}`,
      `TIME +${result.timeScore.toLocaleString()}`,
      `LAND +${result.landingScore.toLocaleString()}`,
    ]
    if (result.paceLabel) scoreParts.push(`PACE ${result.paceLabel}`)
    if (result.scoringFocus) scoreParts.push(`${result.scoringFocus.toUpperCase()} FOCUS`)
    if (Number.isFinite(result.peakSpeedKts)) {
      scoreParts.push(`TOP ${Math.max(0, Math.round(result.peakSpeedKts!))}KT`)
    }
    if (Number.isFinite(result.peakAltitudeM)) {
      scoreParts.push(`ALT ${Math.max(0, Math.round(result.peakAltitudeM!)).toLocaleString()}M`)
    }
    if (Number.isFinite(result.altitudeMilestoneM) && result.altitudeMilestoneM! > 0) {
      scoreParts.push(`CLIMB ${Math.max(0, Math.floor(result.altitudeMilestoneM!)).toLocaleString()}M`)
    }
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
    const destinationCount = Number.isFinite(result.destinationCount)
      ? Math.max(0, Math.floor(result.destinationCount!))
      : 0
    const destinationScore = Number.isFinite(result.destinationScore)
      ? Math.max(0, Math.floor(result.destinationScore!))
      : 0
    if (destinationCount > 0) scoreParts.push(`DEST X${destinationCount}`)
    if (destinationScore > 0) scoreParts.push(`DEST +${destinationScore.toLocaleString()}`)
    const courseBestDestinationCount = Number.isFinite(result.courseBestDestinationCount)
      ? Math.max(0, Math.floor(result.courseBestDestinationCount!))
      : 0
    if (courseBestDestinationCount > destinationCount) {
      scoreParts.push(`COURSE DEST X${courseBestDestinationCount}`)
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
      scoreParts.push(`${result.contractComplete ? 'CONTRACT COMPLETE' : 'CONTRACT OPEN'} · ${result.contractLabel}`)
      if (result.contractDetail) scoreParts.push(result.contractDetail)
      const contractScore = Number.isFinite(result.contractScore)
        ? Math.max(0, Math.floor(result.contractScore!))
        : 0
      if (contractScore > 0) scoreParts.push(`CONTRACT +${contractScore.toLocaleString()}`)
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
    if (result.courseMasteryTierLabel) {
      scoreParts.push(`COURSE TIER ${result.courseMasteryTierLabel}`)
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
    this.scoreDetail.textContent = scoreParts.join(' · ')
    const newBadges = result.newMasteryBadges ?? []
    const allBadges = result.masteryBadges ?? []
    const newRecords = [
      result.newPeakSpeedRecord ? 'SPEED' : '',
      result.newPeakAltitudeRecord ? 'ALTITUDE' : '',
      result.newStuntRecord ? 'ROLLS' : '',
      result.newComboRecord ? 'COMBO' : '',
      result.newApproachRecord ? 'APPROACH' : '',
      result.newDestinationRecord ? 'DESTINATIONS' : '',
      result.newRunStreakRecord ? 'RUN STREAK' : '',
      result.newContractRecord ? 'CONTRACTS' : '',
    ].filter(Boolean)
    const recordLabel = newRecords.length > 0
      ? `NEW RECORD${newRecords.length === 1 ? '' : 'S'} · ${newRecords.join(' / ')}`
      : ''
    const badgeLabel = newBadges.length > 0
      ? `NEW BADGE${newBadges.length === 1 ? '' : 'S'} · ${newBadges.map(masteryBadgeLabel).join(' · ')}`
      : ''
    this.badges.textContent = badgeLabel && recordLabel
      ? `${badgeLabel} · ${recordLabel}`
      : badgeLabel || recordLabel || (allBadges.length > 0
        ? `BADGES ${allBadges.length}/${MASTERY_BADGE_COUNT}`
        : '')
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
    this.shareReplayHandler = null
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

/** Keep result fuel emphasis aligned with the in-flight reserve thresholds. */
export function resultFuelBandClass(remainingPercent: number): typeof FUEL_CLASSES[number] {
  const safe = Number.isFinite(remainingPercent) ? Math.max(0, Math.min(100, remainingPercent)) : 0
  if (safe <= 10) return 'fuel-critical'
  if (safe <= 25) return 'fuel-low'
  return 'fuel-healthy'
}
