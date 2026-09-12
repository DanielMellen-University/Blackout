import { MathUtils, PerspectiveCamera, Quaternion, Scene, Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig } from '../aircraft/flightConfig'
import {
  CAMERA_MODE_LABELS,
  CAMERA_MODES,
  type CameraMode,
} from '../core/types'
import { cameraMinY } from '../world/ground'
import { STREAM_RADIUS_M } from '../world/TerrainSystem'
import { CockpitMode } from './CockpitMode'
import type { RenderQuality } from '../core/RenderQuality'

const _offsetWorld = new Vector3()
const _look = new Vector3()
const _velLead = new Vector3()
const _pivot = new Vector3()
const _desired = new Vector3()
const _toCam = new Vector3()
const _groundSample = new Vector3()
const _forward = new Vector3()
const _aircraftDelta = new Vector3()
const _headingQuat = new Quaternion()
const _bearingDelta = new Vector3()
const _bearingInverse = new Quaternion()
const _cameraRollInverse = new Quaternion()
const _cameraLocalUp = new Vector3()
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
/** Small, non-crash camera pulse for a clean airborne touchdown. */
export const TOUCHDOWN_IMPULSE = 0.18
/** Chase distance stretch at max airspeed (1 = base). */
const SPEED_DIST_STRETCH = 0.14
/** How fast FOV/distance juice tracks airspeed. */
const JUICE_STIFFNESS = 3.2
/** Keep the external horizon readable while letting turns carry a little drama. */
const MAX_EXTERNAL_BANK = 0.14
const EXTERNAL_BANK_STIFFNESS = 8
/** Keep depth precision focused on the streamed world and cloud envelope. */
export const CAMERA_FAR = STREAM_RADIUS_M * 1.5

