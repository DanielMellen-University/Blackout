import { MathUtils, Mesh, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import {
  CAMERA_MODE_LABELS,
  CAMERA_MODES,
  type CameraMode,
} from '../core/types'
import { cameraMinY } from '../world/ground'

const _offsetWorld = new Vector3()
const _look = new Vector3()
const _velLead = new Vector3()
const _pivot = new Vector3()
const _desired = new Vector3()
const _toCam = new Vector3()
const _forward = new Vector3()
const _headingQuat = new Quaternion()
const _Y_UP = new Vector3(0, 1, 0)

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
  /** Spring stiffness for chase follow (higher = snappier). */
  followStiffness: number
  /**
   * When true, orbit offset is rotated only by aircraft heading (yaw).
   * Avoids rolling the camera with the jet for readable chase framing.
   * Orbit mode uses world-space spherical offset instead.
   */
  yawOnly?: boolean
  hideAircraft?: boolean
  freelook?: boolean
}

const MODE_CONFIG: Record<CameraMode, ModeConfig> = {
  chase: {
    lookOffset: new Vector3(0, 1.2, 8),
    fov: 62,
    lookLead: 0.08,
    minDist: 6,
    maxDist: 50,
    defaultYaw: 0,
    defaultPitch: 0.28,
    defaultDistance: 19,
    followStiffness: 10,
    yawOnly: true,
  },
  close: {
    lookOffset: new Vector3(0, 1.0, 6),
    fov: 70,
    lookLead: 0.05,
    minDist: 3.5,
    maxDist: 24,
    defaultYaw: 0,
    defaultPitch: 0.22,
    defaultDistance: 9,
    followStiffness: 12,
    yawOnly: true,
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
    followStiffness: 40,
    hideAircraft: true,
    freelook: true,
  },
  wingman: {
    lookOffset: new Vector3(0, 1.0, 4),
    fov: 58,
    lookLead: 0.05,
    minDist: 8,
    maxDist: 40,
    defaultYaw: -0.9,
    defaultPitch: 0.2,
    defaultDistance: 15,
    followStiffness: 9,
    yawOnly: true,
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
    followStiffness: 8,
    yawOnly: false,
  },
}

const PITCH_LIMIT = Math.PI / 2 - 0.05
const FREELOOK_PITCH_LIMIT = Math.PI / 2 - 0.02
/** ~6.67s idle before easing back to mode defaults. */
const AUTO_RETURN_DELAY = 10 * (2 / 3)
const AUTO_RETURN_RATE = 1.35
const LOOK_STIFFNESS = 14

/**
 * Multi-mode flight camera: spring chase, MMB orbit pan, ground occlusion, idle recenter.
 */
export class CameraSystem {
  readonly camera: PerspectiveCamera
  mode: CameraMode = 'chase'

  /** Extra clearance above ground surface for the lens (meters). */
  groundClearance = 1.15

  /** Orbit yaw relative to aircraft heading (chase) or world (orbit). */
  private yaw = 0
  private pitch = 0.28
  private distance = 20

  /** True while holding middle mouse (button 1) to pan the camera. */
  private panDown = false
  private lastX = 0
  private lastY = 0
  private initialized = false
  private lastVisibilityMode: CameraMode | null = null

  /** Smoothed look-at target for stable framing. */
  private readonly lookSmoothed = new Vector3()
  private lookReady = false

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
    this.lookReady = false
    this.bumpInput()
    if (aircraft) {
      this.applyRig(aircraft, 0, true)
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
    this.applyRig(aircraft, dt, false)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    const c = this.canvas
    const cap: AddEventListenerOptions = { capture: true }
    c.removeEventListener('pointerdown', this.onPointerDown, cap)
    window.removeEventListener('pointerup', this.onPointerUp, cap)
    window.removeEventListener('pointercancel', this.onPointerUp, cap)
    window.removeEventListener('pointermove', this.onPointerMove, cap)
    c.removeEventListener('wheel', this.onWheel)
    c.removeEventListener('auxclick', this.onAuxClick, cap)
    c.removeEventListener('mousedown', this.onMouseDownBlock, cap)
  }

  private bumpInput(): void {
    this.lastInputMs = performance.now()
  }

