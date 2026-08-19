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
} from './core/suppressBrowserUi'
import { Time } from './core/Time'
import { CollisionSystem } from './systems/Collision'
import { CrashFx } from './systems/CrashFx'
import { evaluateWarnings } from './systems/FlightWarnings'
import { isDebugEnabled } from './debug/debugFlags'
import { DebugOverlay } from './debug/DebugOverlay'
import { GameMenu } from './ui/GameMenu'
import { HUD } from './ui/HUD'
import { altitudeAgl } from './world/ground'
import { World } from './world/World'

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null
  if (!canvas) throw new Error('#game canvas not found')

  const titleScreen = document.getElementById('title-screen')
  const playBtn = document.getElementById('btn-play')
  const overlay = document.getElementById('overlay')
  const menuEl = document.getElementById('menu')
  if (!menuEl) throw new Error('#menu not found')
  const menu = new GameMenu(menuEl)

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
  const crashFx = new CrashFx(world.scene)
  const debug = isDebugEnabled() ? new DebugOverlay(world.scene) : null
  debug?.syncPad()

  let playing = false
  let banner: string | null = null
  let bannerUntil = 0
  let wasAirborne = false

  const startGame = (): void => {
    if (playing) return
    playing = true
    menu.close()
    titleScreen?.classList.add('is-hidden')
    if (overlay) {
      overlay.hidden = false
      overlay.classList.remove('overlay-hidden')
    }
    input.release('Space')
    input.release('Enter')
    input.release('NumpadEnter')
    input.clearQueued()
    input.resetFlightControls(0)
    wasAirborne = false
    banner = null
    void lockGameKeyboard()
    canvas.focus({ preventScroll: true })
  }

  const quitToTitle = (): void => {
    playing = false
    menu.close()
    titleScreen?.classList.remove('is-hidden')
    if (overlay) {
      overlay.hidden = true
      overlay.classList.add('overlay-hidden')
    }
    crashFx.reset()
    aircraft.reset(world.spawn)
    cameras.setMode('chase', aircraft)
    input.clearKeys()
    input.resetFlightControls(0)
    banner = null
    wasAirborne = false
  }

  playBtn?.addEventListener('click', () => startGame())
  document.getElementById('btn-controls')?.addEventListener('click', () => {
    menu.showTitlePage('controls')
  })
  document.getElementById('btn-info')?.addEventListener('click', () => {
    menu.showTitlePage('info')
  })
  document.getElementById('menu-resume')?.addEventListener('click', () => menu.close())
  document.getElementById('menu-quit')?.addEventListener('click', () => quitToTitle())
  document.getElementById('menu-fullscreen')?.addEventListener('click', () => {
    toggleGameFullscreen()
  })
  document.getElementById('menu-open-controls')?.addEventListener('click', () => {
    menu.showView('controls')
  })
  document.getElementById('menu-open-info')?.addEventListener('click', () => {
    menu.showView('info')
  })
  menuEl.querySelectorAll('[data-menu-close]').forEach((el) => {
    el.addEventListener('click', () => menu.close())
  })
  menuEl.querySelectorAll('.menu-back').forEach((el) => {
    el.addEventListener('click', () => menu.back())
  })

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        if (!playing) {
          if (menu.open) menu.handleEscape()
          return
        }
        menu.togglePause()
        if (menu.paused) input.clearQueued()
        return
      }
      if (menu.open) return
      if (!playing && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
        if (e.code === 'Space') e.preventDefault()
        startGame()
      }
    },
    true,
  )

  document.addEventListener('fullscreenchange', () => {
    menu.syncFullscreen()
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

    if (playing && !menu.paused) {
      if (input.consumeCameraToggle()) cameras.toggleMode(aircraft)
      if (input.consumeWeatherCycle()) world.cycleWeather()
      if (input.consumeReset()) {
        world.reseed()
        aircraft.reset(world.spawn)
        cameras.setMode(cameras.mode, aircraft)
        crashFx.reset()
        debug?.syncPad()
        input.clearQueued()
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
      world.mission.tick()

      const touch = collision.check(aircraft)
      if (aircraft.status !== 'crashed') {
        if (!aircraft.onGround && aircraft.position.y > flightAltThreshold()) {
          wasAirborne = true
          aircraft.clearLanded()
        }
        if (touch === 'crash') {
          const hit = aircraft.position.clone()
          const v = aircraft.velocity.clone()
          if (cameras.mode === 'cockpit') cameras.setMode('chase', aircraft)
          aircraft.crash()
          crashFx.trigger(hit, v)
          cameras.impulse(1)
          showBanner('CRASH - press R', 4200)
        } else if (touch === 'landed' && wasAirborne && aircraft.status === 'ok') {
          aircraft.markLanded()
          showBanner('LANDED')
          wasAirborne = false
        }
      }

      if (banner && nowMs > bannerUntil && aircraft.status !== 'crashed') {
        banner = null
      }
    } else {
      // Title idle, or pause: hold the jet, still run sky/terrain
      aircraft.controls = input.sampleWithDt(0)
      if (!playing) input.resetFlightControls(0)
    }

    world.update(
      aircraft.position.x,
      aircraft.position.y,
      aircraft.position.z,
      dt,
    )
    const phase = world.atmosphere.phaseLabel
    const baseExp =
      phase === 'NIGHT' ? 0.95 : phase === 'DUSK' || phase === 'DAWN' ? 1.05 : 1.15
    renderer.toneMappingExposure = baseExp + crashFx.bloom * 1.35
    crashFx.update(dt)

    cameras.update(aircraft, dt)
    renderer.render(world.scene, cameras.camera)
    debug?.update(aircraft, world.spawn, cameras.modeLabel, time.fps)

    if (playing) {
      const alt = altitudeAgl(
        aircraft.position.x,
        aircraft.position.y,
        aircraft.position.z,
      )
      const { pitch, roll, heading } = attitudeFromOrientation(aircraft.orientation)
      const warn = evaluateWarnings(aircraft, alt)
      const nav = world.mission.hud(
        aircraft.position.x,
        aircraft.position.y,
        aircraft.position.z,
        heading,
      )
      hud.update({
        y: alt,
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
        mission: nav.label,
        navDist: nav.dist,
        navBearing: nav.bearing,
        navAltDelta: nav.altDelta,
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
  heading: number
} {
  _fwd.set(0, 0, 1).applyQuaternion(orientation)
  const pitch = Math.asin(MathUtils.clamp(_fwd.y, -1, 1))
  const heading = Math.atan2(_fwd.x, _fwd.z)

  _inv.copy(orientation).invert()
  _localUp.set(0, 1, 0).applyQuaternion(_inv)
  const roll = Math.atan2(-_localUp.x, _localUp.y)

  return { pitch, roll, heading }
}

boot().catch((err) => {
  console.error('[Blackout] Failed to start', err)
})
