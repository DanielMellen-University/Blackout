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
import {
  lockGameKeyboard,
  suppressBrowserUi,
  toggleGameFullscreen,
  tryReenterFullscreenFromClick,
} from './core/suppressBrowserUi'
import { Time } from './core/Time'
import { CollisionSystem } from './systems/Collision'
import { evaluateWarnings } from './systems/FlightWarnings'
import { HUD } from './ui/HUD'
import { altitudeAgl } from './world/ground'
import { World } from './world/World'

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null
  if (!canvas) throw new Error('#game canvas not found')

  const titleScreen = document.getElementById('title-screen')
  const playBtn = document.getElementById('btn-play')
  const overlay = document.getElementById('overlay')

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

  let playing = false
  let banner: string | null = null
  let bannerUntil = 0
  let wasAirborne = false

  const startGame = (): void => {
    if (playing) return
    playing = true
    titleScreen?.classList.add('is-hidden')
    if (overlay) {
      overlay.hidden = false
      overlay.classList.remove('overlay-hidden')
    }
    // Space/Enter to start must not leak into AB / throttle
    input.clearKeys()
    input.resetFlightControls(0)
    wasAirborne = false
    banner = null
    // Fullscreen + Keyboard Lock so Ctrl+W (brake+pitch) doesn't close the tab
    void lockGameKeyboard()
    canvas.focus({ preventScroll: true })
  }

  playBtn?.addEventListener('click', () => {
    startGame()
  })
  window.addEventListener(
    'keydown',
    (e) => {
      if (!playing && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
        if (e.code === 'Space') e.preventDefault()
        startGame()
        return
      }
      if (!playing) return

      // Esc / F toggle fullscreen (must stay sync — no await before requestFullscreen)
      if (e.code === 'Escape' || e.code === 'KeyF') {
        e.preventDefault()
        toggleGameFullscreen()
      }
    },
    true, // capture so we run before anything else
  )

  // Chrome often blocks requestFullscreen from Escape; click canvas to re-enter
  canvas.addEventListener(
    'pointerdown',
    () => {
      if (playing) tryReenterFullscreenFromClick()
    },
    true,
  )

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      try {
        const kb = (
          navigator as Navigator & { keyboard?: { unlock: () => void } }
        ).keyboard
        kb?.unlock?.()
      } catch {
        /* ignore */
      }
    }
  })

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

    if (playing) {
      if (input.consumeCameraToggle()) cameras.toggleMode(aircraft)
      if (input.consumeWeatherCycle()) world.cycleWeather()
      if (input.consumeReset()) {
        world.reseed()
        aircraft.reset(world.spawn)
        input.clearKeys()
        input.resetFlightControls(0)
        banner = null
        wasAirborne = false
      }

      aircraft.controls = input.sampleWithDt(dt)
      aircraft.step(dt)

      const event = world.mission.update(
        aircraft.position.x,
        aircraft.position.y,
        aircraft.position.z,
      )
      if (event === 'pass') showBanner('GATE CLEAR', 1200)
      if (event === 'complete') showBanner('CIRCUIT COMPLETE', 4200)

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
    } else {
      // Idle on title: hold jet still, still advance sky/terrain ambience a little
      aircraft.controls = input.sampleWithDt(0)
      input.resetFlightControls(0)
    }

    world.update(
      aircraft.position.x,
      aircraft.position.y,
      aircraft.position.z,
      dt,
    )
    const phase = world.atmosphere.phaseLabel
    renderer.toneMappingExposure =
      phase === 'NIGHT' ? 0.95 : phase === 'DUSK' || phase === 'DAWN' ? 1.05 : 1.15

    cameras.update(aircraft, dt)
    renderer.render(world.scene, cameras.camera)

    if (playing) {
      const alt = altitudeAgl(
        aircraft.position.x,
        aircraft.position.y,
        aircraft.position.z,
      )
      const { pitch, roll } = attitudeFromOrientation(aircraft.orientation)
      const warn = evaluateWarnings(aircraft, alt)
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
        warning: warn.text,
        warningLevel: warn.level,
        clock: world.atmosphere.clockLabel,
        weather: world.atmosphere.weatherLabel,
        dayPhase: world.atmosphere.phaseLabel,
        mission: world.mission.hud(
          aircraft.position.x,
          aircraft.position.y,
          aircraft.position.z,
        ).label,
        banner: aircraft.status === 'crashed' ? 'CRASH - press R' : banner,
      })
    }
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
  const roll = Math.atan2(-_localUp.x, _localUp.y)

  return { pitch, roll }
}

boot().catch((err) => {
  console.error('[Blackout] Failed to start', err)
})
