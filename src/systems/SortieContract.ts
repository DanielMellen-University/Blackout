/** Small deterministic bonus objectives that give each sortie a second decision. */
export type SortieContractKind = 'pace' | 'altitude' | 'stunt' | 'scout' | 'fuel' | 'low-level' | 'biome'

export interface SortieContractDefinition {
  kind: SortieContractKind
  label: string
  detail: string
  target: number
}

export const MAX_CONTRACT_SCORE = 2_000

const LOW_LEVEL_MIN_ALTITUDE_M = 24
const LOW_LEVEL_MAX_ALTITUDE_M = 360
const LOW_LEVEL_TARGET_SECONDS = 10
const BIOME_TARGET_COUNT = 4

const CONTRACTS: readonly Omit<SortieContractDefinition, 'detail'>[] = [
  { kind: 'pace', label: 'SPEED RUN', target: 65 },
  { kind: 'altitude', label: 'SKYLINE', target: 3_000 },
  { kind: 'stunt', label: 'AIRSHOW', target: 2 },
  { kind: 'scout', label: 'SCOUT', target: 2 },
  { kind: 'fuel', label: 'FUEL SAVER', target: 0.75 },
  { kind: 'low-level', label: 'TERRAIN HUGGER', target: LOW_LEVEL_TARGET_SECONDS },
  { kind: 'biome', label: 'BIOME TOUR', target: BIOME_TARGET_COUNT },
]

/** Event-driven contract state. It owns no scene resources and allocates only at reset. */
export class SortieContractTracker {
  private definition: SortieContractDefinition | null = null
  private detailValue = ''
  private hudLabelValue = ''
  private progressValue = 0
  private completeValue = false
  private lowLevelSeconds = 0

  reset(seed: number | undefined, totalGates: number): void {
    this.definition = null
    this.detailValue = ''
    this.hudLabelValue = ''
    this.progressValue = 0
    this.completeValue = false
    this.lowLevelSeconds = 0
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
          : base.kind === 'fuel'
              ? `LAND WITH ${Math.round(target * 100)}% FUEL`
              : base.kind === 'low-level'
                ? `STAY ${Math.round(LOW_LEVEL_MIN_ALTITUDE_M)}-${Math.round(LOW_LEVEL_MAX_ALTITUDE_M)}M FOR ${Math.round(target)}S`
                : `SURVEY ${Math.round(target)} DISTINCT BIOMES`
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

  /** Update the biome-tour objective from the bounded distinct-biome count. */
  recordBiome(count: number): void {
    if (this.definition?.kind !== 'biome' || this.completeValue || !Number.isFinite(count)) return
    this.progressValue = clamp01(count / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded time in a low-altitude airborne band for the terrain-hugger contract. */
  recordLowLevel(altitudeM: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'low-level' || this.completeValue || !airborne) return
    if (!Number.isFinite(altitudeM) || !Number.isFinite(dt)) return
    const safeAltitude = Math.max(0, altitudeM)
    const safeDt = Math.max(0, Math.min(5, dt))
    if (safeAltitude < LOW_LEVEL_MIN_ALTITUDE_M || safeAltitude > LOW_LEVEL_MAX_ALTITUDE_M) return
    this.lowLevelSeconds = Math.min(this.definition.target, this.lowLevelSeconds + safeDt)
    this.progressValue = clamp01(this.lowLevelSeconds / this.definition.target)
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
  // Preserve the original five-contract mapping for existing seeds while
  // reserving deterministic slices for the terrain-hugger and biome-tour objectives.
  const legacyContractCount = CONTRACTS.length - 2
  if (mixed % 13 === 9) return CONTRACTS.length - 2
  if (mixed % 17 === 13) return CONTRACTS.length - 1
  return mixed % legacyContractCount
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
