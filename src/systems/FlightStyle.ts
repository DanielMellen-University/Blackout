import { landingQualityLabel, type ChallengeResult } from './ChallengeRun'

export type SortieStyleId = 'precision' | 'speed' | 'explorer' | 'survivor' | 'balanced'

export interface SortieStyleSummary {
  id: SortieStyleId
  label: string
  detail: string
}

type SortieStyleInput = Pick<ChallengeResult,
  | 'landingQuality'
  | 'landingLabel'
  | 'bestPrecisionStreak'
  | 'approachScore'
  | 'destinationCount'
  | 'biomeCount'
  | 'peakSpeedKts'
  | 'timeScore'
  | 'scoringFocus'
  | 'deadstickScore'
  | 'fuelRemainingPercent'
>

/**
 * Derive one stable debrief identity from telemetry the run already records.
 * This stays presentation-only: no simulation state or persistence is added.
 */
export function sortieStyleForResult(result: SortieStyleInput): SortieStyleSummary {
  const landingQuality = clamp01(result.landingQuality)
  const precisionStreak = safeCount(result.bestPrecisionStreak)
  const approachScore = safeCount(result.approachScore)
  const destinationCount = safeCount(result.destinationCount)
  const biomeCount = safeCount(result.biomeCount)
  const peakSpeedKts = safeCount(result.peakSpeedKts)
  const timeScore = safeCount(result.timeScore)
  const deadstickScore = safeCount(result.deadstickScore)
  const fuelRemaining = clampPercent(result.fuelRemainingPercent)
  const landingLabel = typeof result.landingLabel === 'string' && result.landingLabel.trim().length > 0
    ? result.landingLabel.trim().toUpperCase()
    : landingQualityLabel(landingQuality)

  if (deadstickScore > 0) {
    return { id: 'survivor', label: 'SURVIVOR', detail: 'DEADSTICK RECOVERY' }
  }
  if (landingQuality >= 0.9 && (precisionStreak >= 3 || approachScore >= 400)) {
    return { id: 'precision', label: 'PRECISION', detail: `${landingLabel} TOUCHDOWN` }
  }
  if (destinationCount >= 2 || biomeCount >= 5) {
    const exploration = destinationCount >= 2
      ? `DEST X${destinationCount}`
      : `BIOMES X${biomeCount}`
    return { id: 'explorer', label: 'EXPLORER', detail: exploration }
  }
  if (peakSpeedKts >= 850 || (result.scoringFocus === 'pace' && timeScore >= 40_000)) {
    const detail = peakSpeedKts > 0 ? `TOP ${peakSpeedKts.toLocaleString()}KT` : 'PACE PUSH'
    return { id: 'speed', label: 'SPEED', detail }
  }
  if (fuelRemaining <= 15 && landingQuality >= 0.6) {
    return { id: 'survivor', label: 'SURVIVOR', detail: `${Math.round(fuelRemaining)}% RESERVE LANDING` }
  }
  return { id: 'balanced', label: 'BALANCED', detail: `${landingLabel} CIRCUIT` }
}

function clamp01(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : 0
}

function clampPercent(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value!)) : 100
}

function safeCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : 0
}
