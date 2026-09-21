/**
 * HTML overlay HUD - flight readouts, speedometer, engine power,
 * attitude indicator (pitch ladder + bank), banner.
 */
import { displayedKnots } from '../core/airspeed'
import { fuelEnduranceSeconds, fuelPercent, fuelWarningLevel } from '../aircraft/FuelSystem'
import {
  MAX_RADAR_CONTACTS,
  radarBearingArrow,
  radarDistanceLabel,
  type RadarContact,
} from '../systems/RadarSystem'
import { MAX_COMBO_COUNT } from '../systems/FlightCombo'
import { landingQualityLabel, MAX_BIOME_COUNT } from '../systems/ChallengeRun'
import { SUPERSONIC_THRESHOLD_MPS } from '../systems/Supersonic'
import {
  blackoutVignetteIntensity,
  redoutWashIntensity,
} from '../systems/GLoadFeedback'

export type HudBannerTone = 'info' | 'success' | 'danger'

export type SpeedWarningLevel = 'normal' | 'redline' | 'overspeed'

export type MachCue = 'subsonic' | 'transonic' | 'supersonic'

/** Convert finite airspeed into a bounded Mach ratio for cockpit telemetry. */
export function machNumber(speedMps: number, soundSpeedMps = SUPERSONIC_THRESHOLD_MPS): number {
  if (!Number.isFinite(speedMps) || !Number.isFinite(soundSpeedMps) || soundSpeedMps <= 0) return 0
  return Math.min(20, Math.max(0, speedMps) / soundSpeedMps)
}

/** Keep the Mach readout calm near the transonic boundary instead of flickering. */
export function machCue(value: number): MachCue {
  if (!Number.isFinite(value)) return 'subsonic'
  if (value >= 1) return 'supersonic'
  if (value >= 0.85) return 'transonic'
  return 'subsonic'
}

export function machLabel(value: number): string {
  const safe = Number.isFinite(value) ? Math.min(20, Math.max(0, value)) : 0
  return `M${safe.toFixed(2)}`
}

export function machAriaLabel(value: number): string {
  const label = machLabel(value)
  const cue = machCue(value)
  const description = cue === 'supersonic' ? 'supersonic' : cue === 'transonic' ? 'transonic' : 'subsonic'
  return `${label}, ${description}`
}

export type AltitudeCue = 'normal' | 'caution' | 'warning'

export type EngineHeatCue = 'normal' | 'hot' | 'critical'

export type MissionPhaseCue = 'ready' | 'running' | 'returning' | 'complete' | 'failed'

export type FlightStateCue = 'ground' | 'airborne' | 'crashed'

export function pauseStateLabel(paused: boolean): string {
  return paused ? 'FLIGHT PAUSED · SIMULATION HOLD' : ''
}

export function hudBackgroundHidden(menuOpen: boolean, resultsOpen: boolean): boolean {
  return menuOpen || resultsOpen
}

export type NavigationSector = 'ahead' | 'left' | 'right' | 'behind'

export function navigationSectorLabel(sector: NavigationSector | null): string {
  if (sector === 'left') return 'LEFT'
  if (sector === 'right') return 'RIGHT'
  if (sector === 'behind') return 'BEHIND'
  return 'AHEAD'
}

export const FLIGHT_CONTROLS_HINT = 'W/S PITCH · A/D YAW · Q/E ROLL · V TRIM · G GEAR · C VIEW'

export type WeatherCue = 'calm' | 'active' | 'severe'

export type WindGustCue = 'calm' | 'active' | 'severe'

export type CrosswindSide = 'left' | 'right' | 'calm'

/** Normalize banner tone input so stale callers cannot add arbitrary classes. */
export function normalizeBannerTone(value: unknown): HudBannerTone {
  return value === 'success' || value === 'danger' ? value : 'info'
}

export function formatRadarContacts(contacts: readonly RadarContact[]): string {
  const labels: string[] = []
  const limit = Math.min(MAX_RADAR_CONTACTS, contacts.length)
  for (let index = 0; index < limit; index += 1) {
    const contact = contacts[index]
    if (!contact) continue
    const label = typeof contact.label === 'string' && contact.label.length > 0
      ? contact.label
      : 'CONTACT'
    const marker = contact.selected === true ? '> ' : ''
    labels.push(`${marker}${label} ${radarDistanceLabel(contact.distance)} ${radarBearingArrow(contact.bearing)}`)
  }
  return labels.length > 0 ? labels.join(' · ') : 'NO CONTACTS'
}

/** Reuse radar copy while contacts remain in the same visible display buckets. */
export function createRadarContactsLabelCache(): (contacts: readonly RadarContact[]) => string {
  const previous = Array.from({ length: MAX_RADAR_CONTACTS }, () => ({
    kind: '',
    distanceBucket: Number.NaN,
    bearingSector: Number.NaN,
    label: '',
    selected: false,
  }))
  let previousCount = -1
  let cached = 'NO CONTACTS'
  return (contacts): string => {
    const limit = Math.min(MAX_RADAR_CONTACTS, contacts.length)
    let changed = limit !== previousCount
    for (let index = 0; index < MAX_RADAR_CONTACTS; index += 1) {
      const contact = index < limit ? contacts[index] : undefined
      const kind = contact?.kind ?? ''
      const distanceBucket = contact ? radarDistanceBucket(contact.distance) : Number.NaN
      const bearingSector = contact ? radarBearingSector(contact.bearing) : Number.NaN
      const label = typeof contact?.label === 'string' && contact.label.length > 0
        ? contact.label
        : contact ? 'CONTACT' : ''
      const selected = contact?.selected === true
      const entry = previous[index]!
      if (
        entry.kind !== kind ||
        entry.distanceBucket !== distanceBucket ||
        entry.bearingSector !== bearingSector ||
        entry.label !== label ||
        entry.selected !== selected
      ) changed = true
      entry.kind = kind
      entry.distanceBucket = distanceBucket
      entry.bearingSector = bearingSector
      entry.label = label
      entry.selected = selected
    }
    if (!changed) return cached
    previousCount = limit
    cached = formatRadarContacts(contacts)
    return cached
  }
}

function radarDistanceBucket(distance: number): number {
  const safe = Number.isFinite(distance) ? Math.max(0, distance) : 0
  if (safe < 1000) return Math.round(safe)
  if (safe < 10_000) return Math.round(safe / 100) * 100
  return Math.round(safe / 1000) * 1000
}

function radarBearingSector(bearing: number): number {
  const safe = Number.isFinite(bearing) ? Math.atan2(Math.sin(bearing), Math.cos(bearing)) : 0
  if (Math.abs(safe) < Math.PI / 8) return 0
  if (safe > 0 && safe < Math.PI * .375) return 1
  if (safe < 0 && safe > -Math.PI * .375) return -1
  return safe > 0 ? 2 : -2
}

/** Keep water crossings readable without exposing raw terrain metadata. */
export function waterSurfaceCue(biome: unknown): string {
  return biome === 'ocean' ? 'SEA CROSSING' : 'INLAND WATER CROSSING'
}

/** Clamp route progress before it reaches the visual and semantic meters. */
export function missionProgressPercent(current: number, total: number): number {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0
  const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0
  return safeTotal > 0 ? Math.min(100, Math.round((Math.min(safeCurrent, safeTotal) / safeTotal) * 100)) : 0
}

export function missionProgressText(current: number, total: number): string {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0
  const safeCurrent = Number.isFinite(current)
    ? Math.min(safeTotal, Math.max(0, Math.floor(current)))
    : 0
  return `${safeCurrent} of ${safeTotal} gates cleared`
}

/** Keep route identity visible in the live mission row without unbounded copy. */
export function missionHudLabel(routeLabel: unknown, objective: unknown, contractLabel?: unknown): string {
  const route = typeof routeLabel === 'string' ? routeLabel.trim() : ''
  const task = typeof objective === 'string' ? objective.trim() : ''
  const contract = typeof contractLabel === 'string' ? contractLabel.trim() : ''
  return [route, task, contract].filter(Boolean).join(' · ').slice(0, 120)
}

/** Keep route difficulty and rhythm visible after the launch briefing fades. */
export function routeRiskHudLabel(difficulty: unknown, modifier: unknown): string {
  const safeDifficulty = difficulty === 'relaxed' ? 'RELAXED'
    : difficulty === 'technical' ? 'TECHNICAL'
      : difficulty === 'standard' ? 'STANDARD' : ''
  const safeModifier = modifier === 'steady' ? 'STEADY'
    : modifier === 'tempo' ? 'TEMPO'
      : modifier === 'altitude' ? 'ALTITUDE' : ''
  return [safeDifficulty, safeModifier].filter(Boolean).join(' · ')
}

export function routeRiskAriaLabel(difficulty: unknown, modifier: unknown): string {
  const label = routeRiskHudLabel(difficulty, modifier)
  return label ? `Route risk ${label.toLowerCase().replace(' · ', ', ')}` : ''
}

/** Keep the live flight log compact while coalescing unchanged telemetry buckets. */
export function flightLogHudLabel(
  distanceM: number,
  peakPositiveG: number,
  peakNegativeG: number,
): string {
  const distance = Number.isFinite(distanceM) ? Math.max(0, Math.min(2_000_000, distanceM)) : 0
  const positive = Number.isFinite(peakPositiveG) ? Math.max(0, Math.min(20, peakPositiveG)) : 0
  const negative = Number.isFinite(peakNegativeG) ? Math.max(-9, Math.min(0, peakNegativeG)) : 0
  const parts: string[] = []
  if (distance >= 1) parts.push(`DIST ${formatFlightLogDistance(distance)}`)
  if (positive > 1 || negative < 0) parts.push(`G +${positive.toFixed(1)}/${negative.toFixed(1)}`)
  return parts.join(' · ')
}

export function flightLogAriaLabel(
  distanceM: number,
  peakPositiveG: number,
  peakNegativeG: number,
): string {
  const label = flightLogHudLabel(distanceM, peakPositiveG, peakNegativeG)
  return label ? `Flight log ${label.toLowerCase().replace(' · ', ', ')}` : ''
}

function formatFlightLogDistance(distanceM: number): string {
  if (distanceM < 1_000) return `${Math.round(distanceM)}M`
  return `${(distanceM / 1_000).toFixed(distanceM < 10_000 ? 1 : 0)}KM`
}

/** Reuse an unchanged mission label so the live render loop stays allocation-light. */
export function createMissionHudLabelCache(): (
  routeLabel: unknown,
  objective: unknown,
  contractLabel?: unknown,
) => string {
  let lastRoute: unknown = Symbol('unset')
  let lastObjective: unknown = Symbol('unset')
  let lastContract: unknown = Symbol('unset')
  let cached = ''
  return (routeLabel, objective, contractLabel): string => {
    if (routeLabel === lastRoute && objective === lastObjective && contractLabel === lastContract) {
      return cached
    }
    lastRoute = routeLabel
    lastObjective = objective
    lastContract = contractLabel
    cached = missionHudLabel(routeLabel, objective, contractLabel)
    return cached
  }
}

/** Keep the live combo readout finite and compact for visual and assistive output. */
export function comboHudLabel(value: number): string {
  const safe = Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_COMBO_COUNT, Math.floor(value)))
    : 0
  return safe > 0 ? `X${safe}` : ''
}

/** Keep the live biome survey counter finite and compact for cockpit output. */
export function biomeSurveyHudLabel(value: number): string {
  const safe = Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_BIOME_COUNT, Math.floor(value)))
    : 0
  return safe > 0 ? `X${safe}` : '--'
}

/** Describe the bounded biome survey counter to assistive technology. */
export function biomeSurveyAriaLabel(value: number): string {
  const safe = Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_BIOME_COUNT, Math.floor(value)))
    : 0
  return `${safe} distinct biomes surveyed`
}

/** Keep the persisted contract chain compact and finite for the live HUD. */
export function contractStreakHudLabel(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(1_000, Math.floor(value))) : 0
  return safe > 0 ? `X${safe}` : '--'
}

/** Describe the persisted contract chain without exposing storage details. */
export function contractStreakAriaLabel(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(1_000, Math.floor(value))) : 0
  return safe > 0 ? `contract chain ${safe} completed` : 'no completed contract chain'
}

/** Restrict the navigation target label to the two supported route states. */
export function navigationTargetLabel(target: unknown): 'NEXT GATE' | 'BASE' | 'CITY' | 'VILLAGE' {
  if (target === 'base') return 'BASE'
  if (target === 'city') return 'CITY'
  if (target === 'village') return 'VILLAGE'
  return 'NEXT GATE'
}

/** Include the active checkpoint number when mission counts are available. */
export function navigationTargetText(target: unknown, current?: number, total?: number): string {
  if (target === 'base') return 'BASE'
  if (target === 'city') return 'CITY TARGET'
  if (target === 'village') return 'VILLAGE TARGET'
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total!)) : 0
  if (safeTotal <= 0) return 'NEXT GATE'
  const safeCurrent = Number.isFinite(current)
    ? Math.min(safeTotal - 1, Math.max(0, Math.floor(current!)))
    : 0
  return `GATE ${safeCurrent + 1}/${safeTotal}`
}

/** Route the navigation cue to base while an engine-out sortie is recoverable. */
export function emergencyReturnActive(engineOut: boolean, phase: unknown): boolean {
  return engineOut === true && phase !== 'complete' && phase !== 'failed'
}

export type NavigationAltitudeCue = 'high' | 'low' | 'level'

export type NavigationRangeCue = 'closing' | 'opening' | 'steady'

export type NavigationApproachCue = 'aligned' | 'turn-left' | 'turn-right'

export type NavigationLateralCue = 'center' | 'left' | 'right'

export type NavigationSpeedCue = 'slow' | 'on-speed' | 'fast'

export type NavigationGlideCue = 'high' | 'on-slope' | 'low'

/** Convert target altitude error into a calm climb, descent, or level cue. */
export function navigationAltitudeCue(
  altDelta: number,
  target: unknown = 'gate',
): NavigationAltitudeCue {
  const safe = Number.isFinite(altDelta) ? altDelta : 0
  const threshold = target === 'base' ? 25 : 40
  if (safe > threshold) return 'high'
  if (safe < -threshold) return 'low'
  return 'level'
}

