import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import {
  CAMERA_MODE_LABELS,
  CAMERA_MODES,
  type CameraMode,
} from '../core/types'

const _offsetWorld = new Vector3()
const _look = new Vector3()
const _velLead = new Vector3()
const _spherical = new Spherical()
const _pivot = new Vector3()
const _desired = new Vector3()
const _toCam = new Vector3()

interface ModeConfig {
  offset: Vector3
  lookOffset: Vector3
  fov: number
  lookLead: number
  minDist: number
  maxDist: number
  hideAircraft?: boolean
  freelook?: boolean
}

const MODE_CONFIG: Record<CameraMode, ModeConfig> = {
  chase: {
    offset: new Vector3(0, 5.5, -18),
    lookOffset: new Vector3(0, 1.2, 6),
    fov: 62,
    lookLead: 0.06,
    minDist: 6,
    maxDist: 50,
  },
  close: {
    offset: new Vector3(0, 2.6, -8.5),
    lookOffset: new Vector3(0, 1.0, 5),
    fov: 70,
    lookLead: 0.04,
    minDist: 3.5,
    maxDist: 24,
  },
  cockpit: {
    offset: new Vector3(0, 1.05, 2.35),
    lookOffset: new Vector3(0, 0.95, 14),
    fov: 78,
    lookLead: 0,
    minDist: 1,
    maxDist: 1,
    hideAircraft: true,
    freelook: true,
  },
  wingman: {
    offset: new Vector3(14, 3.5, -4),
    lookOffset: new Vector3(0, 1.0, 2),
    fov: 58,
    lookLead: 0.04,
    minDist: 8,
    maxDist: 40,
  },
  orbit: {
    offset: new Vector3(12, 8, -16),
    lookOffset: new Vector3(0, 1.5, 0),
    fov: 60,
    lookLead: 0,
    minDist: 6,
    maxDist: 160,
  },
}

/**
 * Full spherical look:
 * - Pitch ±180° (full vertical orbit over/under the jet)
 * - Yaw unrestricted (360° horizontal)
 * Tiny epsilon avoids exact pole flips in freelook forward vector.
 */
const PITCH_LIMIT = Math.PI // 180°
const FREELOOK_PITCH_LIMIT = Math.PI / 2 - 0.02 // look up/down without flipping

/**
 * Multi-mode flight camera (Roblox-style RMB look + ground occlusion).
 */
export class CameraSystem {
  readonly camera: PerspectiveCamera
  mode: CameraMode = 'chase'

  /** Flat world ground height (terrain y). */
  groundY = 0
  /** Keep lens this far above terrain (Roblox pop). */
  groundClearance = 1.15

  private yaw = 0
  private pitch = 0.28
  private distance = 20

  private rmbDown = false
  private lastX = 0
  private lastY = 0
  private initialized = false
  private lastVisibilityMode: CameraMode | null = null

