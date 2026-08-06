import { MathUtils, Mesh, PerspectiveCamera, Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import {
  CAMERA_MODE_LABELS,
  CAMERA_MODES,
  type CameraMode,
} from '../core/types'

const _offsetWorld = new Vector3()
const _look = new Vector3()
const _velLead = new Vector3()
const _pivot = new Vector3()
const _desired = new Vector3()
const _toCam = new Vector3()

interface ModeConfig {
  /** Local seat offset for cockpit freelook only. */
  seatOffset?: Vector3
  lookOffset: Vector3
  fov: number
  lookLead: number
  minDist: number
  maxDist: number
  defaultYaw: number
  defaultPitch: number
  defaultDistance: number
  hideAircraft?: boolean
  freelook?: boolean
}

const MODE_CONFIG: Record<CameraMode, ModeConfig> = {
  chase: {
    lookOffset: new Vector3(0, 1.2, 6),
    fov: 62,
    lookLead: 0.06,
    minDist: 6,
    maxDist: 50,
    defaultYaw: 0,
    defaultPitch: 0.28,
    defaultDistance: 19,
  },
  close: {
    lookOffset: new Vector3(0, 1.0, 5),
    fov: 70,
    lookLead: 0.04,
    minDist: 3.5,
    maxDist: 24,
    defaultYaw: 0,
    defaultPitch: 0.22,
    defaultDistance: 9,
  },
  cockpit: {
    seatOffset: new Vector3(0, 1.05, 2.35),
    lookOffset: new Vector3(0, 0.95, 14),
    fov: 78,
    lookLead: 0,
    minDist: 1,
    maxDist: 1,
    defaultYaw: 0,
    defaultPitch: 0,
    defaultDistance: 1,
    hideAircraft: true,
    freelook: true,
  },
  wingman: {
    lookOffset: new Vector3(0, 1.0, 2),
    fov: 58,
    lookLead: 0.04,
    minDist: 8,
    maxDist: 40,
    defaultYaw: -0.9,
    defaultPitch: 0.2,
    defaultDistance: 15,
  },
  orbit: {
    lookOffset: new Vector3(0, 1.5, 0),
    fov: 60,
    lookLead: 0,
    minDist: 6,
    maxDist: 160,
    defaultYaw: 0.6,
    defaultPitch: 0.45,
    defaultDistance: 22,
  },
}

const PITCH_LIMIT = Math.PI / 2
const FREELOOK_PITCH_LIMIT = Math.PI / 2 - 0.02
const AUTO_RETURN_DELAY = 10 * (2 / 3)
const AUTO_RETURN_RATE = 1.35

/**
 * Multi-mode flight camera (Roblox-style RMB look + ground occlusion + idle recenter).
 */
export class CameraSystem {
  readonly camera: PerspectiveCamera
  mode: CameraMode = 'chase'

  groundY = 0
  groundClearance = 1.15

  private yaw = 0
  private pitch = 0.28
  private distance = 20

  /** True while user is holding look button (RMB/MMB). */
  private looking = false
  /** Which pointer button started look (for matching pointerup). */
  private lookButton = -1
  private lastX = 0
  private lastY = 0
  private initialized = false
  private lastVisibilityMode: CameraMode | null = null

  /** performance.now() of last user camera adjust (look / zoom / mode change). */
  private lastInputMs = performance.now()

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
    this.bumpInput()
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

  update(aircraft: Aircraft, dt: number): void {
    if (!this.initialized) {
      this.setMode(this.mode, aircraft)
      this.initialized = true
      return
    }

    this.updateAutoReturn(dt)
    this.applyRig(aircraft)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    const c = this.canvas
    c.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    window.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    c.removeEventListener('wheel', this.onWheel)
    if (document.pointerLockElement === c) {
      document.exitPointerLock()
    }
  }

  private bumpInput(): void {
    this.lastInputMs = performance.now()
  }

  /**
   * After AUTO_RETURN_DELAY with no look/zoom, ease yaw/pitch/distance
   * toward this mode's default framing.
   */
  private updateAutoReturn(dt: number): void {
    if (this.looking || dt <= 0) return

    const idleSec = (performance.now() - this.lastInputMs) / 1000
    if (idleSec < AUTO_RETURN_DELAY) return

    const cfg = MODE_CONFIG[this.mode]
    const alpha = 1 - Math.exp(-AUTO_RETURN_RATE * dt)

    this.yaw = lerpAngle(this.yaw, cfg.defaultYaw, alpha)
    this.pitch = MathUtils.lerp(this.pitch, cfg.defaultPitch, alpha)
    this.distance = MathUtils.lerp(this.distance, cfg.defaultDistance, alpha)

    // Snap when close enough to avoid endless micro-drift
    if (
      Math.abs(deltaAngle(this.yaw, cfg.defaultYaw)) < 0.002 &&
      Math.abs(this.pitch - cfg.defaultPitch) < 0.002 &&
      Math.abs(this.distance - cfg.defaultDistance) < 0.02
    ) {
      this.yaw = cfg.defaultYaw
      this.pitch = cfg.defaultPitch
      this.distance = cfg.defaultDistance
    }
  }

  private applyModeDefaults(mode: CameraMode): void {
    const cfg = MODE_CONFIG[mode]
    this.camera.fov = cfg.fov
    this.camera.updateProjectionMatrix()
    this.yaw = cfg.defaultYaw
    this.pitch = cfg.defaultPitch
    this.distance = cfg.defaultDistance
  }

  private applyRig(aircraft: Aircraft): void {
    const cfg = MODE_CONFIG[this.mode]

    _pivot.copy(aircraft.position)
    _pivot.y += 1.2

    if (cfg.freelook && cfg.seatOffset) {
      _offsetWorld.copy(cfg.seatOffset).applyQuaternion(aircraft.orientation)
      this.camera.position.copy(aircraft.position).add(_offsetWorld)
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

  private resolveGroundOcclusion(
    pivot: Vector3,
    desired: Vector3,
    out: Vector3,
  ): void {
    const minY = this.groundY + this.groundClearance
    out.copy(desired)

    if (pivot.y >= minY && desired.y >= minY) {
      return
    }

    _toCam.subVectors(desired, pivot)
    const dy = _toCam.y

    if (Math.abs(dy) < 1e-6) {
      out.y = minY
      return
    }

    const t = (minY - pivot.y) / dy

    if (t >= 0 && t <= 1) {
      out.copy(pivot).addScaledVector(_toCam, t)
      out.lerp(pivot, 0.015)
      out.y = Math.max(out.y, minY)
    } else if (desired.y < minY) {
      out.y = minY
    }

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
      if (obj instanceof Mesh) obj.visible = !hide
    })
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('pointermove', this.onPointerMove)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  /**
   * Hold RMB (or MMB) to look - with or without Shift (boost).
   * Pointer lock hides the OS cursor and stops the browser context menu
   * from winning over Shift+RMB in Chrome/Firefox.
   */
  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 2 && e.button !== 1) return
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    this.looking = true
    this.lookButton = e.button
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.canvas.style.cursor = 'none'
    this.bumpInput()

    // Request lock while the user gesture is active (works with Shift held)
    if (document.pointerLockElement !== this.canvas) {
      const lock = this.canvas.requestPointerLock as (
        options?: PointerLockOptions,
      ) => Promise<void> | void
      try {
        const result = lock.call(this.canvas, { unadjustedMovement: true })
        if (result && typeof (result as Promise<void>).catch === 'function') {
          ;(result as Promise<void>).catch(() => {
            // Fallback: unlocked drag still works via clientX/Y
          })
        }
      } catch {
        try {
          this.canvas.requestPointerLock()
        } catch {
          // ignore
        }
      }
    }

    try {
      this.canvas.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.looking) return
    if (e.button !== this.lookButton && e.buttons !== 0) return

    this.endLook()
    try {
      if (this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId)
      }
    } catch {
      // ignore
    }
  }

  private onPointerLockChange = (): void => {
    // If lock is lost externally, stop looking
    if (document.pointerLockElement !== this.canvas && this.looking) {
      // Keep looking until button release if still holding button via buttons mask
      // (some UAs fire lock change mid-drag); only clear cursor state
      if (!this.looking) this.canvas.style.cursor = ''
    }
  }

  private endLook(): void {
    this.looking = false
    this.lookButton = -1
    this.canvas.style.cursor = 'crosshair'
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock()
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.looking) return

    // Prefer movementX/Y under pointer lock (immune to menu / edge clamping)
    let dx = e.movementX
    let dy = e.movementY
    if (document.pointerLockElement !== this.canvas) {
      dx = e.clientX - this.lastX
      dy = e.clientY - this.lastY
      this.lastX = e.clientX
      this.lastY = e.clientY
    }

    if (dx === 0 && dy === 0) return

    this.yaw += dx * this.lookSensitivity
    this.yaw = MathUtils.euclideanModulo(this.yaw + Math.PI, Math.PI * 2) - Math.PI

    this.pitch += dy * this.lookSensitivity
    const cfg = MODE_CONFIG[this.mode]
    if (cfg.freelook) {
      this.pitch = MathUtils.clamp(this.pitch, -FREELOOK_PITCH_LIMIT, FREELOOK_PITCH_LIMIT)
    } else {
      this.pitch = MathUtils.clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT)
    }

    this.bumpInput()
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const cfg = MODE_CONFIG[this.mode]
    if (cfg.freelook) return

    const zoom = Math.exp(e.deltaY * 0.0012)
    this.distance = MathUtils.clamp(this.distance * zoom, cfg.minDist, cfg.maxDist)
    this.bumpInput()
  }
}

/** Shortest-path angle difference in (-π, π]. */
function deltaAngle(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
}

/** Lerp angles along the shortest arc. */
function lerpAngle(from: number, to: number, t: number): number {
  return from + deltaAngle(from, to) * t
}