/** Turn target distance change into a calm closing, opening, or steady cue. */
export function navigationRangeCue(current: number, previous: number): NavigationRangeCue {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0
  if (!Number.isFinite(previous)) return 'steady'
  const safePrevious = Math.max(0, previous)
  const delta = safeCurrent - safePrevious
  if (Math.abs(delta) <= 4) return 'steady'
  return delta < 0 ? 'closing' : 'opening'
}

/** Estimate target arrival time only while the route is visibly closing. */
export function navigationEtaSeconds(
  distance: number,
  speed: number,
  rangeCue: NavigationRangeCue,
): number | null {
  if (rangeCue !== 'closing' || !Number.isFinite(distance) || !Number.isFinite(speed) || speed < 1) return null
  return Math.min(5999, Math.max(0, Math.round(Math.max(0, distance) / speed)))
}

/** Compare aircraft heading with the home runway for the return leg. */
export function navigationApproachCue(
  headingDelta: number,
  target: unknown = 'base',
): NavigationApproachCue | null {
  if (target !== 'base' || !Number.isFinite(headingDelta)) return null
  let delta = headingDelta % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  if (Math.abs(delta) <= 8 * (Math.PI / 180)) return 'aligned'
  return delta > 0 ? 'turn-left' : 'turn-right'
}

/** Resolve a bounded correction back toward the home-runway centerline. */
export function navigationLateralCue(
  lateralOffset: number,
  target: unknown = 'base',
): NavigationLateralCue | null {
  if (target !== 'base' || !Number.isFinite(lateralOffset)) return null
  if (lateralOffset > 12) return 'left'
  if (lateralOffset < -12) return 'right'
  return 'center'
}

export function navigationLateralLabel(cue: NavigationLateralCue | null): string {
  if (cue === 'left') return 'LINE L'
  if (cue === 'right') return 'LINE R'
  if (cue === 'center') return 'LINE OK'
  return ''
}

/** Keep base-return energy feedback inside a forgiving landing window. */
export function navigationSpeedCue(
  speed: number,
  target: unknown = 'base',
): NavigationSpeedCue | null {
  if (target !== 'base' || !Number.isFinite(speed)) return null
  if (speed < 46) return 'slow'
  if (speed > 70) return 'fast'
  return 'on-speed'
}

export function navigationSpeedLabel(cue: NavigationSpeedCue | null): string {
  if (cue === 'slow') return 'SPD SLOW'
  if (cue === 'fast') return 'SPD FAST'
  if (cue === 'on-speed') return 'SPD OK'
  return ''
}

/** Compare base-return altitude to a forgiving straight-in glide window. */
export function navigationGlideCue(
  distance: number,
  altDelta: number,
  target: unknown = 'base',
): NavigationGlideCue | null {
  if (target !== 'base' || !Number.isFinite(distance) || !Number.isFinite(altDelta)) return null
  const safeDistance = Math.max(120, distance)
  const slope = altDelta / safeDistance
  if (slope > 0.12) return 'high'
  if (slope < 0.02) return 'low'
  return 'on-slope'
}

export function navigationGlideLabel(cue: NavigationGlideCue | null): string {
  if (cue === 'high') return 'GS HIGH'
  if (cue === 'low') return 'GS LOW'
  if (cue === 'on-slope') return 'GS OK'
  return ''
}

/** Keep manual weather changes audible without exposing raw or empty labels. */
export function weatherCycleBanner(label: unknown): string {
  const safe = typeof label === 'string' && label.trim().length > 0
    ? label.trim()
    : 'WEATHER'
  return `WEATHER SHIFT / ${safe}`
}

/** Keep the active weather-front transition legible without raw blend values. */
export function weatherTransitionLabel(transitioning: boolean): string {
  return transitioning === true ? 'SHIFT' : ''
}

/** Keep the visible weather label synchronized with the active front target. */
export function weatherDisplayLabel(value: unknown, transitioning: boolean): string {
  const label = typeof value === 'string' ? value.trim() : ''
  if (!label) return ''
  return transitioning === true ? `${label} · ${weatherTransitionLabel(true)}` : label
}

/** Keep engine-stress feedback bounded and calm for arcade flight. */
export function engineHeatCue(fraction: number): EngineHeatCue {
  if (!Number.isFinite(fraction)) return 'normal'
  const safe = Math.max(0, Math.min(1, fraction))
  if (safe >= 0.88) return 'critical'
  if (safe >= 0.65) return 'hot'
  return 'normal'
}

/** Announce only meaningful engine heat transitions, not every HUD frame. */
export function engineHeatBanner(
  cue: EngineHeatCue,
  previous: EngineHeatCue | null,
): string | null {
  if (previous === null || cue === previous) return null
  if (cue === 'critical') return 'ENGINE HEAT CRITICAL / REDUCE POWER'
  if (cue === 'hot') return 'ENGINE HOT / REDUCE POWER'
  return 'ENGINE COOLING'
}

/** Announce the single transition from heat lockout back to boost-ready. */
export function engineHeatRearmBanner(previousLocked: boolean, locked: boolean): string | null {
  return previousLocked && !locked ? 'AFTERBURNER READY / ENGINE COOL' : null
}

