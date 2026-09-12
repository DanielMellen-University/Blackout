/**
 * HTML overlay HUD - flight readouts, speedometer, engine power,
 * attitude indicator (pitch ladder + bank), banner.
 */
import { displayedKnots } from '../core/airspeed'

export type HudBannerTone = 'info' | 'success' | 'danger'

/** Normalize banner tone input so stale callers cannot add arbitrary classes. */
export function normalizeBannerTone(value: unknown): HudBannerTone {
  return value === 'success' || value === 'danger' ? value : 'info'
}

export class HUD {
  private readonly posEl: HTMLElement | null
  private readonly verticalSpeedEl: HTMLElement | null
  private readonly spdEl: HTMLElement | null
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
  private readonly phaseEl: HTMLElement | null
  private readonly missionEl: HTMLElement | null
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
  private verticalSpeedValue = Number.NaN
  private verticalSpeedText = ''
  private throttleValue = Number.NaN
  private throttleText = ''
  private speedValue = Number.NaN
  private speedText = ''
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
  private navBearingValue = Number.NaN
  private navBearingText = ''
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
    this.posEl = root.getElementById('hud-pos')
    this.verticalSpeedEl = root.getElementById('hud-vs')
    this.spdEl = root.getElementById('hud-spd')
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
    this.phaseEl = root.getElementById('hud-phase')
    this.missionEl = root.getElementById('hud-mission')
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

  update(opts: {
    y: number
    /** Vertical velocity in metres per second, positive while climbing. */
    verticalSpeed?: number
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
    /** Active caution / warning (STALL, LOW ALT, GEAR). */
    warning?: string | null
    warningLevel?: 'none' | 'caution' | 'warning'
    clock?: string
    weather?: string
    dayPhase?: string
    mission?: string
    /** Next-gate range in meters; omit or 0 to hide. */
    navDist?: number
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
      const altitude = Math.round(opts.y)
      if (altitude !== this.altitudeValue) {
        this.altitudeValue = altitude
        this.altitudeText = String(altitude)
      }
      this.setText(this.posEl, this.altitudeText)
    }

    if (this.verticalSpeedEl) {
      const verticalSpeed = Math.round(opts.verticalSpeed ?? 0)
      if (verticalSpeed !== this.verticalSpeedValue) {
        this.verticalSpeedValue = verticalSpeed
        this.verticalSpeedText = formatVerticalSpeed(verticalSpeed)
      }
      this.setText(this.verticalSpeedEl, this.verticalSpeedText)
    }

    const kts = displayedKnots(opts.speed)
    if (this.spdEl) {
      const speed = Math.round(kts)
      if (speed !== this.speedValue) {
        this.speedValue = speed
        this.speedText = String(speed)
      }
      this.setText(this.spdEl, this.speedText)
    }
    this.updateSpeedo(kts)
    this.updateSpeedJuice(kts, !!opts.boost)
    this.updateCanopyTint(kts, opts.cameraMode === 'cockpit')
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
      const fps = Math.round(opts.fps)
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
    }
    if (this.phaseEl && opts.dayPhase) {
      this.setText(this.phaseEl, opts.dayPhase)
    }
    if (this.missionEl && opts.mission) {
      this.setText(this.missionEl, opts.mission)
    }
    this.updateNav(opts.navBearing ?? null, opts.navDist ?? 0, opts.navAltDelta ?? 0)

    if (opts.throttle !== undefined) {
      this.updateEngine(opts.throttle, !!opts.boost)
    }

