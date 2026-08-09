import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Scene,
} from 'three'
import { flightConfig } from '../aircraft/flightConfig'
import { Atmosphere, type WeatherId } from './Atmosphere'
import { getWorldSeed, randomizeWorldSeed } from './noise'
import { createRunway } from './Runway'
import {
  findFlatSpawn,
  setOpsCenter,
  type FlatSpawn,
} from './terrainSample'
import { FOG_FAR, FOG_NEAR, TerrainSystem } from './TerrainSystem'

export interface SpawnPose {
  x: number
  y: number
  z: number
  yaw: number
  biome: string
}

/**
 * Scene graph: lights, runway, atmosphere, infinite terrain.
 */
export class World {
  readonly scene = new Scene()
  readonly terrain: TerrainSystem
  readonly sun: DirectionalLight
  readonly atmosphere: Atmosphere
  private seed = 0
  private readonly runway: Group
  private readonly hemi: HemisphereLight
  private readonly ambient: AmbientLight
  private readonly fill: DirectionalLight

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

    this.hemi = new HemisphereLight(0xd0e4f8, 0x4a5540, 0.85)
    this.scene.add(this.hemi)

    this.ambient = new AmbientLight(0xffffff, 0.42)
    this.scene.add(this.ambient)

    this.fill = new DirectionalLight(0xb8d0ff, 0.4)
    this.fill.position.set(-100, 80, -60)
    this.scene.add(this.fill)

    this.terrain = new TerrainSystem(this.scene)
    this.atmosphere = new Atmosphere(
      this.scene,
      {
        sun: this.sun,
        hemi: this.hemi,
        ambient: this.ambient,
        fill: this.fill,
      },
      FOG_NEAR,
      FOG_FAR,
    )

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

    const pad = findFlatSpawn()
    this.applySpawn(pad)

    this.terrain.clearAll()
    this.terrain.update(this.spawn.x, this.spawn.z, 1 / 60)
    this.atmosphere.randomizeWeather(this.seed)
    return this.seed
  }

  cycleWeather(): WeatherId {
    return this.atmosphere.cycleWeather()
  }

  /**
   * Stream terrain + advance day/night and weather.
   */
  update(x: number, y: number, z: number, dt: number): void {
    this.terrain.update(x, z, dt)
    this.atmosphere.update(dt, x, y, z)
  }

  private applySpawn(pad: FlatSpawn): void {
    setOpsCenter(pad.x, pad.z)

    const gearY = flightConfig.gearHeight
    const yaw = pad.yaw
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
    sun.shadow.mapSize.set(1024, 1024)
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
}
