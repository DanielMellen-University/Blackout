/** Small deterministic bonus objectives that give each sortie a second decision. */
export type SortieContractKind = 'pace' | 'altitude' | 'stunt' | 'scout' | 'fuel' | 'low-level' | 'biome' | 'speed-band' | 'weather' | 'approach' | 'water' | 'brake' | 'heat' | 'crosswind' | 'g-control' | 'deadstick' | 'front' | 'boost' | 'mach' | 'clean' | 'level' | 'tour' | 'combo' | 'precision' | 'night' | 'butter' | 'dry'

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
const SPEED_BAND_MIN_MPS = 160
const SPEED_BAND_MAX_MPS = 320
const SPEED_BAND_TARGET_SECONDS = 12
const WEATHER_TARGET_SECONDS = 14
const APPROACH_TARGET_SCORE = 360
const WATER_TARGET_SECONDS = 12
const BRAKE_MIN_MPS = 220
const BRAKE_TARGET_SECONDS = 5
const HEAT_MAX_FRACTION = 0.72
const HEAT_MIN_MPS = 180
const HEAT_TARGET_SECONDS = 12
const CROSSWIND_MIN_MPS = 10
const CROSSWIND_TARGET_SECONDS = 10
const G_CONTROL_MIN_MPS = 120
const G_CONTROL_MIN = -0.5
const G_CONTROL_MAX = 4.5
const G_CONTROL_TARGET_SECONDS = 12
const FRONT_TARGET_SECONDS = 12
const BOOST_MIN_MPS = 220
const BOOST_TARGET_SECONDS = 8
const MACH_MIN_MPS = 340
const MACH_TARGET_SECONDS = 10
const LEVEL_MIN_ALTITUDE_M = 180
const LEVEL_MAX_ALTITUDE_M = 600
const LEVEL_MAX_DRIFT_M = 24
const LEVEL_TARGET_SECONDS = 10
const SETTLEMENT_TOUR_DETAIL = 'VISIT ONE CITY AND ONE VILLAGE'
const COMBO_TARGET = 3
const COMBO_RUN_DETAIL = 'BUILD COMBO X3'
const PRECISION_CHAIN_TARGET = 3
const PRECISION_GATE_THRESHOLD = 0.82
const NIGHT_MAX_DAYLIGHT = 0.38
const NIGHT_TARGET_SECONDS = 12
const BUTTER_LANDING_THRESHOLD = 0.92
const DRY_MIN_MPS = 280
const DRY_TARGET_SECONDS = 12

const CONTRACTS: readonly Omit<SortieContractDefinition, 'detail'>[] = [
  { kind: 'pace', label: 'SPEED RUN', target: 65 },
  { kind: 'altitude', label: 'SKYLINE', target: 3_000 },
  { kind: 'stunt', label: 'AIRSHOW', target: 2 },
  { kind: 'scout', label: 'SCOUT', target: 2 },
  { kind: 'fuel', label: 'FUEL SAVER', target: 0.75 },
  { kind: 'low-level', label: 'TERRAIN HUGGER', target: LOW_LEVEL_TARGET_SECONDS },
  { kind: 'biome', label: 'BIOME TOUR', target: BIOME_TARGET_COUNT },
  { kind: 'speed-band', label: 'ENERGY BAND', target: SPEED_BAND_TARGET_SECONDS },
  { kind: 'weather', label: 'STORM RUN', target: WEATHER_TARGET_SECONDS },
  { kind: 'approach', label: 'PRECISION APPROACH', target: APPROACH_TARGET_SCORE },
  { kind: 'water', label: 'WATER RUN', target: WATER_TARGET_SECONDS },
  { kind: 'brake', label: 'BRAKE CHECK', target: BRAKE_TARGET_SECONDS },
  { kind: 'heat', label: 'THERMAL CONTROL', target: HEAT_TARGET_SECONDS },
  { kind: 'crosswind', label: 'CROSSWIND', target: CROSSWIND_TARGET_SECONDS },
  { kind: 'g-control', label: 'G CONTROL', target: G_CONTROL_TARGET_SECONDS },
  { kind: 'deadstick', label: 'DEADSTICK', target: 1 },
  { kind: 'front', label: 'FRONT CHASER', target: FRONT_TARGET_SECONDS },
  { kind: 'boost', label: 'BURN RUN', target: BOOST_TARGET_SECONDS },
  { kind: 'mach', label: 'MACH RUN', target: MACH_TARGET_SECONDS },
  { kind: 'clean', label: 'CLEAN CIRCUIT', target: 1 },
  { kind: 'level', label: 'LEVEL FLIGHT', target: LEVEL_TARGET_SECONDS },
  { kind: 'tour', label: 'SETTLEMENT TOUR', target: 2 },
  { kind: 'combo', label: 'COMBO RUN', target: COMBO_TARGET },
  { kind: 'precision', label: 'PRECISION CHAIN', target: PRECISION_CHAIN_TARGET },
  { kind: 'night', label: 'NIGHT FLIGHT', target: NIGHT_TARGET_SECONDS },
  { kind: 'butter', label: 'BUTTER LANDING', target: BUTTER_LANDING_THRESHOLD },
  { kind: 'dry', label: 'DRY RUN', target: DRY_TARGET_SECONDS },
]

