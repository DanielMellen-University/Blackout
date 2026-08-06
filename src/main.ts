import {
  SRGBColorSpace,
  ACESFilmicToneMapping,
  WebGLRenderer,
} from 'three'
import { Aircraft } from './aircraft/Aircraft'
import { CameraSystem } from './camera/CameraSystem'
import { InputManager } from './core/InputManager'
import { Time } from './core/Time'
import { HUD } from './ui/HUD'
import { World } from './world/World'

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null
  if (!canvas) throw new Error('#game canvas not found')

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true

  const world = new World()
  const aircraft = new Aircraft()
  aircraft.addTo(world.scene)
  await aircraft.tryLoadModel('/models/f35.glb')

  const cameras = new CameraSystem(canvas)
  const input = new InputManager()
  const time = new Time(60)
  const hud = new HUD()

  const resize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    cameras.resize(w, h)
  }
  window.addEventListener('resize', resize)
  resize()

  const tick = (nowMs: number): void => {
    requestAnimationFrame(tick)

    const { frameDt } = time.beginFrame(nowMs)
    // Integrate every visual frame with clamped dt — avoids fixed-step
    // stutter (0-step frames) that makes the model feel laggy.
    const dt = frameDt > 0 ? Math.min(frameDt, 1 / 20) : 1 / 60

    if (input.consumeCameraToggle()) {
      cameras.toggleMode(aircraft)
    }
    if (input.consumeReset()) {
      aircraft.reset()
    }

    aircraft.controls = { ...input.sample() }
    aircraft.freeFlyStep(dt)

    // Camera hard-follows aircraft after sim update (same frame)
    cameras.update(aircraft, dt)

    renderer.render(world.scene, cameras.camera)

    hud.update({
      x: aircraft.position.x,
      y: aircraft.position.y,
      z: aircraft.position.z,
      speed: aircraft.speed,
      cameraMode: cameras.modeLabel,
      fps: time.fps,
    })
  }

  requestAnimationFrame(tick)
  console.info('[Blackout] Phase 0 skeleton running')
}

boot().catch((err) => {
  console.error('[Blackout] Failed to start', err)
})
