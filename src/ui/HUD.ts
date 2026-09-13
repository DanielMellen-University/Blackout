/**
 * HTML overlay HUD - flight readouts, speedometer, engine power,
 * attitude indicator (pitch ladder + bank), banner.
 */
import { displayedKnots } from '../core/airspeed'
import { fuelPercent, fuelWarningLevel } from '../aircraft/FuelSystem'
import {
  MAX_RADAR_CONTACTS,
  radarBearingArrow,
  radarDistanceLabel,
  type RadarContact,
} from '../systems/RadarSystem'

export type HudBannerTone = 'info' | 'success' | 'danger'

export type SpeedWarningLevel = 'normal' | 'redline' | 'overspeed'

export type AltitudeCue = 'normal' | 'caution' | 'warning'

export type MissionPhaseCue = 'ready' | 'running' | 'returning' | 'complete' | 'failed'

export type FlightStateCue = 'ground' | 'airborne' | 'crashed'

export function pauseStateLabel(paused: boolean): string {
  return paused ? 'FLIGHT PAUSED · SIMULATION HOLD' : ''
}

export function hudBackgroundHidden(menuOpen: boolean, resultsOpen: boolean): boolean {
  return menuOpen || resultsOpen
}

export type NavigationSector = 'ahead' | 'left' | 'right' | 'behind'

export const FLIGHT_CONTROLS_HINT = 'W/S PITCH · A/D YAW · Q/E ROLL · C VIEW'

export type WeatherCue = 'calm' | 'active' | 'severe'

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
    labels.push(`${label} ${radarDistanceLabel(contact.distance)} ${radarBearingArrow(contact.bearing)}`)
  }
  return labels.length > 0 ? labels.join(' · ') : 'NO CONTACTS'
}

export class HUD {
  private readonly hudRoot: HTMLElement | null
  private readonly posEl: HTMLElement | null
  private readonly verticalSpeedEl: HTMLElement | null
  private readonly gEl: HTMLElement | null
  private readonly spdEl: HTMLElement | null
  private readonly speedoPanel: HTMLElement | null
  private readonly camEl: HTMLElement | null
  private readonly headingEl: HTMLElement | null
  private readonly headingTapeTrackEl: HTMLElement | null
  private readonly audioEl: HTMLElement | null
  private readonly fpsEl: HTMLElement | null
  private readonly thrEl: HTMLElement | null
  private readonly gearEl: HTMLElement | null
  private readonly stateEl: HTMLElement | null
  private readonly bannerEl: HTMLElement | null
  private readonly spdNeedle: SVGLineElement | null
  private readonly spdArc: SVGPathElement | null
  private readonly engFill: HTMLElement | null
  private readonly engMarker: HTMLElement | null
  private readonly engPanel: HTMLElement | null
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
  private readonly fuelEl: HTMLElement | null
  private readonly radarEl: HTMLElement | null
  private readonly hintEl: HTMLElement | null
  private readonly pausedEl: HTMLElement | null
  private readonly speedJuiceEl: HTMLElement | null
  private readonly canopyTintEl: HTMLElement | null
  private readonly heatVeilEl: HTMLElement | null
  private readonly flightPathEl: HTMLElement | null
  private readonly navCueEl: HTMLElement | null
  private readonly navArrowEl: HTMLElement | null
  private readonly navRangeEl: HTMLElement | null
  private readonly navAltEl: HTMLElement | null

