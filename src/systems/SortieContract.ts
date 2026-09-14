/** Small deterministic bonus objectives that give each sortie a second decision. */
export type SortieContractKind = 'pace' | 'altitude' | 'stunt' | 'scout' | 'fuel'

export interface SortieContractDefinition {
  kind: SortieContractKind
  label: string
  detail: string
  target: number
}

export const MAX_CONTRACT_SCORE = 2_000

const CONTRACTS: readonly Omit<SortieContractDefinition, 'detail'>[] = [
  { kind: 'pace', label: 'SPEED RUN', target: 65 },
  { kind: 'altitude', label: 'SKYLINE', target: 3_000 },
  { kind: 'stunt', label: 'AIRSHOW', target: 2 },
  { kind: 'scout', label: 'SCOUT', target: 2 },
  { kind: 'fuel', label: 'FUEL SAVER', target: 0.75 },
]

/** Event-driven contract state. It owns no scene resources and allocates only at reset. */
export class SortieContractTracker {
  private definition: SortieContractDefinition | null = null
  private detailValue = ''
  private hudLabelValue = ''
  private progressValue = 0
  private completeValue = false

  reset(seed: number | undefined, totalGates: number): void {
    this.definition = null
    this.detailValue = ''
    this.hudLabelValue = ''
    this.progressValue = 0
    this.completeValue = false
    if (typeof seed !== 'number' || !Number.isFinite(seed)) return

    const base = CONTRACTS[indexForSeed(seed)]!
    const safeGates = Number.isFinite(totalGates) ? Math.max(0, Math.floor(totalGates)) : 0
    const target = base.kind === 'pace'
      ? Math.max(48, 53 + safeGates * 3)
      : base.target
    const detail = base.kind === 'pace'
      ? `LAND UNDER ${Math.round(target)}S`
      : base.kind === 'altitude'
        ? `REACH ${Math.round(target).toLocaleString()}M`
        : base.kind === 'stunt'
          ? `COMPLETE ${Math.round(target)} BARREL ROLLS`
          : base.kind === 'scout'
            ? `REACH ${Math.round(target)} SETTLEMENTS`
            : `LAND WITH ${Math.round(target * 100)}% FUEL`
    this.definition = { ...base, target, detail }
    this.detailValue = detail
    this.hudLabelValue = `CONTRACT ${base.label}`
  }

  recordAltitude(altitudeM: number): void {
    if (this.definition?.kind !== 'altitude' || this.completeValue || !Number.isFinite(altitudeM)) return
    this.progressValue = clamp01(altitudeM / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  recordStunt(rolls: number): void {
    if (this.definition?.kind !== 'stunt' || this.completeValue || !Number.isFinite(rolls)) return
    this.progressValue = clamp01(rolls / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  recordDestination(count: number): void {
    if (this.definition?.kind !== 'scout' || this.completeValue || !Number.isFinite(count)) return
    this.progressValue = clamp01(count / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Resolve contracts whose success depends on the final touchdown telemetry. */
  finish(elapsedSec: number, fuelFraction: number): number {
    if (!this.definition || this.completeValue) return this.completeValue ? MAX_CONTRACT_SCORE : 0
    if (this.definition.kind === 'pace') {
      this.completeValue = Number.isFinite(elapsedSec) && elapsedSec <= this.definition.target
      this.progressValue = this.completeValue
        ? 1
        : clamp01(this.definition.target / Math.max(this.definition.target, elapsedSec))
    } else if (this.definition.kind === 'fuel') {
      this.completeValue = Number.isFinite(fuelFraction) && fuelFraction >= this.definition.target
      this.progressValue = Number.isFinite(fuelFraction)
        ? clamp01(fuelFraction / this.definition.target)
        : 0
    }
    return this.completeValue ? MAX_CONTRACT_SCORE : 0
  }

  get enabled(): boolean {
    return this.definition !== null
  }

  get kind(): SortieContractKind | null {
    return this.definition?.kind ?? null
  }

  get label(): string {
    return this.definition?.label ?? ''
  }

  get detail(): string {
    return this.detailValue
  }

  get hudLabel(): string {
    return this.hudLabelValue
  }

  get progress(): number {
    return this.progressValue
  }

  get complete(): boolean {
    return this.completeValue
  }
}

function indexForSeed(seed: number): number {
  const safe = Math.trunc(seed)
  const mixed = (safe ^ (safe >>> 16) ^ Math.imul(safe, 0x45d9f3b)) >>> 0
  return mixed % CONTRACTS.length
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