/** Format a finite fuel endurance estimate for the compact HUD row. */
export function formatFuelEndurance(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return 'END --'
  const safe = Math.min(359_999, Math.max(0, Math.round(seconds)))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return hours > 0
    ? `END ${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `END ${minutes}:${String(secs).padStart(2, '0')}`
}

/** Keep the grounded airfield refuel state visible after its launch banner fades. */
export function refuelHudLabel(refueling: unknown, fraction: number): string {
  if (refueling !== true) return ''
  const percent = fuelPercent({ fraction })
  return `REFUEL ${percent}%`
}

/** Describe the same bounded refuel state for assistive technology. */
export function refuelAriaLabel(refueling: unknown, fraction: number): string {
  const label = refuelHudLabel(refueling, fraction)
  return label ? `Refueling at ${label.slice(7)}` : ''
}

/** Keep the final approach quality forecast compact and aligned with results. */
export function landingPreviewHudLabel(quality: number | null | undefined): string {
  if (quality === null || quality === undefined || !Number.isFinite(quality)) return ''
  return landingQualityLabel(quality)
}

/** Describe the same touchdown forecast without exposing raw scoring math. */
export function landingPreviewAriaLabel(quality: number | null | undefined): string {
  const label = landingPreviewHudLabel(quality)
  return label ? `Predicted touchdown ${label.toLowerCase()}` : ''
}

/** Keep live pace feedback readable while allowing a safe pre-run fallback. */
export function missionPaceLabel(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return 'READY'
  return value.trim()
}

/** Keep best-run ghost pacing compact and calm around the zero crossing. */
export function ghostPaceLabel(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return ''
  const safe = Math.max(-9_999, Math.min(9_999, delta))
  if (Math.abs(safe) < 0.05) return 'EVEN'
  const seconds = Math.abs(Math.round(safe * 10) / 10).toFixed(1)
  return safe < 0 ? `AHEAD ${seconds}S` : `BEHIND ${seconds}S`
}

/** Describe ghost pacing without exposing the signed implementation detail. */
export function ghostPaceAriaLabel(delta: number | null | undefined): string {
  const label = ghostPaceLabel(delta)
  if (!label) return ''
  if (label === 'EVEN') return 'Best-run ghost pace even'
  return label.startsWith('AHEAD')
    ? `Best-run ghost pace ahead by ${label.slice(6).toLowerCase()}`
    : `Best-run ghost pace behind by ${label.slice(7).toLowerCase()}`
}

/** Hide ghost pace telemetry together with the optional ghost path. */
export function visibleGhostPaceDelta(
  delta: number | null | undefined,
  visible: boolean,
): number | null {
  return visible === true && delta !== null && delta !== undefined && Number.isFinite(delta)
    ? delta
    : null
}

/** Keep the optional sortie contract visible without exposing raw tracker state. */
export function contractProgressLabel(
  label: unknown,
  progress: number,
  complete: boolean,
  failed = false,
): string {
  if (typeof label !== 'string' || label.trim().length === 0) return ''
  const safeProgress = Number.isFinite(progress)
    ? Math.max(0, Math.min(1, progress))
    : 0
  return `${label.trim()} ${failed === true ? 'FAILED' : complete === true ? 'DONE' : `${Math.round(safeProgress * 100)}%`}`
}

/** Describe the contract row to assistive technology using the same bounded state. */
export function contractProgressAriaLabel(
  label: unknown,
  progress: number,
  complete: boolean,
  failed = false,
): string {
  if (typeof label !== 'string' || label.trim().length === 0) return ''
  const cleanLabel = label.trim().replace(/^CONTRACT\s+/i, '')
  if (failed === true) return `Contract ${cleanLabel.toLowerCase()} failed`
  if (complete === true) return `Contract ${cleanLabel.toLowerCase()} complete`
  const safeProgress = Number.isFinite(progress)
    ? Math.round(Math.max(0, Math.min(1, progress)) * 100)
    : 0
  return `Contract ${cleanLabel.toLowerCase()}, ${safeProgress} percent complete`
}

/** Keep the contract instruction bounded for the live task detail line. */
export function contractDetailLabel(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 120)
}

/** Describe the same bounded task instruction to assistive technology. */
export function contractDetailAriaLabel(value: unknown): string {
  const detail = contractDetailLabel(value)
  return detail ? `Contract instruction: ${detail.toLowerCase()}` : ''
}

/** Describe afterburner availability without exposing internal lockout state. */
export function afterburnerHudLabel(
  active: boolean,
  lock: unknown,
): 'AB ON' | 'AB READY' | 'AB HOT' | 'AB FUEL' {
  if (lock === 'heat') return 'AB HOT'
  if (lock === 'fuel') return 'AB FUEL'
  return active ? 'AB ON' : 'AB READY'
}

/** Keep the opt-in flight-assist state visible after its toggle banner fades. */
export function stabilityAssistLabel(active: unknown): string {
  return active === true ? 'TRIM ON' : 'TRIM OFF'
}

/** Announce the single transition from powered flight to a fuel-out glide. */
export function engineFuelAvailabilityBanner(
  previousAvailable: boolean,
  available: boolean,
): string | null {
  return previousAvailable && !available ? 'ENGINE OUT / GLIDE TO BASE' : null
}

export class HUD {
  private readonly hudRoot: HTMLElement | null
  private readonly posEl: HTMLElement | null
  private readonly verticalSpeedEl: HTMLElement | null
  private readonly gEl: HTMLElement | null
  private readonly flightLogRowEl: HTMLElement | null
  private readonly flightLogEl: HTMLElement | null
  private readonly machEl: HTMLElement | null
  private readonly spdEl: HTMLElement | null
  private readonly speedoPanel: HTMLElement | null
  private readonly camEl: HTMLElement | null
  private readonly headingEl: HTMLElement | null
  private readonly headingTapeTrackEl: HTMLElement | null
  private readonly audioEl: HTMLElement | null
  private readonly fpsEl: HTMLElement | null
  private readonly thrEl: HTMLElement | null
  private readonly airbrakeEl: HTMLElement | null
  private readonly gearEl: HTMLElement | null
  private readonly engineHeatEl: HTMLElement | null
  private readonly stateEl: HTMLElement | null
  private readonly bannerEl: HTMLElement | null
  private readonly spdNeedle: SVGLineElement | null
  private readonly spdArc: SVGPathElement | null
  private readonly engFill: HTMLElement | null
  private readonly engMarker: HTMLElement | null
  private readonly engPanel: HTMLElement | null
  private readonly abStateEl: HTMLElement | null
  private readonly adiBall: HTMLElement | null
  private readonly adiBankPtr: HTMLElement | null
  private readonly adiPitchEl: HTMLElement | null
  private readonly adiRollEl: HTMLElement | null
  private readonly warnEl: HTMLElement | null
  private readonly warnTextEl: HTMLElement | null
  private readonly clockEl: HTMLElement | null
  private readonly weatherEl: HTMLElement | null
  private readonly windEl: HTMLElement | null
  private readonly phaseEl: HTMLElement | null
  private readonly missionEl: HTMLElement | null
  private readonly routeRiskRowEl: HTMLElement | null
  private readonly routeRiskEl: HTMLElement | null
  private readonly paceEl: HTMLElement | null
  private readonly ghostPaceRowEl: HTMLElement | null
  private readonly ghostPaceEl: HTMLElement | null
  private readonly missionProgressEl: HTMLElement | null
  private readonly contractRowEl: HTMLElement | null
  private readonly contractEl: HTMLElement | null
  private readonly contractDetailEl: HTMLElement | null
  private readonly contractStreakRowEl: HTMLElement | null
  private readonly contractStreakEl: HTMLElement | null
  private readonly biomeRowEl: HTMLElement | null
  private readonly biomeEl: HTMLElement | null
  private readonly comboRowEl: HTMLElement | null
  private readonly comboEl: HTMLElement | null
  private readonly fuelEl: HTMLElement | null
  private readonly fuelEnduranceEl: HTMLElement | null
  private readonly refuelRowEl: HTMLElement | null
  private readonly refuelEl: HTMLElement | null
  private readonly landingRowEl: HTMLElement | null
  private readonly landingEl: HTMLElement | null
  private readonly radarEl: HTMLElement | null
  private readonly assistEl: HTMLElement | null
  private readonly hintEl: HTMLElement | null
  private readonly pausedEl: HTMLElement | null
  private readonly speedJuiceEl: HTMLElement | null
  private readonly canopyTintEl: HTMLElement | null
  private readonly heatVeilEl: HTMLElement | null
  private readonly gLoadVeilEl: HTMLElement | null
  private readonly flightPathEl: HTMLElement | null
  private readonly navCueEl: HTMLElement | null
  private readonly navTargetEl: HTMLElement | null
  private readonly navArrowEl: HTMLElement | null
  private readonly navTurnEl: HTMLElement | null
  private readonly navApproachEl: HTMLElement | null
  private readonly navLateralEl: HTMLElement | null
  private readonly navSpeedEl: HTMLElement | null
  private readonly navGlideEl: HTMLElement | null
  private readonly navRangeEl: HTMLElement | null
  private readonly navTrendEl: HTMLElement | null
  private readonly navEtaEl: HTMLElement | null
  private readonly navAltEl: HTMLElement | null

  /** Display range for the airspeed dial (knots). */
  private readonly maxKts = 3000
  /** Pixels of ladder travel per degree of pitch. */
  private readonly pxPerDeg = 2.4
  private readonly styleCache = new WeakMap<Element, Map<string, string>>()
  private readonly attributeCache = new WeakMap<Element, Map<string, string>>()
  private readonly classCache = new WeakMap<Element, Map<string, boolean>>()
  private readonly textCache = new WeakMap<Element, string>()
  private readonly radarLabelCache = createRadarContactsLabelCache()
  private altitudeValue = Number.NaN
  private altitudeText = ''
  private altitudeAriaText = ''
  private altitudeCueValue: AltitudeCue | null = null
  private verticalSpeedValue = Number.NaN
  private verticalSpeedText = ''
  private verticalSpeedAriaText = ''
  private gValue = Number.NaN
  private gText = ''
  private flightLogText = ''
  private flightLogDistanceValue = -1
  private flightLogPositiveGValue = Number.NaN
  private flightLogNegativeGValue = Number.NaN
  private machValue = Number.NaN
  private machText = 'M0.00'
  private machAriaText = 'M0.00, subsonic'
  private machCueValue: MachCue | null = null
  private throttleValue = Number.NaN
  private throttleText = ''
  private speedValue = Number.NaN
  private speedText = ''
  private speedAriaText = ''
  private speedWarningValue: SpeedWarningLevel | null = null
  private fpsValue = Number.NaN
  private fpsText = ''
  private cameraModeValue: string | null = null
  private cameraModeText = ''
  private headingValue = Number.NaN
  private headingText = ''
  private headingTapeValue = Number.NaN
  private headingTapeTransform = ''
  private audioMutedValue: boolean | null = null
  private audioText = ''
  private pitchValue = Number.NaN
  private pitchText = ''
  private rollValue = Number.NaN
  private rollText = ''
  private fuelValue = Number.NaN
  private fuelText = ''
  private fuelAriaText = ''
  private fuelEnduranceValue = -1
  private fuelEnduranceText = 'END --'
  private refuelValue: boolean | null = null
  private refuelPercentValue = -1
  private refuelText = ''
  private refuelAriaText = ''
  private landingPreviewValue = Number.NaN
  private landingPreviewText = ''
  private landingPreviewAriaText = ''
  private engineHeatValue = Number.NaN
  private engineHeatText = ''
  private abStateText = 'AB READY'
  private radarText = ''
  private radarAriaText = ''
  private stabilityAssistValue: boolean | null = null
  private hintText = ''
  private pausedValue: boolean | null = null
  private hudBackgroundHiddenValue: boolean | null = null
  private windSpeedValue = Number.NaN
  private windDirectionValue = Number.NaN
  private windCrosswindValue = Number.NaN
  private windCrosswindSideValue: CrosswindSide = 'calm'
  private windCrosswindVisible = false
  private windGustCueValue: WindGustCue = 'calm'
  private windText = ''
  private windAriaText = ''
  private weatherCueValue: WeatherCue | null = null
  private weatherTransitionValue: boolean | null = null
  private weatherLabelValue = ''
  private weatherText = ''
  private weatherAriaText = ''
  private missionPhaseValue: MissionPhaseCue | null = null
  private routeRiskText = ''
  private routeRiskAriaText = ''
  private missionProgressCurrent = -1
  private missionProgressTotal = -1
  private missionProgressPercentText = ''
  private missionProgressAriaText = ''
  private contractLabelValue = ''
  private contractProgressValue = -1
  private contractCompleteValue: boolean | null = null
  private contractFailedValue: boolean | null = null
  private contractText = ''
  private contractAriaText = ''
  private contractDetailText = ''
  private contractStreakValue = -1
  private contractStreakText = '--'
  private contractStreakAriaText = 'no completed contract chain'
  private biomeCountValue = -1
  private biomeText = '--'
  private biomeAriaText = '0 distinct biomes surveyed'
  private comboValue = -1
  private comboText = ''
  private comboAriaText = ''
  private paceText = 'READY'
  private ghostPaceText = ''
  private flightStateValue: FlightStateCue | null = null
  private flightStateText = ''
  private flightStateAriaText = ''
  private navBearingValue = Number.NaN
  private navBearingText = ''
  private navSectorValue: NavigationSector | null = null
  private navTurnText = ''
  private navApproachText = ''
  private navLateralText = ''
  private navSpeedText = ''
  private navGlideText = ''
  private navRangeMode = -1
  private navRangeStep = Number.NaN
  private navRangeText = ''
  private navRangeValue = Number.NaN
  private navRangeCueValue: NavigationRangeCue | null = null
  private navRangeCueText = ''
  private navTargetValue: 'NEXT GATE' | 'BASE' | 'CITY' | 'VILLAGE' | null = null
  private navEtaValue = -1
  private navEtaText = '--'
  private navAltMode = -1
  private navAltStep = Number.NaN
  private navAltText = ''
  private flightPathXValue = Number.NaN
  private flightPathYValue = Number.NaN
  private flightPathXText = ''
  private flightPathYText = ''
  private speedNeedleXValue = Number.NaN
  private speedNeedleXText = ''
  private speedNeedleYValue = Number.NaN
  private speedNeedleYText = ''
  private speedNeedleValue = Number.NaN
  private speedArcValue = Number.NaN
  private speedArcText = ''
  private adiBallPitchValue = Number.NaN
  private adiBallRollValue = Number.NaN
  private adiBallTransform = ''
  private adiBankValue = Number.NaN
  private adiBankTransform = ''
  private previousGearDown: boolean | null = null
  private gearFlashUntil = 0

  constructor(root: Document = document) {
    this.hudRoot = root.getElementById('hud')
    this.posEl = root.getElementById('hud-pos')
    this.verticalSpeedEl = root.getElementById('hud-vs')
    this.gEl = root.getElementById('hud-g')
    this.flightLogRowEl = root.getElementById('hud-flight-log-row')
    this.flightLogEl = root.getElementById('hud-flight-log')
    this.machEl = root.getElementById('hud-mach')
    this.spdEl = root.getElementById('hud-spd')
    this.speedoPanel = root.getElementById('speedo-panel')
    this.camEl = root.getElementById('hud-cam')
    this.headingEl = root.getElementById('hud-hdg')
    this.headingTapeTrackEl = root.getElementById('heading-tape-track')
    this.audioEl = root.getElementById('hud-audio')
    this.fpsEl = root.getElementById('hud-fps')
    this.thrEl = root.getElementById('hud-thr')
    this.airbrakeEl = root.getElementById('hud-airbrake')
    this.gearEl = root.getElementById('hud-gear')
    this.engineHeatEl = root.getElementById('hud-engine-heat')
    this.stateEl = root.getElementById('hud-state')
    this.bannerEl = root.getElementById('hud-banner')
    this.spdNeedle = root.getElementById('spd-needle') as SVGLineElement | null
    this.spdArc = root.getElementById('spd-arc') as SVGPathElement | null
    this.engFill = root.getElementById('eng-fill')
    this.engMarker = root.getElementById('eng-marker')
    this.engPanel = root.getElementById('eng-panel')
    this.abStateEl = root.getElementById('hud-ab-state')
    this.adiBall = root.getElementById('adi-ball')
    this.adiBankPtr = root.getElementById('adi-bank-ptr')
    this.adiPitchEl = root.getElementById('adi-pitch')
    this.adiRollEl = root.getElementById('adi-roll')
    this.warnEl = root.getElementById('hud-warn')
    this.warnTextEl = root.getElementById('hud-warn-text')
    this.clockEl = root.getElementById('hud-clock')
    this.weatherEl = root.getElementById('hud-weather')
    this.windEl = root.getElementById('hud-wind')
    this.phaseEl = root.getElementById('hud-phase')
    this.missionEl = root.getElementById('hud-mission')
    this.routeRiskRowEl = root.getElementById('hud-route-risk-row')
    this.routeRiskEl = root.getElementById('hud-route-risk')
    this.paceEl = root.getElementById('hud-pace')
    this.ghostPaceRowEl = root.getElementById('hud-ghost-pace-row')
    this.ghostPaceEl = root.getElementById('hud-ghost-pace')
    this.missionProgressEl = root.getElementById('hud-gate-progress')
    this.contractRowEl = root.getElementById('hud-contract-row')
    this.contractEl = root.getElementById('hud-contract')
    this.contractDetailEl = root.getElementById('hud-contract-detail')
    this.contractStreakRowEl = root.getElementById('hud-contract-streak-row')
    this.contractStreakEl = root.getElementById('hud-contract-streak')
    this.biomeRowEl = root.getElementById('hud-biome-row')
    this.biomeEl = root.getElementById('hud-biome')
    this.comboRowEl = root.getElementById('hud-combo-row')
    this.comboEl = root.getElementById('hud-combo')
    this.fuelEl = root.getElementById('hud-fuel')
    this.fuelEnduranceEl = root.getElementById('hud-fuel-endurance')
    this.refuelRowEl = root.getElementById('hud-refuel-row')
    this.refuelEl = root.getElementById('hud-refuel')
    this.landingRowEl = root.getElementById('hud-landing-row')
    this.landingEl = root.getElementById('hud-landing')
    this.radarEl = root.getElementById('hud-radar')
    this.assistEl = root.getElementById('hud-assist')
    this.hintEl = root.getElementById('hud-hint')
    this.pausedEl = root.getElementById('hud-paused')
    this.speedJuiceEl = root.getElementById('speed-juice')
    this.canopyTintEl = root.getElementById('canopy-tint')
    this.heatVeilEl = root.getElementById('heat-veil')
    this.gLoadVeilEl = root.getElementById('g-load-veil')
    this.flightPathEl = root.getElementById('flight-path-marker')
    this.navCueEl = root.getElementById('nav-cue')
    this.navTargetEl = root.getElementById('nav-target')
    this.navArrowEl = root.getElementById('nav-arrow')
    this.navTurnEl = root.getElementById('nav-turn')
    this.navApproachEl = root.getElementById('nav-approach')
    this.navLateralEl = root.getElementById('nav-line')
    this.navSpeedEl = root.getElementById('nav-speed')
    this.navGlideEl = root.getElementById('nav-glide')
    this.navRangeEl = root.getElementById('nav-range')
    this.navTrendEl = root.getElementById('nav-trend')
    this.navEtaEl = root.getElementById('nav-eta')
    this.navAltEl = root.getElementById('nav-alt')
    this.buildSpeedTicks(root)
    this.buildAttitudeLadder(root)
    this.buildBankMarks(root)
    this.buildHeadingTape(root)
  }

  /** Keep the frozen-flight state explicit even while live telemetry is paused. */
  setPaused(paused: boolean): void {
    if (!this.pausedEl || paused === this.pausedValue) return
    this.pausedValue = paused
    const label = pauseStateLabel(paused)
    this.setText(this.pausedEl, label)
    this.setHidden(this.pausedEl, !paused)
    this.setAttribute(this.pausedEl, 'aria-label', paused ? 'Flight paused. Simulation held.' : '')
  }

  /** Keep stale telemetry out of the accessibility tree while a modal is open. */
  setBackgroundHidden(hidden: boolean): void {
    if (!this.hudRoot || hidden === this.hudBackgroundHiddenValue) return
    this.hudBackgroundHiddenValue = hidden
    this.setAttribute(this.hudRoot, 'aria-hidden', hidden ? 'true' : 'false')
  }

  update(opts: {
    y: number
    /** Vertical velocity in metres per second, positive while climbing. */
    verticalSpeed?: number
    /** Smoothed acceleration along the pilot body-up axis, in G. */
    gForce?: number
    /** Fixed-step flight distance and peak load-factor telemetry. */
    flightDistanceM?: number
    peakPositiveG?: number
    peakNegativeG?: number
    /** Current true airspeed as a Mach ratio, or derived from speed when omitted. */
    mach?: number
    speed: number
    cameraMode: string
    /** Aircraft heading (rad, 0 = north / +Z). */
    heading?: number
    audioMuted?: boolean
    fps: number
    throttle?: number
    boost?: boolean
    airbrake?: boolean
    /** Bounded engine stress fraction used by the compact temperature row. */
    engineHeat?: number
    /** Current afterburner lockout source, if boost is unavailable. */
    afterburnerLock?: 'fuel' | 'heat' | null
    gearDown?: boolean
    onGround?: boolean
    /** Aircraft pitch (rad), nose up positive. */
    pitch?: number
    /** Aircraft roll (rad), right wing down positive. */
    roll?: number
    /** Stable aircraft state used by the compact state row. */
    flightState?: FlightStateCue | string
    /** Live rain intensity used by the cockpit canopy veil. */
    rain?: number
    /** Live snow intensity used by the cockpit canopy veil. */
    snow?: number
    /** Live world wind vector in metres per second. */
    windX?: number
    windZ?: number
    /** Bounded weather gust intensity used for a compact wind-risk cue. */
    weatherGust?: number
    /** Runway-relative crosswind used on the return leg, in metres per second. */
    crosswind?: number | null
    /** Side of the runway toward which the live crosswind vector points. */
    crosswindSide?: CrosswindSide
    /** Active caution / warning (STALL, LOW ALT, GEAR). */
    warning?: string | null
    warningLevel?: 'none' | 'caution' | 'warning'
    clock?: string
    weather?: string
    /** Weather profile ID used for compact severity styling. */
    weatherKind?: string
    /** Whether the live weather front is blending between profiles. */
    weatherTransitioning?: boolean
    dayPhase?: string
    mission?: string
    /** Compact route difficulty and rhythm cue, or empty for Free flight. */
    routeRisk?: string | null
    routeRiskAria?: string | null
    /** Live checkpoint pace context, or null before the first clear. */
    pace?: string | null
    /** Signed elapsed-time delta against the saved best-run ghost. */
    ghostPace?: number | null
    /** Remaining fuel as a normalized fraction. */
    fuel?: number
    /** Whether the aircraft is currently refilling while parked on the home strip. */
    refueling?: boolean
    /** Predicted final touchdown quality shown only on the close return approach. */
    landingPreview?: number | null
    /** Current route phase used for a restrained mission-state cue. */
    missionPhase?: MissionPhaseCue | string
    /** Cleared and total gates for the compact route progress meter. */
    missionCurrent?: number
    missionTotal?: number
    /** Optional bonus-contract label and bounded progress for the task row. */
    contractLabel?: string | null
    /** Full bounded instruction for the active bonus contract. */
    contractDetail?: string | null
    contractProgress?: number
    contractComplete?: boolean
    contractFailed?: boolean
    /** Completed bonus-contract chain entering this sortie. */
    contractStreak?: number
    /** Distinct natural biomes surveyed during the current sortie. */
    biomeCount?: number
    /** Current event-driven clean-flight combo count. */
    combo?: number
    /** Bounded navigation contacts prepared by RadarSystem. */
    radar?: readonly RadarContact[]
    /** Opt-in pitch and bank trim state. */
    stabilityAssist?: boolean
    /** Temporary control hint shown during the takeoff handoff. */
    controlHint?: string | null
    /** Next-gate range in meters; omit or 0 to hide. */
    navDist?: number
    /** RAF timestamp shared by the main loop for time-based HUD cues. */
    timeMs?: number
    /** Radians, 0 = ahead, + = right of nose. */
    navBearing?: number | null
    /** Navigation target kind for the cue header. */
    navTarget?: 'gate' | 'base' | string
    /** Return-leg runway alignment cue. */
    navApproach?: NavigationApproachCue | null
    /** Return-leg runway centerline correction cue. */
    navLateral?: NavigationLateralCue | null
    /** Return-leg landing-energy cue. */
    navSpeed?: NavigationSpeedCue | null
    /** Return-leg glide-slope cue. */
    navGlide?: NavigationGlideCue | null
    navAltDelta?: number
    banner?: string | null
    bannerTone?: HudBannerTone
    /** Cockpit-only velocity-vector position in viewport percentages. */
    flightPathVisible?: boolean
    flightPathX?: number
    flightPathY?: number
  }): void {
    if (this.posEl) {
      const altitude = Number.isFinite(opts.y) ? Math.round(opts.y) : 0
      const cue = altitudeCue(opts.y, opts.onGround === true)
      const altitudeChanged = altitude !== this.altitudeValue
      if (altitudeChanged) {
        this.altitudeValue = altitude
        this.altitudeText = String(altitude)
      }
      if (cue !== this.altitudeCueValue || altitudeChanged) {
        this.altitudeCueValue = cue
        const cueText = cue === 'warning'
          ? ', terrain clearance warning'
          : cue === 'caution' ? ', low terrain clearance' : ''
        this.altitudeAriaText = `${this.altitudeText} metres${cueText}`
      }
      this.setText(this.posEl, this.altitudeText)
      this.setAttribute(this.posEl, 'aria-valuenow', String(Math.max(0, altitude)))
      this.setAttribute(this.posEl, 'aria-valuetext', this.altitudeAriaText)
      this.setClass(this.posEl, 'clearance-caution', cue === 'caution')
      this.setClass(this.posEl, 'clearance-warning', cue === 'warning')
    }

    if (this.verticalSpeedEl) {
      const verticalSpeed = Number.isFinite(opts.verticalSpeed) ? Math.round(opts.verticalSpeed!) : 0
      if (verticalSpeed !== this.verticalSpeedValue) {
        this.verticalSpeedValue = verticalSpeed
        this.verticalSpeedText = formatVerticalSpeed(verticalSpeed)
        this.verticalSpeedAriaText = `${this.verticalSpeedText} metres per second`
      }
      this.setText(this.verticalSpeedEl, this.verticalSpeedText)
      this.setAttribute(this.verticalSpeedEl, 'aria-valuenow', String(verticalSpeed))
      this.setAttribute(this.verticalSpeedEl, 'aria-valuetext', this.verticalSpeedAriaText)
      const tone = verticalSpeedTone(opts.verticalSpeed ?? 0)
      this.setClass(this.verticalSpeedEl, 'climb', tone === 'climb')
      this.setClass(this.verticalSpeedEl, 'sink', tone === 'sink')
    }

    if (this.gEl && opts.gForce !== undefined) {
      const gForce = Math.max(-4, Math.min(12, safeHudValue(opts.gForce, 1)))
      const shown = Math.sign(gForce) * Math.round(Math.abs(gForce) * 10) / 10
      if (shown !== this.gValue) {
        this.gValue = shown
        this.gText = formatGForce(shown)
      }
      this.setText(this.gEl, this.gText)
      this.setAttribute(this.gEl, 'aria-valuenow', String(shown))
      this.setAttribute(this.gEl, 'aria-valuetext', this.gText)
      const tone = gForceTone(shown)
      this.setClass(this.gEl, 'high-g', tone === 'high')
      this.setClass(this.gEl, 'negative-g', tone === 'negative')
    }

    if (this.flightLogRowEl && this.flightLogEl && (
      opts.flightDistanceM !== undefined ||
      opts.peakPositiveG !== undefined ||
      opts.peakNegativeG !== undefined
    )) {
      const distance = Number.isFinite(opts.flightDistanceM) ? Math.max(0, opts.flightDistanceM!) : 0
      const positive = Number.isFinite(opts.peakPositiveG) ? opts.peakPositiveG! : 0
      const negative = Number.isFinite(opts.peakNegativeG) ? opts.peakNegativeG! : 0
      const distanceStep = Math.round(distance / 100) * 100
      const positiveStep = Math.round(positive * 10) / 10
      const negativeStep = Math.round(negative * 10) / 10
      if (
        distanceStep !== this.flightLogDistanceValue ||
        positiveStep !== this.flightLogPositiveGValue ||
        negativeStep !== this.flightLogNegativeGValue
      ) {
        this.flightLogDistanceValue = distanceStep
        this.flightLogPositiveGValue = positiveStep
        this.flightLogNegativeGValue = negativeStep
        this.flightLogText = flightLogHudLabel(distanceStep, positiveStep, negativeStep)
      }
      this.setText(this.flightLogEl, this.flightLogText)
      this.setHidden(this.flightLogRowEl, this.flightLogText.length === 0)
      this.setAttribute(this.flightLogEl, 'aria-label', flightLogAriaLabel(distanceStep, positiveStep, negativeStep))
    }

    if (this.machEl) {
      const mach = opts.mach === undefined
        ? machNumber(opts.speed)
        : Number.isFinite(opts.mach) ? Math.min(20, Math.max(0, opts.mach)) : 0
      const shown = Math.round(mach * 100) / 100
      const cue = machCue(mach)
      if (shown !== this.machValue || cue !== this.machCueValue) {
        this.machValue = shown
        this.machCueValue = cue
        this.machText = machLabel(shown)
        this.machAriaText = machAriaLabel(shown)
      }
      this.setText(this.machEl, this.machText)
      this.setAttribute(this.machEl, 'aria-label', this.machAriaText)
      this.setAttribute(this.machEl, 'aria-valuenow', String(shown))
      this.setClass(this.machEl, 'transonic', cue === 'transonic')
      this.setClass(this.machEl, 'supersonic', cue === 'supersonic')
    }

    const rawKts = displayedKnots(opts.speed)
    const kts = Number.isFinite(rawKts) ? rawKts : 0
    if (this.spdEl) {
      const speed = Math.round(kts)
      const warning = speedWarningLevel(kts, this.maxKts)
      if (speed !== this.speedValue || warning !== this.speedWarningValue) {
        this.speedValue = speed
        this.speedText = String(speed)
        this.speedWarningValue = warning
        const suffix = warning === 'overspeed'
          ? ', overspeed'
          : warning === 'redline'
            ? ', redline'
            : ''
        this.speedAriaText = `${this.speedText} knots${suffix}`
      }
      this.setText(this.spdEl, this.speedText)
      this.setAttribute(this.spdEl, 'aria-valuenow', String(Math.max(0, speed)))
      this.setAttribute(this.spdEl, 'aria-valuetext', this.speedAriaText)
      if (this.speedoPanel) {
        this.setClass(this.speedoPanel, 'redline', warning !== 'normal')
        this.setClass(this.speedoPanel, 'overspeed', warning === 'overspeed')
      }
    }
    this.updateSpeedo(kts)
    this.updateSpeedJuice(kts, !!opts.boost)
    this.updateCanopyTint(
      kts,
      opts.cameraMode === 'cockpit',
      opts.rain ?? 0,
      opts.snow ?? 0,
    )
    this.updateHeatVeil(kts, !!opts.boost)
    this.updateGLoadVeil(opts.gForce)
    this.updateFlightPath(
      opts.flightPathVisible === true,
      opts.flightPathX ?? 50,
      opts.flightPathY ?? 50,
    )

    if (this.camEl) {
      if (opts.cameraMode !== this.cameraModeValue) {
        this.cameraModeValue = opts.cameraMode
        this.cameraModeText = opts.cameraMode.toUpperCase()
      }
      this.setText(this.camEl, this.cameraModeText)
    }
    if (this.headingEl && opts.heading !== undefined) {
      const heading = headingDegrees(opts.heading)
      if (heading !== this.headingValue) {
        this.headingValue = heading
        this.headingText = formatHeading(opts.heading)
      }
      this.setText(this.headingEl, this.headingText)
      this.updateHeadingTape(opts.heading)
    }
    if (this.audioEl && opts.audioMuted !== undefined) {
      const muted = !!opts.audioMuted
      if (muted !== this.audioMutedValue) {
        this.audioMutedValue = muted
        this.audioText = formatAudioState(muted)
      }
      this.setText(this.audioEl, this.audioText)
      this.setClass(this.audioEl, 'muted', muted)
    }
    if (this.fpsEl) {
      const fps = Math.max(0, Math.round(safeHudValue(opts.fps)))
      if (fps !== this.fpsValue) {
        this.fpsValue = fps
        this.fpsText = String(fps)
      }
      this.setText(this.fpsEl, this.fpsText)
    }
    if (this.clockEl && opts.clock) {
      this.setText(this.clockEl, opts.clock)
    }
    if (this.weatherEl && opts.weather) {
      const transitioning = opts.weatherTransitioning === true
      const cue = weatherCue(opts.weatherKind ?? opts.weather)
      if (
        cue !== this.weatherCueValue ||
        transitioning !== this.weatherTransitionValue ||
        opts.weather !== this.weatherLabelValue ||
        this.weatherText.length === 0
      ) {
        this.weatherCueValue = cue
        this.weatherTransitionValue = transitioning
        this.weatherLabelValue = opts.weather
        this.weatherText = weatherDisplayLabel(opts.weather, transitioning)
        this.weatherAriaText = cue === 'severe'
          ? `Severe weather: ${opts.weather}`
          : cue === 'active' ? `Active weather: ${opts.weather}` : `Weather: ${opts.weather}`
        if (transitioning) this.weatherAriaText += ', front shifting'
      }
      this.setText(this.weatherEl, this.weatherText)
      this.setAttribute(this.weatherEl, 'aria-label', this.weatherAriaText)
      this.setAttribute(this.weatherEl, 'aria-live', 'polite')
      this.setClass(this.weatherEl, 'weather-active', cue === 'active')
      this.setClass(this.weatherEl, 'weather-severe', cue === 'severe')
    }
    if (this.windEl && (opts.windX !== undefined || opts.windZ !== undefined)) {
      const windX = Number.isFinite(opts.windX) ? opts.windX! : Number.NaN
      const windZ = Number.isFinite(opts.windZ) ? opts.windZ! : Number.NaN
      const speed = windSpeedMps(windX, windZ)
      const direction = windDirectionDegrees(windX, windZ)
      const speedStep = Math.round(speed)
      const crosswindVisible = opts.crosswind !== undefined && opts.crosswind !== null
      const crosswind = crosswindVisible && Number.isFinite(opts.crosswind)
        ? Math.max(0, opts.crosswind!)
        : 0
      const crosswindSide = crosswindVisible ? normalizeCrosswindSide(opts.crosswindSide) : 'calm'
      const crosswindStep = crosswindVisible ? Math.round(crosswind) : -1
      const gustCue = windGustCue(opts.weatherGust ?? 0)
      if (
        speedStep !== this.windSpeedValue ||
        direction !== this.windDirectionValue ||
        crosswindStep !== this.windCrosswindValue ||
        crosswindVisible !== this.windCrosswindVisible ||
        crosswindSide !== this.windCrosswindSideValue ||
        gustCue !== this.windGustCueValue
      ) {
        this.windSpeedValue = speedStep
        this.windDirectionValue = direction
        this.windCrosswindValue = crosswindStep
        this.windCrosswindVisible = crosswindVisible
        this.windCrosswindSideValue = crosswindSide
        this.windGustCueValue = gustCue
        const baseWindText = formatWind(windX, windZ)
        const crosswindText = crosswindVisible ? formatCrosswind(crosswind, crosswindSide) : ''
        const gustText = formatWindGust(opts.weatherGust ?? 0)
        this.windText = [baseWindText, crosswindText, gustText].filter(Boolean).join(' · ')
        const gustAria = gustCue === 'severe' ? 'strong gusts' : gustCue === 'active' ? 'active gusts' : ''
        this.windAriaText = baseWindText === 'CALM'
          ? ['Calm wind', crosswindText.toLowerCase(), gustAria].filter(Boolean).join(', ')
          : [
            `${speedStep} metres per second toward ${String(direction).padStart(3, '0')} degrees`,
            crosswindText.toLowerCase(),
            gustAria,
          ].filter(Boolean).join(', ')
      }
      this.setText(this.windEl, this.windText)
      this.setAttribute(this.windEl, 'aria-label', this.windAriaText)
      this.setClass(this.windEl, 'crosswind-active', crosswindVisible && crosswind >= 8)
      this.setClass(this.windEl, 'gust-active', gustCue !== 'calm')
      this.setClass(this.windEl, 'gust-severe', gustCue === 'severe')
    }
    if (this.phaseEl && opts.dayPhase) {
      this.setText(this.phaseEl, opts.dayPhase)
    }
    if (this.missionEl && opts.mission !== undefined) {
      this.setText(this.missionEl, opts.mission)
      this.setAttribute(this.missionEl, 'aria-live', 'polite')
      this.setAttribute(this.missionEl, 'aria-atomic', 'true')
      if (opts.missionPhase !== undefined) {
        const phase = normalizeMissionPhase(opts.missionPhase)
        if (phase !== this.missionPhaseValue) {
          this.missionPhaseValue = phase
          for (const candidate of MISSION_PHASES) {
            this.setClass(this.missionEl, `phase-${candidate}`, candidate === phase)
          }
        }
      }
    }
    if (this.routeRiskRowEl && this.routeRiskEl && opts.routeRisk !== undefined) {
      const text = typeof opts.routeRisk === 'string' ? opts.routeRisk : ''
      if (text !== this.routeRiskText) this.routeRiskText = text
      const aria = typeof opts.routeRiskAria === 'string' ? opts.routeRiskAria : ''
      if (aria !== this.routeRiskAriaText) this.routeRiskAriaText = aria
      this.setHidden(this.routeRiskRowEl, this.routeRiskText.length === 0)
      this.setText(this.routeRiskEl, this.routeRiskText)
      this.setAttribute(this.routeRiskEl, 'aria-label', this.routeRiskAriaText)
    }
    if (this.paceEl && opts.pace !== undefined) {
      const pace = missionPaceLabel(opts.pace)
      if (pace !== this.paceText) this.paceText = pace
      this.setText(this.paceEl, this.paceText)
      this.setAttribute(this.paceEl, 'aria-label', `Gate pace: ${this.paceText}`)
      this.setClass(this.paceEl, 'pace-ahead', this.paceText.startsWith('AHEAD'))
      this.setClass(this.paceEl, 'pace-behind', this.paceText.startsWith('BEHIND'))
      this.setClass(this.paceEl, 'pace-on', this.paceText === 'ON PACE' || this.paceText === 'FIRST RUN')
    }
    if (this.ghostPaceRowEl && this.ghostPaceEl && opts.ghostPace !== undefined) {
      const text = ghostPaceLabel(opts.ghostPace)
      if (text !== this.ghostPaceText) this.ghostPaceText = text
      this.setHidden(this.ghostPaceRowEl, text.length === 0)
      this.setText(this.ghostPaceEl, this.ghostPaceText)
      this.setAttribute(this.ghostPaceEl, 'aria-label', ghostPaceAriaLabel(opts.ghostPace))
      this.setClass(this.ghostPaceEl, 'pace-ahead', text.startsWith('AHEAD'))
      this.setClass(this.ghostPaceEl, 'pace-behind', text.startsWith('BEHIND'))
      this.setClass(this.ghostPaceEl, 'pace-on', text === 'EVEN')
    }
    if (this.missionProgressEl && (opts.missionCurrent !== undefined || opts.missionTotal !== undefined)) {
      const current = Number.isFinite(opts.missionCurrent) ? Math.max(0, Math.floor(opts.missionCurrent!)) : 0
      const total = Number.isFinite(opts.missionTotal) ? Math.max(0, Math.floor(opts.missionTotal!)) : 0
      if (current !== this.missionProgressCurrent || total !== this.missionProgressTotal) {
        this.missionProgressCurrent = current
        this.missionProgressTotal = total
        this.missionProgressPercentText = `${missionProgressPercent(current, total)}%`
        this.missionProgressAriaText = missionProgressText(current, total)
      }
      this.setStyle(this.missionProgressEl, '--mission-progress', this.missionProgressPercentText)
      this.setAttribute(this.missionProgressEl, 'aria-valuemax', String(total))
      this.setAttribute(this.missionProgressEl, 'aria-valuenow', String(Math.min(current, total)))
      this.setAttribute(this.missionProgressEl, 'aria-valuetext', this.missionProgressAriaText)
    }
    if (this.contractRowEl && this.contractEl && opts.contractLabel !== undefined) {
      const label = typeof opts.contractLabel === 'string' ? opts.contractLabel : ''
      const progress = Number.isFinite(opts.contractProgress) ? opts.contractProgress! : 0
      const complete = opts.contractComplete === true
      const failed = opts.contractFailed === true
      const progressPercent = Math.round(Math.max(0, Math.min(1, progress)) * 100)
      if (
        label !== this.contractLabelValue ||
        progressPercent !== this.contractProgressValue ||
        complete !== this.contractCompleteValue ||
        failed !== this.contractFailedValue
      ) {
        this.contractLabelValue = label
        this.contractProgressValue = progressPercent
        this.contractCompleteValue = complete
        this.contractFailedValue = failed
        this.contractText = contractProgressLabel(label, progressPercent / 100, complete, failed)
        this.contractAriaText = contractProgressAriaLabel(label, progressPercent / 100, complete, failed)
      }
      const visible = this.contractText.length > 0
      this.setHidden(this.contractRowEl, !visible)
      this.setText(this.contractEl, this.contractText)
      this.setAttribute(this.contractEl, 'aria-label', this.contractAriaText)
      this.setClass(this.contractEl, 'contract-open', visible && !complete)
      this.setClass(this.contractEl, 'contract-complete', visible && complete)
      this.setClass(this.contractEl, 'contract-failed', visible && failed)
      if (this.contractDetailEl) {
        const detail = contractDetailLabel(opts.contractDetail)
        if (detail !== this.contractDetailText) this.contractDetailText = detail
        this.setText(this.contractDetailEl, this.contractDetailText)
        this.setAttribute(this.contractDetailEl, 'aria-label', contractDetailAriaLabel(this.contractDetailText))
        this.setHidden(this.contractDetailEl, !visible || this.contractDetailText.length === 0)
      }
    }
    if (this.contractStreakRowEl && this.contractStreakEl && opts.contractStreak !== undefined) {
      const streak = Number.isFinite(opts.contractStreak)
        ? Math.max(0, Math.min(1_000, Math.floor(opts.contractStreak!)))
        : 0
      if (streak !== this.contractStreakValue) {
        this.contractStreakValue = streak
        this.contractStreakText = contractStreakHudLabel(streak)
        this.contractStreakAriaText = contractStreakAriaLabel(streak)
      }
      this.setHidden(this.contractStreakRowEl, streak <= 0)
      this.setText(this.contractStreakEl, this.contractStreakText)
      this.setAttribute(this.contractStreakEl, 'aria-label', this.contractStreakAriaText)
    }
    if (this.biomeRowEl && this.biomeEl && opts.biomeCount !== undefined) {
      const count = Number.isFinite(opts.biomeCount)
        ? Math.max(0, Math.min(MAX_BIOME_COUNT, Math.floor(opts.biomeCount!)))
        : 0
      if (count !== this.biomeCountValue) {
        this.biomeCountValue = count
        this.biomeText = biomeSurveyHudLabel(count)
        this.biomeAriaText = biomeSurveyAriaLabel(count)
      }
      this.setHidden(this.biomeRowEl, count <= 0)
      this.setText(this.biomeEl, this.biomeText)
      this.setAttribute(this.biomeEl, 'aria-label', this.biomeAriaText)
    }
    if (this.comboRowEl && this.comboEl && opts.combo !== undefined) {
      const combo = Number.isFinite(opts.combo)
        ? Math.max(0, Math.min(MAX_COMBO_COUNT, Math.floor(opts.combo)))
        : 0
      if (combo !== this.comboValue) {
        this.comboValue = combo
        this.comboText = comboHudLabel(combo)
        this.comboAriaText = combo > 0 ? `clean-flight combo ${combo}` : ''
      }
      this.setHidden(this.comboRowEl, combo <= 0)
      this.setText(this.comboEl, this.comboText)
      this.setAttribute(this.comboEl, 'aria-label', this.comboAriaText)
      this.setClass(this.comboEl, 'combo-live', combo >= 2)
    }
    if (this.fuelEl && opts.fuel !== undefined) {
      const percent = fuelPercent({ fraction: opts.fuel })
      if (percent !== this.fuelValue) {
        this.fuelValue = percent
        this.fuelText = `${percent}%`
        this.fuelAriaText = `${percent}% fuel`
      }
      this.setText(this.fuelEl, this.fuelText)
      this.setAttribute(this.fuelEl, 'aria-valuenow', String(percent))
      this.setAttribute(this.fuelEl, 'aria-valuetext', this.fuelAriaText)
      const fuelWarning = fuelWarningLevel({ fraction: opts.fuel })
      this.setClass(this.fuelEl, 'low', fuelWarning !== 'normal')
      this.setClass(this.fuelEl, 'critical', fuelWarning === 'critical')
      if (this.fuelEnduranceEl) {
        const endurance = fuelEnduranceSeconds(opts.fuel, opts.throttle ?? 0, opts.boost === true)
        const enduranceValue = endurance === null ? -1 : Math.round(endurance / 5) * 5
        if (enduranceValue !== this.fuelEnduranceValue) {
          this.fuelEnduranceValue = enduranceValue
          this.fuelEnduranceText = formatFuelEndurance(endurance === null ? null : enduranceValue)
        }
        this.setText(this.fuelEnduranceEl, this.fuelEnduranceText)
        this.setAttribute(this.fuelEnduranceEl, 'aria-label', this.fuelEnduranceText === 'END --'
          ? 'fuel endurance unavailable'
          : `fuel endurance ${this.fuelEnduranceText.slice(4)}`)
        this.fuelAriaText = `${percent}% fuel, ${this.fuelEnduranceText.toLowerCase()}`
        this.setAttribute(this.fuelEl, 'aria-valuetext', this.fuelAriaText)
      }
    }
    if (this.refuelRowEl && this.refuelEl && opts.refueling !== undefined) {
      const active = opts.refueling === true
      const percent = fuelPercent({ fraction: opts.fuel ?? 0 })
      if (active !== this.refuelValue || percent !== this.refuelPercentValue) {
        this.refuelValue = active
        this.refuelPercentValue = percent
        this.refuelText = refuelHudLabel(active, opts.fuel ?? 0)
        this.refuelAriaText = refuelAriaLabel(active, opts.fuel ?? 0)
      }
      this.setHidden(this.refuelRowEl, !active)
      this.setText(this.refuelEl, this.refuelText)
      this.setAttribute(this.refuelEl, 'aria-label', this.refuelAriaText)
    }
    if (this.landingRowEl && this.landingEl && opts.landingPreview !== undefined) {
      const quality = opts.landingPreview === null || !Number.isFinite(opts.landingPreview)
        ? Number.NaN
        : Math.max(0, Math.min(1, opts.landingPreview))
      if (quality !== this.landingPreviewValue) {
        this.landingPreviewValue = quality
        this.landingPreviewText = landingPreviewHudLabel(quality)
        this.landingPreviewAriaText = landingPreviewAriaLabel(quality)
      }
      const visible = Number.isFinite(quality)
      this.setHidden(this.landingRowEl, !visible)
      this.setText(this.landingEl, this.landingPreviewText)
      this.setAttribute(this.landingEl, 'aria-label', this.landingPreviewAriaText)
    }
    if (this.engineHeatEl && opts.engineHeat !== undefined) {
      const safeHeat = Number.isFinite(opts.engineHeat) ? Math.max(0, Math.min(1, opts.engineHeat)) : 0
      const percent = Math.round(safeHeat * 100)
      if (percent !== this.engineHeatValue) {
        this.engineHeatValue = percent
        this.engineHeatText = `${percent}%`
      }
      this.setText(this.engineHeatEl, this.engineHeatText)
      this.setAttribute(this.engineHeatEl, 'aria-valuenow', String(percent))
      this.setAttribute(this.engineHeatEl, 'aria-valuetext', `${percent}% engine heat`)
      const heatWarning = engineHeatCue(safeHeat)
      this.setClass(this.engineHeatEl, 'hot', heatWarning !== 'normal')
      this.setClass(this.engineHeatEl, 'critical', heatWarning === 'critical')
    }
    if (this.radarEl && opts.radar !== undefined) {
      const radarText = this.radarLabelCache(opts.radar)
      if (radarText !== this.radarText) {
        this.radarText = radarText
        this.radarAriaText = radarText === 'NO CONTACTS' ? 'Radar: no contacts' : `Radar: ${radarText}`
      }
      this.setText(this.radarEl, this.radarText)
      this.setAttribute(this.radarEl, 'aria-label', this.radarAriaText)
      this.setClass(this.radarEl, 'radar-active', radarText !== 'NO CONTACTS')
    }
    if (this.assistEl && opts.stabilityAssist !== undefined) {
      const active = opts.stabilityAssist === true
      if (active !== this.stabilityAssistValue) this.stabilityAssistValue = active
      this.setText(this.assistEl, stabilityAssistLabel(active))
      this.setHidden(this.assistEl, !active)
      this.setAttribute(this.assistEl, 'aria-label', active
        ? 'Flight assist enabled: pitch and bank trim'
        : 'Flight assist disabled')
      this.setClass(this.assistEl, 'assist-active', active)
    }
    if (this.hintEl && opts.controlHint !== undefined) {
      const hint = typeof opts.controlHint === 'string' ? opts.controlHint : ''
      if (hint !== this.hintText) this.hintText = hint
      this.setText(this.hintEl, this.hintText)
      this.setHidden(this.hintEl, this.hintText.length === 0)
    }
    this.updateNav(
      opts.navBearing ?? null,
      opts.navDist ?? 0,
      opts.navAltDelta ?? 0,
      opts.navTarget,
      opts.speed,
      opts.missionCurrent,
      opts.missionTotal,
      opts.navApproach,
      opts.navLateral,
      opts.navSpeed,
      opts.navGlide,
    )

    if (opts.throttle !== undefined) {
      this.updateEngine(opts.throttle, !!opts.boost)
    }
    if (this.airbrakeEl && opts.airbrake !== undefined) {
      const open = opts.airbrake === true
      this.setText(this.airbrakeEl, open ? 'OPEN' : 'CLOSED')
      this.setClass(this.airbrakeEl, 'airbrake-open', open)
      this.setAttribute(this.airbrakeEl, 'aria-label', open ? 'Speed brake open' : 'Speed brake closed')
    }
    if (this.abStateEl) {
      const label = afterburnerHudLabel(opts.boost === true, opts.afterburnerLock)
      if (label !== this.abStateText) this.abStateText = label
      this.setText(this.abStateEl, this.abStateText)
      this.setClass(this.abStateEl, 'ab-active', label === 'AB ON')
      this.setClass(this.abStateEl, 'ab-hot', label === 'AB HOT')
      this.setClass(this.abStateEl, 'ab-fuel', label === 'AB FUEL')
      this.setClass(this.abStateEl, 'ab-ready', label === 'AB READY')
      this.setAttribute(this.abStateEl, 'aria-label', `Afterburner ${label.slice(3).toLowerCase()}`)
    }

    if (this.gearEl && opts.gearDown !== undefined) {
      const now = Number.isFinite(opts.timeMs) ? opts.timeMs! : performance.now()
      if (this.previousGearDown !== null && this.previousGearDown !== opts.gearDown) {
        this.gearFlashUntil = now + 700
      }
      this.previousGearDown = opts.gearDown
      this.setText(this.gearEl, opts.gearDown ? 'DOWN' : 'UP')
      this.setClass(this.gearEl, 'gear-cycle', gearTransitionActive(now, this.gearFlashUntil))
    }
    if (this.stateEl && (opts.onGround !== undefined || opts.flightState !== undefined)) {
      const state = normalizeFlightState(opts.flightState, opts.onGround === true)
      if (state !== this.flightStateValue) {
        this.flightStateValue = state
        this.flightStateText = flightStateLabel(state)
        this.flightStateAriaText = state === 'crashed' ? 'Aircraft crashed' :
          state === 'airborne' ? 'Aircraft airborne' : 'Aircraft on ground'
      }
      this.setText(this.stateEl, this.flightStateText)
      this.setAttribute(this.stateEl, 'aria-label', this.flightStateAriaText)
      this.setAttribute(this.stateEl, 'aria-live', 'polite')
      this.setClass(this.stateEl, 'flight-airborne', state === 'airborne')
      this.setClass(this.stateEl, 'flight-crashed', state === 'crashed')
    }

    if (opts.pitch !== undefined && opts.roll !== undefined) {
      this.updateAttitude(opts.pitch, opts.roll)
    }

    this.updateWarning(opts.warning ?? null, opts.warningLevel ?? 'none')

    if (this.bannerEl) {
      if (opts.banner) {
        this.setText(this.bannerEl, opts.banner)
        this.setHidden(this.bannerEl, false)
      } else {
        this.setText(this.bannerEl, '')
        this.setHidden(this.bannerEl, true)
      }
      const tone = normalizeBannerTone(opts.bannerTone)
      this.setAttribute(this.bannerEl, 'aria-live', tone === 'danger' ? 'assertive' : 'polite')
      this.setClass(this.bannerEl, 'banner-info', tone === 'info')
      this.setClass(this.bannerEl, 'banner-success', tone === 'success')
      this.setClass(this.bannerEl, 'banner-danger', tone === 'danger')
    }
  }

  private updateNav(
    bearing: number | null,
    dist: number,
    altDelta: number,
    target: unknown = 'gate',
    speed = 0,
    missionCurrent?: number,
    missionTotal?: number,
    approach?: NavigationApproachCue | null,
    lateral?: NavigationLateralCue | null,
    speedCue?: NavigationSpeedCue | null,
    glideCue?: NavigationGlideCue | null,
  ): void {
    if (!this.navCueEl) return
    const safeBearing = normalizeNavigationBearing(bearing)
    if (safeBearing === null) {
      this.setClass(this.navCueEl, 'near-gate', false)
      this.setClass(this.navCueEl, 'return-home', false)
      this.setClass(this.navCueEl, 'nav-alt-high', false)
      this.setClass(this.navCueEl, 'nav-alt-low', false)
      this.setClass(this.navCueEl, 'nav-alt-level', false)
      this.setClass(this.navCueEl, 'nav-range-closing', false)
      this.setClass(this.navCueEl, 'nav-range-opening', false)
      this.setClass(this.navCueEl, 'nav-range-steady', false)
      this.setClass(this.navCueEl, 'nav-approach-aligned', false)
      this.setClass(this.navCueEl, 'nav-approach-left', false)
      this.setClass(this.navCueEl, 'nav-approach-right', false)
      this.setClass(this.navCueEl, 'nav-lateral-center', false)
      this.setClass(this.navCueEl, 'nav-lateral-left', false)
      this.setClass(this.navCueEl, 'nav-lateral-right', false)
      this.setClass(this.navCueEl, 'nav-speed-slow', false)
      this.setClass(this.navCueEl, 'nav-speed-on', false)
      this.setClass(this.navCueEl, 'nav-speed-fast', false)
      this.setClass(this.navCueEl, 'nav-glide-high', false)
      this.setClass(this.navCueEl, 'nav-glide-on', false)
      this.setClass(this.navCueEl, 'nav-glide-low', false)
      this.setHidden(this.navCueEl, true)
      this.setNavigationSector(null)
      if (this.navTurnEl) this.setText(this.navTurnEl, '')
      this.navTurnText = ''
      if (this.navApproachEl) this.setText(this.navApproachEl, '')
      this.navApproachText = ''
      if (this.navLateralEl) this.setText(this.navLateralEl, '')
      this.navLateralText = ''
      if (this.navSpeedEl) this.setText(this.navSpeedEl, '')
      this.navSpeedText = ''
      if (this.navGlideEl) this.setText(this.navGlideEl, '')
      this.navGlideText = ''
      this.navRangeValue = Number.NaN
      this.navRangeCueValue = null
      this.navTargetValue = null
      this.navEtaValue = -1
      this.navEtaText = 'ETA --'
      return
    }
    const safeDist = Math.max(0, safeHudValue(dist))
    const safeAltDelta = safeHudValue(altDelta)
    const targetLabel = navigationTargetLabel(target)
    const targetText = navigationTargetText(target, missionCurrent, missionTotal)
    const approachCue = targetLabel === 'BASE' ? (approach ?? null) : null
    const lateralCue = targetLabel === 'BASE' ? (lateral ?? null) : null
    const landingSpeedCue = targetLabel === 'BASE' ? (speedCue ?? null) : null
    const landingGlideCue = targetLabel === 'BASE' ? (glideCue ?? null) : null
    const previousDist = targetLabel === this.navTargetValue ? this.navRangeValue : Number.NaN
    const rangeCue = navigationRangeCue(safeDist, previousDist)
    const etaSeconds = navigationEtaSeconds(safeDist, speed, rangeCue)
    this.navRangeValue = safeDist
    this.navTargetValue = targetLabel
    const altitudeCue = navigationAltitudeCue(safeAltDelta, targetLabel === 'BASE' ? 'base' : 'gate')
    this.setHidden(this.navCueEl, false)
    this.setClass(this.navCueEl, 'near-gate', targetLabel === 'NEXT GATE' && gateProximityHudActive(safeDist))
    this.setClass(this.navCueEl, 'return-home', targetLabel === 'BASE')
    this.setClass(this.navCueEl, 'nav-alt-high', altitudeCue === 'high')
    this.setClass(this.navCueEl, 'nav-alt-low', altitudeCue === 'low')
    this.setClass(this.navCueEl, 'nav-alt-level', altitudeCue === 'level')
    this.setClass(this.navCueEl, 'nav-range-closing', rangeCue === 'closing')
    this.setClass(this.navCueEl, 'nav-range-opening', rangeCue === 'opening')
    this.setClass(this.navCueEl, 'nav-range-steady', rangeCue === 'steady')
    this.setClass(this.navCueEl, 'nav-approach-aligned', approachCue === 'aligned')
    this.setClass(this.navCueEl, 'nav-approach-left', approachCue === 'turn-left')
    this.setClass(this.navCueEl, 'nav-approach-right', approachCue === 'turn-right')
    this.setClass(this.navCueEl, 'nav-lateral-center', lateralCue === 'center')
    this.setClass(this.navCueEl, 'nav-lateral-left', lateralCue === 'left')
    this.setClass(this.navCueEl, 'nav-lateral-right', lateralCue === 'right')
    this.setClass(this.navCueEl, 'nav-speed-slow', landingSpeedCue === 'slow')
    this.setClass(this.navCueEl, 'nav-speed-on', landingSpeedCue === 'on-speed')
    this.setClass(this.navCueEl, 'nav-speed-fast', landingSpeedCue === 'fast')
    this.setClass(this.navCueEl, 'nav-glide-high', landingGlideCue === 'high')
    this.setClass(this.navCueEl, 'nav-glide-on', landingGlideCue === 'on-slope')
    this.setClass(this.navCueEl, 'nav-glide-low', landingGlideCue === 'low')
    if (this.navTargetEl) {
      this.setText(this.navTargetEl, targetText)
    }
    const sector = navigationSector(safeBearing)
    this.setNavigationSector(sector)
    const approachLabel = approachCue === 'aligned'
      ? 'aligned with runway'
      : approachCue === 'turn-left' ? 'turn left to align with runway'
        : approachCue === 'turn-right' ? 'turn right to align with runway' : ''
    const lateralLabel = lateralCue === 'left'
      ? 'steer left toward runway centerline'
      : lateralCue === 'right' ? 'steer right toward runway centerline'
        : lateralCue === 'center' ? 'on runway centerline' : ''
    const speedLabel = landingSpeedCue === 'slow'
      ? 'below approach speed'
      : landingSpeedCue === 'fast' ? 'above approach speed'
        : landingSpeedCue === 'on-speed' ? 'on approach speed' : ''
    const glideLabel = landingGlideCue === 'high'
      ? 'above glide slope'
      : landingGlideCue === 'low' ? 'below glide slope'
        : landingGlideCue === 'on-slope' ? 'on glide slope' : ''
    this.setAttribute(this.navCueEl, 'aria-label', `${targetText} navigation, ${navigationSectorLabel(sector)}${approachLabel ? `, ${approachLabel}` : ''}${lateralLabel ? `, ${lateralLabel}` : ''}${speedLabel ? `, ${speedLabel}` : ''}${glideLabel ? `, ${glideLabel}` : ''}`)
    if (this.navTurnEl) {
      const turnText = navigationSectorLabel(sector)
      if (turnText !== this.navTurnText) this.navTurnText = turnText
      this.setText(this.navTurnEl, this.navTurnText)
    }
    if (this.navApproachEl) {
      const approachText = approachCue === 'aligned'
        ? 'ALIGN'
        : approachCue === 'turn-left' ? 'TURN L'
          : approachCue === 'turn-right' ? 'TURN R' : ''
      if (approachText !== this.navApproachText) this.navApproachText = approachText
      this.setText(this.navApproachEl, this.navApproachText)
    }
    if (this.navLateralEl) {
      const lateralText = navigationLateralLabel(lateralCue)
      if (lateralText !== this.navLateralText) this.navLateralText = lateralText
      this.setText(this.navLateralEl, this.navLateralText)
    }
    if (this.navSpeedEl) {
      const speedText = navigationSpeedLabel(landingSpeedCue)
      if (speedText !== this.navSpeedText) this.navSpeedText = speedText
      this.setText(this.navSpeedEl, this.navSpeedText)
    }
    if (this.navGlideEl) {
      const glideText = navigationGlideLabel(landingGlideCue)
      if (glideText !== this.navGlideText) this.navGlideText = glideText
      this.setText(this.navGlideEl, this.navGlideText)
    }
    const deg = navigationBearingDegrees(safeBearing)
    if (this.navArrowEl) {
      if (deg !== this.navBearingValue) {
        this.navBearingValue = deg
        this.navBearingText = `rotate(${deg}deg)`
      }
      this.setStyle(this.navArrowEl, 'transform', this.navBearingText)
    }
    if (this.navRangeEl) {
      const rangeMode = safeDist >= 1000 ? 1 : 0
      const rangeStep = rangeMode ? Math.round(safeDist / 100) : Math.round(safeDist)
      if (rangeMode !== this.navRangeMode || rangeStep !== this.navRangeStep) {
        this.navRangeMode = rangeMode
        this.navRangeStep = rangeStep
        this.navRangeText = rangeMode ? `${(rangeStep / 10).toFixed(1)} KM` : `${rangeStep} M`
      }
      this.setText(this.navRangeEl, this.navRangeText)
      const rangeLabel = rangeCue === 'closing' ? 'closing' : rangeCue === 'opening' ? 'opening' : 'holding'
      this.setAttribute(this.navRangeEl, 'aria-label', `${rangeLabel}, ${this.navRangeText}`)
    }
    if (this.navTrendEl) {
      if (rangeCue !== this.navRangeCueValue) {
        this.navRangeCueValue = rangeCue
        this.navRangeCueText = rangeCue === 'closing' ? 'CLOSE' : rangeCue === 'opening' ? 'OPEN' : 'HOLD'
      }
      this.setText(this.navTrendEl, this.navRangeCueText)
    }
    if (this.navEtaEl) {
      const etaValue = etaSeconds === null ? -1 : etaSeconds
      if (etaValue !== this.navEtaValue) {
        this.navEtaValue = etaValue
        this.navEtaText = etaSeconds === null
          ? 'ETA --'
          : `ETA ${Math.floor(etaSeconds / 60)}:${String(etaSeconds % 60).padStart(2, '0')}`
      }
      this.setText(this.navEtaEl, this.navEtaText)
      this.setAttribute(this.navEtaEl, 'aria-label', etaSeconds === null
        ? 'estimated arrival unavailable'
        : `estimated arrival ${this.navEtaText.slice(4)}`)
    }
    if (this.navAltEl) {
      const altMode = Math.abs(safeAltDelta) < 12 ? 0 : 1
      const altStep = altMode ? Math.round(safeAltDelta) : 0
      if (altMode !== this.navAltMode || altStep !== this.navAltStep) {
        this.navAltMode = altMode
        this.navAltStep = altStep
        if (!altMode) {
          this.navAltText = 'LVL'
        } else {
          const dir = altStep > 0 ? '+' : ''
          this.navAltText = `${dir}${altStep} M`
        }
      }
      this.setText(this.navAltEl, this.navAltText)
      const altLabel = altitudeCue === 'high'
        ? 'climb to target'
        : altitudeCue === 'low' ? 'descend to target' : 'level with target'
      this.setAttribute(this.navAltEl, 'aria-label', `${altLabel}, ${this.navAltText}`)
    }
  }

  private setNavigationSector(sector: NavigationSector | null): void {
    if (!this.navCueEl || sector === this.navSectorValue) return
    this.navSectorValue = sector
    for (const candidate of NAVIGATION_SECTORS) {
      this.setClass(this.navCueEl, `guidance-${candidate}`, candidate === sector)
    }
  }

  private updateWarning(
    text: string | null,
    level: 'none' | 'caution' | 'warning',
  ): void {
    if (!this.warnEl || !this.warnTextEl) return
    if (!text || level === 'none') {
      this.setHidden(this.warnEl, true)
      this.setClass(this.warnEl, 'caution', false)
      this.setClass(this.warnEl, 'warning', false)
      this.setText(this.warnTextEl, '')
      return
    }
    this.setHidden(this.warnEl, false)
    this.setText(this.warnTextEl, text)
    this.setClass(this.warnEl, 'caution', level === 'caution')
    this.setClass(this.warnEl, 'warning', level === 'warning')
  }

  /**
   * Artificial horizon: ball banks with roll, shifts with pitch.
   * Fixed yellow wings = aircraft reference.
   */
  private updateAttitude(pitchRad: number, rollRad: number): void {
    const pitchDeg = (safeHudValue(pitchRad) * 180) / Math.PI
    const rollDeg = (safeHudValue(rollRad) * 180) / Math.PI
    // Clamp visual pitch travel so ladder stays readable
    const pitchVis = Math.max(-50, Math.min(50, pitchDeg))
    const pitchPx = quantizeHudNumber(pitchVis * this.pxPerDeg, 10)
    const rollVisual = quantizeHudNumber(-rollDeg, 10)

    if (this.adiBall) {
      // Nose up → horizon slides down (sky fills more of the mask)
      if (pitchPx !== this.adiBallPitchValue || rollVisual !== this.adiBallRollValue) {
        this.adiBallPitchValue = pitchPx
        this.adiBallRollValue = rollVisual
        this.adiBallTransform = `rotate(${rollVisual}deg) translateY(${pitchPx}px)`
      }
      this.setStyle(this.adiBall, 'transform', this.adiBallTransform)
    }
    if (this.adiBankPtr) {
      if (rollVisual !== this.adiBankValue) {
        this.adiBankValue = rollVisual
        this.adiBankTransform = `rotate(${rollVisual}deg)`
      }
      this.setStyle(this.adiBankPtr, 'transform', this.adiBankTransform)
    }
    if (this.adiPitchEl) {
      const p = Math.round(pitchDeg)
      if (p !== this.pitchValue) {
        this.pitchValue = p
        this.pitchText = `P ${p > 0 ? '+' : ''}${p}°`
      }
      this.setText(this.adiPitchEl, this.pitchText)
    }
    if (this.adiRollEl) {
      const r = Math.round(rollDeg)
      if (r !== this.rollValue) {
        this.rollValue = r
        this.rollText = `B ${r > 0 ? '+' : ''}${r}°`
      }
      this.setText(this.adiRollEl, this.rollText)
    }
  }

  private updateSpeedo(kts: number): void {
    const t = Math.min(1, kts / this.maxKts)
    const cx = 70
    const cy = 70
    const len = 42
    if (this.spdNeedle) {
      // The numeric readout is whole-knot precision. Reuse that same input
      // for the needle so steady flight does not redo trig every frame.
      const needleKts = speedNeedleKts(kts)
      if (needleKts !== this.speedNeedleValue) {
        this.speedNeedleValue = needleKts
        const angleDeg = -120 + Math.min(1, needleKts / this.maxKts) * 240
        const rad = (angleDeg * Math.PI) / 180
        const x2 = quantizeHudNumber(cx + Math.sin(rad) * len, 10)
        if (x2 !== this.speedNeedleXValue) {
          this.speedNeedleXValue = x2
          this.speedNeedleXText = String(x2)
        }
        const y2 = quantizeHudNumber(cy - Math.cos(rad) * len, 10)
        if (y2 !== this.speedNeedleYValue) {
          this.speedNeedleYValue = y2
          this.speedNeedleYText = String(y2)
        }
        this.setAttribute(this.spdNeedle, 'x2', this.speedNeedleXText)
        this.setAttribute(this.spdNeedle, 'y2', this.speedNeedleYText)
      }
    }
    if (this.spdArc) {
      const shown = Math.max(0.5, quantizeHudNumber(t * 100, 10))
      if (shown !== this.speedArcValue) {
        this.speedArcValue = shown
        this.speedArcText = `${shown} 100`
      }
      this.setStyle(this.spdArc, 'stroke-dasharray', this.speedArcText)
      this.setStyle(this.spdArc, 'stroke-dashoffset', '0')
    }
  }

  private updateSpeedJuice(kts: number, boost: boolean): void {
    if (!this.speedJuiceEl) return
    const intensity = speedJuiceIntensity(kts, this.maxKts)
    const active = intensity > 0
    this.setClass(this.speedJuiceEl, 'is-active', active)
    this.setClass(this.speedJuiceEl, 'boost', active && boost)
    this.setStyle(this.speedJuiceEl, 'opacity', formatHudNumber(intensity + (boost ? .06 : 0), 1000))
  }

  private updateCanopyTint(kts: number, cockpit: boolean, rain: number, snow: number): void {
    if (!this.canopyTintEl) return
    const intensity = canopyTintIntensity(kts, cockpit, this.maxKts, rain, snow)
    const active = intensity > 0.01
    this.setClass(this.canopyTintEl, 'is-active', active)
    this.setStyle(this.canopyTintEl, 'opacity', formatHudNumber(intensity, 1000))
    this.setStyle(this.canopyTintEl, '--canopy-wet', formatHudNumber(canopyWeatherIntensity(rain, snow, cockpit), 1000))
  }

  private updateHeatVeil(kts: number, boost: boolean): void {
    if (!this.heatVeilEl) return
    const intensity = afterburnerHeatIntensity(kts, boost, this.maxKts)
    this.setClass(this.heatVeilEl, 'is-active', intensity > 0)
    this.setStyle(this.heatVeilEl, 'opacity', formatHudNumber(intensity, 1000))
  }

  /** Drive the arcade blackout / redout veil from the existing pilot load scalar. */
  private updateGLoadVeil(loadFactor: number | undefined): void {
    if (!this.gLoadVeilEl) return
    const safe = loadFactor === undefined ? 1 : loadFactor
    const blackout = blackoutVignetteIntensity(safe)
    const redout = redoutWashIntensity(safe)
    const active = blackout > 0.01 || redout > 0.01
    this.setClass(this.gLoadVeilEl, 'is-active', active)
    this.setClass(this.gLoadVeilEl, 'is-blackout', blackout >= redout && blackout > 0.01)
    this.setClass(this.gLoadVeilEl, 'is-redout', redout > blackout && redout > 0.01)
    this.setStyle(this.gLoadVeilEl, 'opacity', formatHudNumber(Math.max(blackout, redout), 1000))
    this.setStyle(this.gLoadVeilEl, '--g-load-blackout', formatHudNumber(blackout, 1000))
    this.setStyle(this.gLoadVeilEl, '--g-load-redout', formatHudNumber(redout, 1000))
  }

  private updateFlightPath(visible: boolean, x: number, y: number): void {
    if (!this.flightPathEl) return
    this.setHidden(this.flightPathEl, !visible)
    if (!visible) return

    const markerX = quantizeHudNumber(Number.isFinite(x) ? x : 50, 10)
    const markerY = quantizeHudNumber(Number.isFinite(y) ? y : 50, 10)
    if (markerX !== this.flightPathXValue) {
      this.flightPathXValue = markerX
      this.flightPathXText = `${markerX}%`
    }
    if (markerY !== this.flightPathYValue) {
      this.flightPathYValue = markerY
      this.flightPathYText = `${markerY}%`
    }
    this.setStyle(this.flightPathEl, 'left', this.flightPathXText)
    this.setStyle(this.flightPathEl, 'top', this.flightPathYText)
  }

  private updateEngine(throttle: number, boost: boolean): void {
    // ENG% is the lever / speed target. Afterburner only restyles the bar.
    const level = Math.min(1, Math.max(0, safeHudValue(throttle)))
    const pct = Math.round(level * 100)
    if (this.thrEl) {
      if (pct !== this.throttleValue) {
        this.throttleValue = pct
        this.throttleText = `${pct}%`
      }
      this.setText(this.thrEl, this.throttleText)
    }
    if (this.engFill) {
      // Height % (not scaleY) so the bar fills cleanly from MIN→MAX
      const shownLevel = quantizeHudNumber(level, 1000)
      this.setStyle(this.engFill, 'height', `${shownLevel * 100}%`)
      this.setClass(this.engFill, 'boost', boost)
      this.setAttribute(this.engFill, 'aria-valuenow', String(pct))
    }
    if (this.engMarker) {
      this.setStyle(this.engMarker, 'bottom', `${quantizeHudNumber(level, 1000) * 100}%`)
    }
    if (this.engPanel) {
      this.setClass(this.engPanel, 'boost', boost)
      this.setClass(this.engPanel, 'spooled', level >= 0.95)
      this.setStyle(this.engPanel, '--eng-level', formatHudNumber(level, 1000))
    }
  }

  /** Avoid layout-triggering DOM writes when a readout has not changed. */
  private setText(el: HTMLElement, value: string): void {
    if (this.textCache.get(el) === value) return
    this.textCache.set(el, value)
    el.textContent = value
  }

  private setHidden(el: HTMLElement, hidden: boolean): void {
    if (el.hidden !== hidden) el.hidden = hidden
  }

  /** Coalesce high-frequency style writes across the attitude and engine HUD. */
  private setStyle(el: Element, property: string, value: string): void {
    let cache = this.styleCache.get(el)
    if (!cache) {
      cache = new Map()
      this.styleCache.set(el, cache)
    }
    if (cache.get(property) === value) return
    cache.set(property, value)
    ;(el as HTMLElement | SVGElement).style.setProperty(property, value)
  }

  private setAttribute(el: Element, name: string, value: string): void {
    let cache = this.attributeCache.get(el)
    if (!cache) {
      cache = new Map()
      this.attributeCache.set(el, cache)
    }
    if (cache.get(name) === value) return
    cache.set(name, value)
    el.setAttribute(name, value)
  }

  private setClass(el: Element, name: string, enabled: boolean): void {
    let cache = this.classCache.get(el)
    if (!cache) {
      cache = new Map()
      this.classCache.set(el, cache)
    }
    if (cache.get(name) === enabled) return
    cache.set(name, enabled)
    el.classList.toggle(name, enabled)
  }

  private buildAttitudeLadder(root: Document): void {
    const ladder = root.getElementById('adi-ladder')
    if (!ladder) return
    // Lines every 10° from -40 to +40 (0 is the horizon band)
    for (let deg = -40; deg <= 40; deg += 10) {
      if (deg === 0) continue
      const line = root.createElement('div')
      const major = Math.abs(deg) % 20 === 0
      line.className = 'adi-ladder-line' + (major ? ' major' : '')
      const width = major ? 56 : 36
      line.style.width = `${width}px`
      // Negative pitch below horizon on ball; ball translate handles flight pitch
      line.style.top = `calc(50% + ${-deg * this.pxPerDeg}px)`
      if (major) {
        const l = root.createElement('span')
        l.className = 'lbl l'
        l.textContent = String(Math.abs(deg))
        const r = root.createElement('span')
        r.className = 'lbl r'
        r.textContent = String(Math.abs(deg))
        line.appendChild(l)
        line.appendChild(r)
      }
      ladder.appendChild(line)
    }
  }

  private buildBankMarks(root: Document): void {
    const marks = root.getElementById('adi-bank-marks')
    if (!marks) return
    // Bank ticks at ±10,20,30,45,60
    for (const deg of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
      const tick = root.createElement('div')
      tick.className = 'tick' + (Math.abs(deg) % 30 === 0 ? ' major' : '')
      tick.style.transform = `rotate(${deg}deg)`
      marks.appendChild(tick)
    }
  }

  private buildSpeedTicks(root: Document): void {
    const g = root.getElementById('spd-ticks')
    if (!g) return
    const cx = 70
    const cy = 70
    const rOuter = 52
    const rInnerMajor = 44
    const rInnerMinor = 47
    const tickKts = 50
    const steps = this.maxKts / tickKts
    for (let i = 0; i <= steps; i++) {
      const kts = i * tickKts
      const t = kts / this.maxKts
      const angleDeg = -120 + t * 240
      const rad = (angleDeg * Math.PI) / 180
      const major = i % 2 === 0
      const rIn = major ? rInnerMajor : rInnerMinor
      const x1 = cx + Math.sin(rad) * rIn
      const y1 = cy - Math.cos(rad) * rIn
      const x2 = cx + Math.sin(rad) * rOuter
      const y2 = cy - Math.cos(rad) * rOuter
      const line = root.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(x1))
      line.setAttribute('y1', String(y1))
      line.setAttribute('x2', String(x2))
      line.setAttribute('y2', String(y2))
      line.setAttribute('class', major ? 'tick major' : 'tick minor')
      g.appendChild(line)
    }
  }

  private buildHeadingTape(root: Document): void {
    const track = this.headingTapeTrackEl
    if (!track) return
    // Three wrapped compass passes keep the active heading centered without
    // allocating or rebuilding DOM as the aircraft crosses north.
    for (let degrees = -360; degrees <= 720; degrees += HEADING_TAPE_STEP_DEG) {
      const mark = root.createElement('div')
      const major = degrees % 30 === 0
      mark.className = `heading-tape-mark${major ? ' major' : ''}`
      if (major) {
        const label = root.createElement('span')
        label.className = 'heading-tape-label'
        label.textContent = headingTapeLabel(degrees)
        mark.appendChild(label)
      }
      track.appendChild(mark)
    }
  }

  private updateHeadingTape(headingRad: number): void {
    if (!this.headingTapeTrackEl) return
    const heading = headingDegrees(headingRad)
    if (heading === this.headingTapeValue) return
    this.headingTapeValue = heading
    const offset = headingTapeOffset(headingRad)
    this.headingTapeTransform = `translate3d(-${offset}px, 0, 0)`
    this.setStyle(this.headingTapeTrackEl, 'transform', this.headingTapeTransform)
  }
}

const HEADING_TAPE_STEP_DEG = 15
const HEADING_TAPE_STEP_PX = 56
const MISSION_PHASES: readonly MissionPhaseCue[] = ['ready', 'running', 'returning', 'complete', 'failed']
const NAVIGATION_SECTORS: readonly NavigationSector[] = ['ahead', 'left', 'right', 'behind']

/** Stable decimal formatting prevents float noise from invalidating HUD caches. */
export function quantizeHudNumber(value: number, precision: number): number {
  if (!Number.isFinite(value) || precision <= 0) return 0
  return Math.round(value * precision) / precision
}

/** Keep malformed live telemetry from reaching DOM text or CSS values. */
export function safeHudValue(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

/** Keep terrain clearance legible without turning normal low-level flight into an alarm. */
export function altitudeCue(altitude: number, onGround = false): AltitudeCue {
  if (onGround || !Number.isFinite(altitude)) return 'normal'
  const safeAltitude = Math.max(0, altitude)
  if (safeAltitude <= 12) return 'warning'
  if (safeAltitude <= 48) return 'caution'
  return 'normal'
}

/** Horizontal wind speed used by the compact weather readout. */
export function windSpeedMps(windX: number, windZ: number): number {
  if (!Number.isFinite(windX) || !Number.isFinite(windZ)) return 0
  return Math.hypot(windX, windZ)
}

/** Resolve the absolute wind component across the home runway. */
export function crosswindSpeedMps(windX: number, windZ: number, runwayYaw: number): number {
  if (!Number.isFinite(windX) || !Number.isFinite(windZ) || !Number.isFinite(runwayYaw)) return 0
  return Math.abs(windX * Math.cos(runwayYaw) - windZ * Math.sin(runwayYaw))
}

/** Resolve which runway side the wind vector pushes toward. */
export function crosswindDirection(
  windX: number,
  windZ: number,
  runwayYaw: number,
): CrosswindSide {
  if (!Number.isFinite(windX) || !Number.isFinite(windZ) || !Number.isFinite(runwayYaw)) return 'calm'
  const component = windX * Math.cos(runwayYaw) - windZ * Math.sin(runwayYaw)
  if (Math.abs(component) < 0.5) return 'calm'
  return component > 0 ? 'right' : 'left'
}

function normalizeCrosswindSide(value: unknown): CrosswindSide {
  return value === 'left' || value === 'right' ? value : 'calm'
}

/** Format runway-relative crosswind as a compact return-leg cue. */
export function formatCrosswind(crosswind: number, side: CrosswindSide = 'calm'): string {
  const safe = Number.isFinite(crosswind) ? Math.max(0, crosswind) : 0
  if (safe < 1) return 'XW CALM'
  const sideLabel = side === 'left' ? 'L' : side === 'right' ? 'R' : ''
  return sideLabel ? `XW ${sideLabel} ${Math.round(safe)} M/S` : `XW ${Math.round(safe)} M/S`
}

/** Direction the weather vector travels toward, in degrees from world north. */
export function windDirectionDegrees(windX: number, windZ: number): number {
  const speed = windSpeedMps(windX, windZ)
  if (speed < 0.5) return 0
  const degrees = Math.round((Math.atan2(windX, windZ) * 180) / Math.PI)
  return ((degrees % 360) + 360) % 360
}

/** Format one stable, low-noise weather vector for pilots and screen readers. */
export function formatWind(windX: number, windZ: number): string {
  const speed = Math.round(windSpeedMps(windX, windZ))
  if (speed < 1) return 'CALM'
  return `${speed} M/S ${String(windDirectionDegrees(windX, windZ)).padStart(3, '0')}°`
}

/** Keep gust risk visible without exposing the raw weather scalar. */
export function windGustCue(value: number): WindGustCue {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  if (safe >= 0.72) return 'severe'
  if (safe >= 0.28) return 'active'
  return 'calm'
}

export function formatWindGust(value: number): string {
  const cue = windGustCue(value)
  return cue === 'severe' ? 'GUST HIGH' : cue === 'active' ? 'GUST' : ''
}

/** Classify weather IDs or labels without trusting arbitrary runtime strings. */
export function weatherCue(value: unknown): WeatherCue {
  if (typeof value !== 'string') return 'calm'
  const normalized = value.toLowerCase()
  if (normalized.includes('storm') || normalized.includes('blizzard')) return 'severe'
  if (
    normalized.includes('rain') ||
    normalized.includes('snow') ||
    normalized.includes('fog') ||
    normalized.includes('overcast')
  ) return 'active'
  return 'calm'
}

/** Normalize route phases before they become DOM class names or announcements. */
export function normalizeMissionPhase(value: unknown): MissionPhaseCue {
  return MISSION_PHASES.includes(value as MissionPhaseCue) ? value as MissionPhaseCue : 'ready'
}

export function missionPhaseClass(value: unknown): string {
  return `phase-${normalizeMissionPhase(value)}`
}

/** Normalize aircraft state before it reaches the HUD or accessibility tree. */
export function normalizeFlightState(value: unknown, onGround = false): FlightStateCue {
  if (value === 'crashed') return 'crashed'
  if (value === 'airborne') return 'airborne'
  if (value === 'ground') return 'ground'
  return onGround ? 'ground' : 'airborne'
}

export function flightStateLabel(state: FlightStateCue): string {
  if (state === 'crashed') return 'CRASH'
  if (state === 'airborne') return 'AIR'
  return 'GND'
}

/** Wrap a navigation bearing to a stable signed range, or reject it safely. */
export function normalizeNavigationBearing(bearing: number | null | undefined): number | null {
  if (bearing === null || bearing === undefined || !Number.isFinite(bearing)) return null
  return Math.atan2(Math.sin(bearing), Math.cos(bearing))
}

/** Whole-degree arrow input avoids sub-degree DOM churn during hard turns. */
export function navigationBearingDegrees(bearing: number): number {
  const safe = normalizeNavigationBearing(bearing) ?? 0
  return Math.round((safe * 180) / Math.PI)
}

/** Classify the target side so the cue remains readable while the jet rotates. */
export function navigationSector(bearing: number | null | undefined): NavigationSector {
  const safe = normalizeNavigationBearing(bearing) ?? 0
  const absolute = Math.abs(safe)
  if (absolute <= Math.PI / 8) return 'ahead'
  if (absolute >= Math.PI * .75) return 'behind'
  return safe > 0 ? 'right' : 'left'
}

export function formatHudNumber(value: number, precision: number): string {
  return String(quantizeHudNumber(value, precision))
}

/** Signed, whole-number climb or sink rate for the compact flight readout. */
export function formatVerticalSpeed(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0)
  if (rounded === 0) return '0'
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

/** Deadbanded vertical-speed tone so tiny turbulence does not flicker colors. */
export function verticalSpeedTone(
  value: number,
  threshold = 2,
): 'climb' | 'sink' | 'level' {
  const speed = Number.isFinite(value) ? value : 0
  const deadband = Number.isFinite(threshold) ? Math.max(0, threshold) : 2
  if (speed > deadband) return 'climb'
  if (speed < -deadband) return 'sink'
  return 'level'
}

/** Signed one-decimal G readout for the compact fighter HUD. */
export function formatGForce(value: number): string {
  const safe = Number.isFinite(value) ? value : 1
  const rounded = Math.sign(safe) * Math.round(Math.abs(safe) * 10) / 10
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}G`
}