  /** Display range for the airspeed dial (knots). */
  private readonly maxKts = 3000
  /** Pixels of ladder travel per degree of pitch. */
  private readonly pxPerDeg = 2.4
  private readonly styleCache = new WeakMap<Element, Map<string, string>>()
  private readonly attributeCache = new WeakMap<Element, Map<string, string>>()
  private readonly classCache = new WeakMap<Element, Map<string, boolean>>()
  private readonly textCache = new WeakMap<Element, string>()
  private altitudeValue = Number.NaN
  private altitudeText = ''
  private altitudeAriaText = ''
  private altitudeCueValue: AltitudeCue | null = null
  private verticalSpeedValue = Number.NaN
  private verticalSpeedText = ''
  private verticalSpeedAriaText = ''
  private gValue = Number.NaN
  private gText = ''
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
  private radarText = ''
  private radarAriaText = ''
  private hintText = ''
  private pausedValue: boolean | null = null
  private hudBackgroundHiddenValue: boolean | null = null
  private windSpeedValue = Number.NaN
  private windDirectionValue = Number.NaN
  private windText = ''
  private windAriaText = ''
  private weatherCueValue: WeatherCue | null = null
  private weatherAriaText = ''
  private missionPhaseValue: MissionPhaseCue | null = null
  private flightStateValue: FlightStateCue | null = null
  private flightStateText = ''
  private flightStateAriaText = ''
  private navBearingValue = Number.NaN
  private navBearingText = ''
  private navSectorValue: NavigationSector | null = null
  private navRangeMode = -1
  private navRangeStep = Number.NaN
  private navRangeText = ''
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
    this.spdEl = root.getElementById('hud-spd')
    this.speedoPanel = root.getElementById('speedo-panel')
    this.camEl = root.getElementById('hud-cam')
    this.headingEl = root.getElementById('hud-hdg')
    this.headingTapeTrackEl = root.getElementById('heading-tape-track')
    this.audioEl = root.getElementById('hud-audio')
    this.fpsEl = root.getElementById('hud-fps')
    this.thrEl = root.getElementById('hud-thr')
    this.gearEl = root.getElementById('hud-gear')
    this.stateEl = root.getElementById('hud-state')
    this.bannerEl = root.getElementById('hud-banner')
    this.spdNeedle = root.getElementById('spd-needle') as SVGLineElement | null
    this.spdArc = root.getElementById('spd-arc') as SVGPathElement | null
    this.engFill = root.getElementById('eng-fill')
    this.engMarker = root.getElementById('eng-marker')
    this.engPanel = root.getElementById('eng-panel')
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
    this.fuelEl = root.getElementById('hud-fuel')
    this.radarEl = root.getElementById('hud-radar')
    this.hintEl = root.getElementById('hud-hint')
    this.pausedEl = root.getElementById('hud-paused')
    this.speedJuiceEl = root.getElementById('speed-juice')
    this.canopyTintEl = root.getElementById('canopy-tint')
    this.heatVeilEl = root.getElementById('heat-veil')
    this.flightPathEl = root.getElementById('flight-path-marker')
    this.navCueEl = root.getElementById('nav-cue')
    this.navArrowEl = root.getElementById('nav-arrow')
    this.navRangeEl = root.getElementById('nav-range')
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
    speed: number
    cameraMode: string
    /** Aircraft heading (rad, 0 = north / +Z). */
    heading?: number
    audioMuted?: boolean
    fps: number
    throttle?: number
    boost?: boolean
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
    /** Active caution / warning (STALL, LOW ALT, GEAR). */
    warning?: string | null
    warningLevel?: 'none' | 'caution' | 'warning'
    clock?: string
    weather?: string
    /** Weather profile ID used for compact severity styling. */
    weatherKind?: string
    dayPhase?: string
    mission?: string
    /** Remaining fuel as a normalized fraction. */
    fuel?: number
    /** Current route phase used for a restrained mission-state cue. */
    missionPhase?: MissionPhaseCue | string
    /** Bounded navigation contacts prepared by RadarSystem. */
    radar?: readonly RadarContact[]
    /** Temporary control hint shown during the takeoff handoff. */
    controlHint?: string | null
    /** Next-gate range in meters; omit or 0 to hide. */
    navDist?: number
    /** RAF timestamp shared by the main loop for time-based HUD cues. */
    timeMs?: number
    /** Radians, 0 = ahead, + = right of nose. */
    navBearing?: number | null
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
      this.setText(this.weatherEl, opts.weather)
      const cue = weatherCue(opts.weatherKind ?? opts.weather)
      if (cue !== this.weatherCueValue) {
        this.weatherCueValue = cue
        this.weatherAriaText = cue === 'severe'
          ? `Severe weather: ${opts.weather}`
          : cue === 'active' ? `Active weather: ${opts.weather}` : `Weather: ${opts.weather}`
      }
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
      if (speedStep !== this.windSpeedValue || direction !== this.windDirectionValue) {
        this.windSpeedValue = speedStep
        this.windDirectionValue = direction
        this.windText = formatWind(windX, windZ)
        this.windAriaText = this.windText === 'CALM'
          ? 'Calm wind'
          : `${speedStep} metres per second toward ${String(direction).padStart(3, '0')} degrees`
      }
      this.setText(this.windEl, this.windText)
      this.setAttribute(this.windEl, 'aria-label', this.windAriaText)
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
    }
    if (this.radarEl && opts.radar !== undefined) {
      const radarText = formatRadarContacts(opts.radar)
      if (radarText !== this.radarText) {
        this.radarText = radarText
        this.radarAriaText = radarText === 'NO CONTACTS' ? 'Radar: no contacts' : `Radar: ${radarText}`
      }
      this.setText(this.radarEl, this.radarText)
      this.setAttribute(this.radarEl, 'aria-label', this.radarAriaText)
      this.setClass(this.radarEl, 'radar-active', radarText !== 'NO CONTACTS')
    }
    if (this.hintEl && opts.controlHint !== undefined) {
      const hint = typeof opts.controlHint === 'string' ? opts.controlHint : ''
      if (hint !== this.hintText) this.hintText = hint
      this.setText(this.hintEl, this.hintText)
      this.setHidden(this.hintEl, this.hintText.length === 0)
    }
    this.updateNav(opts.navBearing ?? null, opts.navDist ?? 0, opts.navAltDelta ?? 0)

    if (opts.throttle !== undefined) {
      this.updateEngine(opts.throttle, !!opts.boost)
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
  ): void {
    if (!this.navCueEl) return
    const safeBearing = normalizeNavigationBearing(bearing)
    if (safeBearing === null) {
      this.setClass(this.navCueEl, 'near-gate', false)
      this.setHidden(this.navCueEl, true)
      this.setNavigationSector(null)
      return
    }
    const safeDist = Math.max(0, safeHudValue(dist))
    const safeAltDelta = safeHudValue(altDelta)
    this.setHidden(this.navCueEl, false)
    this.setClass(this.navCueEl, 'near-gate', gateProximityHudActive(safeDist))
    this.setNavigationSector(navigationSector(safeBearing))
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

/** Edge-streak intensity for the version-7 high-speed HUD treatment. */
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
