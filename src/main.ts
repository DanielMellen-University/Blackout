import {
  ACESFilmicToneMapping,
  MathUtils,
  PCFSoftShadowMap,
  PerspectiveCamera,
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
  lockKeysOnly,
  setFlightKeyCapture,
  suppressBrowserUi,
  toggleGameFullscreen,
} from './core/suppressBrowserUi'
import { Time } from './core/Time'
import { ChallengeRun } from './systems/ChallengeRun'
import { CollisionSystem } from './systems/Collision'
import { CrashFx } from './systems/CrashFx'
import { FlightAudio } from './audio/FlightAudio'
import { evaluateWarnings } from './systems/FlightWarnings'
import { isDebugEnabled } from './debug/debugFlags'
import { DebugOverlay } from './debug/DebugOverlay'
import { GameMenu } from './ui/GameMenu'
import { HUD } from './ui/HUD'
import { RunResults } from './ui/RunResults'
import { altitudeAgl } from './world/ground'
import { World } from './world/World'

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null
  if (!canvas) throw new Error('#game canvas not found')

  const titleScreen = document.getElementById('title-screen')
  const playBtn = document.getElementById('btn-play') as HTMLButtonElement | null
  const overlay = document.getElementById('overlay')
  const menuEl = document.getElementById('menu')
  if (!menuEl) throw new Error('#menu not found')
  const menu = new GameMenu(menuEl)

  suppressBrowserUi(canvas)
  const titleStatus = document.getElementById('title-status')
  if (playBtn) playBtn.disabled = true

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
  if (titleStatus) titleStatus.textContent = ''
  if (playBtn) playBtn.disabled = false
  const aircraft = new Aircraft()
  aircraft.addTo(world.scene)
  // Place jet on the flat-biome airfield chosen at world reseed
  aircraft.reset(world.spawn)
  await aircraft.tryLoadModel('/models/f35.glb')

  const cameras = new CameraSystem(canvas)
  const input = new InputManager()
  const time = new Time()
  const hud = new HUD()
  const collision = new CollisionSystem((jet) =>
    world.hitObstacle(jet.position.x, jet.position.y, jet.position.z),
  )
  const crashFx = new CrashFx(world.scene)
  const audio = new FlightAudio()
  const results = new RunResults()
  const challenge = new ChallengeRun()
  const debug = isDebugEnabled() ? new DebugOverlay(world.scene) : null
  debug?.syncPad()

  let playing = false
  let banner: string | null = null
  let bannerUntil = 0
  let wasAirborne = false

  const courseId = (): string => `seed:${world.worldSeed}`

  const syncInputContext = (): void => {
    const live = playing && !menu.paused && !results.open
    input.flightLive = live
    setFlightKeyCapture(live)
  }

  const resetFlight = (newWorld: boolean): void => {
    results.hide()
    if (newWorld) {
      world.reseed()
      debug?.syncPad()
    } else {
      world.mission.start(world.spawn.x, world.spawn.y, world.spawn.z, world.spawn.yaw)
    }
    aircraft.reset(world.spawn)
    cameras.setMode(cameras.mode, aircraft)
    crashFx.reset()
    input.clearQueued()
    input.resetFlightControls(0)
    challenge.reset(courseId(), world.mission.totalGates)
    banner = null
    wasAirborne = false
    time.reset()
  }

  const startGame = (): void => {
    if (playing) return
    playing = true
    menu.close()
    results.hide()
    titleScreen?.classList.add('is-hidden')
    if (overlay) {
      overlay.hidden = false
      overlay.classList.remove('overlay-hidden')
    }
    resetFlight(false)
    input.release('Space')
    input.release('Enter')
    input.release('NumpadEnter')
    void lockGameKeyboard()
    canvas.focus({ preventScroll: true })
    void audio.resume()
    syncInputContext()
  }

  const quitToTitle = (): void => {
    playing = false
    audio.silence()
    menu.close()
    results.hide()
    titleScreen?.classList.remove('is-hidden')
    if (overlay) {
      overlay.hidden = true
      overlay.classList.add('overlay-hidden')
    }
    resetFlight(false)
    cameras.setMode('chase', aircraft)
    input.clearKeys()
    syncInputContext()
  }

  playBtn?.addEventListener('click', () => startGame())
  document.getElementById('btn-controls')?.addEventListener('click', () => {
    menu.showTitlePage('controls')
  })
  document.getElementById('btn-info')?.addEventListener('click', () => {
    menu.showTitlePage('info')
  })
  document.getElementById('menu-resume')?.addEventListener('click', () => {
    menu.close()
    input.clearQueued()
    time.reset()
    syncInputContext()
  })
  document.getElementById('menu-retry')?.addEventListener('click', () => {
    menu.close()
    resetFlight(false)
    syncInputContext()
  })
  document.getElementById('menu-new-world')?.addEventListener('click', () => {
    menu.close()
    resetFlight(true)
    syncInputContext()
  })
  document.getElementById('menu-quit')?.addEventListener('click', () => quitToTitle())
  document.getElementById('btn-retry')?.addEventListener('click', () => {
    resetFlight(false)
    syncInputContext()
  })
  document.getElementById('btn-new-world')?.addEventListener('click', () => {
    resetFlight(true)
    syncInputContext()
  })
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
        e.stopPropagation()
        if (!playing) {
          if (menu.open) menu.handleEscape()
          return
        }
        menu.togglePause()
        input.clearQueued()
        time.reset()
        syncInputContext()
        return
      }
      if (menu.open) return
      if (results.open && playing) {
        if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'NumpadEnter') {
          e.preventDefault()
          resetFlight(false)
          syncInputContext()
        }
        return
      }
      if (!playing && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
        if (e.code === 'Space') e.preventDefault()
        startGame()
      }
    },
    true,
  )

  document.addEventListener('fullscreenchange', () => {
    menu.syncFullscreen()
    if (document.fullscreenElement) {
      void lockKeysOnly()
      return
    }
    try {
      const kb = (
        navigator as Navigator & { keyboard?: { unlock: () => void } }
      ).keyboard
      kb?.unlock?.()
    } catch {
      /* ignore */
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

    syncInputContext()
    const simLive = playing && !menu.paused && !results.open
    if (!simLive) {
      time.skipFrame(nowMs)
      aircraft.controls = input.sampleWithDt(0)
      if (!playing) input.resetFlightControls(0)
    } else {
      const { steps, stepDt } = time.beginFrame(nowMs)
      const dt = stepDt

      if (input.consumeCameraToggle()) cameras.toggleMode(aircraft)
      if (input.consumeWeatherCycle()) world.cycleWeather()
      if (input.consumeReset()) resetFlight(false)

      for (let i = 0; i < steps; i++) {
        aircraft.controls = input.sampleWithDt(dt)
        aircraft.step(dt)

        const touch = collision.check(aircraft)
        if (aircraft.status !== 'crashed') {
          const alt = altitudeAgl(
            aircraft.position.x,
            aircraft.position.y,
            aircraft.position.z,
            aircraft.controls.gearDown,
          )
          if (!aircraft.onGround && alt > 8) {
            wasAirborne = true
            aircraft.clearLanded()
          }
          if (touch === 'crash') {
            const hit = aircraft.position.clone()
            const v = aircraft.velocity.clone()
            if (cameras.mode === 'cockpit') cameras.setMode('chase', aircraft)
            aircraft.crash()
            challenge.fail()
            crashFx.trigger(hit, v)
            cameras.impulse(1)
            audio.playCue('crash')
            showBanner('CRASH - press R', 4200)
            break
          }
          const scoredTouch =
            touch === 'landed' ||
            (touch === 'roll' && challenge.phase === 'returning')
          if (scoredTouch && wasAirborne && aircraft.status === 'ok') {
            aircraft.markLanded()
            wasAirborne = false
            const pose = attitudeFromOrientation(aircraft.orientation)
            const finished = challenge.finishLanding({
              verticalSpeed: aircraft.impactVy || aircraft.velocity.y,
              groundSpeed: Math.hypot(aircraft.velocity.x, aircraft.velocity.z),
              pitchRad: pose.pitch,
              rollRad: pose.roll,
            })
            if (finished) {
              audio.playCue('landed')
              results.show(finished)
              syncInputContext()
              break
            }
            if (touch === 'landed') {
              audio.playCue('landed')
              showBanner('LANDED')
            }
          }
        }

        if (aircraft.status !== 'crashed') {
          const event = world.mission.update(
            aircraft.position.x,
            aircraft.position.y,
            aircraft.position.z,
          )
          if (event === 'pass') {
            challenge.recordGate(world.mission.lastPassQuality)
            audio.playCue('gate')
            showBanner('GATE CLEAR', 1200)
          }
          if (event === 'complete') {
            challenge.recordGate(world.mission.lastPassQuality)
            audio.playCue('complete')
            showBanner('RETURN & LAND', 4200)
          }
        }

        challenge.update(dt, aircraft.speed)
      }

      world.mission.tick()
      if (banner && nowMs > bannerUntil && aircraft.status !== 'crashed') {
        banner = null
      }
    }

    const renderDt = simLive ? 1 / 60 : 0
    world.update(
      aircraft.position.x,
      aircraft.position.y,
      aircraft.position.z,
      Math.max(renderDt, 1 / 60),
      simLive ? renderDt : 0,
    )
    const phase = world.atmosphere.phaseLabel
    const baseExp =
      phase === 'NIGHT' ? 0.95 : phase === 'DUSK' || phase === 'DAWN' ? 1.05 : 1.15
    renderer.toneMappingExposure = baseExp + crashFx.bloom * 1.35
    crashFx.update(simLive ? renderDt : 0)

    audio.update({
      throttle: aircraft.engineState.lever,
      boost: aircraft.engineState.afterburnerActive,
      speed: aircraft.speed,
      mute: !playing || menu.paused || results.open || aircraft.status === 'crashed',
      dt: renderDt || 1 / 60,
    })

    cameras.update(aircraft, simLive ? renderDt : 0)
    renderer.render(world.scene, cameras.camera)
    debug?.update(aircraft, world.spawn, cameras.modeLabel, time.fps)

    if (playing) {
      const alt = aircraft.onGround
        ? 0
        : altitudeAgl(
            aircraft.position.x,
            aircraft.position.y,
            aircraft.position.z,
            aircraft.controls.gearDown,
          )
      const { pitch, roll } = attitudeFromOrientation(aircraft.orientation)
      const warn = evaluateWarnings(aircraft, alt)
      const nav = world.mission.hud(
        aircraft.position.x,
        aircraft.position.y,
        aircraft.position.z,
      )
      const gate = world.mission.activeGatePos()
      hud.update({
        y: alt,
        speed: aircraft.speed,
        cameraMode: cameras.modeLabel,
        fps: time.fps,
        throttle: aircraft.engineState.lever,
        boost: aircraft.engineState.afterburnerActive,
        gearDown: aircraft.controls.gearDown,
        onGround: aircraft.onGround,
        pitch,
        roll,
        warning: warn.text,
        warningLevel: warn.level,
        clock: challenge.clockLabel,
        weather: world.atmosphere.weatherLabel,
        dayPhase: world.atmosphere.phaseLabel,
        mission: challenge.objectiveLabel,
        navDist: nav.dist,
        navBearing: gateScreenBearing(cameras.camera, gate),
        navAltDelta: nav.altDelta,
        banner: aircraft.status === 'crashed' ? 'CRASH - press R' : banner,
      })
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing && !menu.paused && !results.open) {
      menu.openPause()
      input.clearQueued()
      time.reset()
      syncInputContext()
    }
  })

  challenge.reset(courseId(), world.mission.totalGates)
  syncInputContext()
  requestAnimationFrame(tick)
}

const _fwd = new Vector3()
const _gateView = new Vector3()
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

function gateScreenBearing(
  camera: PerspectiveCamera,
  gate: Vector3 | null,
): number | null {
  if (!gate) return null
  camera.updateMatrixWorld()
  _gateView.copy(gate).applyMatrix4(camera.matrixWorldInverse)
  return Math.atan2(_gateView.x, -_gateView.z)
}

boot().catch((err) => {
  console.error('[Blackout] Failed to start', err)
  const status = document.getElementById('title-status')
  if (status) {
    status.textContent = 'Could not create a world. Reload the page.'
  }
  const playBtn = document.getElementById('btn-play')
  if (playBtn instanceof HTMLButtonElement) playBtn.disabled = true
})
