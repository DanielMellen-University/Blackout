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
import { Aircraft } from './aircraft/Aircraft'
import { FUEL_AFTERBURNER_RESERVE_FRACTION } from './aircraft/FuelSystem'
import {
  cameraModeCue,
  cameraRelativeBearing,
  CameraSystem,
  TOUCHDOWN_IMPULSE,
} from './camera/CameraSystem'
import {
  shouldShowFlightPathMarker,
  writeFlightPathMarker,
  type FlightPathMarkerPosition,
} from './camera/FlightPathMarker'
import { InputManager } from './core/InputManager'
import { copyWorldSeedLink, formatWorldSeed, parseWorldSeed } from './core/WorldSeed'
import { TouchControls, touchInputSupported } from './core/TouchControls'
import {
  lockGameKeyboard,
  lockKeysOnly,
  setFlightKeyCapture,
  shouldPauseForFullscreenExit,
  shouldReenterFullscreen,
  suppressBrowserUi,
  toggleGameFullscreen,
} from './core/suppressBrowserUi'
import {
  shouldAdvanceWorld,
  shouldPauseForContextLoss,
  shouldPauseForFocusLost,
  shouldRenderFrame,
  shouldUpdateLiveHud,
  Time,
} from './core/Time'
import {
  ChallengeRun,
  courseMasteryTierForProgress,
  COURSE_BADGES_STORAGE_PREFIX,
  COURSE_BEST_STORAGE_PREFIX,
  COURSE_HISTORY_STORAGE_PREFIX,
  COURSE_STREAK_STORAGE_PREFIX,
  landingWeatherRisk,
  landingQualityForMetrics,
  MASTERY_BADGE_COUNT,
  repairBestCoursePrecisionStreak,
  repairBestCourseScore,
  repairCourseHistory,
  repairMasteryBadges,
} from './systems/ChallengeRun'
import {
  courseDefinitionForId,
  courseRunId,
  COURSE_LIBRARY,
  COURSE_SELECTION_STORAGE_KEY,
  courseSessionId,
  readSelectedCourseId,
  writeSelectedCourseId,
  type CourseId,
} from './systems/CourseLibrary'
import { CollisionSystem } from './systems/Collision'
import { CrashFx } from './systems/CrashFx'
import { LandingFx } from './systems/LandingFx'
import { StuntTracker } from './systems/StuntTracker'
import { FlightComboTracker, type FlightComboEvent } from './systems/FlightCombo'
import { AltitudeMilestoneTracker } from './systems/AltitudeMilestones'
import { FlightAudio, gLoadCueBand, type GLoadCueBand } from './audio/FlightAudio'
import {
  GLoadFeedbackTracker,
  gLoadVisionBanner,
  type GLoadVisionBand,
} from './systems/GLoadFeedback'
import { SupersonicTracker } from './systems/Supersonic'
import { GhostReplay } from './systems/GhostReplay'
import {
  audioVolumePercent,
  normalizeAudioVolume,
  readAudioVolume,
  writeAudioVolume,
} from './audio/AudioPreferences'
import { evaluateWarnings } from './systems/FlightWarnings'
import { gateQualityLabel } from './systems/Mission'
import { isDebugEnabled } from './debug/debugFlags'
import { DebugOverlay } from './debug/DebugOverlay'
import { CoursePicker, courseMasteryProgressLabel, coursePickerCopy } from './ui/CoursePicker'
import { GameMenu } from './ui/GameMenu'
import {
  FLIGHT_CONTROLS_HINT,
  createMissionHudLabelCache,
  hudBackgroundHidden,
  HUD,
  machNumber,
  routeRiskAriaLabel,
  routeRiskHudLabel,
  engineHeatBanner,
  engineHeatCue,
  engineHeatRearmBanner,
  engineFuelAvailabilityBanner,
  emergencyReturnActive,
  crosswindDirection,
  crosswindSpeedMps,
  navigationApproachCue,
  navigationLateralCue,
  navigationSpeedCue,
  navigationGlideCue,
  weatherCycleBanner,
  waterSurfaceCue,
  type CrosswindSide,
  type HudBannerTone,
  type NavigationLateralCue,
  type NavigationSpeedCue,
  type NavigationGlideCue,
} from './ui/HUD'
import { flightRecordCueLabel, RunResults } from './ui/RunResults'
import {
  RADAR_RANGE_METERS,
  RADAR_UPDATE_INTERVAL_MS,
  radarUpdateDue,
  radarDiscoveryLabel,
  radarTargetArrivalLabel,
  radarTargetArrivalRadius,
  RadarSystem,
} from './systems/RadarSystem'
import { altitudeAgl, type GroundSurfaceSample } from './world/ground'
import { sampleTerrainSurface } from './world/terrainSample'
import { refuelFuel } from './aircraft/FuelSystem'
import { World } from './world/World'
import { AdaptiveResolution } from './core/AdaptiveResolution'
import { sceneExposure } from './core/SceneExposure'
import { ListenerBag } from './core/ListenerBag'
import { startupFailureMessage } from './core/startupFailure'
import { appReleaseLabel } from './core/Version'
import { headingFromOrientation } from './core/attitude'
import {
  keyboardYawPreferenceLabel,
  normalizeKeyboardYawPreference,
  readKeyboardYawPreference,
  writeKeyboardYawPreference,
  keyboardRollPreferenceLabel,
  normalizeKeyboardRollPreference,
  readKeyboardRollPreference,
  writeKeyboardRollPreference,
  keyboardPitchPreferenceLabel,
  normalizeKeyboardPitchPreference,
  readKeyboardPitchPreference,
  writeKeyboardPitchPreference,
  type KeyboardPitchPreference,
  type KeyboardRollPreference,
  type KeyboardYawPreference,
} from './core/FlightPreferences'
import {
  defaultRenderQuality,
  hudUpdateDue,
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
  const titleVersion = document.getElementById('title-version')
  if (titleVersion) titleVersion.textContent = appReleaseLabel()
  const playBtn = document.getElementById('btn-play') as HTMLButtonElement | null
  const overlay = document.getElementById('overlay')
  const menuEl = document.getElementById('menu')
  const titleCoursePickerRoot = document.getElementById('title-course-picker')
  const menuCoursePickerRoot = document.getElementById('menu-course-picker')
  const qualitySelect = document.getElementById('menu-quality') as HTMLSelectElement | null
  const yawSelect = document.getElementById('menu-yaw') as HTMLSelectElement | null
  const rollSelect = document.getElementById('menu-roll') as HTMLSelectElement | null
  const pitchSelect = document.getElementById('menu-pitch') as HTMLSelectElement | null
  const yawLabel = document.getElementById('controls-yaw-label')
  const rollLabel = document.getElementById('controls-roll-label')
  const pitchLabel = document.getElementById('controls-pitch-label')
  const volumeRange = document.getElementById('menu-volume') as HTMLInputElement | null
  const volumeValue = document.getElementById('menu-volume-value')
  const touchRoot = document.getElementById('touch-controls')
  if (!menuEl) throw new Error('#menu not found')
  if (!titleCoursePickerRoot || !menuCoursePickerRoot) throw new Error('course picker not found')
  const menu = new GameMenu(menuEl, canvas)
  const uiListeners = new ListenerBag()
  const coursePickers = [
    new CoursePicker(titleCoursePickerRoot),
    new CoursePicker(menuCoursePickerRoot),
  ]

  let qualityStorage: Storage | null = null
  try {
    qualityStorage = window.localStorage
  } catch {
    /* Private browsing can deny storage. The game remains fully playable. */
  }

  let selectedCourseId: CourseId = readSelectedCourseId(qualityStorage)
  const replayCourseId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('course')
    : null
  let replaySeed = parseWorldSeed(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('seed') : null,
  )
  if (replaySeed !== null) selectedCourseId = courseDefinitionForId(replayCourseId).id

  type CourseRecordSnapshot = {
    history: ReturnType<typeof repairCourseHistory>
    bestScore: number
    badgeCount: number
    bestPrecisionStreak: number
  }
  const courseRecordCache = new Map<string, CourseRecordSnapshot>()
  const readCourseRecord = (runId: string): CourseRecordSnapshot => {
    const cached = courseRecordCache.get(runId)
    if (cached) return cached
    const snapshot: CourseRecordSnapshot = {
      history: repairCourseHistory(qualityStorage, runId),
      bestScore: repairBestCourseScore(qualityStorage, runId),
      badgeCount: repairMasteryBadges(qualityStorage, runId).length,
      bestPrecisionStreak: repairBestCoursePrecisionStreak(qualityStorage, runId),
    }
    courseRecordCache.set(runId, snapshot)
    return snapshot
  }

  const refreshCourseSelectorLabels = (): void => {
    const items = COURSE_LIBRARY.map((course) => {
      const runId = courseRunId(course)
      const record = runId ? readCourseRecord(runId) : null
      const copy = coursePickerCopy({
        course,
        history: record?.history ?? null,
        bestScore: record?.bestScore ?? 0,
        badgeCount: record?.badgeCount ?? 0,
        bestPrecisionStreak: record?.bestPrecisionStreak ?? 0,
      })
      return {
        id: course.id,
        label: course.label,
        detail: copy.detail,
        meta: copy.meta,
        stats: copy.stats,
      }
    })
    for (const picker of coursePickers) picker.setItems(items, selectedCourseId)
  }
  const releaseBrowserUi = suppressBrowserUi(canvas)
  const titleStatus = document.getElementById('title-status')
  const titleProgress = document.getElementById('title-progress')
  const refreshCourseProgress = (): void => {
    if (!titleProgress) return
    const curated = COURSE_LIBRARY.filter((course) => course.seed !== null && course.profile !== null)
    let completed = 0
    let earnedBadges = 0
    let mastered = 0
    for (const course of curated) {
      const runId = courseRunId(course)
      if (!runId) continue
      const record = readCourseRecord(runId)
      const history = record.history
      const runCount = history?.completionCount ?? 0
      if (runCount > 0) completed += 1
      earnedBadges += record.badgeCount
      if (courseMasteryTierForProgress({
        completionCount: runCount,
        bestScore: record.bestScore,
        badgeCount: record.badgeCount,
        contractWins: history?.contractWins,
        landingQuality: history?.landingQuality,
      }) === 'legend') mastered += 1
    }
    const badgeTotal = curated.length * MASTERY_BADGE_COUNT
    const masteryLabel = courseMasteryProgressLabel(mastered, curated.length)
    titleProgress.textContent = `COURSES ${completed}/${curated.length} COMPLETE · BADGES ${earnedBadges}/${badgeTotal} · ${masteryLabel}`
    titleProgress.setAttribute(
      'aria-label',
      `${completed} of ${curated.length} curated courses complete, ${earnedBadges} of ${badgeTotal} mastery badges earned, ${mastered} of ${curated.length} at Legend mastery`,
    )
  }
  const refreshCourseUi = (): void => {
    courseRecordCache.clear()
    refreshCourseSelectorLabels()
    refreshCourseProgress()
  }
  refreshCourseUi()
  if (playBtn) playBtn.disabled = true

  const renderQualityFallback = defaultRenderQuality({
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  })
  let renderQuality: RenderQuality = readRenderQuality(qualityStorage, renderQualityFallback)
  const initialAudioVolume = readAudioVolume(qualityStorage)
  const initialKeyboardYaw = readKeyboardYawPreference(qualityStorage)
  const initialKeyboardRoll = readKeyboardRollPreference(qualityStorage)
  const initialKeyboardPitch = readKeyboardPitchPreference(qualityStorage)
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
  let applyAircraftQuality: ((quality: RenderQuality) => void) | null = null
  let applyEffectsQuality: ((quality: RenderQuality) => void) | null = null
  let applyEffectsMotion: ((reduced: boolean) => void) | null = null
  let applyCameraQuality: ((quality: RenderQuality) => void) | null = null
  let applyRadarQuality: ((quality: RenderQuality) => void) | null = null
  let applyRadarMotion: ((reduced: boolean) => void) | null = null
  let applyShadowQuality: ((mapSize: number) => void) | null = null
  const SHADOW_UPDATE_STEP = 1 / 20
  let shadowUpdateElapsed = SHADOW_UPDATE_STEP

  const applyRenderQuality = (next: RenderQuality): void => {
    renderQuality = next
    const profile = renderQualityProfile(next)
    document.documentElement.classList.toggle('quality-lite', !profile.uiBackdropBlur)
    resolution.setCeiling(profile.maxPixelRatio)
    renderer.setPixelRatio(resolution.ratio)
    applyShadowQuality?.(profile.shadowMapSize)
    applyAircraftQuality?.(next)
    applyEffectsQuality?.(next)
    applyCameraQuality?.(next)
    applyRadarQuality?.(next)
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
  if (replaySeed !== null) {
    const replayCourse = courseDefinitionForId(selectedCourseId)
    world.reseed(replaySeed, replayCourse.profile ?? undefined)
  }
  applyShadowQuality = (mapSize: number): void => {
    const safeSize = Number.isFinite(mapSize) ? Math.max(256, Math.floor(mapSize)) : 1024
    if (world.sun.shadow.mapSize.x === safeSize && world.sun.shadow.mapSize.y === safeSize) return
    world.sun.shadow.mapSize.set(safeSize, safeSize)
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.needsUpdate = true
      shadowUpdateElapsed = SHADOW_UPDATE_STEP
    }
  }
  applyShadowQuality(initialQualityProfile.shadowMapSize)
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
  applyAircraftQuality = (quality): void => aircraft.setRenderQuality(quality)
  applyAircraftQuality(renderQuality)
  aircraft.addTo(world.scene)
  // Place jet on the flat-biome airfield chosen at world reseed
  aircraft.reset(world.spawn)

  const cameras = new CameraSystem(canvas)
  cameras.attachToScene(world.scene)
  cameras.setObstacleSampler((x, y, z) => world.hitObstacle(x, y, z))
  // Seed the chase rig before the first title frame. Without an explicit pose
  // here, the paused title loop has no render delta to drive CameraSystem and
  // the hero camera stays at the origin until Play is pressed.
  cameras.setMode('chase', aircraft)
  cameras.setTitleFraming(aircraft)
  applyCameraQuality = (quality): void => cameras.setRenderQuality(quality)
  applyCameraQuality(renderQuality)
  const reducedMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null
  let reducedMotion = false
  const syncReducedMotion = (): void => {
    reducedMotion = !!reducedMotionQuery?.matches
    aircraft.setReducedMotion(reducedMotion)
    cameras.setReducedMotion(reducedMotion)
    world.atmosphere.setReducedMotion(reducedMotion)
    applyEffectsMotion?.(reducedMotion)
    applyRadarMotion?.(reducedMotion)
  }
  const onReducedMotionChange = (): void => syncReducedMotion()
  reducedMotionQuery?.addEventListener?.('change', onReducedMotionChange)
  const input = new InputManager()
  input.setKeyboardYawPreference(initialKeyboardYaw)
  input.setKeyboardRollPreference(initialKeyboardRoll)
  input.setKeyboardPitchPreference(initialKeyboardPitch)
  if (yawSelect) yawSelect.value = initialKeyboardYaw
  if (rollSelect) rollSelect.value = initialKeyboardRoll
  if (pitchSelect) pitchSelect.value = initialKeyboardPitch
  const touchDevice = touchInputSupported(
    typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
  )
  const touchControls = touchRoot && touchDevice
    ? new TouchControls(touchRoot, (state) => input.setTouchState(state))
    : null
  const time = new Time()
  const hud = new HUD()
  const missionLabelCache = createMissionHudLabelCache()
  const collision = new CollisionSystem((jet) =>
    world.hitObstacle(jet.position.x, jet.position.y, jet.position.z),
  )
  const crashFx = new CrashFx(world.scene)
  const landingFx = new LandingFx(world.scene)
  applyEffectsQuality = (quality): void => {
    crashFx.setRenderQuality(quality)
    landingFx.setRenderQuality(quality)
  }
  applyEffectsMotion = (reduced): void => {
    crashFx.setReducedMotion(reduced)
    landingFx.setReducedMotion(reduced)
  }
  applyEffectsQuality(renderQuality)
  syncReducedMotion()
  const audio = new FlightAudio()
  const applyKeyboardYaw = (next: KeyboardYawPreference): void => {
    const preference = normalizeKeyboardYawPreference(next)
    input.setKeyboardYawPreference(preference)
    if (yawSelect) yawSelect.value = preference
    if (yawLabel) yawLabel.textContent = `Yaw (${keyboardYawPreferenceLabel(preference)})`
    writeKeyboardYawPreference(qualityStorage, preference)
  }
  applyKeyboardYaw(initialKeyboardYaw)
  const onKeyboardYawChange = (): void => {
    if (!yawSelect) return
    applyKeyboardYaw(yawSelect.value as KeyboardYawPreference)
    if (playing && !menu.paused && !results.open) {
      showBanner(`KEYBOARD YAW ${keyboardYawPreferenceLabel(input.keyboardYaw)}`, 1500, 'info')
    }
  }
  uiListeners.add(yawSelect, 'change', onKeyboardYawChange)
  const applyKeyboardRoll = (next: KeyboardRollPreference): void => {
    const preference = normalizeKeyboardRollPreference(next)
    input.setKeyboardRollPreference(preference)
    if (rollSelect) rollSelect.value = preference
    if (rollLabel) rollLabel.textContent = `Roll (${keyboardRollPreferenceLabel(preference)})`
    writeKeyboardRollPreference(qualityStorage, preference)
  }
  applyKeyboardRoll(initialKeyboardRoll)
  const onKeyboardRollChange = (): void => {
    if (!rollSelect) return
    applyKeyboardRoll(rollSelect.value as KeyboardRollPreference)
    if (playing && !menu.paused && !results.open) {
      showBanner(`KEYBOARD ROLL ${keyboardRollPreferenceLabel(input.keyboardRoll)}`, 1500, 'info')
    }
  }
  uiListeners.add(rollSelect, 'change', onKeyboardRollChange)
  const applyKeyboardPitch = (next: KeyboardPitchPreference): void => {
    const preference = normalizeKeyboardPitchPreference(next)
    input.setKeyboardPitchPreference(preference)
    if (pitchSelect) pitchSelect.value = preference
    if (pitchLabel) pitchLabel.textContent = `Pitch (${keyboardPitchPreferenceLabel(preference)})`
    writeKeyboardPitchPreference(qualityStorage, preference)
  }
  applyKeyboardPitch(initialKeyboardPitch)
  const onKeyboardPitchChange = (): void => {
    if (!pitchSelect) return
    applyKeyboardPitch(pitchSelect.value as KeyboardPitchPreference)
    if (playing && !menu.paused && !results.open) {
      showBanner(`KEYBOARD PITCH ${keyboardPitchPreferenceLabel(input.keyboardPitch)}`, 1500, 'info')
    }
  }
  uiListeners.add(pitchSelect, 'change', onKeyboardPitchChange)
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
  const ghost = new GhostReplay(world.scene, qualityStorage)
  const stunts = new StuntTracker()
  const combo = new FlightComboTracker()
  const altitudeMilestones = new AltitudeMilestoneTracker()
  const supersonic = new SupersonicTracker()
  const radar = new RadarSystem()
  applyRadarQuality = (quality): void => radar.setRenderQuality(quality)
  applyRadarQuality(renderQuality)
  applyRadarMotion = (reduced): void => radar.setReducedMotion(reduced)
  applyRadarMotion(reducedMotion)
  const debug = isDebugEnabled() ? new DebugOverlay(world.scene) : null
  debug?.syncPad()

  let disposed = false
  let contextLost = false
  let resizeFrame: number | null = null
  const shareReplayButton = document.getElementById('btn-share-replay') as HTMLButtonElement | null
  results.setShareReplayHandler(() => {
    const seed = world.worldSeed
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    const href = typeof window !== 'undefined' ? window.location.href : ''
    void copyWorldSeedLink(seed, clipboard, href, selectedCourseId).then((copied) => {
      if (disposed || !shareReplayButton) return
      shareReplayButton.textContent = copied ? 'Replay link copied' : 'Copy blocked'
      shareReplayButton.setAttribute(
        'aria-label',
        copied ? 'Replay link copied' : 'Copy replay link blocked by browser permissions',
      )
    })
  })
  const disposeRuntime = (): void => {
    if (disposed) return
    disposed = true
    releaseBrowserUi()
    uiListeners.dispose()
    for (const picker of coursePickers) picker.dispose()
    menu.dispose()
    results.dispose()
    touchControls?.dispose()
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
    ghost.dispose()
    world.dispose()
    crashFx.dispose()
    landingFx.dispose()
    debug?.dispose()
    aircraft.dispose()
    renderer.dispose()
  }
  window.addEventListener('beforeunload', disposeRuntime, { once: true })

  let playing = false
  let banner: string | null = null
  let crashMessage = 'CRASH - press R'
  let bannerTone: HudBannerTone = 'info'
  let bannerUntil = 0
  let wasAirborne = false
  let prevAfterburner = false
  let prevAirbrake = false
  let prevAfterburnerLockout = false
  let prevAfterburnerHeatLockout = false
  let prevFuelAvailable = true
  let engineOut = false
  let prevGearDown = true
  let prevLightning = false
  let prevGLoadBand: GLoadCueBand = 'normal'
  let gLoadCueUntil = 0
  const gLoadFeedback = new GLoadFeedbackTracker()
  let prevGLoadVision: GLoadVisionBand | null = null
  let audioMuted = false
  const onVisibilityChange = (): void => {
    if (document.hidden) {
      audio.silence()
      void audio.suspend()
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
    cockpit: false,
  }
  const hudFrame: Parameters<HUD['update']>[0] = {
    y: 0,
    verticalSpeed: 0,
    gForce: 1,
    flightDistanceM: 0,
    peakPositiveG: 1,
    peakNegativeG: 0,
    mach: 0,
    speed: 0,
    cameraMode: '',
    heading: 0,
    audioMuted: false,
    fps: 0,
    throttle: 0,
    engineHeat: 0,
    fuel: 1,
    refueling: false,
    landingPreview: null,
    boost: false,
    gearDown: false,
    onGround: false,
    flightState: 'ground',
    pitch: 0,
    roll: 0,
    rain: 0,
    snow: 0,
    warning: null,
    warningLevel: 'none',
    clock: '',
    weather: '',
    weatherKind: 'clear',
    weatherTransitioning: false,
    windX: 0,
    windZ: 0,
    dayPhase: '',
    mission: '',
    routeRisk: '',
    routeRiskAria: '',
    missionPhase: 'ready',
    ghostPace: null,
    contractLabel: '',
    contractDetail: '',
    contractProgress: 0,
    contractComplete: false,
    contractFailed: false,
    contractStreak: 0,
    biomeCount: 0,
    navDist: 0,
    navBearing: null,
    navAltDelta: 0,
    combo: 0,
    radar: [],
    controlHint: null,
    timeMs: 0,
    banner: null,
    bannerTone: 'info',
    flightPathVisible: false,
    flightPathX: 50,
    flightPathY: 50,
  }
  let prevWarning: string | null = null
  let prevEngineHeat: 'normal' | 'hot' | 'critical' | null = null
  let controlHintUntilMs = 0
  const radarDiscovered = new Set<string>()
  let radarDiscoveryCooldownUntil = 0
  let radarTargetCycleQueued = false
  let radarNextUpdateMs = Number.NaN
  let radarContacts: ReturnType<RadarSystem['update']> = []
  const groundSurface: GroundSurfaceSample = { height: 0, kind: 'land' }
  let terrainClearanceM = 0
  let biomeSurveyCooldown = 0
  let overWater = false
  let refueling = false
  const returnTarget = new Vector3()

  const courseId = (): string => courseSessionId(
    selectedCourseId,
    world.worldSeed,
    world.mission.routeProfile,
  )

  let lastInputContextLive: boolean | null = null
  const syncInputContext = (): void => {
    const live = playing && !menu.paused && !results.open
    hud.setPaused(menu.paused)
    hud.setBackgroundHidden(hudBackgroundHidden(menu.open, results.open))
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

  const recordComboAction = (action: 'gate' | 'stunt'): FlightComboEvent | null => {
    const event = combo.record(action)
    if (!event) return null
    challenge.recordCombo(event.combo)
    return event
  }

  const onContextLost = (event: Event): void => {
    // Prevent the browser from discarding the context before Three.js can
    // participate in its restore path. Rendering is gated until restoration.
    event.preventDefault()
    contextLost = true
    showBanner('GRAPHICS PAUSED / RECOVERING', 8000, 'danger')
    if (shouldPauseForContextLoss(playing, menu.paused, results.open)) {
      audio.silence()
      menu.openPause('graphics')
      input.clearQueued()
      time.reset()
      syncInputContext()
    }
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
    const replaying = replaySeed !== null
    if (newWorld) {
      const course = courseDefinitionForId(selectedCourseId)
      world.reseed(replaying ? replaySeed! : course.seed ?? undefined, course.profile ?? undefined)
      replaySeed = null
      debug?.syncPad()
    } else {
      world.mission.start(
        world.spawn.x,
        world.spawn.y,
        world.spawn.z,
        world.spawn.yaw,
        world.mission.routeProfile,
      )
    }
    aircraft.reset(world.spawn)
    _stableHeading = world.spawn.yaw
    supersonic.reset(aircraft.speed)
    cameras.setMode(cameras.mode, aircraft)
    crashFx.reset()
    landingFx.reset()
    stunts.reset()
    combo.reset()
    altitudeMilestones.reset()
    input.clearQueued()
    input.resetFlightControls(0)
    challenge.reset(courseId(), world.mission.totalGates, world.mission.scoringFocus, world.worldSeed)
    ghost.reset(courseId())
    ghost.setVisible(playing)
    challenge.recordBiome(world.spawn.biome)
    banner = null
    crashMessage = 'CRASH - press R'
    bannerTone = 'info'
    wasAirborne = false
    prevAfterburner = false
    prevAfterburnerLockout = false
    prevAfterburnerHeatLockout = false
    prevFuelAvailable = true
    engineOut = false
    prevGearDown = aircraft.controls.gearDown
    prevLightning = false
    prevGLoadBand = 'normal'
    gLoadCueUntil = 0
    gLoadFeedback.reset(1)
    prevGLoadVision = null
    prevWarning = null
    prevEngineHeat = null
    radarDiscovered.clear()
    radarDiscoveryCooldownUntil = 0
    radar.clearTarget()
    radarTargetCycleQueued = false
    radarNextUpdateMs = Number.NaN
    radarContacts = []
    biomeSurveyCooldown = 0
    overWater = false
    refueling = false
    controlHintUntilMs = briefing ? performance.now() + 9000 : 0
    time.reset()
    if (briefing) {
      const resetLabel = newWorld
        ? replaying
          ? `REPLAY SEED ${formatWorldSeed(world.worldSeed)}`
          : 'NEW WORLD'
        : replaySeed !== null
          ? `REPLAY SEED ${formatWorldSeed(replaySeed)}`
          : 'RETRY SAME COURSE'
      const contractBriefing = challenge.contractBriefing
      showBanner(`${resetLabel} / SPOOL ENGINE / W TO ROTATE · ${world.mission.routeBriefing}${contractBriefing ? ` · ${contractBriefing}` : ''}`, 5000)
    }
  }

  const onCourseChange = (id: string): void => {
    selectedCourseId = courseDefinitionForId(id).id
    replaySeed = null
    writeSelectedCourseId(qualityStorage, selectedCourseId)
    for (const picker of coursePickers) picker.setValue(selectedCourseId)
  }
  for (const picker of coursePickers) picker.onChange(onCourseChange)
  const onProgressStorageChange = (event: Event): void => {
    const storageEvent = event as StorageEvent
    const key = storageEvent.key
    if (key === COURSE_SELECTION_STORAGE_KEY || key === null) {
      selectedCourseId = readSelectedCourseId(qualityStorage)
      replaySeed = null
      for (const picker of coursePickers) picker.setValue(selectedCourseId)
    }
    if (
      key === null ||
      key.startsWith(COURSE_HISTORY_STORAGE_PREFIX) ||
      key.startsWith(COURSE_BADGES_STORAGE_PREFIX) ||
      key.startsWith(COURSE_BEST_STORAGE_PREFIX) ||
      key.startsWith(COURSE_STREAK_STORAGE_PREFIX)
    ) {
      refreshCourseUi()
    }
  }
  uiListeners.add(window, 'storage', onProgressStorageChange)

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
    resetFlight(courseDefinitionForId(selectedCourseId).id !== 'random', true)
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
    cameras.setTitleFraming(aircraft)
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
    uiListeners.add(el, 'click', () => {
      menu.close()
      syncInputContext()
    })
  })
  menuEl.querySelectorAll('.menu-back').forEach((el) => {
    uiListeners.add(el, 'click', () => {
      menu.back()
      syncInputContext()
    })
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
      audio.silence()
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
    if (shouldPauseForFullscreenExit(
      !!document.fullscreenElement,
      playing,
      menu.paused,
      results.open,
    )) {
      audio.silence()
      menu.openPause('fullscreen')
      input.clearQueued()
      time.reset()
      syncInputContext()
    }
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
    resolution.setDeviceRatio(window.devicePixelRatio)
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
  let lastHudUpdateMs = Number.NaN
  const tick = (nowMs: number): void => {
    if (disposed) return
    requestAnimationFrame(tick)

    syncInputContext()
    const simLive = playing && !menu.paused && !results.open
    touchControls?.setVisible(touchDevice && simLive)
    if (!simLive) lastHudUpdateMs = Number.NaN
    const pixelRatio = resolution.update(nowMs - previousFrame, simLive && !document.hidden)
    previousFrame = nowMs
    if (Math.abs(renderer.getPixelRatio() - pixelRatio) > .001) renderer.setPixelRatio(pixelRatio)
    let visualDt = 0
    let simDt = 0
    if (!simLive) {
      time.skipFrame(nowMs)
      aircraft.controls = input.sampleWithDt(0)
      if (!playing) input.resetFlightControls(0)
      aircraft.snapDisplay(nowMs)
    } else {
      const { frameDt, steps, stepDt, alpha } = time.beginFrame(nowMs)
      visualDt = frameDt
      simDt = steps * stepDt
      const dt = stepDt
      const weather = world.atmosphere.weatherSnapshot
      aircraft.setWeatherGust(weather.gust)
      aircraft.setWeatherWind(weather.windX, weather.windZ)
      aircraft.setWeatherSurface(weather.rain, weather.snow)

      if (input.consumeCameraToggle()) {
        const mode = cameras.toggleMode(aircraft)
        showBanner(cameraModeCue(mode), 1200, 'info')
      }
      const stabilityAssist = input.consumeStabilityAssistToggle()
      if (stabilityAssist !== null) {
        showBanner(
          stabilityAssist ? 'FLIGHT ASSIST ON / PITCH + BANK TRIM' : 'FLIGHT ASSIST OFF',
          1600,
          'info',
        )
      }
      if (input.consumeWeatherCycle()) {
        world.cycleWeather()
        showBanner(weatherCycleBanner(world.atmosphere.weatherLabel), 1800, 'info')
      }
      if (input.consumeWorldSeedCopy()) {
        const seed = world.worldSeed
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
        const href = typeof window !== 'undefined' ? window.location.href : ''
        void copyWorldSeedLink(seed, clipboard, href, selectedCourseId).then((copied) => {
          if (disposed) return
          showBanner(
            copied
              ? `REPLAY LINK COPIED / SEED ${formatWorldSeed(seed)}`
              : `SEED ${formatWorldSeed(seed)} / COPY BLOCKED`,
            2200,
            copied ? 'success' : 'danger',
          )
        })
      }
      if (input.consumeReset()) resetFlight(true, true)
      if (input.consumeAudioToggle()) {
        audioMuted = !audioMuted
        if (audioMuted) audio.silence()
        showBanner(audioMuted ? 'AUDIO MUTED' : 'AUDIO LIVE', 1200)
      }
      if (input.consumeRadarTargetCycle()) radarTargetCycleQueued = true
      if (input.consumeGearToggle()) {
        const gearDown = aircraft.toggleGear()
        showBanner(
          gearDown ? 'GEAR DOWN / AUTO SAFETY' : 'GEAR UP / MANUAL OVERRIDE',
          1500,
          'info',
        )
      }

      for (let i = 0; i < steps; i++) {
        aircraft.capturePrevious()
        aircraft.controls = input.sampleWithDt(dt)
        aircraft.step(dt, nowMs)
        if (supersonic.update(aircraft.speed) === 'boom') {
          audio.playCue('sonic-boom')
          if (!banner || bannerUntil <= nowMs) showBanner('MACH 1 / SONIC BOOM', 1500, 'success')
        }
        if (combo.update(dt)) showBanner('COMBO EXPIRED / KEEP FLYING', 1200, 'info')

        const atAirfield = Math.hypot(
          aircraft.position.x - world.spawn.x,
          aircraft.position.z - world.spawn.z,
        ) <= 75
        const refuelEligible = wasAirborne &&
          aircraft.status !== 'crashed' &&
          aircraft.onGround &&
          aircraft.controls.gearDown &&
          aircraft.controls.throttle <= .08 &&
          aircraft.speed <= 3.5 &&
          atAirfield
        if (refuelEligible) {
          const before = aircraft.fuel.fraction
          refuelFuel(aircraft.fuel, dt)
          if (aircraft.fuel.fraction > before + .00001) {
            if (!refueling) showBanner('REFUELING / HOLD POSITION', 1400, 'info')
            refueling = aircraft.fuel.fraction < .9999
            if (engineOut && aircraft.fuel.fraction > 0.0001) engineOut = false
          }
        } else {
          refueling = false
        }

        const touch = collision.check(aircraft)
        if (aircraft.status !== 'crashed') {
          const alt = altitudeAgl(
            aircraft.position.x,
            aircraft.position.y,
            aircraft.position.z,
            aircraft.controls.gearDown,
          )
          terrainClearanceM = alt
          if (!aircraft.onGround && alt > 8) {
            wasAirborne = true
            aircraft.clearLanded()
          }
          if (touch === 'crash' || touch === 'ditch') {
            const ditching = touch === 'ditch'
            crashMessage = ditching
              ? 'DITCHING / WATER CONTACT - press R'
              : 'CRASH - press R'
            _crashPoint.copy(aircraft.position)
            _crashVelocity.copy(aircraft.velocity)
            if (cameras.mode === 'cockpit') cameras.setMode('chase', aircraft)
            aircraft.crash()
            challenge.fail()
            combo.break()
            crashFx.trigger(_crashPoint, _crashVelocity)
            cameras.impulse(1)
            audio.playCue('crash')
            showBanner(crashMessage, 4200, 'danger')
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
            const baseDx = aircraft.position.x - world.spawn.x
            const baseDz = aircraft.position.z - world.spawn.z
            const runwayRightX = Math.cos(world.spawn.yaw)
            const runwayRightZ = -Math.sin(world.spawn.yaw)
            const runwayLateralM = baseDx * runwayRightX + baseDz * runwayRightZ
            const headingDelta = pose.heading - world.spawn.yaw
            const finished = challenge.finishLanding({
              verticalSpeed: aircraft.impactVy || aircraft.velocity.y,
              groundSpeed: Math.hypot(aircraft.velocity.x, aircraft.velocity.z),
              pitchRad: pose.pitch,
              rollRad: pose.roll,
              baseDistanceM: Math.hypot(baseDx, baseDz),
              runwayLateralM,
              headingErrorRad: Math.atan2(Math.sin(headingDelta), Math.cos(headingDelta)),
              weatherRisk: landingWeatherRisk(weather),
              daylight: world.atmosphere.daylight,
            }, aircraft.fuel.fraction)
            if (finished) {
              ghost.commitIfBest(finished.isNewBest, finished.totalScore)
              ghost.setVisible(false)
              audio.playCue(
                finished.landingLabel === 'BUTTER'
                  ? 'landing-soft'
                  : finished.landingLabel === 'HARD' ? 'landing-hard' : 'landed',
              )
              if (flightRecordCueLabel(finished) || finished.masteryTierPromoted) audio.playCue('milestone')
              results.show(finished)
              refreshCourseUi()
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
          const altitudeMilestone = altitudeMilestones.update(
            aircraft.position.y - world.spawn.y,
            !aircraft.onGround,
          )
          if (altitudeMilestone) {
            challenge.recordAltitudeMilestone(altitudeMilestone.thresholdM)
            audio.playCue('milestone')
            showBanner(`ALTITUDE ${altitudeMilestone.thresholdM.toLocaleString()}M`, 1700, 'success')
          }
          const stunt = stunts.update(dt, !aircraft.onGround, aircraft.angularVelocity.z)
          if (stunt) {
            challenge.recordStunt(stunt.rolls)
            audio.playCue('stunt')
            let comboMilestone = 0
            for (let roll = 0; roll < stunt.rolls; roll += 1) {
              const comboEvent = recordComboAction('stunt')
              if (comboEvent?.milestone) comboMilestone = comboEvent.combo
            }
            if (comboMilestone > 0) audio.playCue('streak')
            showBanner(
              `BARREL ROLL X${stunt.totalRolls}${comboMilestone > 0 ? ` · COMBO X${comboMilestone}` : ''}`,
              1500,
              'success',
            )
          }
          const event = world.mission.update(
            aircraft.position.x,
            aircraft.position.y,
            aircraft.position.z,
            nowMs,
          )
          if (event === 'pass') {
            const quality = world.mission.lastPassQuality
            challenge.recordGate(quality)
            const comboEligible = Number.isFinite(quality) && quality >= 0.82
            const comboEvent = comboEligible ? recordComboAction('gate') : null
            if (!comboEligible) combo.break()
            const streak = challenge.gateStreakLabel
            audio.playCue(streak || comboEvent?.milestone ? 'streak' : 'gate')
            showBanner(
              `GATE ${gateQualityLabel(quality)}${streak ? ` · ${streak}` : ''}${comboEvent?.milestone ? ` · COMBO X${comboEvent.combo}` : ''} · ${challenge.gatePaceLabel}`,
              1400,
              'success',
            )
          }
          if (event === 'miss') {
            challenge.recordGateMiss()
            combo.break()
            audio.playCue('warning')
            showBanner('GATE MISSED / RE-ALIGN', 1500, 'danger')
          }
          if (event === 'complete') {
            const quality = world.mission.lastPassQuality
            challenge.recordGate(quality)
            const comboEligible = Number.isFinite(quality) && quality >= 0.82
            const comboEvent = comboEligible ? recordComboAction('gate') : null
            if (!comboEligible) combo.break()
            audio.playCue('complete')
            const streak = challenge.gateStreakLabel
            showBanner(
              `FINAL GATE ${gateQualityLabel(quality)}${streak ? ` · ${streak}` : ''}${comboEvent?.milestone ? ` · COMBO X${comboEvent.combo}` : ''} · RETURN & LAND`,
              4200,
            )
          }
        }

        const contractCue = challenge.consumeContractCompletionCue()
        if (contractCue) {
          audio.playCue('streak')
          showBanner(`CONTRACT COMPLETE / ${contractCue}`, 1800, 'success')
        }
        const contractFailureCue = challenge.consumeContractFailureCue()
        if (contractFailureCue) {
          audio.playCue('warning')
          showBanner(`CONTRACT FAILED / ${contractFailureCue}`, 1800, 'danger')
        }

        biomeSurveyCooldown = Math.max(0, biomeSurveyCooldown - dt)
        if (biomeSurveyCooldown <= 0 && aircraft.status === 'ok' && !aircraft.onGround) {
          const sampled = world.terrain.sampleMeshSurface(aircraft.position.x, aircraft.position.z) ??
            sampleTerrainSurface(aircraft.position.x, aircraft.position.z)
          challenge.recordBiome(sampled.biome)
          challenge.recordWater(sampled.kind === 'water', 0.65, true)
          const biomeCue = challenge.consumeBiomeSurveyCue()
          if (biomeCue && (!banner || bannerUntil <= nowMs)) {
            showBanner(
              `BIOME SURVEY / ${biomeCue.replace('-', ' ').toUpperCase()} / X${challenge.biomeCount}`,
              1300,
              'success',
            )
          }
          biomeSurveyCooldown = 0.65
        }

        challenge.update(
          dt,
          aircraft.speed,
          Math.max(0, aircraft.position.y - world.spawn.y),
          weather.rain,
          weather.snow,
          aircraft.controls.airbrake,
          !aircraft.onGround,
          aircraft.engineHeat.fraction,
          crosswindSpeedMps(weather.windX, weather.windZ, world.spawn.yaw),
          aircraft.loadFactor,
          aircraft.fuel.fraction,
          world.atmosphere.weatherTransitioning,
          aircraft.engineState.afterburnerActive,
          terrainClearanceM,
          world.atmosphere.daylight,
          Math.max(0, aircraft.speed * dt),
        )
        ghost.record(challenge.elapsedSec, aircraft.position)
      }

      world.mission.tick(
        nowMs,
        aircraft.displayPosition.x,
        aircraft.displayPosition.y,
        aircraft.displayPosition.z,
      )
      if (banner && nowMs > bannerUntil && aircraft.status !== 'crashed') {
        banner = null
      }
      aircraft.present(alpha)
      ghost.update(
        challenge.elapsedSec,
        playing && !menu.paused && !results.open && aircraft.status !== 'crashed' && cameras.mode !== 'cockpit',
      )
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
    const exposure = sceneExposure(world.atmosphere.daylight, crashFx.bloom)
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
      afterburnerOn !== prevAfterburner
    ) {
      audio.playCue(afterburnerOn ? 'ab' : 'ab-off')
    }
    prevAfterburner = afterburnerOn
    const airbrakeOpen = aircraft.controls.airbrake
    if (
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed' &&
      airbrakeOpen !== prevAirbrake
    ) {
      audio.playCue(airbrakeOpen ? 'airbrake-open' : 'airbrake-close')
    }
    prevAirbrake = airbrakeOpen
    const afterburnerFuelLocked = aircraft.engineState.afterburnerRequested &&
      aircraft.engineState.lever >= 0.05 &&
      aircraft.fuel.fraction <= FUEL_AFTERBURNER_RESERVE_FRACTION
    const afterburnerHeatLocked = aircraft.engineState.afterburnerRequested &&
      aircraft.engineState.lever >= 0.05 &&
      aircraft.engineState.afterburnerHeatLocked
    const afterburnerLocked = afterburnerFuelLocked || afterburnerHeatLocked
    if (
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed' &&
      afterburnerLocked &&
      !prevAfterburnerLockout
    ) {
      audio.playCue('warning')
      showBanner(
        afterburnerHeatLocked ? 'AFTERBURNER LOCKED / ENGINE HEAT' : 'AFTERBURNER LOCKED / FUEL RESERVE',
        2200,
        'danger',
      )
    }
    prevAfterburnerLockout = afterburnerLocked
    const heatRearmBanner = engineHeatRearmBanner(
      prevAfterburnerHeatLockout,
      afterburnerHeatLocked,
    )
    if (
      heatRearmBanner &&
      !afterburnerFuelLocked &&
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed'
    ) {
      showBanner(heatRearmBanner, 1600, 'success')
    }
    prevAfterburnerHeatLockout = afterburnerHeatLocked

    const fuelAvailable = aircraft.engineState.fuelAvailable
    const fuelOutBanner = engineFuelAvailabilityBanner(prevFuelAvailable, fuelAvailable)
    if (
      fuelOutBanner &&
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed'
    ) {
      audio.playCue('warning')
      showBanner(fuelOutBanner, 3200, 'danger')
      engineOut = true
    }
    prevFuelAvailable = fuelAvailable

    const engineHeatState = engineHeatCue(aircraft.engineHeat.fraction)
    if (engineHeatState !== prevEngineHeat) {
      const heatBanner = engineHeatBanner(engineHeatState, prevEngineHeat)
      if (
        heatBanner &&
        simLive &&
        playing &&
        !menu.paused &&
        !results.open &&
        aircraft.status !== 'crashed'
      ) {
        showBanner(heatBanner, engineHeatState === 'critical' ? 2600 : 1800, engineHeatState === 'critical' ? 'danger' : 'info')
      }
      prevEngineHeat = engineHeatState
    }

    const gBand = gLoadCueBand(aircraft.loadFactor)
    if (
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed' &&
      gBand !== prevGLoadBand &&
      gBand !== 'normal' &&
      nowMs >= gLoadCueUntil
    ) {
      audio.playCue(gBand === 'high' ? 'g-high' : 'g-negative')
      gLoadCueUntil = nowMs + 450
    }
    prevGLoadBand = gBand

    const visionBand = gLoadFeedback.update(aircraft.loadFactor)
    if (visionBand !== prevGLoadVision) {
      const visionBanner = gLoadVisionBanner(visionBand, prevGLoadVision)
      if (
        visionBanner &&
        simLive &&
        playing &&
        !menu.paused &&
        !results.open &&
        aircraft.status !== 'crashed'
      ) {
        audio.playCue(visionBand === 'blackout' ? 'g-high' : 'g-negative')
        showBanner(visionBanner, 2200, 'danger')
      }
      prevGLoadVision = visionBand
    }

    audioFrame.throttle = aircraft.engineState.lever
    audioFrame.boost = afterburnerOn
    audioFrame.airbrake = airbrakeOpen
    audioFrame.speed = aircraft.speed
    const precipitation = world.atmosphere.weatherSnapshot
    audioFrame.rain = precipitation.rain
    audioFrame.snow = precipitation.snow
    audioFrame.cockpit = cameras.mode === 'cockpit'
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

    if (shouldUpdateLiveHud(playing, simLive) && hudUpdateDue(renderQuality, nowMs, lastHudUpdateMs)) {
      lastHudUpdateMs = nowMs
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
        if (warn.text) {
          audio.playCue(warn.terrainClosure ? 'pull-up' : warn.overspeed ? 'overspeed' : 'warning')
        }
        prevWarning = warn.text
      }
      const nav = world.mission.hud(
        aircraft.position.x,
        aircraft.position.y,
        aircraft.position.z,
        pose.heading,
      )
      const gate = world.mission.activeGatePos()
      const returning = challenge.phase === 'returning'
      const emergencyReturn = emergencyReturnActive(engineOut, challenge.phase)
      let navTarget: 'gate' | 'base' | 'city' | 'village' = returning || emergencyReturn ? 'base' : 'gate'
      let navBearing = cameras.mode === 'cockpit'
        ? nav.bearing
        : gateScreenBearing(cameras.camera, gate)
      let navDist = nav.dist
      let navAltDelta = nav.altDelta
      let navApproach: 'aligned' | 'turn-left' | 'turn-right' | null = null
      let navCrosswind: number | null = null
      let navCrosswindSide: CrosswindSide = 'calm'
      let navLateral: NavigationLateralCue | null = null
      let navSpeed: NavigationSpeedCue | null = null
      let navGlide: NavigationGlideCue | null = null
      if (returning || emergencyReturn) {
        returnTarget.set(world.spawn.x, world.spawn.y, world.spawn.z)
        navDist = Math.hypot(
          returnTarget.x - aircraft.position.x,
          returnTarget.y - aircraft.position.y,
          returnTarget.z - aircraft.position.z,
        )
        navAltDelta = returnTarget.y - aircraft.position.y
        navBearing = cameras.mode === 'cockpit'
          ? cameraRelativeBearing(cameras.camera.position, cameras.camera.quaternion, returnTarget)
          : gateScreenBearing(cameras.camera, returnTarget)
        navApproach = navigationApproachCue(pose.heading - world.spawn.yaw, 'base')
        const lateralOffset = (aircraft.position.x - world.spawn.x) * Math.cos(world.spawn.yaw) +
          (aircraft.position.z - world.spawn.z) * -Math.sin(world.spawn.yaw)
        navLateral = navigationLateralCue(lateralOffset, 'base')
        navSpeed = navigationSpeedCue(aircraft.speed, 'base')
        navGlide = navigationGlideCue(navDist, navAltDelta, 'base')
        navCrosswind = crosswindSpeedMps(
          precipitation.windX,
          precipitation.windZ,
          world.spawn.yaw,
        )
        navCrosswindSide = crosswindDirection(
          precipitation.windX,
          precipitation.windZ,
          world.spawn.yaw,
        )
      }
      if (radarUpdateDue(nowMs, radarNextUpdateMs) || radarContacts.length === 0) {
        radarContacts = radar.update(
          aircraft.position.x,
          aircraft.position.z,
          pose.heading,
          gate,
          world.settlements.getRadarLandmarks(
            aircraft.position.x,
            aircraft.position.z,
            RADAR_RANGE_METERS,
          ),
        )
        radarNextUpdateMs = nowMs + RADAR_UPDATE_INTERVAL_MS
      }
      if (radarTargetCycleQueued) {
        radarTargetCycleQueued = false
        const selected = radar.cycleTarget()
        showBanner(
          selected ? `RADAR LOCK / ${selected.label}` : 'NO SETTLEMENTS IN RANGE',
          1400,
          selected ? 'info' : 'danger',
        )
      }
      const selectedRadarTarget = radar.selectedTarget()
      if (!returning && !emergencyReturn && selectedRadarTarget) {
        const targetX = Number.isFinite(selectedRadarTarget.x) ? selectedRadarTarget.x! : aircraft.position.x
        const targetY = Number.isFinite(selectedRadarTarget.y) ? selectedRadarTarget.y! : aircraft.position.y
        const targetZ = Number.isFinite(selectedRadarTarget.z) ? selectedRadarTarget.z! : aircraft.position.z
        returnTarget.set(targetX, targetY, targetZ)
        navDist = Math.hypot(
          targetX - aircraft.position.x,
          targetY - aircraft.position.y,
          targetZ - aircraft.position.z,
        )
        navAltDelta = targetY - aircraft.position.y
        navBearing = cameras.mode === 'cockpit'
          ? cameraRelativeBearing(cameras.camera.position, cameras.camera.quaternion, returnTarget)
          : gateScreenBearing(cameras.camera, returnTarget)
        navTarget = selectedRadarTarget.kind
        navApproach = null
        const arrivalRadius = radarTargetArrivalRadius(selectedRadarTarget.kind)
        if (
          aircraft.status === 'ok' &&
          arrivalRadius > 0 &&
          navDist <= arrivalRadius
        ) {
          if (selectedRadarTarget.kind === 'city' || selectedRadarTarget.kind === 'village') {
            challenge.recordDestination(selectedRadarTarget.kind)
          }
          showBanner(radarTargetArrivalLabel(selectedRadarTarget.kind), 2000, 'success')
          radar.clearTarget()
        }
      }
      if (aircraft.status === 'ok' && !aircraft.onGround && nowMs >= radarDiscoveryCooldownUntil) {
        for (const contact of radarContacts) {
          if (contact.kind === 'gate' || !contact.id || radarDiscovered.has(contact.id)) continue
          radarDiscovered.add(contact.id)
          radarDiscoveryCooldownUntil = nowMs + 2400
          showBanner(radarDiscoveryLabel(contact.kind, contact.biome), 2800, 'success')
          break
        }
      }
      if (world.terrain.sampleMeshSurfaceInto(aircraft.position.x, aircraft.position.z, groundSurface)) {
        const water = groundSurface.kind === 'water'
        if (water !== overWater) {
          overWater = water
          if (water && aircraft.status === 'ok' && !aircraft.onGround && (!banner || bannerUntil <= nowMs)) {
            const surface = world.terrain.sampleMeshSurface(aircraft.position.x, aircraft.position.z)
            showBanner(waterSurfaceCue(surface?.biome), 2600, 'info')
          }
        }
      }
      if (shouldShowFlightPathMarker(
        cameras.mode === 'cockpit',
        aircraft.onGround,
        aircraft.speed,
      )) {
        writeFlightPathMarker(
          cameras.camera,
          cameras.mode === 'cockpit' ? cameras.camera.position : aircraft.displayPosition,
          aircraft.velocity,
          flightPathMarker,
        )
      } else {
        flightPathMarker.visible = false
      }
      hudFrame.y = alt
      hudFrame.verticalSpeed = aircraft.onGround ? 0 : aircraft.velocity.y
      hudFrame.gForce = aircraft.loadFactor
      hudFrame.flightDistanceM = challenge.currentFlightDistanceM
      hudFrame.peakPositiveG = challenge.currentPeakPositiveG
      hudFrame.peakNegativeG = challenge.currentPeakNegativeG
      hudFrame.speed = aircraft.speed
      hudFrame.mach = machNumber(aircraft.speed)
      hudFrame.cameraMode = cameras.modeLabel
      hudFrame.fps = time.fps
      hudFrame.throttle = aircraft.engineState.lever
      hudFrame.airbrake = aircraft.controls.airbrake
      hudFrame.engineHeat = aircraft.engineHeat.fraction
      hudFrame.fuel = aircraft.fuel.fraction
      hudFrame.refueling = refueling
      hudFrame.landingPreview = (returning || emergencyReturn) && navDist <= 3_000 && aircraft.controls.gearDown
        ? landingQualityForMetrics({
          verticalSpeed: aircraft.velocity.y,
          groundSpeed: Math.hypot(aircraft.velocity.x, aircraft.velocity.z),
          pitchRad: pose.pitch,
          rollRad: pose.roll,
        })
        : null
      hudFrame.boost = aircraft.engineState.afterburnerActive
      hudFrame.afterburnerLock = aircraft.engineState.afterburnerHeatLocked
        ? 'heat'
        : aircraft.fuel.fraction <= FUEL_AFTERBURNER_RESERVE_FRACTION ? 'fuel' : null
      hudFrame.stabilityAssist = aircraft.controls.stabilityAssist
      hudFrame.gearDown = aircraft.controls.gearDown
      hudFrame.onGround = aircraft.onGround
      hudFrame.flightState = aircraft.status === 'crashed'
        ? 'crashed'
        : aircraft.onGround ? 'ground' : 'airborne'
      hudFrame.pitch = pose.pitch
      hudFrame.roll = pose.roll
      hudFrame.rain = precipitation.rain
      hudFrame.snow = precipitation.snow
      hudFrame.heading = pose.heading
      hudFrame.audioMuted = audioMuted
      hudFrame.warning = warn.text
      hudFrame.warningLevel = warn.level
      hudFrame.clock = challenge.clockLabel
      hudFrame.weather = world.atmosphere.weatherLabel
      hudFrame.weatherKind = world.atmosphere.weather
      hudFrame.weatherTransitioning = world.atmosphere.weatherTransitioning
      hudFrame.windX = precipitation.windX
      hudFrame.windZ = precipitation.windZ
      hudFrame.weatherGust = precipitation.gust
      hudFrame.dayPhase = world.atmosphere.phaseLabel
      const contractLabel = challenge.contractLabel
      hudFrame.mission = missionLabelCache(
        world.mission.routeSummary.label,
        `${world.mission.routeSummary.challengeLabel} ${challenge.objectiveLabel}`,
        contractLabel,
      )
      const routeSummary = world.mission.routeSummary
      hudFrame.routeRisk = routeSummary.profile === 'free'
        ? ''
        : routeRiskHudLabel(routeSummary.difficulty, routeSummary.modifier)
      hudFrame.routeRiskAria = routeSummary.profile === 'free'
        ? ''
        : routeRiskAriaLabel(routeSummary.difficulty, routeSummary.modifier)
      hudFrame.contractLabel = contractLabel
      hudFrame.contractDetail = challenge.contractDetail ?? ''
      hudFrame.contractProgress = challenge.contractProgress
      hudFrame.contractComplete = challenge.contractComplete
      hudFrame.contractFailed = challenge.contractFailed
      hudFrame.contractStreak = challenge.contractStreak
      hudFrame.biomeCount = challenge.biomeCount
      hudFrame.pace = challenge.gatesPassed > 0 ? challenge.gatePaceLabel : null
      hudFrame.ghostPace = (
        (challenge.phase === 'running' || challenge.phase === 'returning') &&
        cameras.mode !== 'cockpit' &&
        aircraft.status === 'ok'
      ) ? ghost.paceDelta(challenge.elapsedSec) : null
      hudFrame.missionPhase = challenge.phase
      hudFrame.missionCurrent = challenge.gatesPassed
      hudFrame.missionTotal = challenge.totalGates
      hudFrame.combo = combo.current
      hudFrame.navDist = navDist
      hudFrame.navBearing = navBearing
      hudFrame.navAltDelta = navAltDelta
      hudFrame.navTarget = navTarget
      hudFrame.navApproach = navApproach
      hudFrame.crosswind = navCrosswind
      hudFrame.crosswindSide = navCrosswindSide
      hudFrame.navLateral = navLateral
      hudFrame.navSpeed = navSpeed
      hudFrame.navGlide = navGlide
      hudFrame.radar = radarContacts
      hudFrame.controlHint = nowMs < controlHintUntilMs && aircraft.status !== 'crashed'
        ? FLIGHT_CONTROLS_HINT
        : null
      hudFrame.timeMs = nowMs
      hudFrame.banner = aircraft.status === 'crashed' ? crashMessage : banner
      hudFrame.bannerTone = aircraft.status === 'crashed' ? 'danger' : bannerTone
      hudFrame.flightPathVisible = flightPathMarker.visible
      hudFrame.flightPathX = flightPathMarker.x
      hudFrame.flightPathY = flightPathMarker.y
      hud.update(hudFrame)
    }
  }

  const pauseForLostFocus = (): void => {
    if (!shouldPauseForFocusLost(playing, menu.paused, results.open)) return
    audio.silence()
    menu.openPause('focus')
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

      challenge.reset(courseId(), world.mission.totalGates, world.mission.scoringFocus, world.worldSeed)
  syncInputContext()
  // The procedural F-35 is the immediate playable path. If an optional GLB
  // exists, let it hydrate in the background instead of blocking the title
  // screen on a missing or slow asset request.
  void aircraft.tryLoadModel('/models/f35.glb')
  requestAnimationFrame(tick)
}

const _fwd = new Vector3()
const _inv = new Quaternion()
const _localUp = new Vector3()
const _crashPoint = new Vector3()
const _crashVelocity = new Vector3()
const _attitude = { pitch: 0, roll: 0, heading: 0 }
let _stableHeading = 0
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
  const heading = headingFromOrientation(orientation, _stableHeading)
  _stableHeading = heading

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
  return cameraRelativeBearing(camera.position, camera.quaternion, gate)
}

boot().catch((err) => {
  console.error('[Blackout] Failed to start', err)
  const status = document.getElementById('title-status')
  if (status) status.textContent = startupFailureMessage(err)
  const playBtn = document.getElementById('btn-play')
  if (playBtn instanceof HTMLButtonElement) playBtn.disabled = true
})
