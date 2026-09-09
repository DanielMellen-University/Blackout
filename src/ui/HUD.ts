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
  private readonly navCueEl: HTMLElement | null
  private readonly navArrowEl: HTMLElement | null
  private readonly navRangeEl: HTMLElement | null
  private readonly navAltEl: HTMLElement | null

  /** Display range for the airspeed dial (knots). */
  private readonly maxKts = 3000
  /** Pixels of ladder travel per degree of pitch. */
  private readonly pxPerDeg = 2.4

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
      this.setText(this.posEl, String(Math.round(opts.y)))
    }

    const kts = displayedKnots(opts.speed)
    if (this.spdEl) {
      this.setText(this.spdEl, String(Math.round(kts)))
    }
    this.updateSpeedo(kts)

    if (this.camEl) {
      this.setText(this.camEl, opts.cameraMode.toUpperCase())
    }
    if (this.fpsEl) {
      this.setText(this.fpsEl, String(Math.round(opts.fps)))
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
      this.setText(this.gearEl, opts.gearDown ? 'DOWN' : 'UP')
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
    const deg = (bearing * 180) / Math.PI
    if (this.navArrowEl) {
      this.navArrowEl.style.transform = `rotate(${deg}deg)`
    }
    if (this.navRangeEl) {
      this.setText(
        this.navRangeEl,
        dist >= 1000 ? `${(dist / 1000).toFixed(1)} KM` : `${Math.round(dist)} M`,
      )
    }
    if (this.navAltEl) {
      if (Math.abs(altDelta) < 12) {
        this.setText(this.navAltEl, 'LVL')
      } else {
        const dir = altDelta > 0 ? '+' : ''
        this.setText(this.navAltEl, `${dir}${Math.round(altDelta)} M`)
      }
    }
  }

  private updateWarning(
    text: string | null,
    level: 'none' | 'caution' | 'warning',
  ): void {
    if (!this.warnEl || !this.warnTextEl) return
    if (!text || level === 'none') {
      this.setHidden(this.warnEl, true)
      this.warnEl.classList.remove('caution', 'warning')
      this.setText(this.warnTextEl, '')
      return
    }
    this.setHidden(this.warnEl, false)
    this.setText(this.warnTextEl, text)
    this.warnEl.classList.toggle('caution', level === 'caution')
    this.warnEl.classList.toggle('warning', level === 'warning')
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
    const pitchPx = pitchVis * this.pxPerDeg

    if (this.adiBall) {
      // Nose up → horizon slides down (sky fills more of the mask)
      this.adiBall.style.transform = `rotate(${-rollDeg}deg) translateY(${pitchPx}px)`
    }
    if (this.adiBankPtr) {
      this.adiBankPtr.style.transform = `rotate(${-rollDeg}deg)`
    }
    if (this.adiPitchEl) {
      const p = Math.round(pitchDeg)
      this.setText(this.adiPitchEl, `P ${p > 0 ? '+' : ''}${p}°`)
    }
    if (this.adiRollEl) {
      const r = Math.round(rollDeg)
      this.setText(this.adiRollEl, `B ${r > 0 ? '+' : ''}${r}°`)
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
      this.spdNeedle.setAttribute('x2', String(cx + Math.sin(rad) * len))
      this.spdNeedle.setAttribute('y2', String(cy - Math.cos(rad) * len))
    }
    if (this.spdArc) {
      const shown = Math.max(0.5, t * 100)
      this.spdArc.style.strokeDasharray = `${shown} 100`
      this.spdArc.style.strokeDashoffset = '0'
    }
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
      this.engFill.style.height = `${level * 100}%`
      this.engFill.classList.toggle('boost', boost)
      this.engFill.setAttribute('aria-valuenow', String(pct))
    }
    if (this.engMarker) {
      this.engMarker.style.bottom = `${level * 100}%`
    }
    if (this.engPanel) {
      this.engPanel.classList.toggle('boost', boost)
      this.engPanel.classList.toggle('spooled', level >= 0.95)
      this.engPanel.style.setProperty('--eng-level', String(level))
    }
  }

  /** Avoid layout-triggering DOM writes when a readout has not changed. */
  private setText(el: HTMLElement, value: string): void {
    if (el.textContent !== value) el.textContent = value
  }

  private setHidden(el: HTMLElement, hidden: boolean): void {
    if (el.hidden !== hidden) el.hidden = hidden
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
