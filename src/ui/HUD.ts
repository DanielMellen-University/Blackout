/**
 * HTML overlay HUD - flight readouts, speedometer, engine power, banner.
 * Speedo: 0–maxKts dial. ENG: 0–100% vertical bar (Shift up / Ctrl down).
 */
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
  private readonly engAb: HTMLElement | null
  private readonly engPanel: HTMLElement | null

  /** Display range for the airspeed dial (knots). */
  private readonly maxKts = 420

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
    this.engAb = root.getElementById('eng-ab')
    this.engPanel = root.getElementById('eng-panel')
    this.buildSpeedTicks(root)
  }

  update(opts: {
    x: number
    y: number
    z: number
    speed: number
    cameraMode: string
    fps: number
    throttle?: number
    boost?: boolean
    gearDown?: boolean
    onGround?: boolean
    banner?: string | null
  }): void {
    if (this.posEl) {
      this.posEl.textContent = `${opts.y.toFixed(0)} m`
    }

    const kts = Math.max(0, opts.speed * 1.94384)
    if (this.spdEl) {
      this.spdEl.textContent = String(Math.round(kts))
    }
    this.updateSpeedo(kts)

    if (this.camEl) {
      this.camEl.textContent = opts.cameraMode.toUpperCase()
    }
    if (this.fpsEl) {
      this.fpsEl.textContent = String(Math.round(opts.fps))
    }

    if (opts.throttle !== undefined) {
      this.updateEngine(opts.throttle, !!opts.boost)
    }

    if (this.gearEl && opts.gearDown !== undefined) {
      this.gearEl.textContent = opts.gearDown ? 'DOWN' : 'UP'
    }
    if (this.stateEl && opts.onGround !== undefined) {
      this.stateEl.textContent = opts.onGround ? 'GND' : 'AIR'
    }
    if (this.bannerEl) {
      if (opts.banner) {
        this.bannerEl.textContent = opts.banner
        this.bannerEl.hidden = false
      } else {
        this.bannerEl.textContent = ''
        this.bannerEl.hidden = true
      }
    }
  }

  /**
   * Arc spans ~240° from lower-left (0 kts) to lower-right (maxKts).
   * Needle angle: -120° at 0 → +120° at max (0° = straight up).
   */
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
      // stroke-dasharray pathLength=100: reveal arc by progress
      const shown = Math.max(0.5, t * 100)
      this.spdArc.style.strokeDasharray = `${shown} 100`
      this.spdArc.style.strokeDashoffset = '0'
    }
  }

  /**
   * Drive ENG bar + % from commanded throttle every frame (Shift/Ctrl spool).
   * Uses scaleY so the fill tracks the setpoint live without flex % height bugs.
   */
  private updateEngine(throttle: number, boost: boolean): void {
    const level = Math.min(1, Math.max(0, throttle))
    const pct = Math.round(level * 100)
    if (this.thrEl) {
      this.thrEl.textContent = `${pct}%`
    }
    // Continuous 0–1: bar and marker follow the live setpoint, not stepped %
    if (this.engFill) {
      this.engFill.style.transform = `scaleY(${level})`
      this.engFill.classList.toggle('boost', boost)
      this.engFill.setAttribute('aria-valuenow', String(pct))
    }
    if (this.engMarker) {
      this.engMarker.style.bottom = `${level * 100}%`
    }
    if (this.engAb) {
      this.engAb.hidden = !boost
    }
    if (this.engPanel) {
      this.engPanel.classList.toggle('boost', boost)
      this.engPanel.classList.toggle('spooled', level >= 0.95)
      this.engPanel.style.setProperty('--eng-level', String(level))
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
    // ticks every 20 kts major, 10 minor over 0..max
    const steps = this.maxKts / 10
    for (let i = 0; i <= steps; i++) {
      const kts = i * 10
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
