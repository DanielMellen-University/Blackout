import { PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { Aircraft } from '../aircraft/Aircraft'
import type { CameraMode } from '../core/types'

const _offset = new Vector3(0, 6, -18)
const _desired = new Vector3()
const _look = new Vector3()
const _back = new Vector3()

/**
 * Orbit (free inspect) and simple follow camera for Phase 0.
 * Chase spring + cockpit come in Phase 2.
 */
export class CameraSystem {
  readonly camera: PerspectiveCamera
  readonly orbit: OrbitControls
  mode: CameraMode = 'orbit'

  private readonly followPos = new Vector3(0, 12, -24)

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new PerspectiveCamera(60, 1, 0.1, 3000)
    this.camera.position.set(18, 14, 22)

    this.orbit = new OrbitControls(this.camera, canvas)
    this.orbit.enableDamping = true
    this.orbit.dampingFactor = 0.06
    this.orbit.maxPolarAngle = Math.PI * 0.49
    this.orbit.minDistance = 4
    this.orbit.maxDistance = 200
    this.orbit.target.set(0, 6, 0)
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
    this.orbit.enabled = mode === 'orbit'
  }

  toggleMode(): CameraMode {
    this.setMode(this.mode === 'orbit' ? 'follow' : 'orbit')
    return this.mode
  }

  update(aircraft: Aircraft, dt: number): void {
    if (this.mode === 'orbit') {
      this.orbit.target.lerp(aircraft.position, 1 - Math.exp(-4 * dt))
      this.orbit.update()
      return
    }

    // Follow: behind and above in aircraft local space
    _back.copy(_offset).applyQuaternion(aircraft.orientation)
    _desired.copy(aircraft.position).add(_back)
    this.followPos.lerp(_desired, 1 - Math.exp(-5 * dt))
    this.camera.position.copy(this.followPos)
    _look.set(aircraft.position.x, aircraft.position.y + 1.5, aircraft.position.z)
    this.camera.lookAt(_look)
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.orbit.dispose()
  }
}
