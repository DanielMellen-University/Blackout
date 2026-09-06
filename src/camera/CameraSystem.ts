import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig } from '../aircraft/flightConfig'
import {
  CAMERA_MODE_LABELS,
  CAMERA_MODES,
  type CameraMode,
} from '../core/types'
import { cameraMinY } from '../world/ground'
import { CockpitMode } from './CockpitMode'

const _offsetWorld = new Vector3()
const _look = new Vector3()
const _velLead = new Vector3()
const _pivot = new Vector3()
const _desired = new Vector3()
const _toCam = new Vector3()
const _forward = new Vector3()
const _aircraftDelta = new Vector3()
const _headingQuat = new Quaternion()
const _Y_UP = new Vector3(0, 1, 0)

/** External / chase-style modes only. Cockpit is `CockpitMode`. */
type ChaseMode = Exclude<CameraMode, 'cockpit'>

interface ModeConfig {
  lookOffset: Vector3
  fov: number
  lookLead: number
  maxLookLead: number
  minDist: number
  maxDist: number
  defaultYaw: number
  defaultPitch: number
  defaultDistance: number
  followStiffness: number
  /**
   * When true, the offset is rotated only by aircraft heading (yaw), avoiding
   * camera roll while retaining a readable external view.
   */
  yawOnly?: boolean
}

const MODE_CONFIG: Record<ChaseMode, ModeConfig> = {
  chase: {
    lookOffset: new Vector3(0, 1.1, 5.5),
    fov: 60,
    lookLead: 0.055,
    maxLookLead: 10,
    minDist: 6,
    maxDist: 32,
    defaultYaw: 0,
    defaultPitch: 0.24,
    defaultDistance: 17,
    followStiffness: 9,
    yawOnly: true,
  },
}

const PITCH_LIMIT = Math.PI / 2 - 0.05
/** ~6.67s idle before easing back to mode defaults. */
const AUTO_RETURN_DELAY = 10 * (2 / 3)
const AUTO_RETURN_RATE = 1.35
const LOOK_STIFFNESS = 14
/** Extra FOV (deg) at max airspeed. */
const SPEED_FOV_BOOST = 6
/** Chase distance stretch at max airspeed (1 = base). */
const SPEED_DIST_STRETCH = 0.14
/** How fast FOV/distance juice tracks airspeed. */
const JUICE_STIFFNESS = 3.2

/**
 * Stable external chase camera plus a dedicated cockpit view.
 */
export class CameraSystem {
  readonly camera: PerspectiveCamera
  mode: CameraMode = 'chase'
  readonly cockpit = new CockpitMode()

  /** Smoothed 0–1 speed juice for FOV / pullback. */
  private speedJuice = 0
  /** Last reliable horizontal heading; retained while the nose is near vertical. */
  private stableHeading = 0
  /** Last aircraft position used to move the chase rig in the jet's frame. */
  private readonly lastAircraftPosition = new Vector3()
  private aircraftPositionReady = false

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

  /** Smoothed look-at target for stable framing. */
  private readonly lookSmoothed = new Vector3()
  private lookReady = false

  /** performance.now() of last user camera adjust (look / zoom / mode change). */
  private lastInputMs = performance.now()

