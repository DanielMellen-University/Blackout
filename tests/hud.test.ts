import { describe, expect, it } from 'vitest'
import {
  afterburnerHeatIntensity,
  biomeSurveyAriaLabel,
  biomeSurveyHudLabel,
  contractStreakAriaLabel,
  contractStreakHudLabel,
  canopyTintIntensity,
  canopyWeatherIntensity,
  crosswindDirection,
  crosswindSpeedMps,
  altitudeCue,
  formatAudioState,
  formatRadarContacts,
  formatRadarContactsAria,
  createRadarContactsLabelCache,
  waterSurfaceCue,
  formatGForce,
  formatHeading,
  formatFuelEndurance,
  refuelAriaLabel,
  refuelHudLabel,
  landingPreviewAriaLabel,
  landingPreviewHudLabel,
  formatCrosswind,
  formatHudNumber,
  formatVerticalSpeed,
  formatWind,
  formatWindGust,
  FLIGHT_CONTROLS_HINT,
  engineHeatCue,
  engineHeatBanner,
  engineFuelAvailabilityBanner,
  emergencyReturnActive,
  engineHeatRearmBanner,
  afterburnerHudLabel,
  stabilityAssistLabel,
  flightStateLabel,
  gateProximityHudActive,
  gearTransitionActive,
  gForceTone,
  hudBackgroundHidden,
  headingTapeLabel,
  headingTapeOffset,
  normalizeBannerTone,
  normalizeFlightState,
  normalizeMissionPhase,
  navigationAltitudeCue,
  navigationApproachCue,
  navigationLateralCue,
  navigationLateralLabel,
  navigationSpeedCue,
  navigationSpeedLabel,
  navigationGlideCue,
  navigationGlideLabel,
  navigationBearingDegrees,
  navigationEtaSeconds,
  navigationRangeCue,
  navigationSectorLabel,
  navigationTargetLabel,
  navigationTargetText,
  navigationSector,
  normalizeNavigationBearing,
  pauseStateLabel,
  missionPhaseClass,
  missionProgressPercent,
  missionProgressText,
  machAriaLabel,
  machCue,
  machLabel,
  machNumber,
  missionPaceLabel,
  missionHudLabel,
  createMissionHudLabelCache,
  routeRiskAriaLabel,
  routeRiskHudLabel,
  flightLogAriaLabel,
  flightLogHudLabel,
  ghostPaceLabel,
  ghostPaceAriaLabel,
  visibleGhostPaceDelta,
  contractProgressLabel,
  contractProgressAriaLabel,
  contractDetailLabel,
  contractDetailAriaLabel,
  comboHudLabel,
  quantizeHudNumber,
  safeHudValue,
  speedWarningLevel,
  speedJuiceIntensity,
  speedNeedleKts,
  verticalSpeedTone,
  windDirectionDegrees,
  windSpeedMps,
  windGustCue,
  weatherCue,
  weatherCycleBanner,
  weatherDisplayLabel,
  weatherTransitionLabel,
} from '../src/ui/HUD'

