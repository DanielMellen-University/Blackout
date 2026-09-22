import {
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three'
import type { Aircraft } from '../aircraft/Aircraft'

/** Seat in aircraft space (canopy). */
const SEAT = new Vector3(0, 0.62, 2.42)
const BASE_FOV = 74

const _seatWorld = new Vector3()
/** Three.js camera looks down local -Z; airframe nose is +Z. */
const _noseFlip = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)

/**
 * Cockpit: hard-lock the lens to the jet.
 * Position = seat. Angle = airframe. No canopy props, no chase math.
 */
export class CockpitMode {
  private attached = false
  private disposed = false

  get active(): boolean {
    return this.attached
  }

  enter(camera: PerspectiveCamera): void {
    if (this.disposed) return
    this.attached = true
    camera.fov = BASE_FOV
    camera.near = 0.12
    camera.up.set(0, 1, 0)
    camera.updateProjectionMatrix()
  }

  exit(camera: PerspectiveCamera): void {
    if (this.disposed) return
    this.attached = false
    camera.up.set(0, 1, 0)
    camera.near = 0.2
    camera.updateProjectionMatrix()
  }

  update(camera: PerspectiveCamera, aircraft: Aircraft): void {
    if (this.disposed || !this.attached) return
    if (!finiteVector3(aircraft.displayPosition) || !finiteQuaternion(aircraft.displayOrientation)) return

    _seatWorld.copy(SEAT).applyQuaternion(aircraft.displayOrientation)
    camera.position.copy(aircraft.displayPosition).add(_seatWorld)
    camera.quaternion.copy(aircraft.displayOrientation).multiply(_noseFlip)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.attached = false
  }
}

function finiteVector3(value: Vector3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function finiteQuaternion(value: Quaternion): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) &&
    Number.isFinite(value.z) && Number.isFinite(value.w)
}