  private readonly lookSensitivity = 0.005
  private readonly canvas: HTMLCanvasElement
  private shake = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    // Far plane past stream + sky (~8.4 km terrain, fog wall earlier)
    this.camera = new PerspectiveCamera(62, 1, 0.2, 60000)
    this.bindInput(canvas)
    this.applyModeDefaults('chase')
  }

  get modeLabel(): string {
    return CAMERA_MODE_LABELS[this.mode]
  }

  setMode(mode: CameraMode, aircraft?: Aircraft): void {
    const leavingCockpit = this.mode === 'cockpit' && mode !== 'cockpit'
    this.mode = mode
    this.lookReady = false
    this.bumpInput()

    if (mode === 'cockpit') {
      this.cockpit.enter(this.camera)
    } else {
      if (leavingCockpit) this.cockpit.exit(this.camera)
      this.applyModeDefaults(mode)
    }

    if (aircraft) {
      if (mode === 'cockpit') this.cockpit.update(this.camera, aircraft)
      else this.applyRig(aircraft, 0, true)
      this.applyAircraftVisibility(aircraft)
    }
  }

  /** Brief view punch (crash boom). */
  impulse(amount = 1): void {
    this.shake = Math.max(this.shake, amount)
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

    if (this.mode === 'cockpit') {
      this.cockpit.update(this.camera, aircraft)
      this.applyAircraftVisibility(aircraft)
      this.applyShake(dt)
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
    if (this.mode === 'cockpit' || this.panDown || dt <= 0) return

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

  private applyModeDefaults(mode: ChaseMode): void {
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
    _forward.set(0, 0, 1).applyQuaternion(aircraft.displayOrientation)
    if (Math.hypot(_forward.x, _forward.z) > 0.08) {
      this.stableHeading = Math.atan2(_forward.x, _forward.z)
    }
    return this.stableHeading
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
    if (this.mode === 'cockpit') return
    const cfg = MODE_CONFIG[this.mode]

    // Move the established rig by the aircraft's world translation before
    // smoothing its relative offset. Without this, exponential world-space
    // follow creates v / stiffness metres of unintended zoom-out at speed.
    if (!snap && dt > 0 && this.aircraftPositionReady) {
      _aircraftDelta.subVectors(aircraft.displayPosition, this.lastAircraftPosition)
      this.camera.position.add(_aircraftDelta)
      if (this.lookReady) this.lookSmoothed.add(_aircraftDelta)
    }
    this.lastAircraftPosition.copy(aircraft.displayPosition)
    this.aircraftPositionReady = true

    // Subtle speed sensation without making the aircraft disappear at Vmax.
    const speedT = MathUtils.clamp(aircraft.speed / flightConfig.maxSpeed, 0, 1)
    const targetJuice = speedT * speedT * (3 - 2 * speedT) // smoothstep
    if (snap || dt <= 0) {
      this.speedJuice = targetJuice
    } else {
      const jA = 1 - Math.exp(-JUICE_STIFFNESS * dt)
      this.speedJuice = MathUtils.lerp(this.speedJuice, targetJuice, jA)
    }
    const juice = this.speedJuice
    const framing = resolveExternalSpeedFraming(
      this.distance,
      cfg.fov,
      cfg.maxLookLead,
      juice,
    )

    _pivot.copy(aircraft.displayPosition)
    _pivot.y += 1.2

    this.camera.up.copy(_Y_UP)
    this.sphericalOffset(_offsetWorld, this.yaw, this.pitch, framing.distance)

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
    this.applyShake(dt)

    // Look slightly ahead of the jet (yaw-only offset + velocity lead)
    if (cfg.yawOnly) {
      const heading = this.aircraftHeading(aircraft)
      _headingQuat.setFromAxisAngle(_Y_UP, heading)
      _look.copy(cfg.lookOffset).applyQuaternion(_headingQuat)
    } else {
      _look.copy(cfg.lookOffset)
    }
    _look.add(aircraft.displayPosition)

    if (cfg.lookLead > 0) {
      // Slightly more lead at high speed so framing stays ahead of the jet
      _velLead.copy(aircraft.velocity).multiplyScalar(cfg.lookLead * (1 + juice * 0.4))
      // Prefer horizontal lead so banking does not yank the look target skyward
      _velLead.y *= 0.35
      _velLead.clampLength(0, framing.lookLeadLimit)
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

    if (Math.abs(this.camera.fov - framing.fov) > 0.05) {
      this.camera.fov = framing.fov
      this.camera.updateProjectionMatrix()
    }

    this.applyAircraftVisibility(aircraft)
  }

  private resolveGroundOcclusion(
    pivot: Vector3,
    desired: Vector3,
    out: Vector3,
  ): void {
    out.copy(desired)
    _toCam.subVectors(desired, pivot)

    // Check the whole sightline. Endpoint-only clamping lets the camera pass
    // through a ridge between the jet and its desired chase position.
    const samples = 10
    for (let i = 1; i <= samples; i++) {
      const t = i / samples
      _desired.copy(pivot).addScaledVector(_toCam, t)
      const floor = cameraMinY(_desired.x, _desired.z, this.groundClearance)
      if (_desired.y >= floor) continue

      const safeT = Math.max(0.06, (i - 1.25) / samples)
      out.copy(pivot).addScaledVector(_toCam, safeT)
      out.y = Math.max(
        out.y,
        cameraMinY(out.x, out.z, this.groundClearance),
      )
      break
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

  private applyShake(dt: number): void {
    if (this.shake <= 0.002) {
      this.shake = 0
      return
    }
    const s = this.shake * this.shake
    this.camera.position.x += (Math.random() - 0.5) * 2.4 * s
    this.camera.position.y += (Math.random() - 0.5) * 1.6 * s
    this.camera.position.z += (Math.random() - 0.5) * 2.4 * s
    this.shake *= Math.exp(-7 * Math.max(dt, 0.008))
  }

  private applyAircraftVisibility(aircraft: Aircraft): void {
    if (aircraft.status === 'crashed') {
      aircraft.mesh.visible = false
      return
    }
    aircraft.mesh.visible = this.mode !== 'cockpit'
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

    if (this.mode === 'cockpit') return

    this.yaw += dx * this.lookSensitivity
    this.yaw = MathUtils.euclideanModulo(this.yaw + Math.PI, Math.PI * 2) - Math.PI
    this.pitch = MathUtils.clamp(this.pitch + dy * this.lookSensitivity, -PITCH_LIMIT, PITCH_LIMIT)
    this.bumpInput()
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    if (this.mode === 'cockpit') return

    const cfg = MODE_CONFIG[this.mode]
    const zoom = Math.exp(e.deltaY * 0.0012)
    this.distance = MathUtils.clamp(this.distance * zoom, cfg.minDist, cfg.maxDist)
    this.bumpInput()
  }
}

export interface ExternalSpeedFraming {
  distance: number
  fov: number
  lookLeadLimit: number
}

/** Pure external-camera envelope, exposed for regression tests and tuning. */
export function resolveExternalSpeedFraming(
  baseDistance: number,
  baseFov: number,
  maxLookLead: number,
  speedJuice: number,
): ExternalSpeedFraming {
  const t = MathUtils.clamp(speedJuice, 0, 1)
  return {
    distance: baseDistance * (1 + t * SPEED_DIST_STRETCH),
    fov: baseFov + t * SPEED_FOV_BOOST,
    lookLeadLimit: MathUtils.lerp(maxLookLead * 0.45, maxLookLead, t),
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
