import type { Aircraft } from '../../aircraft/Aircraft'
import type { CameraSystem } from '../../camera/CameraSystem'
import { holdOperationPresentation, type OperationFlightPose } from '../../systems/operation/flight'
import { OperationCourseMarkers } from '../../systems/operation/markers'
import type { World } from '../../world/World'
import type { OperationDeck, OperationSceneFrame } from './deck'

/**
 * Mirrors the operation aircraft into the existing scene and cockpit camera.
 * The stage HUD stays on the deck. Scoring still comes from the flight samples.
 */
export class OperationCockpit {
  private readonly markers = new OperationCourseMarkers()
  private readonly world: World
  private readonly aircraft: Aircraft
  private readonly cameras: CameraSystem
  private readonly title: HTMLElement | null
  private active = false
  private titleHiddenByUs = false
  private lastPose: OperationFlightPose | null = null
  private attached: OperationDeck | null = null

  constructor(world: World, aircraft: Aircraft, cameras: CameraSystem, title: HTMLElement | null) {
    this.world = world
    this.aircraft = aircraft
    this.cameras = cameras
    this.title = title
  }

  attach(deck: OperationDeck): void {
    if (this.attached === deck) return
    this.attached = deck
    deck.bindScene(frame => this.onFrame(frame))
  }

  /** Stream the corridor and hold the cockpit on the latest pose. True while the operation is open. */
  pump(): boolean {
    if (!this.active) return false
    const pose = this.lastPose
    if (pose) this.applyPose(pose)
    this.world.update(this.aircraft.position.x, this.aircraft.position.y, this.aircraft.position.z, 1 / 60, 1 / 60, 1 / 60)
    return true
  }

  private onFrame(frame: OperationSceneFrame): void {
    if (!frame.active) {
      this.leave()
      return
    }
    if (!this.active) this.enter(frame)
    this.markers.sync(frame.seed, frame.route, frame.energy, frame.phase)
    if (frame.pose) {
      this.lastPose = frame.pose
      this.applyPose(frame.pose)
    }
  }

  private enter(frame: OperationSceneFrame): void {
    this.active = true
    holdOperationPresentation(frame.seed)
    const pose = frame.pose
    this.world.presentOperationCourse(pose?.x ?? 0, pose?.z ?? 0)
    if (!this.markers.root.parent) this.world.scene.add(this.markers.root)
    if (this.title && !this.title.classList.contains('is-hidden')) {
      this.title.classList.add('is-hidden')
      this.titleHiddenByUs = true
    }
    if (pose) {
      this.lastPose = pose
      this.applyPose(pose)
    }
    this.cameras.setMode('cockpit', this.aircraft)
  }

  private leave(): void {
    if (!this.active) return
    this.active = false
    this.lastPose = null
    this.markers.hide()
    this.markers.root.removeFromParent()
    holdOperationPresentation(null)
    this.world.restoreOperationCourse()
    this.aircraft.reset(this.world.spawn)
    this.cameras.setMode('chase', this.aircraft)
    this.cameras.setTitleFraming(this.aircraft)
    if (this.titleHiddenByUs) {
      this.title?.classList.remove('is-hidden')
      this.titleHiddenByUs = false
    }
  }

  private applyPose(pose: OperationFlightPose): void {
    this.aircraft.position.set(pose.x, pose.y, pose.z)
    this.aircraft.orientation.set(pose.qx, pose.qy, pose.qz, pose.qw)
    this.aircraft.snapDisplay()
  }
}
