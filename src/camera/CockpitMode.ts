import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { Aircraft } from '../aircraft/Aircraft'

/** Seat in aircraft space (canopy). */
const SEAT = new Vector3(0, 0.85, 2.55)
const BASE_FOV = 78

const _seatWorld = new Vector3()
/** Three.js camera looks down local -Z; airframe nose is +Z. */
const _noseFlip = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)

/**
 * Cockpit: hard-lock the lens to the jet.
 * Position = seat. Angle = airframe. No look-around, no chase math.
 */
export class CockpitMode {
  private attached = false

  get active(): boolean {
    return this.attached
  }

  enter(camera: PerspectiveCamera): void {
    this.attached = true
    camera.fov = BASE_FOV
    camera.near = 0.12
    camera.up.set(0, 1, 0)
    camera.updateProjectionMatrix()
  }

  exit(camera: PerspectiveCamera): void {
    this.attached = false
    camera.up.set(0, 1, 0)
    camera.near = 0.2
    camera.updateProjectionMatrix()
  }

  update(camera: PerspectiveCamera, aircraft: Aircraft): void {
    if (!this.attached) return

    _seatWorld.copy(SEAT).applyQuaternion(aircraft.orientation)
    camera.position.copy(aircraft.position).add(_seatWorld)
    camera.quaternion.copy(aircraft.orientation).multiply(_noseFlip)
  }
}
