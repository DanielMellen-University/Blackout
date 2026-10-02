import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Path,
  PerspectiveCamera,
  Quaternion,
  Shape,
  ShapeGeometry,
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
 * A restrained canopy rim gives cockpit mode a physical reference without
 * putting the full aircraft mesh in front of the lens. One 2D mesh keeps the
 * first-person view cheap and avoids the old oversized cockpit silhouette.
 */
function createCockpitFrame(): Mesh<ShapeGeometry, MeshBasicMaterial> {
  const outer = new Shape()
  outer.moveTo(-1.54, -0.76)
  outer.lineTo(1.54, -0.76)
  outer.lineTo(1.54, 0.92)
  outer.lineTo(-1.54, 0.92)
  outer.closePath()

  const opening = new Path()
  opening.moveTo(-1.37, -0.58)
  opening.lineTo(1.37, -0.58)
  opening.lineTo(1.37, 0.75)
  opening.lineTo(-1.37, 0.75)
  opening.closePath()
  outer.holes.push(opening)

  const frame = new Mesh(
    new ShapeGeometry(outer),
    new MeshBasicMaterial({
      color: 0x101923,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    }),
  )
  frame.name = 'CockpitFrame'
  frame.position.z = -1.15
  frame.renderOrder = 20
  frame.frustumCulled = false
  frame.visible = false
  return frame
}

/**
 * Cockpit: hard-lock the lens to the jet.
 * Position = seat. Angle = airframe. No canopy props, no chase math.
 */
export class CockpitMode {
  private attached = false
  private disposed = false
  private readonly frame = createCockpitFrame()

  get active(): boolean {
    return this.attached
  }

  enter(camera: PerspectiveCamera): void {
    if (this.disposed) return
    this.attached = true
    if (this.frame.parent !== camera) camera.add(this.frame)
    this.frame.visible = true
    camera.fov = BASE_FOV
    camera.near = 0.12
    camera.up.set(0, 1, 0)
    camera.updateProjectionMatrix()
  }

  exit(camera: PerspectiveCamera): void {
    if (this.disposed) return
    this.attached = false
    this.frame.visible = false
    if (this.frame.parent === camera) camera.remove(this.frame)
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
    this.frame.removeFromParent()
    this.frame.geometry.dispose()
    this.frame.material.dispose()
  }
}

function finiteVector3(value: Vector3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function finiteQuaternion(value: Quaternion): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) &&
    Number.isFinite(value.z) && Number.isFinite(value.w)
}