    if (this.gearEl && opts.gearDown !== undefined) {
      const now = performance.now()
      if (this.previousGearDown !== null && this.previousGearDown !== opts.gearDown) {
        this.gearFlashUntil = now + 700
      }
      this.previousGearDown = opts.gearDown
      this.setText(this.gearEl, opts.gearDown ? 'DOWN' : 'UP')
      this.setClass(this.gearEl, 'gear-cycle', gearTransitionActive(now, this.gearFlashUntil))
    }
    if (this.stateEl && opts.onGround !== undefined) {
      this.setText(this.stateEl, opts.onGround ? 'GND' : 'AIR')
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
    if (bearing === null) {
      this.setClass(this.navCueEl, 'near-gate', false)
      this.setHidden(this.navCueEl, true)
      return
    }
    this.setHidden(this.navCueEl, false)
    this.setClass(this.navCueEl, 'near-gate', gateProximityHudActive(dist))
    const deg = quantizeHudNumber((bearing * 180) / Math.PI, 4)
    if (this.navArrowEl) {
      if (deg !== this.navBearingValue) {
        this.navBearingValue = deg
        this.navBearingText = `rotate(${deg}deg)`
      }
      this.setStyle(this.navArrowEl, 'transform', this.navBearingText)
    }
    if (this.navRangeEl) {
      const rangeMode = dist >= 1000 ? 1 : 0
      const rangeStep = rangeMode ? Math.round(dist / 100) : Math.round(dist)
      if (rangeMode !== this.navRangeMode || rangeStep !== this.navRangeStep) {
        this.navRangeMode = rangeMode
        this.navRangeStep = rangeStep
        this.navRangeText = rangeMode ? `${(rangeStep / 10).toFixed(1)} KM` : `${rangeStep} M`
      }
      this.setText(this.navRangeEl, this.navRangeText)
    }
    if (this.navAltEl) {
      const altMode = Math.abs(altDelta) < 12 ? 0 : 1
      const altStep = altMode ? Math.round(altDelta) : 0
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
    const pitchDeg = (pitchRad * 180) / Math.PI
    const rollDeg = (rollRad * 180) / Math.PI
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
    const angleDeg = -120 + t * 240
    const rad = (angleDeg * Math.PI) / 180
    const cx = 70
    const cy = 70
    const len = 42
    if (this.spdNeedle) {
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

  private updateCanopyTint(kts: number, cockpit: boolean): void {
    if (!this.canopyTintEl) return
    const intensity = canopyTintIntensity(kts, cockpit)
    const active = intensity > 0.01
    this.setClass(this.canopyTintEl, 'is-active', active)
    this.setStyle(this.canopyTintEl, 'opacity', formatHudNumber(intensity, 1000))
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
    const level = Math.min(1, Math.max(0, throttle))
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

/** Stable decimal formatting prevents float noise from invalidating HUD caches. */
export function quantizeHudNumber(value: number, precision: number): number {
  if (!Number.isFinite(value) || precision <= 0) return 0
  return Math.round(value * precision) / precision
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
  const t = Math.min(1, Math.max(0, knots / Math.max(1, maxKts)))
  if (t <= 0.18) return 0
  return Math.min(0.42, (t - 0.18) * 0.52)
}

/**
 * Cockpit-only canopy fog/vignette from IAS. Outside cockpit the tint stays off.
 * Reduced-motion callers should pass the same curve; CSS freezes animation.
 */
export function canopyTintIntensity(knots: number, cockpit: boolean, maxKts = 3000): number {
  if (!cockpit) return 0
  const t = Math.min(1, Math.max(0, knots / Math.max(1, maxKts)))
  if (t <= 0.22) return 0
  return Math.min(0.28, (t - 0.22) * 0.36)
}

/** Soft edge warmth used only while the afterburner is lit. */
export function afterburnerHeatIntensity(
  knots: number,
  boost: boolean,
  maxKts = 3000,
): number {
  if (!boost) return 0
  const t = Math.min(1, Math.max(0, knots / Math.max(1, maxKts)))
  return Math.min(0.16, 0.06 + t * 0.1)
}

/** HUD near-gate pulse window (meters to active checkpoint). */
export function gateProximityHudActive(dist: number, limit = 220): boolean {
  return Number.isFinite(dist) && dist > 0 && dist <= limit
}
