import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Scene,
} from 'three'
import { flightConfig } from '../aircraft/flightConfig'
import { Atmosphere, type WeatherId } from './Atmosphere'
import { AIRFIELD_COLLIDERS } from './Airfield'
import { randomizeWorldSeed, setWorldSeed } from './noise'
import { createRunway } from './Runway'
import {
  clearOpsPad,
  findPlayableSpawn,
  getOpsPad,
  setOpsPad,
  type FlatSpawn,
} from './terrainSample'
import { FOG_FAR, FOG_NEAR, TerrainSystem } from './TerrainSystem'
import { MissionSystem } from '../systems/Mission'

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
  /** Cool moonlight — no shadows (cheap second key light). */
  readonly moon: DirectionalLight
  readonly atmosphere: Atmosphere
  readonly mission: MissionSystem
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
  private committed = false

  constructor() {
    this.sun = this.createSun()
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    this.moon = this.createMoon()
    this.scene.add(this.moon)
    this.scene.add(this.moon.target)

    this.hemi = new HemisphereLight(0xd0e4f8, 0x4a5540, 0.85)
    this.scene.add(this.hemi)

    this.ambient = new AmbientLight(0xffffff, 0.42)
    this.scene.add(this.ambient)

    this.fill = new DirectionalLight(0xb8d0ff, 0.4)
    this.fill.position.set(-100, 80, -60)
    this.scene.add(this.fill)
    this.scene.add(this.fill.target)

    this.terrain = new TerrainSystem(this.scene)
    this.atmosphere = new Atmosphere(
      this.scene,
      {
        sun: this.sun,
        moon: this.moon,
        hemi: this.hemi,
        ambient: this.ambient,
        fill: this.fill,
      },
      FOG_NEAR,
      FOG_FAR,
    )

    this.runway = createRunway()
    this.scene.add(this.runway)
    this.mission = new MissionSystem(this.scene)
    this.reseed()
  }

  get worldSeed(): number {
    return this.seed
  }

  /**
   * New random world seed, pick a flat-biome airfield, rebuild terrain there.
   * Search and validation run before the live world is replaced. If anything
   * throws after a world already exists, the previous seed/pad stay in place.
   */
  reseed(): number {
    const previousSeed = this.seed
    const previousPad = getOpsPad()
    const previousSpawn = { ...this.spawn }
    const restore = (): void => {
      setWorldSeed(previousSeed)
      this.seed = previousSeed
      this.spawn = previousSpawn
      if (previousPad) setOpsPad(previousPad.x, previousPad.z, previousPad.y)
      else clearOpsPad()
    }

    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        const nextSeed = randomizeWorldSeed()
        clearOpsPad()
        const pad = findPlayableSpawn()
        if (!pad) continue
        setOpsPad(pad.x, pad.z, pad.y)
        this.seed = nextSeed
        this.applySpawn(pad)
        this.terrain.clearAll()
        this.terrain.update(this.spawn.x, this.spawn.z, 1 / 60)
        this.atmosphere.randomizeWeather(this.seed)
        this.mission.start(this.spawn.x, this.spawn.y, this.spawn.z, this.spawn.yaw)
        this.committed = true
        return this.seed
      }
      if (this.committed) {
        restore()
        return this.seed
      }
      throw new Error('reseed: no dry inland pad')
    } catch (err) {
      restore()
      if (this.committed) return this.seed
      throw err
    }
  }

  /** True if a world-space point overlaps hangar, tower, or shack. */
  hitObstacle(x: number, y: number, z: number): boolean {
    const pad = getOpsPad()
    if (!pad) return false
    const yaw = this.spawn.yaw
    const dx = x - pad.x
    const dz = z - pad.z
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    const lx = dx * rx + dz * rz
    const lz = dx * fx + dz * fz
    const ly = y - pad.y
    for (const b of AIRFIELD_COLLIDERS) {
      if (
        Math.abs(lx - b.cx) <= b.hx &&
        Math.abs(ly - b.cy) <= b.hy &&
        Math.abs(lz - b.cz) <= b.hz
      ) {
        return true
      }
    }
    return false
  }

  cycleWeather(): WeatherId {
    return this.atmosphere.cycleWeather()
  }

  /**
   * Stream terrain + advance day/night and weather.
   * Pass simDt=0 to freeze challenge conditions while still streaming tiles.
   */
  update(x: number, y: number, z: number, dt: number, simDt = dt, visualDt = simDt): void {
    this.terrain.update(x, z, dt)
    this.atmosphere.update(simDt, x, y, z, visualDt)
  }

  private applySpawn(pad: FlatSpawn): void {
    const yaw = pad.yaw
    const back = 45
    const fx = Math.sin(yaw)
    const fz = Math.cos(yaw)
    const x = pad.x - fx * back
    const z = pad.z - fz * back
    this.spawn = {
      x,
      y: pad.y + flightConfig.gearHeight,
      z,
      yaw,
      biome: pad.biome,
    }

    this.runway.position.set(pad.x, pad.y + 0.05, pad.z)
    this.runway.rotation.y = yaw
  }

  private createSun(): DirectionalLight {
    const sun = new DirectionalLight(0xfff5e6, 1.65)
    sun.name = 'SunLight'
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
    return sun
  }

  /** Moon key light — directional only, no shadow map (keeps night cheap). */
  private createMoon(): DirectionalLight {
    const moon = new DirectionalLight(0xc8d4ff, 0)
    moon.name = 'MoonLight'
    moon.position.set(-180, 200, -120)
    moon.castShadow = false
    return moon
  }
}
