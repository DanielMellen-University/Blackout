import {
  ACESFilmicToneMapping,
  MathUtils,
  PCFSoftShadowMap,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { Aircraft } from './aircraft/Aircraft'
import { CameraSystem } from './camera/CameraSystem'
import { InputManager } from './core/InputManager'
import { suppressBrowserUi } from './core/suppressBrowserUi'
import { Time } from './core/Time'
import { CollisionSystem } from './systems/Collision'
import { HUD } from './ui/HUD'
import { altitudeAgl } from './world/ground'
import { World } from './world/World'

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null
  if (!canvas) throw new Error('#game canvas not found')

  suppressBrowserUi(canvas)

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  const world = new World()
  const aircraft = new Aircraft()
  aircraft.addTo(world.scene)
  // Place jet on the flat-biome airfield chosen at world reseed
  aircraft.reset(world.spawn)
  await aircraft.tryLoadModel('/models/f35.glb')

  const cameras = new CameraSystem(canvas)
  const input = new InputManager()
  const time = new Time()
  const hud = new HUD()
  const collision = new CollisionSystem()

  let banner: string | null = null
  let bannerUntil = 0
  let wasAirborne = false

  const onResize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    cameras.resize(w, h)
  }
  window.addEventListener('resize', onResize)
  onResize()

  const showBanner = (text: string, ms = 2800): void => {
    banner = text
    bannerUntil = performance.now() + ms
  }

  const tick = (nowMs: number): void => {
    requestAnimationFrame(tick)

    const { frameDt } = time.beginFrame(nowMs)
    const dt = frameDt > 0 ? Math.min(frameDt, 1 / 20) : 1 / 60

    if (input.consumeCameraToggle()) cameras.toggleMode(aircraft)
    if (input.consumeReset()) {
      // New random world + flat-biome airfield each respawn
      world.reseed()
      aircraft.reset(world.spawn)
      input.resetFlightControls(0)
      banner = null
      wasAirborne = false
    }

    // Shared live controls — throttle setpoint updates every frame while Shift/Ctrl held
    aircraft.controls = input.sampleWithDt(dt)
    aircraft.step(dt)

    const touch = collision.check(aircraft)
    if (aircraft.status === 'ok') {
      if (!aircraft.onGround && aircraft.position.y > flightAltThreshold()) {
        wasAirborne = true
      }
      if (touch === 'crash') {
        aircraft.crash()
        showBanner('CRASH - press R')
      } else if (touch === 'landed' && wasAirborne) {
        aircraft.markLanded()
        showBanner('LANDED')
        wasAirborne = false
      }
    }

    if (banner && nowMs > bannerUntil && aircraft.status !== 'crashed') {
      banner = null
    }

    world.update(aircraft.position.x, aircraft.position.z)
    cameras.update(aircraft, dt)
    renderer.render(world.scene, cameras.camera)

    const alt = altitudeAgl(
      aircraft.position.x,
      aircraft.position.y,
      aircraft.position.z,
    )
    const { pitch, roll } = attitudeFromOrientation(aircraft.orientation)
    hud.update({
      x: aircraft.position.x,
      y: alt,
      z: aircraft.position.z,
      speed: aircraft.speed,
      cameraMode: cameras.modeLabel,
      fps: time.fps,
      throttle: aircraft.controls.throttle,
      boost: aircraft.controls.boost,
      gearDown: aircraft.controls.gearDown,
      onGround: aircraft.onGround,
      pitch,
      roll,
      banner: aircraft.status === 'crashed' ? 'CRASH - press R' : banner,
    })
  }

  requestAnimationFrame(tick)
}

function flightAltThreshold(): number {
  return 8
}

const _fwd = new Vector3()
const _inv = new Quaternion()
const _localUp = new Vector3()

/**
 * Body: +Z nose, +Y up, +X right.
 * pitch: nose up positive (rad). roll: right wing down positive (rad).
 */
function attitudeFromOrientation(orientation: Quaternion): {
  pitch: number
  roll: number
} {
  _fwd.set(0, 0, 1).applyQuaternion(orientation)
  const pitch = Math.asin(MathUtils.clamp(_fwd.y, -1, 1))

  _inv.copy(orientation).invert()
  _localUp.set(0, 1, 0).applyQuaternion(_inv)
  // Bank from body-frame world-up; right wing down = positive
  const roll = Math.atan2(-_localUp.x, _localUp.y)

  return { pitch, roll }
}

boot().catch((err) => {
  console.error('[Blackout] Failed to start', err)
})
