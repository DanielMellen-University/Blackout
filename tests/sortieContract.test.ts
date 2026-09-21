import { describe, expect, it } from 'vitest'
import {
  MAX_CONTRACT_SCORE,
  SortieContractTracker,
  sortieContractDetailForSeed,
  sortieContractLabelForSeed,
  type SortieContractKind,
} from '../src/systems/SortieContract'

describe('sortie contracts', () => {
  it('previews deterministic seeded tasks without assigning Free flight a contract', () => {
    expect(sortieContractLabelForSeed(undefined)).toBe('')
    expect(sortieContractLabelForSeed(42)).toBe('BIOME TOUR')
    expect(sortieContractDetailForSeed(42)).toBe('SURVEY 4 DISTINCT BIOMES')
    expect(sortieContractDetailForSeed(undefined)).toBe('')
    expect(sortieContractLabelForSeed(42)).toBe(sortieContractLabelForSeed(42))
  })

  it('assigns a deterministic contract without allocating runtime state', () => {
    const first = new SortieContractTracker()
    const second = new SortieContractTracker()
    first.reset(42, 5)
    second.reset(42, 5)
    expect(first.enabled).toBe(true)
    expect(first.kind).toBe(second.kind)
    expect(first.label).toBe(second.label)
    expect(first.detail).toBe(second.detail)
    expect(first.progress).toBe(0)
    expect(first.complete).toBe(false)

    const disabled = new SortieContractTracker()
    disabled.reset(undefined, 5)
    expect(disabled.enabled).toBe(false)
    expect(disabled.hudLabel).toBe('')
    expect(disabled.finish(0, 1)).toBe(0)
  })

  it('covers every contract kind with bounded event and touchdown completion', () => {
    const kinds = new Set<SortieContractKind>()
    for (let seed = 0; seed < 512; seed += 1) {
      const tracker = new SortieContractTracker()
      tracker.reset(seed, 5)
      if (!tracker.kind) continue
      kinds.add(tracker.kind)
      if (tracker.kind === 'altitude') tracker.recordAltitude(99_999)
      if (tracker.kind === 'stunt') tracker.recordStunt(99)
      if (tracker.kind === 'scout') tracker.recordDestination(99)
      if (tracker.kind === 'tour') {
        tracker.recordDestination(1, 'city')
        tracker.recordDestination(2, 'village')
      }
      if (tracker.kind === 'combo') tracker.recordCombo(3)
      if (tracker.kind === 'precision') {
        tracker.recordPrecisionGate(0.9)
        tracker.recordPrecisionGate(0.9)
        tracker.recordPrecisionGate(0.9)
      }
      if (tracker.kind === 'night') {
        tracker.recordNight(0.8, 5)
        tracker.recordNight(0.2, 5)
        tracker.recordNight(0.2, 5)
        tracker.recordNight(0.2, 2)
      }
      if (tracker.kind === 'dry') {
        tracker.recordDry(false, 300, 5, false)
        tracker.recordDry(true, 300, 5)
        tracker.recordDry(false, 240, 5)
        tracker.recordDry(false, 300, 5)
        tracker.recordDry(false, 300, 5)
        tracker.recordDry(false, 300, 5)
      }
      if (tracker.kind === 'target') {
        tracker.recordDestination(1, 'city', 'city-1')
        tracker.recordRadarLock(true, 'city', 'city-1')
        tracker.recordDestination(1, 'city', 'city-1')
      }
      if (tracker.kind === 'gust') {
        tracker.recordGust(0.8, 5, false)
        tracker.recordGust(0.4, 5)
        tracker.recordGust(0.8, 5)
        tracker.recordGust(0.8, 5)
      }
      if (tracker.kind === 'range') {
        tracker.recordDistance(5_000, false)
        tracker.recordDistance(5_000)
        tracker.recordDistance(7_000)
      }
      if (tracker.kind === 'high-dive') {
        tracker.recordHighDive(1_800, false)
        tracker.recordHighDive(1_800)
        tracker.recordHighDive(421)
        tracker.recordHighDive(420)
      }
      if (tracker.kind === 'water-skim') {
        tracker.recordWaterSkim(true, 18, 5, false)
        tracker.recordWaterSkim(false, 80, 5)
        tracker.recordWaterSkim(true, 181, 5)
        tracker.recordWaterSkim(true, 80, 5)
        tracker.recordWaterSkim(true, 80, 3)
      }
      if (tracker.kind === 'low-level') {
        tracker.recordLowLevel(180, 5)
        tracker.recordLowLevel(180, 5)
      }
      if (tracker.kind === 'biome') tracker.recordBiome(99)
      if (tracker.kind === 'speed-band') {
        tracker.recordSpeedBand(220, 5)
        tracker.recordSpeedBand(220, 5)
        tracker.recordSpeedBand(220, 5)
      }
      if (tracker.kind === 'weather') {
        tracker.recordWeather(0.5, 0, 5)
        tracker.recordWeather(0, 0.7, 5)
        tracker.recordWeather(0.6, 0, 5)
      }
      if (tracker.kind === 'water') {
        tracker.recordWater(true, 5, false)
        tracker.recordWater(false, 5)
        tracker.recordWater(true, 5)
        tracker.recordWater(true, 5)
        tracker.recordWater(true, 5)
      }
      if (tracker.kind === 'brake') {
        tracker.recordBrake(240, 5, false)
        tracker.recordBrake(120, 5, true)
        tracker.recordBrake(240, 5, true)
      }
      if (tracker.kind === 'heat') {
        tracker.recordHeat(0.5, 220, 5, false)
        tracker.recordHeat(0.9, 220, 5)
        tracker.recordHeat(0.5, 120, 5)
        tracker.recordHeat(0.5, 220, 5)
        tracker.recordHeat(0.5, 220, 5)
        tracker.recordHeat(0.5, 220, 5)
      }
      if (tracker.kind === 'crosswind') {
        tracker.recordCrosswind(12, 5, false)
        tracker.recordCrosswind(4, 5)
        tracker.recordCrosswind(12, 5)
        tracker.recordCrosswind(12, 5)
      }
      if (tracker.kind === 'g-control') {
        tracker.recordGControl(2, 180, 5, false)
        tracker.recordGControl(5, 180, 5)
        tracker.recordGControl(2, 90, 5)
        tracker.recordGControl(2, 180, 5)
        tracker.recordGControl(2, 180, 5)
        tracker.recordGControl(2, 180, 5)
      }
      if (tracker.kind === 'deadstick') tracker.recordDeadstick(0, true)
      if (tracker.kind === 'front') {
        tracker.recordFront(true, 5, false)
        tracker.recordFront(false, 5)
        tracker.recordFront(true, 5)
        tracker.recordFront(true, 5)
        tracker.recordFront(true, 5)
      }
      if (tracker.kind === 'boost') {
        tracker.recordBoost(true, 260, 5, false)
        tracker.recordBoost(false, 260, 5)
        tracker.recordBoost(true, 180, 5)
        tracker.recordBoost(true, 260, 4)
        tracker.recordBoost(true, 260, 5)
      }
      if (tracker.kind === 'mach') {
        tracker.recordMach(360, 5, false)
        tracker.recordMach(300, 5)
        tracker.recordMach(360, 4)
        tracker.recordMach(360, 5)
        tracker.recordMach(360, 5)
      }
      if (tracker.kind === 'clean') {
        tracker.recordCleanGate(false, 1, 5)
        tracker.recordCleanGate(false, 5, 5)
      }
      if (tracker.kind === 'level') {
        tracker.recordLevelFlight(180, 5, false)
        tracker.recordLevelFlight(180, 5)
        tracker.recordLevelFlight(198, 5)
      }
      const score = tracker.finish(
        0,
        1,
        tracker.kind === 'approach' ? 500 : 0,
        tracker.kind === 'butter' ? 1 : 0,
      )
      expect(tracker.complete).toBe(true)
      expect(tracker.progress).toBe(1)
      expect(score).toBe(MAX_CONTRACT_SCORE)
    }
    expect(kinds).toEqual(new Set(['pace', 'altitude', 'stunt', 'scout', 'fuel', 'low-level', 'biome', 'speed-band', 'weather', 'approach', 'water', 'brake', 'heat', 'crosswind', 'g-control', 'deadstick', 'front', 'boost', 'mach', 'clean', 'level', 'tour', 'combo', 'precision', 'night', 'butter', 'dry', 'target', 'gust', 'range', 'high-dive', 'water-skim']))
  })

  it('accumulates only low airborne passes over water for WATER SKIM', () => {
    const tracker = new SortieContractTracker()
    let skimSeed = -1
    for (let seed = 0; seed < 4_096; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'water-skim') {
        skimSeed = seed
        break
      }
    }
    expect(skimSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(skimSeed, 5)
    expect(tracker.label).toBe('WATER SKIM')
    expect(tracker.detail).toBe('SKIM WATER AT 18-180M FOR 8S')
    tracker.recordWaterSkim(true, 80, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordWaterSkim(false, 80, 5)
    tracker.recordWaterSkim(true, 17, 5)
    tracker.recordWaterSkim(true, 181, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordWaterSkim(true, 80, 3)
    expect(tracker.progress).toBeCloseTo(3 / 8)
    expect(tracker.detail).toContain('CURRENT 3S')
    tracker.recordWaterSkim(true, 80, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('requires a high climb before the recovery dive can complete', () => {
    const tracker = new SortieContractTracker()
    let highDiveSeed = -1
    for (let seed = 0; seed < 4_096; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'high-dive') {
        highDiveSeed = seed
        break
      }
    }
    expect(highDiveSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(highDiveSeed, 5)
    expect(tracker.label).toBe('HIGH DIVE')
    expect(tracker.detail).toBe('REACH 1,800M THEN RECOVER BELOW 420M')
    tracker.recordHighDive(1_800, false)
    expect(tracker.progress).toBe(0)
    tracker.recordHighDive(1_799)
    expect(tracker.progress).toBe(0)
    tracker.recordHighDive(1_800)
    expect(tracker.progress).toBe(0.5)
    tracker.recordHighDive(421)
    expect(tracker.complete).toBe(false)
    tracker.recordHighDive(420)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time through strong gusts', () => {
    const tracker = new SortieContractTracker()
    let gustSeed = -1
    for (let seed = 0; seed < 4_096; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'gust') {
        gustSeed = seed
        break
      }
    }
    expect(gustSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(gustSeed, 5)
    expect(tracker.label).toBe('GUST RIDER')
    tracker.recordGust(0.8, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordGust(0.4, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordGust(0.8, 4)
    expect(tracker.progress).toBeCloseTo(0.4)
    expect(tracker.detail).toContain('CURRENT 4.0S')
    tracker.recordGust(0.8, 6)
    tracker.recordGust(0.8, 1)
    expect(tracker.complete).toBe(true)
    expect(tracker.detail).toContain('CURRENT 10.0S')
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne distance for the range-run contract', () => {
    const tracker = new SortieContractTracker()
    let rangeSeed = -1
    for (let seed = 0; seed < 4_096; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'range') {
        rangeSeed = seed
        break
      }
    }
    expect(rangeSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(rangeSeed, 5)
    expect(tracker.label).toBe('RANGE RUN')
    tracker.recordDistance(5_000, false)
    expect(tracker.progress).toBe(0)
    tracker.recordDistance(Number.NaN)
    expect(tracker.progress).toBe(0)
    tracker.recordDistance(5_000)
    expect(tracker.progress).toBeCloseTo(5 / 12)
    expect(tracker.detail).toContain('CURRENT 5.0KM')
    tracker.recordDistance(7_000)
    expect(tracker.complete).toBe(true)
    expect(tracker.detail).toContain('CURRENT 12.0KM')
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('requires a radar lock before a target arrival can complete the contract', () => {
    const tracker = new SortieContractTracker()
    let targetSeed = -1
    for (let seed = 0; seed < 4_096; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'target') {
        targetSeed = seed
        break
      }
    }
    expect(targetSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(targetSeed, 5)
    expect(tracker.label).toBe('RADAR RUN')
    expect(tracker.detail).toBe('LOCK ONE RADAR CONTACT THEN ARRIVE')
    tracker.recordDestination(1, 'city', 'city-1')
    expect(tracker.complete).toBe(false)
    expect(tracker.progress).toBe(0)
    tracker.recordRadarLock(false, 'city', 'city-1')
    expect(tracker.progress).toBe(0)
    tracker.recordRadarLock(true, 'city', 'city-1')
    expect(tracker.progress).toBeCloseTo(0.5)
    tracker.recordDestination(1, 'village', 'village-1')
    expect(tracker.complete).toBe(false)
    tracker.recordDestination(1, 'city', 'city-2')
    expect(tracker.complete).toBe(false)
    tracker.recordDestination(1, 'city', 'city-1')
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time through the dusk envelope', () => {
    const tracker = new SortieContractTracker()
    let nightSeed = -1
    for (let seed = 0; seed < 2_048; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'night') {
        nightSeed = seed
        break
      }
    }
    expect(nightSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(nightSeed, 5)
    tracker.recordNight(0.2, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordNight(0.5, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordNight(0.2, 5)
    expect(tracker.progress).toBeCloseTo(5 / 12)
    tracker.recordNight(0.2, 7)
    tracker.recordNight(0.2, 2)
    expect(tracker.complete).toBe(true)
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time inside the terrain-hugger band', () => {
    const tracker = new SortieContractTracker()
    tracker.reset(11, 5)
    expect(tracker.kind).toBe('low-level')
    tracker.recordLowLevel(18, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordLowLevel(180, 4, false)
    expect(tracker.progress).toBe(0)
    tracker.recordLowLevel(180, 4)
    expect(tracker.progress).toBeCloseTo(0.4)
    expect(tracker.detail).toContain('CURRENT 4S')
    tracker.recordLowLevel(480, 10)
    expect(tracker.complete).toBe(false)
    tracker.recordLowLevel(180, 5)
    tracker.recordLowLevel(180, 1)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('turns distinct biome progress into a bounded biome-tour reward', () => {
    const tracker = new SortieContractTracker()
    tracker.reset(8, 5)
    expect(tracker.kind).toBe('biome')
    tracker.recordBiome(1)
    expect(tracker.progress).toBeCloseTo(0.25)
    expect(tracker.detail).toContain('CURRENT 1 BIOMES')
    tracker.recordBiome(3)
    expect(tracker.complete).toBe(false)
    tracker.recordBiome(4)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time inside the energy speed band', () => {
    const tracker = new SortieContractTracker()
    let speedBandSeed = -1
    for (let seed = 0; seed < 256; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'speed-band') {
        speedBandSeed = seed
        break
      }
    }
    expect(speedBandSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(speedBandSeed, 5)
    tracker.recordSpeedBand(220, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordSpeedBand(120, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordSpeedBand(220, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordSpeedBand(220, 5)
    tracker.recordSpeedBand(220, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time during meaningful precipitation', () => {
    const tracker = new SortieContractTracker()
    let weatherSeed = -1
    for (let seed = 0; seed < 512; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'weather') {
        weatherSeed = seed
        break
      }
    }
    expect(weatherSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(weatherSeed, 5)
    tracker.recordWeather(0.8, 0, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordWeather(0.1, 0.1, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordWeather(0.35, 0, 4)
    expect(tracker.progress).toBeCloseTo(4 / 14)
    tracker.recordWeather(0, 0.8, 5)
    tracker.recordWeather(0.8, 0, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time over rendered water', () => {
    const tracker = new SortieContractTracker()
    let waterSeed = -1
    for (let seed = 0; seed < 512; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'water') {
        waterSeed = seed
        break
      }
    }
    expect(waterSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(waterSeed, 5)
    tracker.recordWater(true, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordWater(false, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordWater(true, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordWater(true, 5)
    tracker.recordWater(true, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('turns centered touchdown quality into a precision-approach contract', () => {
    const tracker = new SortieContractTracker()
    let approachSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'approach') {
        approachSeed = seed
        break
      }
    }
    expect(approachSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(approachSeed, 5)
    expect(tracker.label).toBe('PRECISION APPROACH')
    expect(tracker.detail).toBe('LAND CENTERED AND ALIGNED')
    expect(tracker.finish(99, 1, 359)).toBe(0)
    expect(tracker.complete).toBe(false)
    expect(tracker.progress).toBeCloseTo(359 / 360)
    expect(tracker.finish(99, 1, 500)).toBe(MAX_CONTRACT_SCORE)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
  })

  it('accumulates only high-speed airborne time with the speed brake open', () => {
    const tracker = new SortieContractTracker()
    let brakeSeed = -1
    for (let seed = 0; seed < 512; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'brake') {
        brakeSeed = seed
        break
      }
    }
    expect(brakeSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(brakeSeed, 5)
    tracker.recordBrake(240, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordBrake(120, 5, true)
    expect(tracker.progress).toBe(0)
    tracker.recordBrake(240, 2, true, false)
    expect(tracker.progress).toBe(0)
    tracker.recordBrake(240, 2, true)
    expect(tracker.progress).toBeCloseTo(0.4)
    tracker.recordBrake(240, 3, true)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only controlled engine heat at cruise speed', () => {
    const tracker = new SortieContractTracker()
    let heatSeed = -1
    for (let seed = 0; seed < 512; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'heat') {
        heatSeed = seed
        break
      }
    }
    expect(heatSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(heatSeed, 5)
    tracker.recordHeat(0.5, 220, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordHeat(0.9, 220, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordHeat(0.5, 120, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordHeat(0.5, 220, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordHeat(0.5, 220, 5)
    tracker.recordHeat(0.5, 220, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time through meaningful crosswind', () => {
    const tracker = new SortieContractTracker()
    let crosswindSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'crosswind') {
        crosswindSeed = seed
        break
      }
    }
    expect(crosswindSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(crosswindSeed, 5)
    expect(tracker.label).toBe('CROSSWIND')
    tracker.recordCrosswind(12, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordCrosswind(8, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordCrosswind(12, 4)
    expect(tracker.progress).toBeCloseTo(0.4)
    tracker.recordCrosswind(12, 5)
    tracker.recordCrosswind(12, 1)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only high-speed time inside the G-control envelope', () => {
    const tracker = new SortieContractTracker()
    let gControlSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'g-control') {
        gControlSeed = seed
        break
      }
    }
    expect(gControlSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(gControlSeed, 5)
    expect(tracker.label).toBe('G CONTROL')
    tracker.recordGControl(2, 180, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordGControl(5, 180, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordGControl(2, 90, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordGControl(2, 180, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordGControl(2, 180, 5)
    tracker.recordGControl(2, 180, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    tracker.finish(99, 0)
    expect(tracker.complete).toBe(true)
  })

  it('keeps the deadstick contract open until an airborne fuel-out', () => {
    const tracker = new SortieContractTracker()
    let deadstickSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'deadstick') {
        deadstickSeed = seed
        break
      }
    }
    expect(deadstickSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(deadstickSeed, 5)
    expect(tracker.label).toBe('DEADSTICK')
    tracker.recordDeadstick(0, false)
    expect(tracker.complete).toBe(false)
    tracker.recordDeadstick(0.01, true)
    expect(tracker.complete).toBe(false)
    tracker.recordDeadstick(0, true)
    expect(tracker.progress).toBe(1)
    expect(tracker.complete).toBe(true)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time during a weather-front shift', () => {
    const tracker = new SortieContractTracker()
    let frontSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'front') {
        frontSeed = seed
        break
      }
    }
    expect(frontSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(frontSeed, 5)
    expect(tracker.label).toBe('FRONT CHASER')
    tracker.recordFront(true, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordFront(false, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordFront(true, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordFront(true, 5)
    tracker.recordFront(true, 3)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only high-speed airborne time with afterburner active', () => {
    const tracker = new SortieContractTracker()
    let boostSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'boost') {
        boostSeed = seed
        break
      }
    }
    expect(boostSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(boostSeed, 5)
    expect(tracker.label).toBe('BURN RUN')
    tracker.recordBoost(true, 260, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordBoost(false, 260, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordBoost(true, 180, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordBoost(true, 260, 3)
    expect(tracker.progress).toBeCloseTo(3 / 8)
    tracker.recordBoost(true, 260, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('accumulates only airborne time above the supersonic threshold', () => {
    const tracker = new SortieContractTracker()
    let machSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'mach') {
        machSeed = seed
        break
      }
    }
    expect(machSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(machSeed, 5)
    expect(tracker.label).toBe('MACH RUN')
    tracker.recordMach(360, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordMach(300, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordMach(360, 4)
    expect(tracker.progress).toBeCloseTo(0.4)
    tracker.recordMach(360, 5)
    tracker.recordMach(360, 1)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 0)).toBe(MAX_CONTRACT_SCORE)
  })

  it('fails the clean-circuit contract permanently after a gate miss', () => {
    const tracker = new SortieContractTracker()
    let cleanSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'clean') {
        cleanSeed = seed
        break
      }
    }
    expect(cleanSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(cleanSeed, 5)
    expect(tracker.label).toBe('CLEAN CIRCUIT')
    tracker.recordCleanGate(false, 2, 5)
    expect(tracker.progress).toBeCloseTo(0.4)
    tracker.recordCleanGate(true, 2, 5)
    expect(tracker.failed).toBe(true)
    expect(tracker.complete).toBe(false)
    tracker.recordCleanGate(false, 5, 5)
    expect(tracker.complete).toBe(false)
    expect(tracker.finish(99, 1)).toBe(0)
  })

  it('requires a stable altitude window for level flight', () => {
    const tracker = new SortieContractTracker()
    let levelSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'level') {
        levelSeed = seed
        break
      }
    }
    expect(levelSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(levelSeed, 5)
    expect(tracker.label).toBe('LEVEL FLIGHT')
    expect(tracker.detail).toContain('WITHIN +/-24M')
    tracker.recordLevelFlight(180, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordLevelFlight(120, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordLevelFlight(300, 5)
    expect(tracker.progress).toBeCloseTo(0.5)
    tracker.recordLevelFlight(340, 1)
    expect(tracker.progress).toBe(0)
    tracker.recordLevelFlight(340, 5)
    expect(tracker.progress).toBeCloseTo(0.5)
    tracker.recordLevelFlight(322, 5)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('requires both settlement tiers for a settlement tour', () => {
    const tracker = new SortieContractTracker()
    let tourSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'tour') {
        tourSeed = seed
        break
      }
    }
    expect(tourSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(tourSeed, 5)
    expect(tracker.label).toBe('SETTLEMENT TOUR')
    expect(tracker.detail).toBe('VISIT ONE CITY AND ONE VILLAGE / CITY OPEN / VILLAGE OPEN')
    tracker.recordDestination(1, 'city')
    expect(tracker.progress).toBeCloseTo(0.5)
    expect(tracker.detail).toBe('VISIT ONE CITY AND ONE VILLAGE / CITY OK / VILLAGE OPEN')
    tracker.recordDestination(2, 'city')
    expect(tracker.progress).toBeCloseTo(0.5)
    tracker.recordDestination(2, 'village')
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.detail).toBe('VISIT ONE CITY AND ONE VILLAGE / CITY OK / VILLAGE OK')
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('turns the existing combo chain into a bounded contract', () => {
    const tracker = new SortieContractTracker()
    let comboSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'combo') {
        comboSeed = seed
        break
      }
    }
    expect(comboSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(comboSeed, 5)
    expect(tracker.label).toBe('COMBO RUN')
    expect(tracker.detail).toBe('BUILD COMBO X3 / CURRENT X0')
    tracker.recordCombo(2)
    expect(tracker.progress).toBeCloseTo(2 / 3)
    expect(tracker.detail).toBe('BUILD COMBO X3 / CURRENT X2')
    tracker.recordCombo(2)
    expect(tracker.progress).toBeCloseTo(2 / 3)
    tracker.recordCombo(3)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.detail).toBe('BUILD COMBO X3 / CURRENT X3')
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('requires consecutive high-quality gates for a precision chain', () => {
    const tracker = new SortieContractTracker()
    let precisionSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'precision') {
        precisionSeed = seed
        break
      }
    }
    expect(precisionSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(precisionSeed, 5)
    expect(tracker.label).toBe('PRECISION CHAIN')
    expect(tracker.detail).toBe('CLEAR 3 PERFECT GATES IN A ROW')
    tracker.recordPrecisionGate(0.9)
    tracker.recordPrecisionGate(0.4)
    expect(tracker.progress).toBe(0)
    tracker.recordPrecisionGate(0.9)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordPrecisionGate(0.9)
    tracker.recordPrecisionGate(0.9)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('requires a finite butter-quality touchdown for the landing contract', () => {
    const tracker = new SortieContractTracker()
    let butterSeed = -1
    for (let seed = 0; seed < 2_048; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'butter') {
        butterSeed = seed
        break
      }
    }
    expect(butterSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(butterSeed, 5)
    expect(tracker.label).toBe('BUTTER LANDING')
    expect(tracker.detail).toBe('LAND WITH A BUTTER TOUCHDOWN')
    expect(tracker.finish(99, 1, 0, 0.91)).toBe(0)
    expect(tracker.progress).toBeCloseTo(0.91 / 0.92)
    expect(tracker.finish(99, 1, 0, 0.92)).toBe(MAX_CONTRACT_SCORE)
    expect(tracker.complete).toBe(true)
    expect(tracker.progress).toBe(1)
  })

  it('accumulates only high-speed airborne time on dry power', () => {
    const tracker = new SortieContractTracker()
    let drySeed = -1
    for (let seed = 0; seed < 2_048; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'dry') {
        drySeed = seed
        break
      }
    }
    expect(drySeed).toBeGreaterThanOrEqual(0)
    tracker.reset(drySeed, 5)
    expect(tracker.label).toBe('DRY RUN')
    expect(tracker.detail).toContain('HOLD DRY POWER ABOVE')
    tracker.recordDry(false, 300, 5, false)
    expect(tracker.progress).toBe(0)
    tracker.recordDry(true, 300, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordDry(false, 240, 5)
    expect(tracker.progress).toBe(0)
    tracker.recordDry(false, 300, 4)
    expect(tracker.progress).toBeCloseTo(1 / 3)
    tracker.recordDry(false, 300, 5)
    tracker.recordDry(false, 300, 3)
    expect(tracker.complete).toBe(true)
    expect(tracker.finish(99, 1)).toBe(MAX_CONTRACT_SCORE)
  })

  it('does not assign a gate-only contract to a no-gate sortie', () => {
    const tracker = new SortieContractTracker()
    let cleanSeed = -1
    for (let seed = 0; seed < 1_024; seed += 1) {
      tracker.reset(seed, 5)
      if (tracker.kind === 'clean') {
        cleanSeed = seed
        break
      }
    }
    expect(cleanSeed).toBeGreaterThanOrEqual(0)
    tracker.reset(cleanSeed, 0)
    expect(tracker.enabled).toBe(false)
    expect(tracker.label).toBe('')
  })

  it('does not award incomplete contracts and keeps malformed telemetry finite', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const tracker = new SortieContractTracker()
      tracker.reset(seed, 5)
      expect(tracker.finish(Number.NaN, Number.NaN)).toBe(0)
      expect(tracker.complete).toBe(false)
      expect(Number.isFinite(tracker.progress)).toBe(true)
      expect(tracker.progress).toBeGreaterThanOrEqual(0)
      expect(tracker.progress).toBeLessThanOrEqual(1)
    }
  })
})
