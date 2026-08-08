import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
import { Aircraft } from './aircraft/Aircraft'
import { CameraSystem } from './camera/CameraSystem'
import { InputManager } from './core/InputManager'
import { suppressBrowserUi } from './core/suppressBrowserUi'
import { Time } from './core/Time'
import { CollisionSystem } from './systems/Collision'
import { HUD } from './ui/HUD'
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
      aircraft.reset()
      banner = null
      wasAirborne = false
    }

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

    cameras.update(aircraft, dt)
    renderer.render(world.scene, cameras.camera)

    const alt = Math.max(0, aircraft.position.y - 1.4)
    hud.update({
      x: aircraft.position.x,
      y: alt,
      z: aircraft.position.z,
      speed: aircraft.speed,
      cameraMode: cameras.modeLabel,
      fps: time.fps,
      throttle: aircraft.controls.throttle,
      gearDown: aircraft.controls.gearDown,
      onGround: aircraft.onGround,
      banner: aircraft.status === 'crashed' ? 'CRASH - press R' : banner,
    })
  }

  requestAnimationFrame(tick)
}

function flightAltThreshold(): number {
  return 8
}

boot().catch((err) => {
  console.error('[Blackout] Failed to start', err)
})
