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

interface ModeConfig {
  /** Default local offset when look yaw/pitch are zero (X right, Y up, Z nose). */
  offset: Vector3
  lookOffset: Vector3
  fov: number
  lookLead: number
  /** Min/max orbit distance (meters). */
  minDist: number
  maxDist: number
  hideAircraft?: boolean
  /** Cockpit: freelook from pilot seat instead of orbiting around jet. */
  freelook?: boolean
}

const MODE_CONFIG: Record<CameraMode, ModeConfig> = {
  chase: {
    offset: new Vector3(0, 5.5, -18),
    lookOffset: new Vector3(0, 1.2, 6),
    fov: 62,
    lookLead: 0.06,
    minDist: 8,
    maxDist: 50,
  },
  close: {
    offset: new Vector3(0, 2.6, -8.5),
    lookOffset: new Vector3(0, 1.0, 5),
    fov: 70,
    lookLead: 0.04,
    minDist: 4,
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
    minDist: 10,
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
 * Multi-mode flight camera.
 * - C cycles modes
 * - Hold RMB + drag = Roblox-style look / pan around the jet
 * - Scroll = zoom (chase/close/wingman/orbit)
 * - Context menu is suppressed so RMB is free for the game
 */
export class CameraSystem {
  readonly camera: PerspectiveCamera
  mode: CameraMode = 'chase'

  /** Radians — horizontal orbit (Roblox-style). */
  private yaw = 0
  /** Radians — vertical orbit. */
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

    // Seed spherical from default offset
    _spherical.setFromVector3(cfg.offset)
    this.distance = MathUtils.clamp(_spherical.radius, cfg.minDist, cfg.maxDist)
    // Three.js spherical: phi from +Y, theta around Y
    // offset (0, y, -z) → behind aircraft
    this.yaw = 0
    this.pitch = mode === 'cockpit' ? 0 : 0.25
    if (mode === 'wingman') {
      this.yaw = -0.9
      this.pitch = 0.2
    }
    if (mode === 'orbit') {
      this.yaw = 0.6
      this.pitch = 0.45
      this.distance = 22
    }
    if (mode === 'close') {
      this.distance = 9
      this.pitch = 0.22
    }
    if (mode === 'chase') {
      this.distance = 19
      this.pitch = 0.28
    }
  }

  private applyRig(aircraft: Aircraft): void {
    const cfg = MODE_CONFIG[this.mode]
    _pivot.copy(aircraft.position)
    _pivot.y += 1.2

    if (cfg.freelook) {
      // Cockpit: seat position + look direction from yaw/pitch
      _offsetWorld.copy(cfg.offset).applyQuaternion(aircraft.orientation)
      this.camera.position.copy(aircraft.position).add(_offsetWorld)

      // Look dir in local space: start +Z, apply pitch then yaw
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
      // Third-person: spherical orbit in aircraft local space, then to world
      // yaw 0, pitch 0 → behind and slightly above (local -Z)
      const cp = Math.cos(this.pitch)
      const sp = Math.sin(this.pitch)
      const cy = Math.cos(this.yaw)
      const sy = Math.sin(this.yaw)

      // Local offset: x right, y up, z forward (nose)
      // Behind = -Z when yaw=0
      _offsetWorld.set(
        sy * cp * this.distance,
        sp * this.distance + 1.2,
        -cy * cp * this.distance,
      )
      _offsetWorld.applyQuaternion(aircraft.orientation)
      this.camera.position.copy(aircraft.position).add(_offsetWorld)

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
    // Block browser context menu everywhere so RMB is for camera
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
    if (e.button !== 2 && this.rmbDown === false) return
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

    // Roblox-like: horizontal drag yaws, vertical drag pitches
    this.yaw -= dx * this.lookSensitivity
    this.pitch += dy * this.lookSensitivity

    const cfg = MODE_CONFIG[this.mode]
    if (cfg.freelook) {
      this.pitch = MathUtils.clamp(this.pitch, -1.2, 1.2)
      // wrap yaw freely
    } else {
      this.pitch = MathUtils.clamp(this.pitch, 0.05, 1.35)
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
