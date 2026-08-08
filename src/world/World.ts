import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Scene,
} from 'three'
import { getWorldSeed, randomizeWorldSeed } from './noise'
import { createRunway } from './Runway'
import { FOG_FAR, TerrainSystem } from './TerrainSystem'

/**
 * Scene graph: lights, runway, infinite streaming terrain + biomes.
 */
export class World {
  readonly scene = new Scene()
  readonly terrain: TerrainSystem
  readonly sun: DirectionalLight
  private seed = 0

  constructor() {
    this.sun = this.createSun()
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    this.addFillLights()
    this.terrain = new TerrainSystem(this.scene)
    this.reseed(true)
    this.addRunway()
  }

  get worldSeed(): number {
    return this.seed
  }

  /**
   * New random world seed, rebuild terrain around origin.
   * Call on boot and when the player resets (R).
   */
  reseed(force = false): number {
    this.seed = randomizeWorldSeed()
    this.terrain.clearAll()
    this.terrain.update(0, 0)
    if (force) {
      // ensure seed field tracks noise module
      this.seed = getWorldSeed()
    }
    return this.seed
  }

  /** Stream terrain around the aircraft each frame. */
  update(x: number, z: number): void {
    this.terrain.update(x, z)
    // Keep shadow volume centered on the flyer for far flights
    this.sun.position.set(x + 180, 280, z + 120)
    this.sun.target.position.set(x, 0, z)
    this.sun.target.updateMatrixWorld()
  }

  private createSun(): DirectionalLight {
    const sun = new DirectionalLight(0xfff5e6, 1.65)
    sun.position.set(180, 280, 120)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 10
    sun.shadow.camera.far = 1200
    sun.shadow.camera.left = -450
    sun.shadow.camera.right = 450
    sun.shadow.camera.top = 450
    sun.shadow.camera.bottom = -450
    sun.shadow.bias = -0.0002
    void FOG_FAR
    return sun
  }

  private addFillLights(): void {
    const hemi = new HemisphereLight(0xd0e4f8, 0x4a5540, 0.85)
    this.scene.add(hemi)

    const ambient = new AmbientLight(0xffffff, 0.42)
    this.scene.add(ambient)

    const fill = new DirectionalLight(0xb8d0ff, 0.4)
    fill.position.set(-100, 80, -60)
    this.scene.add(fill)
  }

  private addRunway(): void {
    const runway = createRunway()
    runway.position.set(0, 0.04, 0)
    this.scene.add(runway)
  }
}