/** Keep sustained high and negative loads visually distinct without alarms. */
export function gForceTone(value: number, highThreshold = 4): 'normal' | 'high' | 'negative' {
  const safe = Number.isFinite(value) ? value : 1
  const threshold = Number.isFinite(highThreshold) ? Math.max(0, highThreshold) : 4
  if (safe < 0) return 'negative'
  if (safe >= threshold) return 'high'
  return 'normal'
}

function headingDegrees(headingRad: number): number {
  if (!Number.isFinite(headingRad)) return 0
  const degrees = Math.round((headingRad * 180) / Math.PI)
  return ((degrees % 360) + 360) % 360
}

/** Pixel offset that centers the wrapped compass item for an aircraft heading. */
export function headingTapeOffset(headingRad: number, stepPx = HEADING_TAPE_STEP_PX): number {
  const safeStep = Number.isFinite(stepPx) && stepPx > 0 ? stepPx : HEADING_TAPE_STEP_PX
  const heading = headingDegrees(headingRad)
  // The tape starts at -360°, so the centered wrapped pass begins at index 24.
  return ((heading + 360) / HEADING_TAPE_STEP_DEG + 0.5) * safeStep
}

/** Label a 30° compass major mark with cardinal letters where appropriate. */
export function headingTapeLabel(degrees: number): string {
  if (!Number.isFinite(degrees)) return '000'
  const wrapped = ((Math.round(degrees) % 360) + 360) % 360
  if (wrapped === 0) return 'N'
  if (wrapped === 90) return 'E'
  if (wrapped === 180) return 'S'
  if (wrapped === 270) return 'W'
  return String(wrapped).padStart(3, '0')
}

