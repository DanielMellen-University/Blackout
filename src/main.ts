import {
  ACESFilmicToneMapping,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { Aircraft, disposeAircraftObject } from './aircraft/Aircraft'
import {
  cameraModeCue,
  CameraSystem,
  TOUCHDOWN_IMPULSE,
} from './camera/CameraSystem'
import {
  writeFlightPathMarker,
  type FlightPathMarkerPosition,
} from './camera/FlightPathMarker'
import { InputManager } from './core/InputManager'
import {
  lockGameKeyboard,
  lockKeysOnly,
  setFlightKeyCapture,
  shouldReenterFullscreen,
  suppressBrowserUi,
  toggleGameFullscreen,
} from './core/suppressBrowserUi'
import {
  shouldAdvanceWorld,
  shouldPauseForFocusLost,
  shouldRenderFrame,
  shouldUpdateLiveHud,
  Time,
} from './core/Time'
import { ChallengeRun } from './systems/ChallengeRun'
import { CollisionSystem } from './systems/Collision'
import { CrashFx } from './systems/CrashFx'
import { LandingFx } from './systems/LandingFx'
import { FlightAudio } from './audio/FlightAudio'
import {
  audioVolumePercent,
  normalizeAudioVolume,
  readAudioVolume,
  writeAudioVolume,
} from './audio/AudioPreferences'
import { evaluateWarnings } from './systems/FlightWarnings'
import { isDebugEnabled } from './debug/debugFlags'
import { DebugOverlay } from './debug/DebugOverlay'
import { GameMenu } from './ui/GameMenu'
import { HUD, type HudBannerTone } from './ui/HUD'
import { RunResults } from './ui/RunResults'
import { altitudeAgl } from './world/ground'
import { World } from './world/World'
import { AdaptiveResolution } from './core/AdaptiveResolution'
import { ListenerBag } from './core/ListenerBag'
import {
  defaultRenderQuality,
  normalizeRenderQuality,
  readRenderQuality,
  renderQualityProfile,
  shadowUpdateDue,
  writeRenderQuality,
  type RenderQuality,
} from './core/RenderQuality'

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null
  if (!canvas) throw new Error('#game canvas not found')

  const titleScreen = document.getElementById('title-screen')
  const playBtn = document.getElementById('btn-play') as HTMLButtonElement | null
  const overlay = document.getElementById('overlay')
  const menuEl = document.getElementById('menu')
  const qualitySelect = document.getElementById('menu-quality') as HTMLSelectElement | null
  const volumeRange = document.getElementById('menu-volume') as HTMLInputElement | null
  const volumeValue = document.getElementById('menu-volume-value')
  if (!menuEl) throw new Error('#menu not found')
  const menu = new GameMenu(menuEl)
  const uiListeners = new ListenerBag()

  const releaseBrowserUi = suppressBrowserUi(canvas)
  const titleStatus = document.getElementById('title-status')
  if (playBtn) playBtn.disabled = true

  let qualityStorage: Storage | null = null
  try {
    qualityStorage = window.localStorage
  } catch {
    /* Private browsing can deny storage. The game remains fully playable. */
  }
  const renderQualityFallback = defaultRenderQuality({
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  })
  let renderQuality: RenderQuality = readRenderQuality(qualityStorage, renderQualityFallback)
  const initialAudioVolume = readAudioVolume(qualityStorage)
  const initialQualityProfile = renderQualityProfile(renderQuality)

  const renderer = new WebGLRenderer({
    canvas,
    // Multisample antialiasing is selected once at context creation. Low
    // quality should avoid paying that GPU cost on constrained devices.
    antialias: initialQualityProfile.antialias,
    powerPreference: 'high-performance',
  })
  const resolution = new AdaptiveResolution(window.devicePixelRatio, initialQualityProfile.maxPixelRatio)
  renderer.setPixelRatio(resolution.ratio)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.shadowMap.enabled = initialQualityProfile.shadows
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = initialQualityProfile.shadows
  // Three.js now folds the old PCFSoftShadowMap into PCFShadowMap anyway.
  // Use the supported constant directly so startup stays warning-free.
  renderer.shadowMap.type = PCFShadowMap

  let applyAtmosphereQuality: ((precipitationScale: number, cloudScale: number, vegetationScale: number) => void) | null = null
  const SHADOW_UPDATE_STEP = 1 / 20
  let shadowUpdateElapsed = SHADOW_UPDATE_STEP

  const applyRenderQuality = (next: RenderQuality): void => {
    renderQuality = next
    const profile = renderQualityProfile(next)
    resolution.setCeiling(profile.maxPixelRatio)
    renderer.setPixelRatio(resolution.ratio)
    renderer.shadowMap.enabled = profile.shadows
    if (profile.shadows) {
      // A quality switch can re-enable shadows after Low, so refresh on the
      // next visible render instead of waiting for the cadence timer.
      renderer.shadowMap.needsUpdate = true
      shadowUpdateElapsed = SHADOW_UPDATE_STEP
    }
    applyAtmosphereQuality?.(profile.precipitationScale, profile.cloudScale, profile.vegetationScale)
    if (qualitySelect) qualitySelect.value = next
    writeRenderQuality(qualityStorage, next)
  }
  applyRenderQuality(renderQuality)
  const onQualityChange = (): void => {
    if (!qualitySelect) return
    applyRenderQuality(normalizeRenderQuality(qualitySelect.value, renderQuality))
  }
  uiListeners.add(qualitySelect, 'change', onQualityChange)

  const world = new World()
  // Keep the title hero focused on the runway and jet. Nearby procedural
  // cities remain generated and become visible as soon as flight starts.
  world.setSettlementsVisible(false)
  applyAtmosphereQuality = (precipitationScale, cloudScale, vegetationScale) => {
    world.atmosphere.setPrecipitationScale(precipitationScale)
    world.atmosphere.setCloudDensityScale(cloudScale)
    world.terrain.setVegetationScale(vegetationScale)
  }
  applyAtmosphereQuality(initialQualityProfile.precipitationScale, initialQualityProfile.cloudScale, initialQualityProfile.vegetationScale)
  if (titleStatus) titleStatus.textContent = 'AIRFIELD READY · PRESS PLAY OR ENTER'
  if (playBtn) playBtn.disabled = false
  const aircraft = new Aircraft()
  aircraft.addTo(world.scene)
  // Place jet on the flat-biome airfield chosen at world reseed
  aircraft.reset(world.spawn)

  const cameras = new CameraSystem(canvas)
  cameras.attachToScene(world.scene)
  const reducedMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null
  const syncReducedMotion = (): void => {
    cameras.setReducedMotion(!!reducedMotionQuery?.matches)
  }
  const onReducedMotionChange = (): void => syncReducedMotion()
  reducedMotionQuery?.addEventListener?.('change', onReducedMotionChange)
  syncReducedMotion()
  const input = new InputManager()
  const time = new Time()
  const hud = new HUD()
  const collision = new CollisionSystem((jet) =>
    world.hitObstacle(jet.position.x, jet.position.y, jet.position.z),
  )
  const crashFx = new CrashFx(world.scene)
  const landingFx = new LandingFx(world.scene)
  const audio = new FlightAudio()
  const applyAudioVolume = (next: number): void => {
    const volume = normalizeAudioVolume(next)
    audio.setVolume(volume)
    if (volumeRange) volumeRange.value = String(Math.round(volume * 100))
    if (volumeValue) volumeValue.textContent = audioVolumePercent(volume)
    writeAudioVolume(qualityStorage, volume)
  }
  applyAudioVolume(initialAudioVolume)
  const onVolumeInput = (): void => {
    if (!volumeRange) return
    applyAudioVolume(Number(volumeRange.value) / 100)
  }
  uiListeners.add(volumeRange, 'input', onVolumeInput)
  const results = new RunResults()
  const challenge = new ChallengeRun()
  const debug = isDebugEnabled() ? new DebugOverlay(world.scene) : null
  debug?.syncPad()

  let disposed = false
  let contextLost = false
  let resizeFrame: number | null = null
  const disposeRuntime = (): void => {
    if (disposed) return
    disposed = true
    releaseBrowserUi()
    uiListeners.dispose()
    menu.dispose()
    results.dispose()
    input.dispose()
    reducedMotionQuery?.removeEventListener?.('change', onReducedMotionChange)
    cameras.dispose()
    audio.dispose()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    document.removeEventListener('visibilitychange', onFlightVisibilityPause)
    window.removeEventListener('blur', onWindowBlur)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    window.removeEventListener('keydown', onGlobalKeyDown, true)
    window.removeEventListener('resize', onResize)
    if (resizeFrame !== null) {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = null
    }
    canvas.removeEventListener('webglcontextlost', onContextLost)
    canvas.removeEventListener('webglcontextrestored', onContextRestored)
    world.dispose()
    crashFx.dispose()
    landingFx.dispose()
    disposeAircraftObject(aircraft.mesh)
    renderer.dispose()
  }
  window.addEventListener('beforeunload', disposeRuntime, { once: true })

  let playing = false
  let banner: string | null = null
  let bannerTone: HudBannerTone = 'info'
  let bannerUntil = 0
  let wasAirborne = false
  let prevAfterburner = false
  let prevGearDown = true
  let prevLightning = false
  let audioMuted = false
  const onVisibilityChange = (): void => {
    if (document.hidden) {
      audio.silence()
      return
    }
    if (playing && !menu.paused && !results.open) void audio.resume()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  const audioFrame: Parameters<FlightAudio['update']>[0] = {
    throttle: 0,
    boost: false,
    speed: 0,
    rain: 0,
    snow: 0,
    mute: true,
    dt: 1 / 60,
  }
  const hudFrame: Parameters<HUD['update']>[0] = {
    y: 0,
    verticalSpeed: 0,
    speed: 0,
    cameraMode: '',
    heading: 0,
    audioMuted: false,
    fps: 0,
    throttle: 0,
    boost: false,
    gearDown: false,
    onGround: false,
    pitch: 0,
    roll: 0,
    warning: null,
    warningLevel: 'none',
    clock: '',
    weather: '',
    dayPhase: '',
    mission: '',
    navDist: 0,
    navBearing: null,
    navAltDelta: 0,
    banner: null,
    bannerTone: 'info',
    flightPathVisible: false,
    flightPathX: 50,
    flightPathY: 50,
  }
  let prevWarning: string | null = null

  const courseId = (): string => `seed:${world.worldSeed}`

  let lastInputContextLive: boolean | null = null
  const syncInputContext = (): void => {
    const live = playing && !menu.paused && !results.open
    if (live === lastInputContextLive) return
    lastInputContextLive = live
    input.flightLive = live
    setFlightKeyCapture(live)
  }

  const showBanner = (text: string, ms = 2800, tone: HudBannerTone = 'info'): void => {
    banner = text
    bannerTone = tone
    bannerUntil = performance.now() + ms
  }

  const onContextLost = (event: Event): void => {
    // Prevent the browser from discarding the context before Three.js can
    // participate in its restore path. Rendering is gated until restoration.
    event.preventDefault()
    contextLost = true
    showBanner('GRAPHICS PAUSED / RECOVERING', 8000, 'danger')
  }
  const onContextRestored = (): void => {
    contextLost = false
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.needsUpdate = true
      shadowUpdateElapsed = SHADOW_UPDATE_STEP
    }
    showBanner('GRAPHICS RECOVERED', 1800, 'success')
  }
  canvas.addEventListener('webglcontextlost', onContextLost, false)
  canvas.addEventListener('webglcontextrestored', onContextRestored, false)

  const resetFlight = (newWorld: boolean, briefing = false): void => {
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
    landingFx.reset()
    input.clearQueued()
    input.resetFlightControls(0)
    challenge.reset(courseId(), world.mission.totalGates)
    banner = null
    bannerTone = 'info'
    wasAirborne = false
    prevAfterburner = false
    prevGearDown = aircraft.controls.gearDown
    prevLightning = false
    prevWarning = null
    time.reset()
    if (briefing) showBanner('SPOOL ENGINE / W TO ROTATE', 5000)
  }

  const startGame = (): void => {
    if (playing) return
    playing = true
    world.setSettlementsVisible(true)
    menu.close()
    results.hide()
    titleScreen?.classList.add('is-hidden')
    if (overlay) {
      overlay.hidden = false
      overlay.classList.remove('overlay-hidden')
    }
    resetFlight(false, true)
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
    world.setSettlementsVisible(false)
    audioMuted = false
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

  uiListeners.add(playBtn, 'click', () => startGame())
  uiListeners.add(document.getElementById('btn-controls'), 'click', () => {
    menu.showTitlePage('controls')
  })
  uiListeners.add(document.getElementById('btn-info'), 'click', () => {
    menu.showTitlePage('info')
  })
  uiListeners.add(document.getElementById('menu-resume'), 'click', () => {
    menu.close()
    input.clearQueued()
    time.reset()
    syncInputContext()
  })
  uiListeners.add(document.getElementById('menu-retry'), 'click', () => {
    menu.close()
    resetFlight(false, true)
    syncInputContext()
  })
  uiListeners.add(document.getElementById('menu-new-world'), 'click', () => {
    menu.close()
    resetFlight(true, true)
    syncInputContext()
  })
  uiListeners.add(document.getElementById('menu-quit'), 'click', () => quitToTitle())
  uiListeners.add(document.getElementById('btn-retry'), 'click', () => {
    resetFlight(false, true)
    syncInputContext()
  })
  uiListeners.add(document.getElementById('btn-new-world'), 'click', () => {
    resetFlight(true, true)
    syncInputContext()
  })
  uiListeners.add(document.getElementById('menu-fullscreen'), 'click', () => {
    toggleGameFullscreen()
  })
  uiListeners.add(document.getElementById('menu-open-controls'), 'click', () => {
    menu.showView('controls')
  })
  uiListeners.add(document.getElementById('menu-open-info'), 'click', () => {
    menu.showView('info')
  })
  menuEl.querySelectorAll('[data-menu-close]').forEach((el) => {
    uiListeners.add(el, 'click', () => menu.close())
  })
  menuEl.querySelectorAll('.menu-back').forEach((el) => {
    uiListeners.add(el, 'click', () => menu.back())
  })

  const onGlobalKeyDown = (e: KeyboardEvent): void => {
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
      if (e.code === 'KeyR') {
        e.preventDefault()
        resetFlight(true, true)
        syncInputContext()
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault()
        resetFlight(false, true)
        syncInputContext()
      }
      return
    }
    if (!playing && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
      if (e.code === 'Space') e.preventDefault()
      startGame()
    }
  }
  window.addEventListener('keydown', onGlobalKeyDown, true)

  const onFullscreenChange = (): void => {
    menu.syncFullscreen()
    if (!document.fullscreenElement && shouldReenterFullscreen(
      false,
      playing && !menu.paused && !results.open,
    )) {
      showBanner('CLICK TO RE-ENTER FULLSCREEN', 5000)
    }
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
  }
  document.addEventListener('fullscreenchange', onFullscreenChange)

  const applyResize = (): void => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h, false)
    cameras.resize(w, h)
  }
  const onResize = (): void => {
    if (resizeFrame !== null) return
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null
      if (disposed) return
      applyResize()
    })
  }
  window.addEventListener('resize', onResize)
  applyResize()

  let previousFrame = 0
  const tick = (nowMs: number): void => {
    if (disposed) return
    requestAnimationFrame(tick)

    syncInputContext()
    const simLive = playing && !menu.paused && !results.open
    const pixelRatio = resolution.update(nowMs - previousFrame, simLive && !document.hidden)
    previousFrame = nowMs
    if (Math.abs(renderer.getPixelRatio() - pixelRatio) > .001) renderer.setPixelRatio(pixelRatio)
    let visualDt = 0
    let simDt = 0
    if (!simLive) {
      time.skipFrame(nowMs)
      aircraft.controls = input.sampleWithDt(0)
      if (!playing) input.resetFlightControls(0)
      aircraft.snapDisplay()
    } else {
      const { frameDt, steps, stepDt, alpha } = time.beginFrame(nowMs)
      visualDt = frameDt
      simDt = steps * stepDt
      const dt = stepDt

      if (input.consumeCameraToggle()) {
        const mode = cameras.toggleMode(aircraft)
        showBanner(cameraModeCue(mode), 1200, 'info')
      }
      if (input.consumeWeatherCycle()) world.cycleWeather()
      if (input.consumeReset()) resetFlight(true, true)
      if (input.consumeAudioToggle()) {
        audioMuted = !audioMuted
        if (audioMuted) audio.silence()
        showBanner(audioMuted ? 'AUDIO MUTED' : 'AUDIO LIVE', 1200)
      }

      for (let i = 0; i < steps; i++) {
        aircraft.capturePrevious()
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
            showBanner('CRASH - press R', 4200, 'danger')
            break
          }
          const scoredTouch =
            touch === 'landed' ||
            (touch === 'roll' && challenge.phase === 'returning')
          if (touch === 'landed' && wasAirborne) {
            cameras.impulse(TOUCHDOWN_IMPULSE)
            landingFx.trigger(aircraft.position, aircraft.velocity, 1)
          } else if (touch === 'roll' && wasAirborne) {
            landingFx.trigger(aircraft.position, aircraft.velocity, 0.62)
          }
          if (aircraft.onGround && (touch === 'roll' || touch === 'landed')) {
            landingFx.scrub(aircraft.position, aircraft.velocity, dt)
          }
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
              showBanner('LANDED', 2800, 'success')
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
            showBanner('GATE CLEAR', 1200, 'success')
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
      aircraft.present(alpha)
    }

    if (shouldAdvanceWorld(simLive, simDt, visualDt)) {
      world.update(
        aircraft.displayPosition.x,
        aircraft.displayPosition.y,
        aircraft.displayPosition.z,
        Math.max(visualDt, 1 / 120),
        simDt,
        visualDt,
      )
    }
    const phase = world.atmosphere.phaseLabel
    const baseExp =
      phase === 'NIGHT' ? 0.95 : phase === 'DUSK' || phase === 'DAWN' ? 1.05 : 1.15
    const exposure = baseExp + crashFx.bloom * 1.35
    if (Math.abs(renderer.toneMappingExposure - exposure) > 0.001) {
      renderer.toneMappingExposure = exposure
    }
    aircraft.setNightReadability(world.atmosphere.daylight)
    crashFx.update(simLive ? visualDt : 0)
    landingFx.update(simLive ? visualDt : 0)

    const lightningActive = world.atmosphere.lightningActive
    if (
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed' &&
      lightningActive &&
      !prevLightning
    ) {
      audio.playCue('thunder')
    }
    prevLightning = lightningActive

    const gearDown = aircraft.controls.gearDown
    if (
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed' &&
      gearDown !== prevGearDown
    ) {
      audio.playCue(gearDown ? 'gear-down' : 'gear-up')
    }
    prevGearDown = gearDown

    const afterburnerOn = aircraft.engineState.afterburnerActive
    if (
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed' &&
      afterburnerOn &&
      !prevAfterburner
    ) {
      audio.playCue('ab')
    }
    prevAfterburner = afterburnerOn

    audioFrame.throttle = aircraft.engineState.lever
    audioFrame.boost = afterburnerOn
    audioFrame.speed = aircraft.speed
    const precipitation = world.atmosphere.weatherSnapshot
    audioFrame.rain = precipitation.rain
    audioFrame.snow = precipitation.snow
    audioFrame.mute =
      audioMuted || document.hidden || !playing || menu.paused || results.open || aircraft.status === 'crashed'
    audioFrame.dt = visualDt || 1 / 60
    audio.update(audioFrame)

    // A hidden tab cannot present a frame. Keep simulation and streaming alive,
    // but avoid submitting camera/debug/render work until the tab is visible.
    if (shouldRenderFrame(document.hidden, contextLost)) {
      if (renderer.shadowMap.enabled) {
        shadowUpdateElapsed += Math.max(0, visualDt)
        if (shadowUpdateDue(shadowUpdateElapsed, 0, SHADOW_UPDATE_STEP)) {
          renderer.shadowMap.needsUpdate = true
          shadowUpdateElapsed %= SHADOW_UPDATE_STEP
        }
      }
      cameras.update(aircraft, visualDt)
      renderer.render(world.scene, cameras.camera)
      debug?.update(aircraft, world.spawn, cameras.modeLabel, time.fps)
    }

    if (shouldUpdateLiveHud(playing, simLive)) {
      const alt = aircraft.onGround
        ? 0
        : altitudeAgl(
            aircraft.position.x,
            aircraft.position.y,
            aircraft.position.z,
            aircraft.controls.gearDown,
          )
      const pose = attitudeFromOrientation(aircraft.orientation)
      const warn = evaluateWarnings(aircraft, alt)
      if (warn.text !== prevWarning) {
        if (warn.text) audio.playCue('warning')
        prevWarning = warn.text
      }
      const nav = world.mission.hud(
        aircraft.position.x,
        aircraft.position.y,
        aircraft.position.z,
      )
      const gate = world.mission.activeGatePos()
      if (cameras.mode === 'cockpit') {
        writeFlightPathMarker(
          cameras.camera,
          cameras.camera.position,
          aircraft.velocity,
          flightPathMarker,
        )
      } else {
        flightPathMarker.visible = false
      }
      hudFrame.y = alt
      hudFrame.verticalSpeed = aircraft.onGround ? 0 : aircraft.velocity.y
      hudFrame.speed = aircraft.speed
      hudFrame.cameraMode = cameras.modeLabel
      hudFrame.fps = time.fps
      hudFrame.throttle = aircraft.engineState.lever
      hudFrame.boost = aircraft.engineState.afterburnerActive
      hudFrame.gearDown = aircraft.controls.gearDown
      hudFrame.onGround = aircraft.onGround
      hudFrame.pitch = pose.pitch
      hudFrame.roll = pose.roll
      hudFrame.heading = pose.heading
      hudFrame.audioMuted = audioMuted
      hudFrame.warning = warn.text
      hudFrame.warningLevel = warn.level
      hudFrame.clock = challenge.clockLabel
      hudFrame.weather = world.atmosphere.weatherLabel
      hudFrame.dayPhase = world.atmosphere.phaseLabel
      hudFrame.mission = challenge.objectiveLabel
      hudFrame.navDist = nav.dist
      hudFrame.navBearing = gateScreenBearing(cameras.camera, gate)
      hudFrame.navAltDelta = nav.altDelta
      hudFrame.banner = aircraft.status === 'crashed' ? 'CRASH - press R' : banner
      hudFrame.bannerTone = aircraft.status === 'crashed' ? 'danger' : bannerTone
      hudFrame.flightPathVisible = flightPathMarker.visible
      hudFrame.flightPathX = flightPathMarker.x
      hudFrame.flightPathY = flightPathMarker.y
      hud.update(hudFrame)
    }
  }

  const pauseForLostFocus = (): void => {
    if (!shouldPauseForFocusLost(playing, menu.paused, results.open)) return
    menu.openPause()
    input.clearQueued()
    time.reset()
    syncInputContext()
  }
  const onWindowBlur = (): void => pauseForLostFocus()
  const onFlightVisibilityPause = (): void => {
    if (document.hidden) pauseForLostFocus()
  }
  document.addEventListener('visibilitychange', onFlightVisibilityPause)
  window.addEventListener('blur', onWindowBlur)

  challenge.reset(courseId(), world.mission.totalGates)
  syncInputContext()
  // The procedural F-35 is the immediate playable path. If an optional GLB
  // exists, let it hydrate in the background instead of blocking the title
  // screen on a missing or slow asset request.
  void aircraft.tryLoadModel('/models/f35.glb')
  requestAnimationFrame(tick)
}

const _fwd = new Vector3()
const _gateView = new Vector3()
const _inv = new Quaternion()
const _localUp = new Vector3()
const _attitude = { pitch: 0, roll: 0, heading: 0 }
const flightPathMarker: FlightPathMarkerPosition = {
  x: 50,
  y: 50,
  visible: false,
}

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

  _attitude.pitch = pitch
  _attitude.roll = roll
  _attitude.heading = heading
  return _attitude
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
