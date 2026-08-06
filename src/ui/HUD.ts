/**
 * Minimal HTML overlay HUD for Phase 0 debug readouts.
 * Phase 2 will expand to airspeed/altitude/attitude instruments.
 */
export class HUD {
  private readonly posEl: HTMLElement | null
  private readonly spdEl: HTMLElement | null
  private readonly camEl: HTMLElement | null
  private readonly fpsEl: HTMLElement | null

  constructor(root: Document = document) {
    this.posEl = root.getElementById('hud-pos')
    this.spdEl = root.getElementById('hud-spd')
    this.camEl = root.getElementById('hud-cam')
    this.fpsEl = root.getElementById('hud-fps')
  }

  update(opts: {
    x: number
    y: number
    z: number
    speed: number
    cameraMode: string
    fps: number
  }): void {
    if (this.posEl) {
      this.posEl.textContent = `${opts.x.toFixed(0)}, ${opts.y.toFixed(0)}, ${opts.z.toFixed(0)}`
    }
    if (this.spdEl) {
      this.spdEl.textContent = opts.speed.toFixed(1)
    }
    if (this.camEl) {
      this.camEl.textContent = opts.cameraMode.toUpperCase()
    }
    if (this.fpsEl) {
      this.fpsEl.textContent = String(Math.round(opts.fps))
    }
  }
}
