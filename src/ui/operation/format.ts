import type { OperationMedal } from '../../systems/operation/medal'

/** Grouped score for the stage HUD and the results screen. */
export function formatOperationScore(score: number): string {
  if (!Number.isFinite(score)) return '0'
  return Math.round(score).toLocaleString('en-US')
}

/** Whole metres per second, the unit the operation score uses. */
export function formatOperationSpeed(mps: number): string {
  if (!Number.isFinite(mps)) return '—'
  return `${Math.round(mps)} m/s`
}

/** Whole metres of terrain clearance. */
export function formatOperationClearance(clearanceM: number): string {
  if (!Number.isFinite(clearanceM)) return '—'
  return `${Math.round(clearanceM)} m`
}

/** Medal name for a finished run. A miss stays "No medal". */
export function formatOperationMedal(medal: OperationMedal): string {
  if (medal === 'gold') return 'Gold'
  if (medal === 'silver') return 'Silver'
  if (medal === 'bronze') return 'Bronze'
  return 'No medal'
}

/** Player-facing name for one ridge-relay decision. */
export function operationChoiceLabel(choice: string): string {
  if (choice === 'valley') return 'Valley'
  if (choice === 'ridge') return 'Ridge'
  if (choice === 'conserve') return 'Conserve'
  if (choice === 'commit') return 'Commit'
  return ''
}