/** Wrap aircraft heading to a stable, three-digit 000–359 degree readout. */
export function formatHeading(headingRad: number): string {
  return `${String(headingDegrees(headingRad)).padStart(3, '0')}°`
}

/** Compact audio state label used by the in-flight HUD. */
export function formatAudioState(muted: boolean): string {
  return muted ? 'MUTE' : 'LIVE'
}

/** Short HUD emphasis window used for automatic gear transitions. */
export function gearTransitionActive(now: number, until: number): boolean {
  return Number.isFinite(now) && Number.isFinite(until) && now < until
}

/** Edge-streak intensity for the Phase 7 high-speed HUD treatment. */
export function speedJuiceIntensity(knots: number, maxKts = 3000): number {
  const safeKnots = Number.isFinite(knots) ? Math.max(0, knots) : 0
  const safeMaxKts = Number.isFinite(maxKts) ? Math.max(1, maxKts) : 3000
  const t = Math.min(1, Math.max(0, safeKnots / safeMaxKts))
  if (t <= 0.18) return 0
  return Math.min(0.42, (t - 0.18) * 0.52)
}

/** Keep the airspeed gauge honest near and beyond its displayed envelope. */
export function speedWarningLevel(knots: number, maxKts = 3000): SpeedWarningLevel {
  const safeMax = Number.isFinite(maxKts) ? Math.max(1, maxKts) : 3000
  const safeKnots = Number.isFinite(knots) ? Math.max(0, knots) : 0
  if (safeKnots > safeMax) return 'overspeed'
  if (safeKnots >= safeMax * 0.94) return 'redline'
  return 'normal'
}

