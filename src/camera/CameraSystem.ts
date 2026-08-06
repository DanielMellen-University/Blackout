import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Aircraft } from '../aircraft/Aircraft'
import {
  CAMERA_MODE_LABELS,
  CAMERA_MODES,
  type CameraMode,
} from '../core/types'

const _offsetWorld = new Vector3()
const _look = new Vector3()
const _velLead = new Vector3()
const _orbitTarget = new Vector3()

interface ModeConfig {
  /** Local-space offset from aircraft (X right, Y up, Z nose-forward). */
  offset: Vector3
  /** Look-at point offset in local space. */
  lookOffset: Vector3
  fov: number
  /** Small look-ahead along velocity (seconds of travel). 0 = none. */
  lookLead: number
  hideAircraft?: boolean
}

const MODE_CONFIG: Record<Exclude<CameraMode, 'orbit'>, ModeConfig> = {
  chase: {
    offset: new Vector3(0, 5.5, -18),
    lookOffset: new Vector3(0, 1.2, 10),
    fov: 62,
    lookLead: 0.08,
  },
  close: {
    offset: new Vector3(0, 2.6, -8.5),
    lookOffset: new Vector3(0, 1.0, 7),
    fov: 70,
    lookLead: 0.05,
  },
  cockpit: {
    offset: new Vector3(0, 1.05, 2.35),
    lookOffset: new Vector3(0, 0.95, 14),
    fov: 78,
    lookLead: 0,
    hideAircraft: true,
  },
  wingman: {
    offset: new Vector3(14, 3.5, -4),
    lookOffset: new Vector3(0, 1.0, 3),
    fov: 58,
    lookLead: 0.04,
  },
}

/**
 * Multi-mode flight camera. Press C to cycle:
 * chase → close → cockpit → wingman → orbit → …
 *
 * Chase/close/cockpit/wingman are hard-locked to the aircraft each frame
 * (no spring lag) so the jet stays glued in frame.
 */
export class CameraSystem {
  readonly camera: PerspectiveCamera
  readonly orbit: OrbitControls
  mode: CameraMode = 'chase'

  private initialized = false
  private lastVisibilityMode: CameraMode | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new PerspectiveCamera(62, 1, 0.15, 4000)

    this.orbit = new OrbitControls(this.camera, canvas)
    this.orbit.enableDamping = true
    this.orbit.dampingFactor = 0.08
    this.orbit.maxPolarAngle = Math.PI * 0.48
    this.orbit.minPolarAngle = 0.08
    this.orbit.minDistance = 6
    this.orbit.maxDistance = 160
    this.orbit.enablePan = false
    this.orbit.target.set(0, 6, 0)
    this.orbit.enabled = false
  }

  get modeLabel(): string {
    return CAMERA_MODE_LABELS[this.mode]
  }

  setMode(mode: CameraMode, aircraft?: Aircraft): void {
    const prev = this.mode
    this.mode = mode
    this.orbit.enabled = mode === 'orbit'

    if (mode === 'orbit' && aircraft) {
      this.orbit.target.copy(aircraft.position)
      this.orbit.target.y += 1.5
      const dist = this.camera.position.distanceTo(aircraft.position)
      if (dist < 6 || dist > 160 || prev === 'cockpit') {
        _offsetWorld.set(12, 8, -16).applyQuaternion(aircraft.orientation)
        this.camera.position.copy(aircraft.position).add(_offsetWorld)
      }
      this.orbit.update()
      this.camera.fov = 60
      this.camera.updateProjectionMatrix()
    } else if (mode !== 'orbit') {
      const cfg = MODE_CONFIG[mode]
      this.camera.fov = cfg.fov
      this.camera.updateProjectionMatrix()
      if (aircraft) this.applyRig(aircraft, cfg)
    }

    if (aircraft) this.applyAircraftVisibility(aircraft, true)
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
    }

    if (this.mode === 'orbit') {
      // Orbit target tracks the jet tightly (high rate = no rubber-band)
      _orbitTarget.set(
        aircraft.position.x,
        aircraft.position.y + 1.5,
        aircraft.position.z,
      )
      const alpha = 1 - Math.exp(-14 * dt)
      this.orbit.target.lerp(_orbitTarget, alpha)
      this.orbit.update()
      return
    }

    this.applyRig(aircraft, MODE_CONFIG[this.mode])
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.orbit.dispose()
  }

  /** Hard-lock camera to aircraft local rig — zero spring lag. */
  private applyRig(aircraft: Aircraft, cfg: ModeConfig): void {
    _offsetWorld.copy(cfg.offset).applyQuaternion(aircraft.orientation)
    this.camera.position.copy(aircraft.position).add(_offsetWorld)

    _look.copy(cfg.lookOffset).applyQuaternion(aircraft.orientation)
    _look.add(aircraft.position)

    if (cfg.lookLead > 0) {
      _velLead.copy(aircraft.velocity).multiplyScalar(cfg.lookLead)
      _look.add(_velLead)
    }

    this.camera.lookAt(_look)

    if (this.camera.fov !== cfg.fov) {
      this.camera.fov = cfg.fov
      this.camera.updateProjectionMatrix()
    }
  }

  private applyAircraftVisibility(aircraft: Aircraft, force = false): void {
    if (!force && this.lastVisibilityMode === this.mode) return
    this.lastVisibilityMode = this.mode

    const hide = this.mode === 'cockpit'
    aircraft.mesh.traverse((obj) => {
      if ((obj as { isMesh?: boolean }).isMesh) {
        obj.visible = !hide
      }
    })
  }
}
