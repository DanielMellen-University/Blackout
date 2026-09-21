export type SortieStyleId = 'precision' | 'speed' | 'explorer' | 'survivor' | 'balanced'

export const SORTIE_STYLE_IDS: readonly SortieStyleId[] = [
  'precision',
  'speed',
  'explorer',
  'survivor',
  'balanced',
]

export interface SortieStyleSummary {
  id: SortieStyleId
  label: string
  detail: string
}

export interface SortieStyleInput {
  landingQuality?: number
  landingLabel?: string
  bestPrecisionStreak?: number
  approachScore?: number
  destinationCount?: number
  biomeCount?: number
  peakSpeedKts?: number
  timeScore?: number
  scoringFocus?: 'balanced' | 'gates' | 'pace' | 'landing'
  deadstickScore?: number
  fuelRemainingPercent?: number
}

/**
 * Derive one stable debrief identity from telemetry the run already records.
 * The classifier itself stays allocation-light and adds no simulation state.
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
    : landingQualityBand(landingQuality)

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

export function normalizeSortieStyle(value: unknown): SortieStyleId | undefined {
  return typeof value === 'string' && (SORTIE_STYLE_IDS as readonly string[]).includes(value)
    ? value as SortieStyleId
    : undefined
}

export function sortieStyleLabel(style: SortieStyleId): string {
  return style.toUpperCase()
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

function landingQualityBand(value: number): string {
  if (value >= 0.92) return 'BUTTER'
  if (value >= 0.78) return 'SMOOTH'
  if (value >= 0.6) return 'FIRM'
  return 'HARD'
}