/** Whole-knot input shared by the speed readout and needle geometry. */
export function speedNeedleKts(knots: number): number {
  return Math.round(Number.isFinite(knots) ? Math.max(0, knots) : 0)
}

/**
 * Cockpit-only canopy fog/vignette from IAS. Outside cockpit the tint stays off.
 * Reduced-motion callers should pass the same curve; CSS freezes animation.
 */
export function canopyTintIntensity(
  knots: number,
  cockpit: boolean,
  maxKts = 3000,
  rain = 0,
  snow = 0,
): number {
  if (!cockpit) return 0
  const safeKnots = Number.isFinite(knots) ? Math.max(0, knots) : 0
  const safeMaxKts = Number.isFinite(maxKts) ? Math.max(1, maxKts) : 3000
  const t = Math.min(1, Math.max(0, safeKnots / safeMaxKts))
  const weather = canopyWeatherIntensity(rain, snow, cockpit)
  if (t <= 0.22) return weather
  return Math.min(0.32, (t - 0.22) * 0.36 + weather)
}

/** Bounded weather response for the cockpit canopy streak texture. */
export function canopyWeatherIntensity(rain: number, snow: number, cockpit: boolean): number {
  if (!cockpit) return 0
  const wet = Math.min(1, Math.max(0, safeHudValue(rain))) * 0.09
  const frozen = Math.min(1, Math.max(0, safeHudValue(snow))) * 0.045
  return Math.min(0.12, wet + frozen)
}

/** Soft edge warmth used only while the afterburner is lit. */
export function afterburnerHeatIntensity(
  knots: number,
  boost: boolean,
  maxKts = 3000,
): number {
  if (!boost) return 0
  const safeKnots = Number.isFinite(knots) ? Math.max(0, knots) : 0
  const safeMaxKts = Number.isFinite(maxKts) ? Math.max(1, maxKts) : 3000
  const t = Math.min(1, Math.max(0, safeKnots / safeMaxKts))
  return Math.min(0.16, 0.06 + t * 0.1)
}

/** HUD near-gate pulse window (meters to active checkpoint). */
export function gateProximityHudActive(dist: number, limit = 220): boolean {
  return Number.isFinite(dist) && dist > 0 && dist <= limit
}
