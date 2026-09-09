/**
 * HTML overlay HUD - flight readouts, speedometer, engine power,
 * attitude indicator (pitch ladder + bank), banner.
 */
import { displayedKnots } from '../core/airspeed'

export class HUD {
  private readonly posEl: HTMLElement | null
  private readonly spdEl: HTMLElement | null
  private readonly camEl: HTMLElement | null
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
  private speedValue = Number.NaN
  private speedText = ''
  private fpsValue = Number.NaN
  private fpsText = ''
  private cameraModeValue: string | null = null
  private cameraModeText = ''
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
  private previousGearDown: boolean | null = null
  private gearFlashUntil = 0

  constructor(root: Document = document) {
    this.posEl = root.getElementById('hud-pos')
    this.spdEl = root.getElementById('hud-spd')
    this.camEl = root.getElementById('hud-cam')
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
    this.navCueEl = root.getElementById('nav-cue')
    this.navArrowEl = root.getElementById('nav-arrow')
    this.navRangeEl = root.getElementById('nav-range')
    this.navAltEl = root.getElementById('nav-alt')
    this.buildSpeedTicks(root)
    this.buildAttitudeLadder(root)
    this.buildBankMarks(root)
  }

  update(opts: {
    y: number
    speed: number
    cameraMode: string
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
  }): void {
    if (this.posEl) {
      const altitude = Math.round(opts.y)
      if (altitude !== this.altitudeValue) {
        this.altitudeValue = altitude
        this.altitudeText = String(altitude)
      }
      this.setText(this.posEl, this.altitudeText)
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

    if (this.camEl) {
      if (opts.cameraMode !== this.cameraModeValue) {
        this.cameraModeValue = opts.cameraMode
        this.cameraModeText = opts.cameraMode.toUpperCase()
      }
      this.setText(this.camEl, this.cameraModeText)
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
    }
  }

  private updateNav(
    bearing: number | null,
    dist: number,
    altDelta: number,
  ): void {
    if (!this.navCueEl) return
    if (bearing === null) {
      this.setHidden(this.navCueEl, true)
      return
    }
    this.setHidden(this.navCueEl, false)
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
      this.setStyle(this.adiBall, 'transform', `rotate(${rollVisual}deg) translateY(${pitchPx}px)`)
    }
    if (this.adiBankPtr) {
      this.setStyle(this.adiBankPtr, 'transform', `rotate(${rollVisual}deg)`)
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
      this.setAttribute(this.spdNeedle, 'x2', formatHudNumber(cx + Math.sin(rad) * len, 10))
      this.setAttribute(this.spdNeedle, 'y2', formatHudNumber(cy - Math.cos(rad) * len, 10))
    }
    if (this.spdArc) {
      const shown = Math.max(0.5, quantizeHudNumber(t * 100, 10))
      this.setStyle(this.spdArc, 'stroke-dasharray', `${shown} 100`)
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

  private updateEngine(throttle: number, boost: boolean): void {
    // ENG% is the lever / speed target. Afterburner only restyles the bar.
    const level = Math.min(1, Math.max(0, throttle))
    const pct = Math.round(level * 100)
    if (this.thrEl) {
      this.setText(this.thrEl, `${pct}%`)
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
}

/** Stable decimal formatting prevents float noise from invalidating HUD caches. */
export function quantizeHudNumber(value: number, precision: number): number {
  if (!Number.isFinite(value) || precision <= 0) return 0
  return Math.round(value * precision) / precision
}

export function formatHudNumber(value: number, precision: number): string {
  return String(quantizeHudNumber(value, precision))
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
