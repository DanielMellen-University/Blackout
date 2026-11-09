import type { OperationMedal } from '../../systems/operation/medal'
import type { OperationStageId } from '../../systems/operation/identity'
import type { StageResult } from '../../systems/operation/score'
import type { OperationStick } from '../../systems/operation/stick'

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

function axis(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2)
}

/** Live stick, rudder and the keys that move them. */
export function formatOperationStick(stick: OperationStick): string {
  const power = Number.isFinite(stick.throttle) ? Math.round(Math.max(0, Math.min(1, stick.throttle)) * 100) : 0
  return `You fly · pitch ${axis(stick.pitch)} · roll ${axis(stick.roll)} · rudder ${axis(stick.yaw)} · power ${power}% · W/S pitch · A/D roll · Q/E rudder · Shift power · Space nitro`
}

function whole(value: number | undefined): string {
  return Number.isFinite(value) ? `${Math.round(value!)}` : '0'
}

/** One stage on the results screen: score plus the measured flight. */
export function formatStageLine(id: OperationStageId, stage: StageResult): string {
  const name = id.charAt(0).toUpperCase() + id.slice(1)
  const verdict = stage.passed ? formatOperationScore(stage.score) : stage.reason
  const fuel = Number.isFinite(stage.fuelUsed) ? stage.fuelUsed.toFixed(1) : '0.0'
  const nitro = Number.isFinite(stage.nitroUsed) ? `${Math.round(stage.nitroUsed * 100)}%` : '0%'
  return `${name} ${verdict} · ${Number.isFinite(stage.elapsedSec) ? stage.elapsedSec.toFixed(1) : '0.0'} s · path ${whole(stage.pathDeviationM)} m · alt ${whole(stage.altitudeErrorM)} m · ${whole(stage.meanSpeedMps)} m/s · fuel ${fuel} · nitro ${nitro}`
}
