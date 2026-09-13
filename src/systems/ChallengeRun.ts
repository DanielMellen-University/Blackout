export type ChallengePhase =
  | 'ready'
  | 'running'
  | 'returning'
  | 'complete'
  | 'failed'

export type Medal = 'gold' | 'silver' | 'bronze' | 'complete'

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
}

interface ScoreStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const BEST_KEY = 'blackout.best.'
const TRACE_KEY = 'blackout.trace.'

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
  private gateQualityTotal = 0
  private readonly gateSplits: number[] = []
  private bestGateSplits: number[] = []
  private lastPaceDeltaSec = Number.NaN
  private readonly storage: ScoreStore | null
  private clockLabelMinutes = -1
  private clockLabelCentis = -1
  private clockLabelValue = '0:00.00'

  constructor(storage: ScoreStore | null = browserStorage()) {
    this.storage = storage
  }

  reset(courseId: string, totalGates: number): void {
    this.courseId = courseId
    this.totalGates = Math.max(0, Math.floor(totalGates))
    this.phase = 'ready'
    this.elapsedSec = 0
    this.gatesPassed = 0
    this.gateQualityTotal = 0
    this.gateSplits.length = 0
    this.bestGateSplits = this.readBestTrace()
    this.lastPaceDeltaSec = Number.NaN
    this.result = null
    this.clockLabelMinutes = -1
    this.clockLabelCentis = -1
  }

  /** Advance simulation time and arm the clock once the takeoff roll begins. */
  update(dt: number, speed: number): void {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 5)) : 0
    const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
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
    this.gateQualityTotal += clamp01(quality)
    const split = Number.isFinite(this.elapsedSec) ? Math.max(0, this.elapsedSec) : 0
    this.gateSplits[gateIndex] = split
    const bestSplit = this.bestGateSplits[gateIndex]
    this.lastPaceDeltaSec = Number.isFinite(bestSplit) ? split - bestSplit! : Number.NaN
    if (this.totalGates > 0 && this.gatesPassed >= this.totalGates) {
      this.phase = 'returning'
    }
  }

  finishLanding(metrics: LandingMetrics): ChallengeResult | null {
    if (this.phase !== 'returning') return null

    const elapsedSec = Number.isFinite(this.elapsedSec) ? Math.max(0, this.elapsedSec) : 0
    const gateQuality =
      this.totalGates > 0 ? this.gateQualityTotal / this.totalGates : 0
    const gateScore = Math.round(20_000 * clamp01(gateQuality))

    // A brisk, clean circuit scores well; time can never erase completion.
    const timeScore = Math.round(Math.max(5_000, 70_000 - elapsedSec * 320))

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
    const landingScore = Math.round(10_000 * landingQuality)
    const totalScore = gateScore + timeScore + landingScore
    const previousBest = this.readBest()
    const isNewBest = totalScore > previousBest
    const bestScore = Math.max(previousBest, totalScore)
    const bestElapsedSec = this.bestGateSplits[this.totalGates - 1]
    const paceDeltaSec = Number.isFinite(bestElapsedSec)
      ? elapsedSec - bestElapsedSec!
      : Number.NaN
    const paceLabel = formatPaceDelta(paceDeltaSec)
    const comparisonBestSplits = this.bestGateSplits.slice()
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
      totalScore,
      medal: medalFor(totalScore),
      bestScore,
      isNewBest,
      gateSplits: this.gateSplits.slice(),
      bestGateSplits: comparisonBestSplits,
      paceDeltaSec,
      paceLabel,
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
    return formatPaceDelta(this.lastPaceDeltaSec)
  }

  private readBest(): number {
    try {
      const parsed = Number(this.storage?.getItem(BEST_KEY + this.courseId) ?? 0)
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
    } catch {
      return 0
    }
  }

  private writeBest(score: number): void {
    try {
      this.storage?.setItem(BEST_KEY + this.courseId, String(Math.floor(score)))
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