/** Event-driven contract state. It owns no scene resources and allocates only at reset. */
export class SortieContractTracker {
  private definition: SortieContractDefinition | null = null
  private detailValue = ''
  private hudLabelValue = ''
  private progressValue = 0
  private completeValue = false
  private lowLevelSeconds = 0
  private speedBandSeconds = 0
  private weatherSeconds = 0
  private waterSeconds = 0
  private brakeSeconds = 0
  private heatSeconds = 0
  private crosswindSeconds = 0
  private gControlSeconds = 0
  private deadstickTriggered = false
  private frontSeconds = 0
  private boostSeconds = 0
  private machSeconds = 0
  private cleanGateCount = 0
  private cleanFailed = false
  private levelSeconds = 0
  private levelReferenceM = Number.NaN
  private visitedCity = false
  private visitedVillage = false
  private precisionStreak = 0
  private nightSeconds = 0
  private drySeconds = 0

  reset(seed: number | undefined, totalGates: number): void {
    this.definition = null
    this.detailValue = ''
    this.hudLabelValue = ''
    this.progressValue = 0
    this.completeValue = false
    this.lowLevelSeconds = 0
    this.speedBandSeconds = 0
    this.weatherSeconds = 0
    this.waterSeconds = 0
    this.brakeSeconds = 0
    this.heatSeconds = 0
    this.crosswindSeconds = 0
    this.gControlSeconds = 0
    this.deadstickTriggered = false
    this.frontSeconds = 0
    this.boostSeconds = 0
    this.machSeconds = 0
    this.cleanGateCount = 0
    this.cleanFailed = false
    this.levelSeconds = 0
    this.levelReferenceM = Number.NaN
    this.visitedCity = false
    this.visitedVillage = false
    this.precisionStreak = 0
    this.nightSeconds = 0
    this.drySeconds = 0
    if (typeof seed !== 'number' || !Number.isFinite(seed)) return

    const base = CONTRACTS[indexForSeed(seed)]!
    const safeGates = Number.isFinite(totalGates) ? Math.max(0, Math.floor(totalGates)) : 0
    // A no-miss circuit has no meaningful completion state in Free flight.
    // Leave the bonus slot empty instead of assigning an impossible task.
    if (base.kind === 'clean' && safeGates <= 0) return
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
            ? `HOLD RADIO ALT ${Math.round(LOW_LEVEL_MIN_ALTITUDE_M)}-${Math.round(LOW_LEVEL_MAX_ALTITUDE_M)}M FOR ${Math.round(target)}S`
            : base.kind === 'biome'
              ? `SURVEY ${Math.round(target)} DISTINCT BIOMES`
              : base.kind === 'speed-band'
                ? `HOLD ${Math.round(SPEED_BAND_MIN_MPS * 1.943844492)}-${Math.round(SPEED_BAND_MAX_MPS * 1.943844492)} KTS FOR ${Math.round(target)}S`
                : base.kind === 'weather'
                ? `FLY IN RAIN OR SNOW FOR ${Math.round(target)}S`
                  : base.kind === 'water'
                    ? `FLY OVER WATER FOR ${Math.round(target)}S`
                    : base.kind === 'brake'
                      ? `DEPLOY BRAKE ABOVE ${Math.round(BRAKE_MIN_MPS * 1.943844492)} KTS FOR ${Math.round(target)}S`
                      : base.kind === 'heat'
                        ? `KEEP HEAT BELOW ${Math.round(HEAT_MAX_FRACTION * 100)}% ABOVE ${Math.round(HEAT_MIN_MPS * 1.943844492)} KTS FOR ${Math.round(target)}S`
                        : base.kind === 'crosswind'
                          ? `HOLD CROSSWIND ABOVE ${Math.round(CROSSWIND_MIN_MPS * 1.943844492)} KTS FOR ${Math.round(target)}S`
                        : base.kind === 'g-control'
                          ? `HOLD ${Math.round(G_CONTROL_MIN_MPS * 1.943844492)}+ KTS BETWEEN ${G_CONTROL_MIN}G AND ${G_CONTROL_MAX}G FOR ${Math.round(target)}S`
                        : base.kind === 'deadstick'
                          ? 'GLIDE TO BASE AFTER FUEL OUT'
                        : base.kind === 'front'
                          ? `FLY DURING WEATHER SHIFT FOR ${Math.round(target)}S`
                        : base.kind === 'boost'
                          ? `HOLD AFTERBURNER ABOVE ${Math.round(BOOST_MIN_MPS * 1.943844492)} KTS FOR ${Math.round(target)}S`
                        : base.kind === 'mach'
                          ? `BREAK MACH 1 FOR ${Math.round(target)}S`
                        : base.kind === 'clean'
                          ? 'CLEAR EVERY GATE WITHOUT A MISS'
                        : base.kind === 'level'
                          ? `HOLD ${Math.round(LEVEL_MIN_ALTITUDE_M)}-${Math.round(LEVEL_MAX_ALTITUDE_M)}M WITHIN +/-${Math.round(LEVEL_MAX_DRIFT_M)}M FOR ${Math.round(target)}S`
                        : base.kind === 'tour'
                          ? SETTLEMENT_TOUR_DETAIL
                        : base.kind === 'combo'
                          ? COMBO_RUN_DETAIL
                        : base.kind === 'precision'
                          ? `CLEAR ${Math.round(target)} PERFECT GATES IN A ROW`
                        : base.kind === 'night'
                          ? `FLY AFTER DARK FOR ${Math.round(target)}S`
                        : base.kind === 'butter'
                          ? 'LAND WITH A BUTTER TOUCHDOWN'
                        : base.kind === 'dry'
                          ? `HOLD DRY POWER ABOVE ${Math.round(DRY_MIN_MPS * 1.943844492)} KTS FOR ${Math.round(target)}S`
                        : 'LAND CENTERED AND ALIGNED'
    this.definition = { ...base, target, detail }
    this.detailValue = base.kind === 'tour'
      ? settlementTourDetail(false, false)
      : base.kind === 'combo'
        ? comboRunDetail(0)
        : detail
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

  recordDestination(count: number, kind?: 'city' | 'village'): void {
    if (this.completeValue) return
    if (this.definition?.kind === 'scout') {
      if (!Number.isFinite(count)) return
      this.progressValue = clamp01(count / this.definition.target)
      if (this.progressValue >= 1) this.completeValue = true
      return
    }
    if (this.definition?.kind !== 'tour' || (kind !== 'city' && kind !== 'village')) return
    if (kind === 'city') this.visitedCity = true
    if (kind === 'village') this.visitedVillage = true
    this.detailValue = settlementTourDetail(this.visitedCity, this.visitedVillage)
    this.progressValue = (this.visitedCity ? 0.5 : 0) + (this.visitedVillage ? 0.5 : 0)
    if (this.visitedCity && this.visitedVillage) this.completeValue = true
  }

  /** Turn the existing gate-and-stunt chain into a bounded arcade objective. */
  recordCombo(combo: number): void {
    if (this.definition?.kind !== 'combo' || this.completeValue || !Number.isFinite(combo)) return
    const safeCombo = Math.max(0, Math.floor(combo))
    this.detailValue = comboRunDetail(safeCombo)
    this.progressValue = clamp01(safeCombo / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Turn the existing high-center gate streak into a bounded precision objective. */
  recordPrecisionGate(quality: number): void {
    if (this.definition?.kind !== 'precision' || this.completeValue || !Number.isFinite(quality)) return
    this.precisionStreak = quality >= PRECISION_GATE_THRESHOLD
      ? Math.min(this.definition.target, this.precisionStreak + 1)
      : 0
    this.progressValue = clamp01(this.precisionStreak / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded airborne time through the existing dusk and night envelope. */
  recordNight(daylight: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'night' || this.completeValue || !airborne) return
    if (!Number.isFinite(daylight) || !Number.isFinite(dt)) return
    const safeDaylight = Math.max(0, Math.min(1, daylight))
    if (safeDaylight > NIGHT_MAX_DAYLIGHT) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.nightSeconds = Math.min(this.definition.target, this.nightSeconds + safeDt)
    this.progressValue = clamp01(this.nightSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded high-speed airborne time without afterburner. */
  recordDry(afterburner: boolean, speedMps: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'dry' || this.completeValue || !airborne || afterburner === true) return
    if (!Number.isFinite(speedMps) || !Number.isFinite(dt)) return
    if (Math.max(0, speedMps) < DRY_MIN_MPS) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.drySeconds = Math.min(this.definition.target, this.drySeconds + safeDt)
    this.progressValue = clamp01(this.drySeconds / this.definition.target)
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

  /** Accumulate bounded airborne time inside a forgiving cruise-speed band. */
  recordSpeedBand(speedMps: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'speed-band' || this.completeValue || !airborne) return
    if (!Number.isFinite(speedMps) || !Number.isFinite(dt)) return
    const safeSpeed = Math.max(0, speedMps)
    const safeDt = Math.max(0, Math.min(5, dt))
    if (safeSpeed < SPEED_BAND_MIN_MPS || safeSpeed > SPEED_BAND_MAX_MPS) return
    this.speedBandSeconds = Math.min(this.definition.target, this.speedBandSeconds + safeDt)
    this.progressValue = clamp01(this.speedBandSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded airborne time while precipitation is meaningfully active. */
  recordWeather(rain: number, snow: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'weather' || this.completeValue || !airborne) return
    if (!Number.isFinite(rain) || !Number.isFinite(snow) || !Number.isFinite(dt)) return
    const active = Math.max(0, Math.min(1, Math.max(rain, snow))) >= 0.25
    if (!active) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.weatherSeconds = Math.min(this.definition.target, this.weatherSeconds + safeDt)
    this.progressValue = clamp01(this.weatherSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded airborne time over the rendered water surface. */
  recordWater(isWater: boolean, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'water' || this.completeValue || !airborne || isWater !== true) return
    if (!Number.isFinite(dt)) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.waterSeconds = Math.min(this.definition.target, this.waterSeconds + safeDt)
    this.progressValue = clamp01(this.waterSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded high-speed time with the pilot's speed brake deployed. */
  recordBrake(speedMps: number, dt: number, active: boolean, airborne = true): void {
    if (this.definition?.kind !== 'brake' || this.completeValue || !airborne || active !== true) return
    if (!Number.isFinite(speedMps) || !Number.isFinite(dt)) return
    if (Math.max(0, speedMps) < BRAKE_MIN_MPS) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.brakeSeconds = Math.min(this.definition.target, this.brakeSeconds + safeDt)
    this.progressValue = clamp01(this.brakeSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded high-speed time while engine heat stays controlled. */
  recordHeat(heatFraction: number, speedMps: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'heat' || this.completeValue || !airborne) return
    if (!Number.isFinite(heatFraction) || !Number.isFinite(speedMps) || !Number.isFinite(dt)) return
    if (Math.max(0, speedMps) < HEAT_MIN_MPS || Math.max(0, heatFraction) > HEAT_MAX_FRACTION) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.heatSeconds = Math.min(this.definition.target, this.heatSeconds + safeDt)
    this.progressValue = clamp01(this.heatSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded airborne time while handling meaningful crosswind. */
  recordCrosswind(crosswindMps: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'crosswind' || this.completeValue || !airborne) return
    if (!Number.isFinite(crosswindMps) || !Number.isFinite(dt)) return
    if (Math.max(0, crosswindMps) < CROSSWIND_MIN_MPS) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.crosswindSeconds = Math.min(this.definition.target, this.crosswindSeconds + safeDt)
    this.progressValue = clamp01(this.crosswindSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded airborne time inside a controllable high-speed G envelope. */
  recordGControl(loadFactor: number, speedMps: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'g-control' || this.completeValue || !airborne) return
    if (!Number.isFinite(loadFactor) || !Number.isFinite(speedMps) || !Number.isFinite(dt)) return
    const safeLoad = loadFactor
    if (Math.max(0, speedMps) < G_CONTROL_MIN_MPS || safeLoad < G_CONTROL_MIN || safeLoad > G_CONTROL_MAX) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.gControlSeconds = Math.min(this.definition.target, this.gControlSeconds + safeDt)
    this.progressValue = clamp01(this.gControlSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Complete only after an airborne sortie actually runs the tank dry. */
  recordDeadstick(fuelFraction: number, airborne = true): void {
    if (this.definition?.kind !== 'deadstick' || this.completeValue || !airborne || this.deadstickTriggered) return
    if (!Number.isFinite(fuelFraction) || fuelFraction > 0.0001) return
    this.deadstickTriggered = true
    this.progressValue = 1
    this.completeValue = true
  }

  /** Accumulate bounded airborne time while an existing weather front shifts. */
  recordFront(transitioning: boolean, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'front' || this.completeValue || !airborne || transitioning !== true) return
    if (!Number.isFinite(dt)) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.frontSeconds = Math.min(this.definition.target, this.frontSeconds + safeDt)
    this.progressValue = clamp01(this.frontSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded airborne time with afterburner active at high speed. */
  recordBoost(active: boolean, speedMps: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'boost' || this.completeValue || !airborne || active !== true) return
    if (!Number.isFinite(speedMps) || !Number.isFinite(dt)) return
    if (Math.max(0, speedMps) < BOOST_MIN_MPS) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.boostSeconds = Math.min(this.definition.target, this.boostSeconds + safeDt)
    this.progressValue = clamp01(this.boostSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded airborne time above the supersonic threshold. */
  recordMach(speedMps: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'mach' || this.completeValue || !airborne) return
    if (!Number.isFinite(speedMps) || !Number.isFinite(dt)) return
    if (Math.max(0, speedMps) < MACH_MIN_MPS) return
    const safeDt = Math.max(0, Math.min(5, dt))
    this.machSeconds = Math.min(this.definition.target, this.machSeconds + safeDt)
    this.progressValue = clamp01(this.machSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Accumulate bounded airborne time while holding a forgiving altitude window. */
  recordLevelFlight(altitudeM: number, dt: number, airborne = true): void {
    if (this.definition?.kind !== 'level' || this.completeValue || !airborne) return
    if (!Number.isFinite(altitudeM) || !Number.isFinite(dt)) return
    const safeAltitude = Math.max(0, altitudeM)
    const safeDt = Math.max(0, Math.min(5, dt))
    if (safeAltitude < LEVEL_MIN_ALTITUDE_M || safeAltitude > LEVEL_MAX_ALTITUDE_M) {
      this.levelSeconds = 0
      this.levelReferenceM = Number.NaN
      this.progressValue = 0
      return
    }
    if (!Number.isFinite(this.levelReferenceM)) this.levelReferenceM = safeAltitude
    if (Math.abs(safeAltitude - this.levelReferenceM) > LEVEL_MAX_DRIFT_M) {
      this.levelSeconds = 0
      this.levelReferenceM = safeAltitude
      this.progressValue = 0
      return
    }
    this.levelSeconds = Math.min(this.definition.target, this.levelSeconds + safeDt)
    this.progressValue = clamp01(this.levelSeconds / this.definition.target)
    if (this.progressValue >= 1) this.completeValue = true
  }

  /** Track a no-miss circuit objective without adding mission state. */
  recordCleanGate(missed: boolean, passed: number, total: number): void {
    if (this.definition?.kind !== 'clean' || this.completeValue || this.cleanFailed) return
    if (missed === true) {
      this.cleanFailed = true
      this.progressValue = 0
      return
    }
    if (!Number.isFinite(passed) || !Number.isFinite(total) || total <= 0) return
    this.cleanGateCount = Math.max(this.cleanGateCount, Math.min(total, Math.floor(passed)))
    this.progressValue = clamp01(this.cleanGateCount / total)
    if (this.cleanGateCount >= total) this.completeValue = true
  }

  /** Resolve contracts whose success depends on the final touchdown telemetry. */
  finish(elapsedSec: number, fuelFraction: number, approachScore = 0, landingQuality = 0): number {
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
    } else if (this.definition.kind === 'approach') {
      const safeApproach = Number.isFinite(approachScore) ? Math.max(0, approachScore) : 0
      this.completeValue = safeApproach >= this.definition.target
      this.progressValue = clamp01(safeApproach / this.definition.target)
    } else if (this.definition.kind === 'butter') {
      const safeQuality = Number.isFinite(landingQuality) ? clamp01(landingQuality) : 0
      this.completeValue = safeQuality >= this.definition.target
      this.progressValue = clamp01(safeQuality / this.definition.target)
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

  get failed(): boolean {
    return this.cleanFailed
  }
}

function indexForSeed(seed: number): number {
  const safe = Math.trunc(seed)
  const mixed = (safe ^ (safe >>> 16) ^ Math.imul(safe, 0x45d9f3b)) >>> 0
  // Preserve the original five-contract mapping for existing seeds while
  // reserving deterministic slices for terrain-hugger, biome-tour,
  // energy-band, storm-run, precision-approach, brake-check, thermal-control,
  // crosswind, G-control, deadstick, weather-front, afterburner, Mach, and
  // no-miss circuit, level-flight, settlement-tour, combo, precision,
  // night-flight, butter-landing, and dry-run objectives.
  const legacyContractCount = 5
  if (mixed % 13 === 9) return 5
  if (mixed % 17 === 13) return 6
  if (mixed % 19 === 7) return 7
  if (mixed % 23 === 11) return 8
  if (mixed % 29 === 17) return 9
  if (mixed % 37 === 19) return 10
  if (mixed % 41 === 23) return 11
  if (mixed % 43 === 31) return 12
  if (mixed % 47 === 37) return 13
  if (mixed % 53 === 41) return 14
  if (mixed % 59 === 47) return 15
  if (mixed % 67 === 53) return 16
  if (mixed % 71 === 61) return 17
  if (mixed % 73 === 23) return 18
  if (mixed % 79 === 29) return 19
  if (mixed % 83 === 71) return 20
  if (mixed % 89 === 7) return 21
  if (mixed % 97 === 13) return 22
  if (mixed % 101 === 17) return 23
  if (mixed % 107 === 31) return 24
  if (mixed % 109 === 47) return 25
  if (mixed % 113 === 67) return 26
  return mixed % legacyContractCount
}

/** Preview the deterministic contract on a seeded course without creating tracker state. */
export function sortieContractLabelForSeed(seed: number | undefined, totalGates = 5): string {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) return ''
  const safeGates = Number.isFinite(totalGates) ? Math.max(0, Math.floor(totalGates)) : 0
  const contract = CONTRACTS[indexForSeed(seed)]
  if (!contract || (contract.kind === 'clean' && safeGates <= 0)) return ''
  return contract.label
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function settlementTourDetail(city: boolean, village: boolean): string {
  return `${SETTLEMENT_TOUR_DETAIL} / CITY ${city ? 'OK' : 'OPEN'} / VILLAGE ${village ? 'OK' : 'OPEN'}`
}

function comboRunDetail(combo: number): string {
  return `${COMBO_RUN_DETAIL} / CURRENT X${Math.max(0, Math.min(COMBO_TARGET, combo))}`
}