  private readonly lookSensitivity = 0.005
  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.camera = new PerspectiveCamera(62, 1, 0.15, 4000)
    this.bindInput(canvas)
    this.applyModeDefaults('chase')
  }

  get modeLabel(): string {
    return CAMERA_MODE_LABELS[this.mode]
  }

  setMode(mode: CameraMode, aircraft?: Aircraft): void {
    this.mode = mode
    this.applyModeDefaults(mode)
    if (aircraft) {
      this.applyRig(aircraft)
      this.applyAircraftVisibility(aircraft, true)
    }
  }

  toggleMode(aircraft?: Aircraft): CameraMode {
    const idx = CAMERA_MODES.indexOf(this.mode)
    const next = CAMERA_MODES[(idx + 1) % CAMERA_MODES.length]!
    this.setMode(next, aircraft)
    return this.mode
  }

  update(aircraft: Aircraft, _dt: number): void {
    if (!this.initialized) {
      this.setMode(this.mode, aircraft)
      this.initialized = true
      return
    }
    this.applyRig(aircraft)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    const c = this.canvas
    c.removeEventListener('contextmenu', this.onContextMenu)
    c.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    c.removeEventListener('wheel', this.onWheel)
    document.removeEventListener('contextmenu', this.onContextMenu)
  }

  private applyModeDefaults(mode: CameraMode): void {
    const cfg = MODE_CONFIG[mode]
    this.camera.fov = cfg.fov
    this.camera.updateProjectionMatrix()

    _spherical.setFromVector3(cfg.offset)
    this.distance = MathUtils.clamp(_spherical.radius, cfg.minDist, cfg.maxDist)
    this.yaw = 0
    this.pitch = mode === 'cockpit' ? 0 : 0.25

    if (mode === 'wingman') {
      this.yaw = -0.9
      this.pitch = 0.2
    } else if (mode === 'orbit') {
      this.yaw = 0.6
      this.pitch = 0.45
      this.distance = 22
    } else if (mode === 'close') {
      this.distance = 9
      this.pitch = 0.22
    } else if (mode === 'chase') {
      this.distance = 19
      this.pitch = 0.28
    }
  }

  private applyRig(aircraft: Aircraft): void {
    const cfg = MODE_CONFIG[this.mode]

    // Focus / subject pivot (slightly above aircraft origin)
    _pivot.copy(aircraft.position)
    _pivot.y += 1.2

    if (cfg.freelook) {
      _offsetWorld.copy(cfg.offset).applyQuaternion(aircraft.orientation)
      this.camera.position.copy(aircraft.position).add(_offsetWorld)
      // Keep cockpit cam above ground if jet is low
      this.clampAboveGround(this.camera.position)

      const lookDist = 20
      const cp = Math.cos(this.pitch)
      _look.set(
        Math.sin(this.yaw) * cp * lookDist,
        -Math.sin(this.pitch) * lookDist,
        Math.cos(this.yaw) * cp * lookDist,
      )
      _look.applyQuaternion(aircraft.orientation)
      _look.add(this.camera.position)
      this.camera.lookAt(_look)
    } else {
      // Ideal third-person position from yaw / pitch / distance (local → world)
      // pitch 0 = level behind, +pitch = above, -pitch = below
      const cp = Math.cos(this.pitch)
      const sp = Math.sin(this.pitch)
      const cy = Math.cos(this.yaw)
      const sy = Math.sin(this.yaw)

      _offsetWorld.set(
        sy * cp * this.distance,
        sp * this.distance,
        -cy * cp * this.distance,
      )
      _offsetWorld.applyQuaternion(aircraft.orientation)
      _desired.copy(_pivot).add(_offsetWorld)

      // Roblox-style: if the line of sight hits terrain, pull camera in
      this.resolveGroundOcclusion(_pivot, _desired, this.camera.position)

      _look.copy(cfg.lookOffset).applyQuaternion(aircraft.orientation)
      _look.add(aircraft.position)

      if (cfg.lookLead > 0) {
        _velLead.copy(aircraft.velocity).multiplyScalar(cfg.lookLead)
        _look.add(_velLead)
      }

      this.camera.lookAt(_look)
    }

    if (this.camera.fov !== cfg.fov) {
      this.camera.fov = cfg.fov
      this.camera.updateProjectionMatrix()
    }

    this.applyAircraftVisibility(aircraft)
  }

  /**
   * If the ideal camera is underground or the segment from pivot→cam
   * crosses the ground plane, place the camera at the intersection
   * (shorten zoom) so terrain "blocks" the view like Roblox.
   */
  private resolveGroundOcclusion(
    pivot: Vector3,
    desired: Vector3,
    out: Vector3,
  ): void {
    const minY = this.groundY + this.groundClearance
    out.copy(desired)

    // Fast path: entire segment clear above ground
    if (pivot.y >= minY && desired.y >= minY) {
      return
    }

    // Desired is below clearance — intersect ray with plane y = minY
    _toCam.subVectors(desired, pivot)
    const dy = _toCam.y

    if (Math.abs(dy) < 1e-6) {
      // Horizontal ray — just lift
      out.y = minY
      return
    }

    // t where pivot + t*(desired-pivot) has y = minY
    const t = (minY - pivot.y) / dy

    if (t >= 0 && t <= 1) {
      // Hit between pivot and desired → stop at surface
      out.copy(pivot).addScaledVector(_toCam, t)
      // Nudge slightly toward pivot so we sit just above the plane
      out.lerp(pivot, 0.015)
      out.y = Math.max(out.y, minY)
    } else if (desired.y < minY) {
      // Desired underground but no valid segment hit (pivot also low)
      out.y = minY
    }

    // Never sit closer than a tiny min distance to pivot (avoid camera flip)
    const minSep = 1.5
    _toCam.subVectors(out, pivot)
    const sep = _toCam.length()
    if (sep < minSep && sep > 1e-6) {
      _toCam.multiplyScalar(minSep / sep)
      out.copy(pivot).add(_toCam)
      if (out.y < minY) out.y = minY
    }
  }

  private clampAboveGround(pos: Vector3): void {
    const minY = this.groundY + this.groundClearance
    if (pos.y < minY) pos.y = minY
  }

  private applyAircraftVisibility(aircraft: Aircraft, force = false): void {
    if (!force && this.lastVisibilityMode === this.mode) return
    this.lastVisibilityMode = this.mode
    const hide = MODE_CONFIG[this.mode].hideAircraft === true
    aircraft.mesh.traverse((obj) => {
      if ((obj as { isMesh?: boolean }).isMesh) {
        obj.visible = !hide
      }
    })
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    document.addEventListener('contextmenu', this.onContextMenu)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    canvas.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('mousemove', this.onMouseMove)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 2) return
    e.preventDefault()
    this.rmbDown = true
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.canvas.style.cursor = 'grabbing'
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2 || e.buttons === 0) {
      this.rmbDown = false
      this.canvas.style.cursor = ''
    }
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.rmbDown) return
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY

    // Horizontal → yaw (free 360°); vertical → pitch (±180° third-person)
    this.yaw -= dx * this.lookSensitivity
    this.pitch += dy * this.lookSensitivity

    // Keep yaw in (-π, π] for numeric stability — still full 360° freedom
    this.yaw = MathUtils.euclideanModulo(this.yaw + Math.PI, Math.PI * 2) - Math.PI

    const cfg = MODE_CONFIG[this.mode]
    if (cfg.freelook) {
      // Cockpit: ±90° look (full up/down without rolling the horizon)
      this.pitch = MathUtils.clamp(this.pitch, -FREELOOK_PITCH_LIMIT, FREELOOK_PITCH_LIMIT)
    } else {
      // Third-person: full ±180° so you can go under, over, and around
      this.pitch = MathUtils.clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT)
    }
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const cfg = MODE_CONFIG[this.mode]
    if (cfg.freelook) return

    const zoom = Math.exp(e.deltaY * 0.0012)
    this.distance = MathUtils.clamp(this.distance * zoom, cfg.minDist, cfg.maxDist)
  }
}