describe('HUD value formatting', () => {
  it('removes float noise at a bounded visual precision', () => {
    expect(quantizeHudNumber(0.12349, 100)).toBe(0.12)
    expect(quantizeHudNumber(0.12501, 100)).toBe(0.13)
    expect(formatHudNumber(0.99994, 1000)).toBe('1')
  })

  it('returns a safe zero for invalid precision or values', () => {
    expect(quantizeHudNumber(Number.NaN, 100)).toBe(0)
    expect(quantizeHudNumber(3, 0)).toBe(0)
    expect(formatHudNumber(Infinity, 100)).toBe('0')
  })

  it('keeps malformed live telemetry finite', () => {
    expect(safeHudValue(4.5)).toBe(4.5)
    expect(safeHudValue(Number.NaN)).toBe(0)
    expect(safeHudValue(Number.POSITIVE_INFINITY, -1)).toBe(-1)
  })

  it('keeps high-speed edge juice restrained and bounded', () => {
    expect(speedJuiceIntensity(0)).toBe(0)
    expect(speedJuiceIntensity(500)).toBe(0)
    expect(speedJuiceIntensity(1800)).toBeGreaterThan(0)
    expect(speedJuiceIntensity(3000)).toBeCloseTo(.42)
    expect(speedJuiceIntensity(5000)).toBeCloseTo(.42)
    expect(speedJuiceIntensity(Number.NaN)).toBe(0)
    expect(speedJuiceIntensity(3000, Number.NaN)).toBeCloseTo(.42)
  })

  it('marks the airspeed redline without hiding true overspeed', () => {
    expect(speedWarningLevel(2800)).toBe('normal')
    expect(speedWarningLevel(2820)).toBe('redline')
    expect(speedWarningLevel(3000)).toBe('redline')
    expect(speedWarningLevel(3000.1)).toBe('overspeed')
    expect(speedWarningLevel(Number.NaN)).toBe('normal')
  })

  it('coalesces the speed needle to the displayed knot resolution', () => {
    expect(speedNeedleKts(1200.49)).toBe(1200)
    expect(speedNeedleKts(1200.5)).toBe(1201)
    expect(speedNeedleKts(-12)).toBe(0)
    expect(speedNeedleKts(Number.NaN)).toBe(0)
  })

  it('formats climb and sink rates with a readable sign', () => {
    expect(formatVerticalSpeed(12.4)).toBe('+12')
    expect(formatVerticalSpeed(-3.6)).toBe('-4')
    expect(formatVerticalSpeed(0.2)).toBe('0')
    expect(formatVerticalSpeed(Number.NaN)).toBe('0')
  })

  it('keeps Mach telemetry finite and readable across speed bands', () => {
    expect(machNumber(340)).toBeCloseTo(1)
    expect(machNumber(170)).toBeCloseTo(0.5)
    expect(machNumber(Number.NaN)).toBe(0)
    expect(machNumber(340, 0)).toBe(0)
    expect(machCue(0.84)).toBe('subsonic')
    expect(machCue(0.85)).toBe('transonic')
    expect(machCue(1)).toBe('supersonic')
    expect(machCue(Number.NaN)).toBe('subsonic')
    expect(machLabel(1)).toBe('M1.00')
    expect(machLabel(Number.NaN)).toBe('M0.00')
    expect(machAriaLabel(0.9)).toBe('M0.90, transonic')
  })

  it('keeps best-run ghost pacing readable around the zero crossing', () => {
    expect(ghostPaceLabel(null)).toBe('')
    expect(ghostPaceLabel(-1.26)).toBe('AHEAD 1.3S')
    expect(ghostPaceLabel(1.24)).toBe('BEHIND 1.2S')
    expect(ghostPaceLabel(0.02)).toBe('EVEN')
    expect(ghostPaceLabel(Number.NaN)).toBe('')
    expect(ghostPaceAriaLabel(-1.2)).toBe('Best-run ghost pace ahead by 1.2s')
    expect(ghostPaceAriaLabel(1.2)).toBe('Best-run ghost pace behind by 1.2s')
  })

  it('hides ghost pace telemetry when the path is toggled off', () => {
    expect(visibleGhostPaceDelta(-1.2, true)).toBe(-1.2)
    expect(visibleGhostPaceDelta(-1.2, false)).toBeNull()
    expect(visibleGhostPaceDelta(Number.NaN, true)).toBeNull()
  })

  it('keeps live flight-log telemetry compact and finite', () => {
    expect(flightLogHudLabel(2_450, 5.25, -1.4)).toBe('DIST 2.5KM · G +5.3/-1.4')
    expect(flightLogHudLabel(0, 1, 0)).toBe('')
    expect(flightLogHudLabel(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN)).toBe('')
    expect(flightLogAriaLabel(2_450, 5.25, -1.4)).toBe('Flight log dist 2.5km, g +5.3/-1.4')
  })

  it('formats bounded fighter G-load cues with distinct stress tones', () => {
    expect(formatGForce(1)).toBe('+1.0G')
    expect(formatGForce(-0.45)).toBe('-0.5G')
    expect(formatGForce(Number.NaN)).toBe('+1.0G')
    expect(gForceTone(3.9)).toBe('normal')
    expect(gForceTone(4)).toBe('high')
    expect(gForceTone(-0.1)).toBe('negative')
  })

  it('keeps vertical-speed color changes inside a deadband', () => {
    expect(verticalSpeedTone(2.01)).toBe('climb')
    expect(verticalSpeedTone(-2.01)).toBe('sink')
    expect(verticalSpeedTone(2)).toBe('level')
    expect(verticalSpeedTone(-2)).toBe('level')
    expect(verticalSpeedTone(Number.NaN)).toBe('level')
  })

  it('wraps aircraft heading into a compact compass readout', () => {
    expect(formatHeading(0)).toBe('000°')
    expect(formatHeading(Math.PI / 2)).toBe('090°')
    expect(formatHeading(-Math.PI / 2)).toBe('270°')
    expect(formatHeading(2 * Math.PI)).toBe('000°')
    expect(formatHeading(Number.NaN)).toBe('000°')
  })

  it('keeps the wrapped heading tape centered across north', () => {
    expect(headingTapeOffset(0, 56)).toBeCloseTo(1372)
    expect(headingTapeOffset(Math.PI / 2, 56)).toBeCloseTo(1708)
    expect(headingTapeOffset(-Math.PI / 2, 56)).toBeCloseTo(2380)
    expect(headingTapeLabel(0)).toBe('N')
    expect(headingTapeLabel(90)).toBe('E')
    expect(headingTapeLabel(360)).toBe('N')
    expect(headingTapeLabel(-30)).toBe('330')
  })

  it('keeps the audio state label compact', () => {
    expect(formatAudioState(false)).toBe('LIVE')
    expect(formatAudioState(true)).toBe('MUTE')
  })

  it('keeps gear transition emphasis inside its short timing window', () => {
    expect(gearTransitionActive(100, 700)).toBe(true)
    expect(gearTransitionActive(700, 700)).toBe(false)
    expect(gearTransitionActive(800, 700)).toBe(false)
    expect(gearTransitionActive(Number.NaN, 700)).toBe(false)
  })

  it('limits canopy tint to cockpit view and high IAS', () => {
    expect(canopyTintIntensity(2400, false)).toBe(0)
    expect(canopyTintIntensity(400, true)).toBe(0)
    expect(canopyTintIntensity(1800, true)).toBeGreaterThan(0)
    expect(canopyTintIntensity(3000, true)).toBeCloseTo(0.28)
    expect(canopyTintIntensity(5000, true)).toBeCloseTo(0.28)
  })

  it('adds a bounded weather veil only to the cockpit canopy', () => {
    expect(canopyWeatherIntensity(1, 0, true)).toBeCloseTo(0.09)
    expect(canopyWeatherIntensity(0, 1, true)).toBeCloseTo(0.045)
    expect(canopyWeatherIntensity(4, 4, true)).toBeCloseTo(0.12)
    expect(canopyWeatherIntensity(1, 1, false)).toBe(0)
    expect(canopyTintIntensity(0, true, 3000, 1, 0)).toBeCloseTo(0.09)
    expect(canopyTintIntensity(0, false, 3000, 1, 1)).toBe(0)
  })

  it('keeps afterburner heat veil soft and boost-only', () => {
    expect(afterburnerHeatIntensity(2400, false)).toBe(0)
    expect(afterburnerHeatIntensity(0, true)).toBeCloseTo(0.06)
    expect(afterburnerHeatIntensity(1500, true)).toBeCloseTo(0.11)
    expect(afterburnerHeatIntensity(3000, true)).toBeCloseTo(0.16)
    expect(afterburnerHeatIntensity(5000, true)).toBeCloseTo(0.16)
    expect(afterburnerHeatIntensity(Number.NaN, true)).toBeCloseTo(0.06)
    expect(afterburnerHeatIntensity(1500, true, Number.NaN)).toBeCloseTo(0.11)
  })

  it('keeps engine heat bands restrained and finite-safe', () => {
    expect(engineHeatCue(0.64)).toBe('normal')
    expect(engineHeatCue(0.65)).toBe('hot')
    expect(engineHeatCue(0.88)).toBe('critical')
    expect(engineHeatCue(2)).toBe('critical')
    expect(engineHeatCue(Number.NaN)).toBe('normal')
    expect(engineHeatBanner('hot', 'normal')).toBe('ENGINE HOT / REDUCE POWER')
    expect(engineHeatBanner('critical', 'hot')).toBe('ENGINE HEAT CRITICAL / REDUCE POWER')
    expect(engineHeatBanner('normal', 'critical')).toBe('ENGINE COOLING')
    expect(engineHeatBanner('normal', null)).toBeNull()
    expect(engineHeatRearmBanner(false, true)).toBeNull()
    expect(engineHeatRearmBanner(true, true)).toBeNull()
    expect(engineHeatRearmBanner(true, false)).toBe('AFTERBURNER READY / ENGINE COOL')
  })

  it('keeps afterburner availability explicit after transient banners fade', () => {
    expect(afterburnerHudLabel(false, null)).toBe('AB READY')
    expect(afterburnerHudLabel(true, null)).toBe('AB ON')
    expect(afterburnerHudLabel(false, 'heat')).toBe('AB HOT')
    expect(afterburnerHudLabel(true, 'fuel')).toBe('AB FUEL')
    expect(afterburnerHudLabel(false, 'unknown')).toBe('AB READY')
  })

  it('marks the nav cue near the active gate only inside the soft window', () => {
    expect(gateProximityHudActive(0)).toBe(false)
    expect(gateProximityHudActive(180)).toBe(true)
    expect(gateProximityHudActive(220)).toBe(true)
    expect(gateProximityHudActive(221)).toBe(false)
    expect(gateProximityHudActive(Number.NaN)).toBe(false)
  })

  it('normalizes banner tones to the supported visual states', () => {
    expect(normalizeBannerTone('success')).toBe('success')
    expect(normalizeBannerTone('danger')).toBe('danger')
    expect(normalizeBannerTone('warning')).toBe('info')
    expect(normalizeBannerTone(null)).toBe('info')
  })

  it('turns bounded gust intensity into a calm, active, or severe cue', () => {
    expect(windGustCue(-1)).toBe('calm')
    expect(windGustCue(0.27)).toBe('calm')
    expect(windGustCue(0.28)).toBe('active')
    expect(formatWindGust(0.28)).toBe('GUST')
    expect(windGustCue(0.72)).toBe('severe')
    expect(formatWindGust(1)).toBe('GUST HIGH')
    expect(formatWindGust(Number.NaN)).toBe('')
  })

  it('formats bounded radar contacts for a compact HUD readout', () => {
    expect(formatRadarContacts([
      { kind: 'gate', label: 'GATE', distance: 1200, bearing: 0 },
      { kind: 'city', label: 'CITY', distance: 4200, bearing: Math.PI / 2 },
    ])).toBe('GATE 1.2K ↑ · CITY 4.2K →')
    expect(formatRadarContacts([])).toBe('NO CONTACTS')
    expect(formatRadarContacts([
      { kind: 'village', label: '', distance: Number.NaN, bearing: Number.NaN },
    ])).toBe('CONTACT 0M ↑')
    expect(formatRadarContacts([
      { kind: 'city', label: 'CITY', distance: 800, bearing: 0, selected: true },
    ])).toBe('> CITY 800M ↑')
  })

  it('describes radar lock state and direction without visual glyphs', () => {
    expect(formatRadarContactsAria([
      { kind: 'gate', label: 'GATE', distance: 1200, bearing: 0 },
      { kind: 'city', label: 'CITY', distance: 800, bearing: Math.PI / 2, selected: true },
    ])).toBe('Radar: gate 1.2k ahead; selected city 800m right')
    expect(formatRadarContactsAria([])).toBe('Radar: no contacts')
  })

  it('reuses radar copy while displayed distance and bearing buckets stay stable', () => {
    const cache = createRadarContactsLabelCache()
    const contacts = [{ kind: 'gate' as const, label: 'GATE', distance: 1240, bearing: 0 }]
    const first = cache(contacts)
    expect(first).toBe('GATE 1.2K ↑')
    expect(cache(contacts)).toBe(first)
    contacts[0].distance = 1210
    expect(cache(contacts)).toBe(first)
    contacts[0].distance = 1350
    expect(cache(contacts)).toBe('GATE 1.4K ↑')
    contacts[0].bearing = Math.PI / 2
    expect(cache(contacts)).toBe('GATE 1.4K →')
  })

  it('keeps optional radar targets explicit in the navigation label', () => {
    expect(navigationTargetLabel('city')).toBe('CITY')
    expect(navigationTargetLabel('village')).toBe('VILLAGE')
    expect(navigationTargetText('city')).toBe('CITY TARGET')
    expect(navigationTargetText('village')).toBe('VILLAGE TARGET')
    expect(navigationTargetLabel('unknown')).toBe('NEXT GATE')
  })

  it('keeps the live biome survey counter bounded and accessible', () => {
    expect(biomeSurveyHudLabel(3)).toBe('X3')
    expect(biomeSurveyHudLabel(Number.MAX_SAFE_INTEGER)).toBe('X15')
    expect(biomeSurveyHudLabel(Number.NaN)).toBe('--')
    expect(biomeSurveyAriaLabel(3)).toBe('3 distinct biomes surveyed')
    expect(biomeSurveyAriaLabel(-4)).toBe('0 distinct biomes surveyed')
  })

  it('announces only the powered-to-glide fuel transition', () => {
    expect(engineFuelAvailabilityBanner(true, false)).toBe('ENGINE OUT / GLIDE TO BASE')
    expect(engineFuelAvailabilityBanner(false, false)).toBeNull()
    expect(engineFuelAvailabilityBanner(false, true)).toBeNull()
    expect(engineFuelAvailabilityBanner(true, true)).toBeNull()
  })

  it('routes only recoverable engine-out phases toward base', () => {
    expect(emergencyReturnActive(true, 'running')).toBe(true)
    expect(emergencyReturnActive(true, 'returning')).toBe(true)
    expect(emergencyReturnActive(true, 'complete')).toBe(false)
    expect(emergencyReturnActive(true, 'failed')).toBe(false)
    expect(emergencyReturnActive(false, 'running')).toBe(false)
  })

  it('keeps water crossing cues calm and semantic', () => {
    expect(waterSurfaceCue('ocean')).toBe('SEA CROSSING')
    expect(waterSurfaceCue('water')).toBe('INLAND WATER CROSSING')
    expect(waterSurfaceCue(undefined)).toBe('INLAND WATER CROSSING')
  })

  it('bounds route progress for the compact gate meter', () => {
    expect(missionProgressPercent(2, 5)).toBe(40)
    expect(missionProgressPercent(9, 5)).toBe(100)
    expect(missionProgressPercent(Number.NaN, Number.NaN)).toBe(0)
    expect(missionProgressText(2, 5)).toBe('2 of 5 gates cleared')
    expect(missionProgressText(9, 5)).toBe('5 of 5 gates cleared')
  })

  it('keeps live pace feedback safe before and after a gate clear', () => {
    expect(missionPaceLabel(null)).toBe('READY')
    expect(missionPaceLabel('AHEAD 0.50S')).toBe('AHEAD 0.50S')
    expect(missionPaceLabel('  ON PACE  ')).toBe('ON PACE')
    expect(missionPaceLabel('')).toBe('READY')
  })

  it('keeps contract task wording bounded and accessible', () => {
    expect(contractProgressLabel('CONTRACT SPEED RUN', 0.42, false)).toBe('CONTRACT SPEED RUN 42%')
    expect(contractProgressLabel('CONTRACT SPEED RUN', 9, false)).toBe('CONTRACT SPEED RUN 100%')
    expect(contractProgressLabel('CONTRACT SPEED RUN', Number.NaN, false)).toBe('CONTRACT SPEED RUN 0%')
    expect(contractProgressLabel('CONTRACT SPEED RUN', 0.42, true)).toBe('CONTRACT SPEED RUN DONE')
    expect(contractProgressLabel('CONTRACT CLEAN CIRCUIT', 0.4, false, true)).toBe('CONTRACT CLEAN CIRCUIT FAILED')
    expect(contractProgressLabel('', 1, true)).toBe('')
    expect(contractProgressAriaLabel('CONTRACT SPEED RUN', 0.42, false))
      .toBe('Contract speed run, 42 percent complete')
    expect(contractProgressAriaLabel('CONTRACT SPEED RUN', 0.42, true))
      .toBe('Contract speed run complete')
    expect(contractProgressAriaLabel('CONTRACT CLEAN CIRCUIT', 0.4, false, true))
      .toBe('Contract clean circuit failed')
    expect(contractProgressAriaLabel(null, 1, false)).toBe('')
    expect(contractDetailLabel('  HOLD AFTERBURNER ABOVE 428 KTS FOR 8S  '))
      .toBe('HOLD AFTERBURNER ABOVE 428 KTS FOR 8S')
    expect(contractDetailLabel('x'.repeat(200))).toHaveLength(120)
    expect(contractDetailLabel(Number.NaN)).toBe('')
    expect(contractDetailAriaLabel('HOLD AFTERBURNER ABOVE 428 KTS FOR 8S'))
      .toBe('Contract instruction: hold afterburner above 428 kts for 8s')
  })

  it('keeps the live combo expiry readable and bounded', () => {
    expect(comboHudLabel(2, 8)).toBe('X2 · 8S')
    expect(comboHudLabel(2, 0)).toBe('X2')
    expect(comboHudLabel(Number.NaN, 8)).toBe('')
    expect(comboHudLabel(2, Number.POSITIVE_INFINITY)).toBe('X2')
  })

  it('keeps the persisted contract chain compact and finite', () => {
    expect(contractStreakHudLabel(3)).toBe('X3')
    expect(contractStreakHudLabel(Number.MAX_SAFE_INTEGER)).toBe('X1000')
    expect(contractStreakHudLabel(Number.NaN)).toBe('--')
    expect(contractStreakAriaLabel(3)).toBe('contract chain 3 completed')
    expect(contractStreakAriaLabel(0)).toBe('no completed contract chain')
  })

  it('keeps weather-front transitions compact and explicit', () => {
    expect(weatherTransitionLabel(true)).toBe('SHIFT')
    expect(weatherTransitionLabel(false)).toBe('')
    expect(weatherTransitionLabel(Number.NaN as unknown as boolean)).toBe('')
    expect(weatherDisplayLabel('RAIN FRONT', true)).toBe('RAIN FRONT · SHIFT')
    expect(weatherDisplayLabel('  SNOW SHOWERS  ', false)).toBe('SNOW SHOWERS')
    expect(weatherDisplayLabel('', true)).toBe('')
  })

  it('keeps route identity in the live mission row within a bounded label', () => {
    expect(missionHudLabel('RIVER RUN', 'RANGE GATE 1/5', 'CONTRACT WATER RUN'))
      .toBe('RIVER RUN · RANGE GATE 1/5 · CONTRACT WATER RUN')
    expect(missionHudLabel('', '  TAKE OFF  ')).toBe('TAKE OFF')
    expect(missionHudLabel('x'.repeat(200), 'y'.repeat(200))).toHaveLength(120)
  })

  it('reuses the cached mission label until one of its inputs changes', () => {
    const cache = createMissionHudLabelCache()
    const first = cache('RIVER RUN', 'RANGE GATE 1/5', 'CONTRACT WATER RUN')
    expect(cache('RIVER RUN', 'RANGE GATE 1/5', 'CONTRACT WATER RUN')).toBe(first)
    expect(cache('RIVER RUN', 'RANGE GATE 2/5', 'CONTRACT WATER RUN'))
      .toBe('RIVER RUN · RANGE GATE 2/5 · CONTRACT WATER RUN')
  })

  it('keeps route risk copy compact and fails closed for unknown values', () => {
    expect(routeRiskHudLabel('technical', 'tempo')).toBe('TECHNICAL · TEMPO')
    expect(routeRiskAriaLabel('technical', 'tempo')).toBe('Route risk technical, tempo')
    expect(routeRiskHudLabel('free', 'unknown')).toBe('')
    expect(routeRiskAriaLabel('free', 'unknown')).toBe('')
  })

  it('keeps terrain clearance cues calm on the ground and explicit in flight', () => {
    expect(altitudeCue(0, true)).toBe('normal')
    expect(altitudeCue(10)).toBe('warning')
    expect(altitudeCue(32)).toBe('caution')
    expect(altitudeCue(49)).toBe('normal')
    expect(altitudeCue(Number.NaN)).toBe('normal')
  })

  it('normalizes mission phases before styling the live route row', () => {
    expect(normalizeMissionPhase('returning')).toBe('returning')
    expect(normalizeMissionPhase('unknown')).toBe('ready')
    expect(missionPhaseClass('complete')).toBe('phase-complete')
    expect(missionPhaseClass(null)).toBe('phase-ready')
  })

  it('formats finite wind telemetry with a calm fallback', () => {
    expect(windSpeedMps(3, 4)).toBe(5)
    expect(windDirectionDegrees(0, 5)).toBe(0)
    expect(windDirectionDegrees(5, 0)).toBe(90)
    expect(formatWind(3, 4)).toBe('5 M/S 037°')
    expect(formatWind(Number.NaN, 4)).toBe('CALM')
    expect(crosswindSpeedMps(3, 4, 0)).toBe(3)
    expect(crosswindSpeedMps(3, 4, Math.PI / 2)).toBe(4)
    expect(crosswindSpeedMps(Number.NaN, 4, 0)).toBe(0)
    expect(crosswindDirection(3, 4, 0)).toBe('right')
    expect(crosswindDirection(3, 4, Math.PI / 2)).toBe('left')
    expect(crosswindDirection(0, 0, 0)).toBe('calm')
    expect(crosswindDirection(Number.NaN, 4, 0)).toBe('calm')
    expect(formatCrosswind(0.4)).toBe('XW CALM')
    expect(formatCrosswind(8.2)).toBe('XW 8 M/S')
    expect(formatCrosswind(8.2, 'left')).toBe('XW L 8 M/S')
    expect(formatCrosswind(8.2, 'right')).toBe('XW R 8 M/S')
  })

  it('normalizes stable ground, airborne, and crash state cues', () => {
    expect(normalizeFlightState('ground')).toBe('ground')
    expect(normalizeFlightState('airborne')).toBe('airborne')
    expect(normalizeFlightState('crashed')).toBe('crashed')
    expect(normalizeFlightState('bad', true)).toBe('ground')
    expect(normalizeFlightState('bad', false)).toBe('airborne')
    expect(flightStateLabel('crashed')).toBe('CRASH')
  })

  it('keeps the paused-flight announcement explicit and compact', () => {
    expect(pauseStateLabel(true)).toBe('FLIGHT PAUSED · SIMULATION HOLD')
    expect(pauseStateLabel(false)).toBe('')
  })

  it('hides stale HUD telemetry whenever a modal owns focus', () => {
    expect(hudBackgroundHidden(true, false)).toBe(true)
    expect(hudBackgroundHidden(false, true)).toBe(true)
    expect(hudBackgroundHidden(false, false)).toBe(false)
  })

  it('keeps navigation bearings wrapped and sector cues stable in hard turns', () => {
    expect(normalizeNavigationBearing(3 * Math.PI)).toBeCloseTo(Math.PI)
    expect(normalizeNavigationBearing(Number.NaN)).toBeNull()
    expect(navigationBearingDegrees(-Math.PI / 2)).toBe(-90)
    expect(navigationSector(0)).toBe('ahead')
    expect(navigationSector(Math.PI / 2)).toBe('right')
    expect(navigationSector(-Math.PI / 2)).toBe('left')
    expect(navigationSector(Math.PI)).toBe('behind')
    expect(navigationSector(null)).toBe('ahead')
    expect(navigationSectorLabel('left')).toBe('LEFT')
    expect(navigationSectorLabel('right')).toBe('RIGHT')
    expect(navigationSectorLabel('behind')).toBe('BEHIND')
    expect(navigationSectorLabel(null)).toBe('AHEAD')
  })

  it('labels the return cue as base and fails closed to the next gate', () => {
    expect(navigationTargetLabel('base')).toBe('BASE')
    expect(navigationTargetLabel('gate')).toBe('NEXT GATE')
    expect(navigationTargetLabel(null)).toBe('NEXT GATE')
    expect(navigationTargetText('gate', 1, 5)).toBe('GATE 2/5')
    expect(navigationTargetText('gate', 9, 5)).toBe('GATE 5/5')
    expect(navigationTargetText('base', 1, 5)).toBe('BASE')
    expect(navigationTargetText('gate', Number.NaN, Number.NaN)).toBe('NEXT GATE')
  })

  it('turns navigation altitude error into a bounded climb or descent cue', () => {
    expect(navigationAltitudeCue(41)).toBe('high')
    expect(navigationAltitudeCue(-41)).toBe('low')
    expect(navigationAltitudeCue(24, 'base')).toBe('level')
    expect(navigationAltitudeCue(26, 'base')).toBe('high')
    expect(navigationAltitudeCue(Number.NaN)).toBe('level')
  })

  it('turns navigation distance change into a deadbanded route trend', () => {
    expect(navigationRangeCue(900, Number.NaN)).toBe('steady')
    expect(navigationRangeCue(900, 905)).toBe('closing')
    expect(navigationRangeCue(905, 900)).toBe('opening')
    expect(navigationRangeCue(904, 900)).toBe('steady')
    expect(navigationRangeCue(Number.NaN, 900)).toBe('closing')
  })

  it('keeps return approach alignment finite and runway-specific', () => {
    expect(navigationApproachCue(0)).toBe('aligned')
    expect(navigationApproachCue(7 * Math.PI / 180)).toBe('aligned')
    expect(navigationApproachCue(30 * Math.PI / 180)).toBe('turn-left')
    expect(navigationApproachCue(-30 * Math.PI / 180)).toBe('turn-right')
    expect(navigationApproachCue(Math.PI * 2 + 30 * Math.PI / 180)).toBe('turn-left')
    expect(navigationApproachCue(30 * Math.PI / 180, 'gate')).toBeNull()
    expect(navigationApproachCue(Number.NaN)).toBeNull()
  })

  it('keeps the return localizer bounded and explicit', () => {
    expect(navigationLateralCue(0)).toBe('center')
    expect(navigationLateralCue(30)).toBe('left')
    expect(navigationLateralCue(-30)).toBe('right')
    expect(navigationLateralCue(30, 'gate')).toBeNull()
    expect(navigationLateralCue(Number.NaN)).toBeNull()
    expect(navigationLateralLabel('center')).toBe('LINE OK')
    expect(navigationLateralLabel('left')).toBe('LINE L')
    expect(navigationLateralLabel('right')).toBe('LINE R')
    expect(navigationLateralLabel(null)).toBe('')
  })

  it('keeps the return speed window bounded and explicit', () => {
    expect(navigationSpeedCue(45)).toBe('slow')
    expect(navigationSpeedCue(55)).toBe('on-speed')
    expect(navigationSpeedCue(71)).toBe('fast')
    expect(navigationSpeedCue(55, 'gate')).toBeNull()
    expect(navigationSpeedCue(Number.NaN)).toBeNull()
    expect(navigationSpeedLabel('slow')).toBe('SPD SLOW')
    expect(navigationSpeedLabel('on-speed')).toBe('SPD OK')
    expect(navigationSpeedLabel('fast')).toBe('SPD FAST')
    expect(navigationSpeedLabel(null)).toBe('')
  })

  it('keeps the return glide window bounded and explicit', () => {
    expect(navigationGlideCue(1000, 100)).toBe('on-slope')
    expect(navigationGlideCue(1000, 140)).toBe('high')
    expect(navigationGlideCue(1000, 10)).toBe('low')
    expect(navigationGlideCue(1000, 100, 'gate')).toBeNull()
    expect(navigationGlideCue(Number.NaN, 100)).toBeNull()
    expect(navigationGlideCue(1000, Number.NaN)).toBeNull()
    expect(navigationGlideLabel('high')).toBe('GS HIGH')
    expect(navigationGlideLabel('on-slope')).toBe('GS OK')
    expect(navigationGlideLabel('low')).toBe('GS LOW')
    expect(navigationGlideLabel(null)).toBe('')
  })

  it('keeps route ETA bounded and only reports it while closing', () => {
    expect(navigationEtaSeconds(1000, 100, 'closing')).toBe(10)
    expect(navigationEtaSeconds(6100, 100, 'closing')).toBe(61)
    expect(navigationEtaSeconds(1000, 100, 'opening')).toBeNull()
    expect(navigationEtaSeconds(1000, 0, 'closing')).toBeNull()
    expect(navigationEtaSeconds(Number.NaN, 100, 'closing')).toBeNull()
  })

  it('keeps the takeoff control hint compact and stable', () => {
    expect(FLIGHT_CONTROLS_HINT).toContain('W/S PITCH')
    expect(FLIGHT_CONTROLS_HINT).toContain('C VIEW')
    expect(FLIGHT_CONTROLS_HINT.length).toBeLessThan(64)
  })

  it('classifies severe weather without trusting malformed labels', () => {
    expect(weatherCue('storm')).toBe('severe')
    expect(weatherCue('THUNDERSTORM')).toBe('severe')
    expect(weatherCue('blizzard')).toBe('severe')
    expect(weatherCue('rain')).toBe('active')
    expect(weatherCue('OVERCAST / SHIFTING')).toBe('active')
    expect(weatherCue('clear')).toBe('calm')
    expect(weatherCue(null)).toBe('calm')
  })

  it('announces manual weather shifts with a safe compact label', () => {
    expect(weatherCycleBanner('RAIN / SHIFTING')).toBe('WEATHER SHIFT / RAIN / SHIFTING')
    expect(weatherCycleBanner('')).toBe('WEATHER SHIFT / WEATHER')
    expect(weatherCycleBanner(null)).toBe('WEATHER SHIFT / WEATHER')
  })

  it('formats bounded fuel endurance for cockpit scanning', () => {
    expect(formatFuelEndurance(0)).toBe('END 0:00')
    expect(formatFuelEndurance(125)).toBe('END 2:05')
    expect(formatFuelEndurance(3661)).toBe('END 1:01:01')
    expect(formatFuelEndurance(null)).toBe('END --')
    expect(formatFuelEndurance(Number.NaN)).toBe('END --')
  })

  it('keeps grounded refueling visible and finite', () => {
    expect(refuelHudLabel(false, .42)).toBe('')
    expect(refuelHudLabel(true, .42)).toBe('REFUEL 42%')
    expect(refuelHudLabel(true, Number.NaN)).toBe('REFUEL 0%')
    expect(refuelAriaLabel(true, .42)).toBe('Refueling at 42%')
    expect(refuelAriaLabel(false, .42)).toBe('')
  })

  it('keeps touchdown forecasts aligned with the result quality bands', () => {
    expect(landingPreviewHudLabel(null)).toBe('')
    expect(landingPreviewHudLabel(0.93)).toBe('BUTTER')
    expect(landingPreviewHudLabel(0.8)).toBe('SMOOTH')
    expect(landingPreviewHudLabel(0.6)).toBe('FIRM')
    expect(landingPreviewHudLabel(Number.NaN)).toBe('')
    expect(landingPreviewAriaLabel(0.93)).toBe('Predicted touchdown butter')
  })

  it('keeps the optional flight-assist state explicit after its banner fades', () => {
    expect(stabilityAssistLabel(true)).toBe('TRIM ON')
    expect(stabilityAssistLabel(false)).toBe('TRIM OFF')
    expect(stabilityAssistLabel('on')).toBe('TRIM OFF')
  })
})
