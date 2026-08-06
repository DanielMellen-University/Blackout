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

    const { steps, frameDt } = time.beginFrame(nowMs)
    const dt = time.fixedDt

    if (input.consumeCameraToggle()) {
      cameras.toggleMode()
    }
    if (input.consumeReset()) {
      aircraft.reset()
    }

    aircraft.controls = { ...input.sample() }

    for (let i = 0; i < steps; i++) {
      aircraft.freeFlyStep(dt)
    }

    cameras.update(aircraft, frameDt || dt)

    renderer.render(world.scene, cameras.camera)

    hud.update({
      x: aircraft.position.x,
      y: aircraft.position.y,
      z: aircraft.position.z,
      speed: aircraft.speed,
      cameraMode: cameras.mode,
      fps: time.fps,
    })
  }

  requestAnimationFrame(tick)
  console.info('[Blackout] Phase 0 skeleton running')
}

boot().catch((err) => {
  console.error('[Blackout] Failed to start', err)
})
