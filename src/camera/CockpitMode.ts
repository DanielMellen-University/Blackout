import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
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
 * Position = seat. Angle = airframe. No look-around, no chase math.
 */
export class CockpitMode {
  private attached = false
  private disposed = false
  private readonly frame = new Group()
  private readonly frameMaterial = new MeshBasicMaterial({
    color: 0x101b25,
    transparent: true,
    opacity: 0.78,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })

  constructor() {
    this.frame.name = 'CockpitFrame'
    this.frame.visible = false
    this.frame.renderOrder = 20

    const leftRail = new Mesh(new BoxGeometry(0.07, 1.45, 0.07), this.frameMaterial)
    leftRail.name = 'CockpitLeftRail'
    leftRail.position.set(-1.36, 0.35, -1.75)
    leftRail.rotation.z = -0.1

    const rightRail = new Mesh(new BoxGeometry(0.07, 1.45, 0.07), this.frameMaterial)
    rightRail.name = 'CockpitRightRail'
    rightRail.position.set(1.36, 0.35, -1.75)
    rightRail.rotation.z = 0.1

    const brow = new Mesh(new BoxGeometry(2.72, 0.08, 0.08), this.frameMaterial)
    brow.name = 'CockpitCanopyBrow'
    brow.position.set(0, 1.02, -1.75)
    brow.rotation.z = 0.02

    const coaming = new Mesh(new BoxGeometry(2.35, 0.16, 0.42), this.frameMaterial)
    coaming.name = 'CockpitCoaming'
    coaming.position.set(0, -0.94, -1.45)
    coaming.rotation.x = -0.08

    this.frame.add(leftRail, rightRail, brow, coaming)
    this.frame.traverse((object) => {
      object.updateMatrix()
      object.matrixAutoUpdate = false
    })
  }

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
    camera.up.set(0, 1, 0)
    camera.near = 0.2
    camera.updateProjectionMatrix()
  }

  update(camera: PerspectiveCamera, aircraft: Aircraft): void {
    if (this.disposed || !this.attached) return
    if (!finiteVector3(aircraft.displayPosition) || !finiteQuaternion(aircraft.displayOrientation)) return

    if (this.frame.parent !== camera) camera.add(this.frame)
    this.frame.visible = true

    _seatWorld.copy(SEAT).applyQuaternion(aircraft.displayOrientation)
    camera.position.copy(aircraft.displayPosition).add(_seatWorld)
    camera.quaternion.copy(aircraft.displayOrientation).multiply(_noseFlip)
  }

  /** Release the camera-attached cockpit geometry during runtime teardown. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.attached = false
    this.frame.removeFromParent()
    this.frame.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
    })
    this.frameMaterial.dispose()
  }
}

function finiteVector3(value: Vector3): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
}

function finiteQuaternion(value: Quaternion): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) &&
    Number.isFinite(value.z) && Number.isFinite(value.w)
}