/** Short feedback copy used when the pilot toggles between flight views. */
export function cameraModeCue(mode: CameraMode): string {
  return mode === 'cockpit' ? 'COCKPIT VIEW' : 'EXTERNAL VIEW'
}

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

  /** Simulation/render seconds since the last user camera adjustment. */
  private cameraIdleSeconds = 0
  /** Title showcase framing stays composed until the player launches. */
  private autoReturnEnabled = true

  private readonly lookSensitivity = 0.005
  private readonly canvas: HTMLCanvasElement
  private shake = 0
  private shakePhase = 0
  private readonly shakeOffset = { x: 0, y: 0, z: 0 }
  private readonly speedFraming = { distance: 0, fov: 0, lookLeadLimit: 0 }
  private boostSway = 0
  private boostPhase = 0
  private externalBank = 0
  private readonly boostOffset = { x: 0, y: 0, z: 0 }
  private reducedMotion = false
  private disposed = false
  private renderQuality: RenderQuality = 'balanced'

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    // Terrain and clouds fade before the stream edge, so a tighter far plane
    // preserves depth precision without clipping anything the player can see.
    this.camera = new PerspectiveCamera(62, 1, 0.2, CAMERA_FAR)
    this.bindInput(canvas)
    this.applyModeDefaults('chase')
  }

  get modeLabel(): string {
    return CAMERA_MODE_LABELS[this.mode]
  }

  /** Honor the browser's reduced-motion preference for camera-only effects. */
  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled
    if (enabled) {
      this.shake = 0
      this.boostSway = 0
      this.externalBank = 0
    }
  }

  /** Apply the shared render preset to chase-camera terrain probe detail. */
  setRenderQuality(quality: RenderQuality): void {
    if (this.disposed) return
    this.renderQuality = quality
  }

  get prefersReducedMotion(): boolean {
    return this.reducedMotion
  }

  setMode(mode: CameraMode, aircraft?: Aircraft): void {
    if (this.disposed) return
    const leavingCockpit = this.mode === 'cockpit' && mode !== 'cockpit'
    const externalYaw = this.yaw
    const externalPitch = this.pitch
    const externalDistance = this.distance
    this.autoReturnEnabled = true
    this.mode = mode
    this.lookReady = false
    this.bumpInput()

    if (mode === 'cockpit') {
      this.cockpit.enter(this.camera)
    } else {
      if (leavingCockpit) {
        this.cockpit.exit(this.camera)
        this.applyModeDefaults(mode)
        this.yaw = externalYaw
        this.pitch = externalPitch
        this.distance = externalDistance
      } else {
        this.applyModeDefaults(mode)
      }
    }

    if (aircraft) {
      if (mode === 'cockpit') this.cockpit.update(this.camera, aircraft)
      else this.applyRig(aircraft, 0, true)
      this.applyAircraftVisibility(aircraft)
    }
  }

  /**
   * Stage a readable three-quarter aircraft hero for the title screen.
   * Gameplay always calls setMode afterwards, restoring the normal chase rig.
   */
  setTitleFraming(aircraft?: Aircraft): void {
    if (this.disposed || this.mode === 'cockpit') return
    this.autoReturnEnabled = false
    this.yaw = 0.55
    this.pitch = 0.18
    this.distance = 19
    this.bumpInput()
    this.lookReady = false
    if (aircraft) {
      this.applyRig(aircraft, 0, true)
      this.initialized = true
    }
  }

  /** Brief view punch (crash boom). */
  impulse(amount = 1): void {
    if (this.disposed || this.reducedMotion) return
    this.shake = Math.max(this.shake, amount)
    if (amount > 0) this.shakePhase = (this.shakePhase + amount * 1.7) % (Math.PI * 2)
  }

  toggleMode(aircraft?: Aircraft): CameraMode {
    if (this.disposed) return this.mode
    const idx = CAMERA_MODES.indexOf(this.mode)
    const next = CAMERA_MODES[(idx + 1) % CAMERA_MODES.length]!
    this.setMode(next, aircraft)
    return this.mode
  }

  update(aircraft: Aircraft, dt: number): void {
    if (this.disposed) return
    if (!this.initialized) {
      this.setMode(this.mode, aircraft)
      this.initialized = true
      return
    }

    // Paused, title, and results frames keep rendering the last camera pose.
    // Avoid re-running ground occlusion probes when no visual time elapsed.
    if (!Number.isFinite(dt) || dt <= 0) return

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
    const aspect = cameraViewportAspect(width, height)
    if (Math.abs(this.camera.aspect - aspect) < 1e-6) return
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  /** Add the camera to the render scene so camera-attached cockpit geometry draws. */
  attachToScene(scene: Scene): void {
    if (this.disposed) return
    if (this.camera.parent !== scene) scene.add(this.camera)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const c = this.canvas
    const cap: AddEventListenerOptions = { capture: true }
    c.removeEventListener('pointerdown', this.onPointerDown, cap)
    window.removeEventListener('pointerup', this.onPointerUp, cap)
    window.removeEventListener('pointercancel', this.onPointerUp, cap)
    window.removeEventListener('pointermove', this.onPointerMove, cap)
    c.removeEventListener('wheel', this.onWheel)
    c.removeEventListener('auxclick', this.onAuxClick, cap)
    c.removeEventListener('mousedown', this.onMouseDownBlock, cap)
    this.cockpit.dispose()
    this.camera.removeFromParent()
  }

  private bumpInput(): void {
    this.cameraIdleSeconds = 0
  }

  /**
   * After AUTO_RETURN_DELAY with no look/zoom, ease yaw/pitch/distance
   * toward this mode's default framing.
   */
  private updateAutoReturn(dt: number): void {
    if (!this.autoReturnEnabled || this.mode === 'cockpit' || this.panDown || dt <= 0) return

    this.cameraIdleSeconds = Math.min(
      AUTO_RETURN_DELAY + 1,
      this.cameraIdleSeconds + dt,
    )
    if (this.cameraIdleSeconds < AUTO_RETURN_DELAY) return

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
    if (!finiteVector3(aircraft.displayPosition) || !finiteQuaternion(aircraft.displayOrientation)) return
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
    const speed = Number.isFinite(aircraft.speed) ? Math.max(0, aircraft.speed) : 0
    const speedT = MathUtils.clamp(speed / flightConfig.maxSpeed, 0, 1)
    const targetJuice = speedT * speedT * (3 - 2 * speedT) // smoothstep
    if (snap || dt <= 0) {
      this.speedJuice = targetJuice
    } else {
      const jA = 1 - Math.exp(-JUICE_STIFFNESS * dt)
      this.speedJuice = MathUtils.lerp(this.speedJuice, targetJuice, jA)
    }
    const juice = this.speedJuice
    const framing = resolveExternalSpeedFramingInto(
      this.speedFraming,
      this.distance,
      cfg.fov,
      cfg.maxLookLead,
      juice,
      cfg.maxDist,
    )

    _pivot.copy(aircraft.displayPosition)
    _pivot.y += 1.2

    this.camera.up.copy(_Y_UP)
    this.sphericalOffset(_offsetWorld, this.yaw, this.pitch, framing.distance)
    const heading = cfg.yawOnly ? this.aircraftHeading(aircraft) : 0
    if (cfg.yawOnly) {
      _headingQuat.setFromAxisAngle(_Y_UP, heading)
    }

    if (cfg.yawOnly) {
      // Chase-style: rotate offset by heading only (no roll/pitch of the airframe)
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
    // Shake and afterburner sway are applied after the rig solve. Keep their
    // final lens position above the terrain so a low pass cannot clip through
    // a ridge during a touchdown pulse or boost.
    const effectsMayMoveCamera = !this.reducedMotion && (
      this.shake > 0.002 ||
      this.boostSway > 0.001 ||
      aircraft.engineState.afterburnerActive
    )
    this.applyShake(dt)
    this.applyBoostSway(aircraft.engineState.afterburnerActive, dt)
    if (effectsMayMoveCamera) this.clampAboveGround(this.camera.position)

    // Look slightly ahead of the jet (yaw-only offset + velocity lead)
    if (cfg.yawOnly) {
      _look.copy(cfg.lookOffset).applyQuaternion(_headingQuat)
    } else {
      _look.copy(cfg.lookOffset)
    }
    _look.add(aircraft.displayPosition)

    if (cfg.lookLead > 0 && finiteVector3(aircraft.velocity)) {
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

    const targetBank = this.reducedMotion
      ? 0
      : cameraBankAngle(aircraft.displayOrientation, MAX_EXTERNAL_BANK)
    this.externalBank = snap || dt <= 0
      ? targetBank
      : MathUtils.damp(this.externalBank, targetBank, EXTERNAL_BANK_STIFFNESS, dt)
    this.camera.rotateZ(this.externalBank)

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
    // through a ridge between the jet and its desired chase position. Short
    // rigs need fewer probes; long, user-zoomed sightlines keep the full
    // budget so distant ridges remain protected.
    const samples = cameraOcclusionSampleCount(_toCam.length(), this.renderQuality)
    for (let i = 1; i <= samples; i++) {
      const t = i / samples
      _groundSample.copy(pivot).addScaledVector(_toCam, t)
      const floor = cameraMinY(_groundSample.x, _groundSample.z, this.groundClearance)
      if (_groundSample.y >= floor) continue

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
    if (this.reducedMotion) {
      this.shake = 0
      return
    }
    if (this.shake <= 0.002) {
      this.shake = 0
      return
    }
    this.shakePhase = (this.shakePhase + Math.max(dt, 0.008) * 28) % (Math.PI * 2)
    const offset = cameraShakeOffsetInto(this.shakeOffset, this.shakePhase, this.shake)
    this.camera.position.x += offset.x
    this.camera.position.y += offset.y
    this.camera.position.z += offset.z
    this.shake *= Math.exp(-7 * Math.max(dt, 0.008))
  }

  private applyBoostSway(active: boolean, dt: number): void {
    if (this.reducedMotion) {
      this.boostSway = 0
      return
    }
    const target = active ? 1 : 0
    this.boostSway = dt <= 0
      ? target
      : MathUtils.damp(this.boostSway, target, 7, dt)
    if (this.boostSway <= 0.001) return
    this.boostPhase = (this.boostPhase + Math.max(dt, 0.008) * 18) % (Math.PI * 2)
    const offset = cameraBoostOffsetInto(this.boostOffset, this.boostPhase, this.boostSway)
    this.camera.position.x += offset.x
    this.camera.position.y += offset.y
    this.camera.position.z += offset.z
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

/** Return a finite projection aspect even during zero-sized or malformed resizes. */
export function cameraViewportAspect(width: number, height: number): number {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1
  return safeWidth / safeHeight
}

/** Distance-aware ground-occlusion probes for the external chase rig. */
export function cameraOcclusionSampleCount(distance: number, quality: RenderQuality = 'balanced'): number {
  const d = Number.isFinite(distance) ? Math.max(0, distance) : Infinity
  if (quality === 'low') {
    if (d <= 10) return 4
    if (d <= 22) return 5
    return 6
  }
  if (d <= 10) return 6
  if (d <= 22) return 8
  return 10
}

/**
 * Return a target's horizontal bearing in camera-local space without forcing
 * a matrix-world rebuild. The gameplay camera is attached directly to the
 * world scene, so its position and quaternion are already world-space state.
 */
export function cameraRelativeBearing(
  cameraPosition: Vector3,
  cameraOrientation: Quaternion,
  target: Vector3,
): number {
  if (
    !finiteVector3(cameraPosition) ||
    !finiteQuaternion(cameraOrientation) ||
    !finiteVector3(target)
  ) return 0
  _bearingDelta.subVectors(target, cameraPosition)
  _bearingInverse.copy(cameraOrientation).invert()
  _bearingDelta.applyQuaternion(_bearingInverse)
  return Math.atan2(_bearingDelta.x, -_bearingDelta.z)
}

/** Small external-view bank derived from the airframe roll, capped for readability. */
export function cameraBankAngle(orientation: Quaternion, maxBank = MAX_EXTERNAL_BANK): number {
  if (!finiteQuaternion(orientation)) return 0
  _cameraRollInverse.copy(orientation).invert()
  _cameraLocalUp.set(0, 1, 0).applyQuaternion(_cameraRollInverse)
  const roll = Math.atan2(-_cameraLocalUp.x, _cameraLocalUp.y)
  const safeMax = Number.isFinite(maxBank) ? Math.max(0, maxBank) : MAX_EXTERNAL_BANK
  return MathUtils.clamp(Number.isFinite(roll) ? roll : 0, -safeMax, safeMax)
}

export interface ExternalSpeedFraming {
  distance: number
  fov: number
  lookLeadLimit: number
}

export interface CameraShakeOffset {
  x: number
  y: number
  z: number
}

export type CameraBoostOffset = CameraShakeOffset

/** Smooth, bounded impact shake that avoids frame-to-frame white-noise jitter. */
export function cameraShakeOffset(phase: number, intensity: number): CameraShakeOffset {
  return cameraShakeOffsetInto({ x: 0, y: 0, z: 0 }, phase, intensity)
}

/** Fill a caller-owned shake record for the camera loop without allocating. */
export function cameraShakeOffsetInto(
  out: CameraShakeOffset,
  phase: number,
  intensity: number,
): CameraShakeOffset {
  const safePhase = Number.isFinite(phase) ? phase : 0
  const safeIntensity = Number.isFinite(intensity) ? Math.max(0, intensity) : 0
  const scale = safeIntensity ** 2
  if (scale === 0) {
    out.x = 0
    out.y = 0
    out.z = 0
    return out
  }
  out.x = (Math.sin(safePhase * 1.7) * .72 + Math.sin(safePhase * 3.1 + 1.2) * .28) * 2.4 * scale
  out.y = (Math.sin(safePhase * 2.1 + .7) * .75 + Math.sin(safePhase * 4.3) * .25) * 1.6 * scale
  out.z = (Math.cos(safePhase * 1.9 + 2) * .72 + Math.sin(safePhase * 3.7 - .8) * .28) * 2.4 * scale
  return out
}

/** Smooth, tiny afterburner sway for the external chase camera. */
export function cameraBoostOffset(phase: number, intensity: number): CameraBoostOffset {
  return cameraBoostOffsetInto({ x: 0, y: 0, z: 0 }, phase, intensity)
}

export function cameraBoostOffsetInto(
  out: CameraBoostOffset,
  phase: number,
  intensity: number,
): CameraBoostOffset {
  const safePhase = Number.isFinite(phase) ? phase : 0
  const safeIntensity = Number.isFinite(intensity) ? intensity : 0
  const scale = Math.min(1, Math.max(0, safeIntensity))
  if (scale === 0) {
    out.x = 0
    out.y = 0
    out.z = 0
    return out
  }
  out.x = (Math.sin(safePhase * 1.6) * .7 + Math.sin(safePhase * 2.9 + .8) * .3) * .028 * scale
  out.y = (Math.sin(safePhase * 2.2 + .4) * .72 + Math.sin(safePhase * 3.7) * .28) * .016 * scale
  out.z = (Math.cos(safePhase * 1.4 + 1.1) * .7 + Math.sin(safePhase * 3.2 - .5) * .3) * .035 * scale
  return out
}

/** Pure external-camera envelope, exposed for regression tests and tuning. */
export function resolveExternalSpeedFraming(
  baseDistance: number,
  baseFov: number,
  maxLookLead: number,
  speedJuice: number,
  maxDistance = Infinity,
): ExternalSpeedFraming {
  return resolveExternalSpeedFramingInto(
    { distance: 0, fov: 0, lookLeadLimit: 0 },
    baseDistance,
    baseFov,
    maxLookLead,
    speedJuice,
    maxDistance,
  )
}

/** Fill a caller-owned framing record for per-frame camera updates. */
export function resolveExternalSpeedFramingInto(
  out: ExternalSpeedFraming,
  baseDistance: number,
  baseFov: number,
  maxLookLead: number,
  speedJuice: number,
  maxDistance = Infinity,
): ExternalSpeedFraming {
  const safeDistance = Number.isFinite(baseDistance) ? Math.max(0, baseDistance) : 17
  const safeFov = Number.isFinite(baseFov) ? baseFov : 60
  const safeLead = Number.isFinite(maxLookLead) ? Math.max(0, maxLookLead) : 10
  const safeMaxDistance = Number.isFinite(maxDistance) && maxDistance > 0 ? maxDistance : Infinity
  const t = Number.isFinite(speedJuice) ? MathUtils.clamp(speedJuice, 0, 1) : 0
  out.distance = Math.min(safeMaxDistance, safeDistance * (1 + t * SPEED_DIST_STRETCH))
  out.fov = safeFov + t * SPEED_FOV_BOOST
  out.lookLeadLimit = MathUtils.lerp(safeLead * 0.45, safeLead, t)
  return out
}

function finiteVector3(value: Vector3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function finiteQuaternion(value: Quaternion): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) &&
    Number.isFinite(value.z) && Number.isFinite(value.w)
}

/** Shortest-path angle difference in (-π, π]. */
function deltaAngle(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
}

/** Lerp angles along the shortest arc. */
function lerpAngle(from: number, to: number, t: number): number {
  return from + deltaAngle(from, to) * t
}
