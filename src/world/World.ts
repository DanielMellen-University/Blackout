import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Scene,
} from 'three'
import { flightConfig } from '../aircraft/flightConfig'
import { getWorldSeed, randomizeWorldSeed } from './noise'
import { createRunway } from './Runway'
import {
  findFlatSpawn,
  setOpsCenter,
  type FlatSpawn,
} from './terrainSample'
import { FOG_FAR, TerrainSystem } from './TerrainSystem'

export interface SpawnPose {
  x: number
  y: number
  z: number
  yaw: number
  biome: string
}

/**
 * Scene graph: lights, runway, infinite streaming terrain + biomes.
 */
export class World {
  readonly scene = new Scene()
  readonly terrain: TerrainSystem
  readonly sun: DirectionalLight
  private seed = 0
  private readonly runway: Group
  /** Current airfield spawn (flat biome pad). */
  spawn: SpawnPose = {
    x: 0,
    y: flightConfig.gearHeight,
    z: -45,
    yaw: 0,
    biome: 'plains',
  }

  constructor() {
    this.sun = this.createSun()
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    this.addFillLights()
    this.terrain = new TerrainSystem(this.scene)
    this.runway = createRunway()
    this.scene.add(this.runway)
    this.reseed(true)
  }

  get worldSeed(): number {
    return this.seed
  }

  /**
   * New random world seed, pick a flat-biome airfield, rebuild terrain there.
   */
  reseed(force = false): number {
    this.seed = randomizeWorldSeed()
    if (force) this.seed = getWorldSeed()

    // Search natural terrain (ops center still at previous / 0,0)
    const pad = findFlatSpawn()
    this.applySpawn(pad)

    this.terrain.clearAll()
    this.terrain.update(this.spawn.x, this.spawn.z)
    return this.seed
  }

  /** Stream terrain around the aircraft each frame. */
  update(x: number, z: number): void {
    this.terrain.update(x, z)
    this.sun.position.set(x + 180, 280, z + 120)
    this.sun.target.position.set(x, 0, z)
    this.sun.target.updateMatrixWorld()
  }

  private applySpawn(pad: FlatSpawn): void {
    // Flatten terrain around the airfield and force solid land
    setOpsCenter(pad.x, pad.z)

    // After ops center is set, surface under runway is y ≈ 0 (flat pad)
    const gearY = flightConfig.gearHeight
    const yaw = pad.yaw
    // Runway model is long on local +Z; place jet at threshold (behind center)
    const back = 45
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    this.spawn = {
      x: pad.x - fx * back,
      y: gearY,
      z: pad.z - fz * back,
      yaw,
      biome: pad.biome,
    }

    this.runway.position.set(pad.x, 0.04, pad.z)
    this.runway.rotation.y = yaw
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
}
