/**
 * HTML overlay HUD - flight + debug readouts.
 */
export class HUD {
  private readonly posEl: HTMLElement | null
  private readonly spdEl: HTMLElement | null
  private readonly camEl: HTMLElement | null
  private readonly fpsEl: HTMLElement | null
  private readonly thrEl: HTMLElement | null
  private readonly gearEl: HTMLElement | null
  private readonly stateEl: HTMLElement | null

  constructor(root: Document = document) {
    this.posEl = root.getElementById('hud-pos')
    this.spdEl = root.getElementById('hud-spd')
    this.camEl = root.getElementById('hud-cam')
    this.fpsEl = root.getElementById('hud-fps')
    this.thrEl = root.getElementById('hud-thr')
    this.gearEl = root.getElementById('hud-gear')
    this.stateEl = root.getElementById('hud-state')
  }

  update(opts: {
    x: number
    y: number
    z: number
    speed: number
    cameraMode: string
    fps: number
    throttle?: number
    gearDown?: boolean
    onGround?: boolean
  }): void {
    if (this.posEl) {
      this.posEl.textContent = `${opts.x.toFixed(0)}, ${opts.y.toFixed(0)}, ${opts.z.toFixed(0)}`
    }
    if (this.spdEl) {
      // m/s -> rough knots for flavor
      const kts = opts.speed * 1.94384
      this.spdEl.textContent = `${kts.toFixed(0)} kts`
    }
    if (this.camEl) {
      this.camEl.textContent = opts.cameraMode.toUpperCase()
    }
    if (this.fpsEl) {
      this.fpsEl.textContent = String(Math.round(opts.fps))
    }
    if (this.thrEl && opts.throttle !== undefined) {
      this.thrEl.textContent = `${Math.round(opts.throttle * 100)}%`
    }
    if (this.gearEl && opts.gearDown !== undefined) {
      this.gearEl.textContent = opts.gearDown ? 'DOWN' : 'UP'
    }
    if (this.stateEl && opts.onGround !== undefined) {
      this.stateEl.textContent = opts.onGround ? 'GND' : 'AIR'
    }
  }
}