  /**
   * After AUTO_RETURN_DELAY with no look/zoom, ease yaw/pitch/distance
   * toward this mode's default framing.
   */
  private updateAutoReturn(dt: number): void {
    if (this.panDown || dt <= 0) return

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

  /**
   * Aircraft heading around world Y from body +Z forward.
   */
  private aircraftHeading(aircraft: Aircraft): number {
    _forward.set(0, 0, 1).applyQuaternion(aircraft.orientation)
    return Math.atan2(_forward.x, _forward.z)
  }

  /**
   * Spherical offset in "behind the jet" frame: yaw=0 is aft, pitch up is +Y.
   */
  private sphericalOffset(out: Vector3, yaw: number, pitch: number, dist: number): void {
    const cp = Math.cos(pitch)
    const sp = Math.sin(pitch)
    const cy = Math.cos(yaw)
    const sy = Math.sin(yaw)
    out.set(sy * cp * dist, sp * dist, -cy * cp * dist)
  }

  private applyRig(aircraft: Aircraft, dt: number, snap: boolean): void {
    const cfg = MODE_CONFIG[this.mode]

    _pivot.copy(aircraft.position)
    _pivot.y += 1.2

    if (cfg.freelook && cfg.seatOffset) {
      // Cockpit: hard-attach seat, freelook via MMB yaw/pitch in aircraft frame
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
      this.lookSmoothed.copy(_look)
      this.lookReady = true
    } else {
      this.sphericalOffset(_offsetWorld, this.yaw, this.pitch, this.distance)

      if (cfg.yawOnly) {
        // Chase-style: rotate offset by heading only (no roll/pitch of the airframe)
        const heading = this.aircraftHeading(aircraft)
        _headingQuat.setFromAxisAngle(_Y_UP, heading)
        _offsetWorld.applyQuaternion(_headingQuat)
      }
      // Orbit: leave offset in world spherical space around the pivot

      _desired.copy(_pivot).add(_offsetWorld)
      this.resolveGroundOcclusion(_pivot, _desired, _desired)

      if (snap || dt <= 0) {
        this.camera.position.copy(_desired)
      } else {
        const alpha = 1 - Math.exp(-cfg.followStiffness * dt)
        this.camera.position.lerp(_desired, alpha)
      }
      this.clampAboveGround(this.camera.position)

      // Look slightly ahead of the jet (yaw-only offset + velocity lead)
      if (cfg.yawOnly) {
        const heading = this.aircraftHeading(aircraft)
        _headingQuat.setFromAxisAngle(_Y_UP, heading)
        _look.copy(cfg.lookOffset).applyQuaternion(_headingQuat)
      } else {
        _look.copy(cfg.lookOffset)
      }
      _look.add(aircraft.position)

      if (cfg.lookLead > 0) {
        _velLead.copy(aircraft.velocity).multiplyScalar(cfg.lookLead)
        // Prefer horizontal lead so banking does not yank the look target skyward
        _velLead.y *= 0.35
        _look.add(_velLead)
      }

      if (snap || dt <= 0 || !this.lookReady) {
        this.lookSmoothed.copy(_look)
        this.lookReady = true
      } else {
        const lookAlpha = 1 - Math.exp(-LOOK_STIFFNESS * dt)
        this.lookSmoothed.lerp(_look, lookAlpha)
      }

      this.camera.lookAt(this.lookSmoothed)
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
    // Shared ground query under the desired camera XY
    const minY = cameraMinY(desired.x, desired.z, this.groundClearance)
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
      const floor = cameraMinY(out.x, out.z, this.groundClearance)
      if (out.y < floor) out.y = floor
    }
  }

  private clampAboveGround(pos: Vector3): void {
    const minY = cameraMinY(pos.x, pos.z, this.groundClearance)
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
    // Middle mouse button pan (button 1, buttons mask bit 4)
    const cap: AddEventListenerOptions = { capture: true }
    canvas.addEventListener('pointerdown', this.onPointerDown, cap)
    window.addEventListener('pointerup', this.onPointerUp, cap)
    window.addEventListener('pointercancel', this.onPointerUp, cap)
    window.addEventListener('pointermove', this.onPointerMove, cap)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    // Prevent default autoscroll on MMB
    canvas.addEventListener('auxclick', this.onAuxClick, cap)
    canvas.addEventListener('mousedown', this.onMouseDownBlock, cap)
  }

  private onMouseDownBlock = (e: MouseEvent): void => {
    if (e.button === 1) e.preventDefault()
  }

  private onAuxClick = (e: MouseEvent): void => {
    if (e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 1) return // middle mouse only
    e.preventDefault()
    e.stopPropagation()
    this.panDown = true
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.canvas.style.cursor = 'grabbing'
    try {
      this.canvas.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    this.bumpInput()
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.panDown) return
    // button 1 released, or middle bit clear (buttons & 4)
    if (e.button === 1 || (e.buttons & 4) === 0) {
      this.panDown = false
      this.canvas.style.cursor = 'crosshair'
      try {
        if (this.canvas.hasPointerCapture(e.pointerId)) {
          this.canvas.releasePointerCapture(e.pointerId)
        }
      } catch {
        // ignore
      }
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.panDown) return
    if ((e.buttons & 4) === 0) {
      this.panDown = false
      this.canvas.style.cursor = 'crosshair'
      return
    }

    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY
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
