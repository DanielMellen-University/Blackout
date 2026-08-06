import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Aircraft } from '../aircraft/Aircraft'
import {
  CAMERA_MODE_LABELS,
  CAMERA_MODES,
  type CameraMode,
} from '../core/types'

const _desired = new Vector3()
const _look = new Vector3()
const _offsetWorld = new Vector3()
const _velDir = new Vector3()
const _orbitTarget = new Vector3()

interface ModeConfig {
  /** Local-space offset from aircraft (X right, Y up, Z forward/nose). */
  offset: Vector3
  /** Look-at point offset in local space. */
  lookOffset: Vector3
  /** Position spring rate (higher = snappier). */
  posLag: number
  /** Look-at spring rate. */
  lookLag: number
  /** FOV degrees. */
  fov: number
  /** Hide aircraft mesh (cockpit). */
  hideAircraft?: boolean
}

const MODE_CONFIG: Record<Exclude<CameraMode, 'orbit'>, ModeConfig> = {
  // Classic chase: above and behind the tail
  chase: {
    offset: new Vector3(0, 5.5, -18),
    lookOffset: new Vector3(0, 1.2, 8),
    posLag: 4.5,
    lookLag: 7,
    fov: 62,
  },
  // Tight chase for detail / speed feel
  close: {
    offset: new Vector3(0, 2.8, -9),
    lookOffset: new Vector3(0, 1.0, 6),
    posLag: 6.5,
    lookLag: 9,
    fov: 70,
  },
  // Inside canopy, look along the nose
  cockpit: {
    offset: new Vector3(0, 1.05, 2.35),
    lookOffset: new Vector3(0, 0.95, 12),
    posLag: 18,
    lookLag: 18,
    fov: 78,
    hideAircraft: true,
  },
  // Formation / side view
  wingman: {
    offset: new Vector3(14, 3.5, -4),
    lookOffset: new Vector3(0, 1.0, 2),
    posLag: 3.5,
    lookLag: 6,
    fov: 58,
  },
}

/**
 * Multi-mode flight camera. Press C to cycle:
 * chase → close → cockpit → wingman → orbit → …
 */
export class CameraSystem {
  readonly camera: PerspectiveCamera
  readonly orbit: OrbitControls
  mode: CameraMode = 'chase'

  private readonly pos = new Vector3(0, 14, -22)
  private readonly look = new Vector3(0, 6, 0)
  private initialized = false

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new PerspectiveCamera(62, 1, 0.15, 4000)
    this.camera.position.copy(this.pos)

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
      // Seed orbit from current camera so the cut isn't jarring
      this.orbit.target.copy(aircraft.position)
      this.orbit.target.y += 1.5
      const dist = this.camera.position.distanceTo(aircraft.position)
      if (dist < 6 || dist > 160 || prev === 'cockpit') {
        _offsetWorld.set(12, 8, -16).applyQuaternion(aircraft.orientation)
        this.camera.position.copy(aircraft.position).add(_offsetWorld)
      }
      this.orbit.update()
    }

    if (mode !== 'orbit') {
      const cfg = MODE_CONFIG[mode]
      this.camera.fov = cfg.fov
      this.camera.updateProjectionMatrix()
      // Hard snap on mode change so you instantly see the new angle
      if (aircraft) {
        this.snapTo(aircraft, cfg)
      }
    } else {
      this.camera.fov = 60
      this.camera.updateProjectionMatrix()
    }

    if (aircraft) {
      this.applyAircraftVisibility(aircraft)
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
    }

    // Keep mesh hide/show correct if model swapped
    this.applyAircraftVisibility(aircraft)

    if (this.mode === 'orbit') {
      this.orbit.target.lerp(
        _orbitTarget.set(
          aircraft.position.x,
          aircraft.position.y + 1.5,
          aircraft.position.z,
        ),
        1 - Math.exp(-5 * dt),
      )
      this.orbit.update()
      return
    }

    const cfg = MODE_CONFIG[this.mode]
    this.computeRig(aircraft, cfg, _desired, _look)

    // Velocity-based look lead for chase cameras (sells speed)
    if (this.mode === 'chase' || this.mode === 'close') {
      _velDir.copy(aircraft.velocity)
      _velDir.y *= 0.35
      const spd = _velDir.length()
      if (spd > 1) {
        _velDir.multiplyScalar(0.12)
        _look.add(_velDir)
      }
    }

    const posAlpha = 1 - Math.exp(-cfg.posLag * dt)
    const lookAlpha = 1 - Math.exp(-cfg.lookLag * dt)
    this.pos.lerp(_desired, posAlpha)
    this.look.lerp(_look, lookAlpha)

    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)

    if (this.camera.fov !== cfg.fov) {
      this.camera.fov = cfg.fov
      this.camera.updateProjectionMatrix()
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.orbit.dispose()
  }

  private snapTo(aircraft: Aircraft, cfg: ModeConfig): void {
    this.computeRig(aircraft, cfg, this.pos, this.look)
    this.camera.position.copy(this.pos)
    this.camera.lookAt(this.look)
  }

  private computeRig(
    aircraft: Aircraft,
    cfg: ModeConfig,
    outPos: Vector3,
    outLook: Vector3,
  ): void {
    _offsetWorld.copy(cfg.offset).applyQuaternion(aircraft.orientation)
    outPos.copy(aircraft.position).add(_offsetWorld)

    _offsetWorld.copy(cfg.lookOffset).applyQuaternion(aircraft.orientation)
    outLook.copy(aircraft.position).add(_offsetWorld)
  }

  private applyAircraftVisibility(aircraft: Aircraft): void {
    const hide = this.mode === 'cockpit'
    // Hide solid airframe in cockpit; keep group active for world transforms
    aircraft.mesh.traverse((obj) => {
      if ((obj as { isMesh?: boolean }).isMesh) {
        obj.visible = !hide
      }
    })
  }
}
