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
import { afterburnerLockReason } from './aircraft/EngineState'
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
import { pruneRotatingCourseRecords, touchSeededRandomCourseRecord } from './core/CourseRecordRetention'
import { resetFlightPreferences } from './core/PreferenceReset'
import {
  bestOpsStreak,
  opsStreakLabel,
  readOpsStreak,
  recordOpsCompletion,
  type OpsStreakSnapshot,
} from './core/OpsStreak'
import {
  COURSE_FAVORITES_STORAGE_KEY,
  readCourseFavoriteIds,
  toggleCourseFavorite,
  writeCourseFavoriteIds,
} from './core/CourseFavorites'
import {
  COURSE_RECENTS_STORAGE_KEY,
  readRecentCourseIds,
  rememberCourseId,
  writeRecentCourseIds,
} from './core/CourseRecents'
import {
  copyWorldSeed,
  copyWorldSeedLink,
  formatWorldSeed,
  normalizeWorldSeed,
  parseWorldSeed,
  shouldRegenerateWorldOnLaunch,
  worldSeedLaunchStatus,
} from './core/WorldSeed'
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
  staticRenderDue,
  Time,
} from './core/Time'
import { bannerRemainingMs, bannerUntilFromRemaining, MAX_BANNER_DURATION_MS } from './core/BannerClock'
import {
  ChallengeRun,
  courseMasteryTierForProgress,
  COURSE_BADGES_STORAGE_PREFIX,
  COURSE_BEST_STORAGE_PREFIX,
  COURSE_HISTORY_STORAGE_PREFIX,
  COURSE_STREAK_STORAGE_PREFIX,
  landingApproachScore,
  landingWeatherRisk,
  landingQualityForMetrics,
  repairBestCoursePrecisionStreak,
  repairBestCourseScore,
  repairCourseHistory,
  repairMasteryBadges,
} from './systems/ChallengeRun'
import {
  courseDefinitionForId,
  dailyOpsDayKey,
  dailyOpsTimestampForDayKey,
  monthlyOpsMonthKey,
  monthlyOpsTimestampForMonthKey,
  weeklyOpsTimestampForWeekKey,
  weeklyOpsWeekKey,
  courseRunId,
  COURSE_LIBRARY,
  courseSessionId,
  readSelectedCourseId,
  resolveCourseDefinition,
  shouldResetSeededRandomWorldForStorageKey,
  writeSelectedCourseId,
  type CourseId,
} from './systems/CourseLibrary'
import { CollisionSystem, contactFailureLabel } from './systems/Collision'
import { CrashFx } from './systems/CrashFx'
import { LandingFx } from './systems/LandingFx'
import { SonicBoomFx } from './systems/SonicBoomFx'
import { WaterWakeFx } from './systems/WaterWakeFx'
import { SpeedStreakFx } from './systems/SpeedStreakFx'
import { MachConeFx } from './systems/MachConeFx'
import { GroundWakeFx } from './systems/GroundWakeFx'
import { thermalLiftIntensity } from './systems/ThermalLift'
import { stormBuffetDrive, stormBuffetGearScale } from './systems/StormBuffet'
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
  pilotRankForProgress,
  pilotRankRank,
  pilotRankLabel,
  pilotRankNextGoalLabel,
  pilotCommendationLabel,
  pilotCommendationsLabel,
  pilotCommendationsForProgress,
  type PilotCommendationId,
  type PilotRank,
  type PilotCareerProgress,
} from './systems/CareerProgression'
import {
  audioVolumePercent,
  normalizeAudioVolume,
  normalizeAudioChannelVolume,
  readAudioVolume,
  writeAudioVolume,
  readAudioChannelVolume,
  writeAudioChannelVolume,
  type AudioChannel,
} from './audio/AudioPreferences'
import { evaluateWarnings, FlightWarningTracker, warningCueForState } from './systems/FlightWarnings'
import { gateQualityLabel } from './systems/Mission'
import { sortieContractDetailForSeed, sortieContractLabelForSeed } from './systems/SortieContract'
import { isDebugEnabled } from './debug/debugFlags'
import type { DebugOverlay } from './debug/DebugOverlay'
import type { CoursePicker as CoursePickerInstance, CoursePickerCategory, CoursePickerSort } from './ui/CoursePicker'
import type {
  HUD as HudInstance,
  CrosswindSide,
  FuelHomeCue,
  HudBannerTone,
  NavigationLateralCue,
  NavigationSpeedCue,
  NavigationGlideCue,
} from './ui/HUD'
import {
  RADAR_RANGE_METERS,
  RADAR_UPDATE_INTERVAL_MS,
  radarUpdateDue,
  radarDiscoveryLabel,
  radarTargetArrivalLabel,
  radarTargetArrivalRadius,
  RadarSystem,
} from './systems/RadarSystem'
import { type GroundSurfaceSample } from './world/ground'
import { sampleTerrainSurface } from './world/terrainSample'
import { trafficAlertSide, trafficAlertVertical } from './world/AirTrafficSystem'
import { fuelEnduranceSeconds, refuelFuel } from './aircraft/FuelSystem'
import { World } from './world/World'
import { cloudImmersionBand, type CloudImmersionBand } from './world/Atmosphere'
import { AdaptiveResolution } from './core/AdaptiveResolution'
import { nightWeatherReadability, sceneExposure } from './core/SceneExposure'
import { ListenerBag } from './core/ListenerBag'
import { appReleaseLabel } from './core/Version'
import { headingFromOrientation } from './core/attitude'
import {
  DEFAULT_CAMERA_AUTO_RETURN,
  DEFAULT_CAMERA_EFFECTS,
  DEFAULT_CAMERA_MODE,
  DEFAULT_CAMERA_SENSITIVITY,
  DEFAULT_CAMERA_SPEED_FRAMING,
  DEFAULT_GHOST_VISIBLE,
  DEFAULT_HUD_DISPLAY,
  DEFAULT_KEYBOARD_BINDINGS,
  DEFAULT_KEYBOARD_PITCH,
  DEFAULT_KEYBOARD_ROLL,
  DEFAULT_KEYBOARD_YAW,
  DEFAULT_REDUCED_MOTION,
  DEFAULT_STABILITY_ASSIST,
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
  keyboardBindingLabel,
  normalizeKeyboardBindings,
  readKeyboardBindings,
  writeKeyboardBindings,
  readGhostVisibilityPreference,
  writeGhostVisibilityPreference,
  readCameraModePreference,
  writeCameraModePreference,
  readStabilityAssistPreference,
  writeStabilityAssistPreference,
  cameraSensitivityLabel,
  cameraSensitivityMultiplier,
  normalizeCameraSensitivity,
  readCameraSensitivityPreference,
  writeCameraSensitivityPreference,
  cameraSpeedFramingLabel,
  cameraSpeedFramingMultiplier,
  normalizeCameraSpeedFraming,
  readCameraSpeedFramingPreference,
  writeCameraSpeedFramingPreference,
  readCameraAutoReturnPreference,
  writeCameraAutoReturnPreference,
  readCameraEffectsPreference,
  writeCameraEffectsPreference,
  readReducedMotionPreference,
  writeReducedMotionPreference,
  normalizeHudDisplay,
  readHudDisplayPreference,
  writeHudDisplayPreference,
  type CameraSensitivity,
  type CameraSpeedFraming,
  type HudDisplay,
  type KeyboardPitchPreference,
  type KeyboardRollPreference,
  type KeyboardYawPreference,
  type KeyboardBindingCode,
  type KeyboardBindings,
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

export async function boot(): Promise<void> {
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
  const titleSeedInput = document.getElementById('title-seed-input') as HTMLInputElement | null
  const titleSeedLoad = document.getElementById('title-seed-load') as HTMLButtonElement | null
  const titleSeedStatus = document.getElementById('title-seed-status')
  const qualitySelect = document.getElementById('menu-quality') as HTMLSelectElement | null
  const yawSelect = document.getElementById('menu-yaw') as HTMLSelectElement | null
  const rollSelect = document.getElementById('menu-roll') as HTMLSelectElement | null
  const pitchSelect = document.getElementById('menu-pitch') as HTMLSelectElement | null
  const boostKeySelect = document.getElementById('menu-boost-key') as HTMLSelectElement | null
  const airbrakeKeySelect = document.getElementById('menu-airbrake-key') as HTMLSelectElement | null
  const gearKeySelect = document.getElementById('menu-gear-key') as HTMLSelectElement | null
  const cameraSensitivitySelect = document.getElementById('menu-camera-sensitivity') as HTMLSelectElement | null
  const cameraSpeedFramingSelect = document.getElementById('menu-camera-speed-framing') as HTMLSelectElement | null
  const cameraAutoReturnToggle = document.getElementById('menu-camera-auto-return') as HTMLInputElement | null
  const cameraEffectsToggle = document.getElementById('menu-camera-effects') as HTMLInputElement | null
  const reducedMotionToggle = document.getElementById('menu-reduced-motion') as HTMLInputElement | null
  const hudDisplayToggle = document.getElementById('menu-hud-display') as HTMLInputElement | null
  const stabilityAssistToggle = document.getElementById('menu-stability-assist') as HTMLInputElement | null
  const resetSettingsButton = document.getElementById('menu-reset-settings') as HTMLButtonElement | null
  const yawLabel = document.getElementById('controls-yaw-label')
  const rollLabel = document.getElementById('controls-roll-label')
  const pitchLabel = document.getElementById('controls-pitch-label')
  const boostKeyLabel = document.getElementById('controls-boost-label')
  const airbrakeKeyLabel = document.getElementById('controls-airbrake-label')
  const gearKeyLabel = document.getElementById('controls-gear-label')
  const volumeRange = document.getElementById('menu-volume') as HTMLInputElement | null
  const volumeValue = document.getElementById('menu-volume-value')
  const engineVolumeRange = document.getElementById('menu-engine-volume') as HTMLInputElement | null
  const engineVolumeValue = document.getElementById('menu-engine-volume-value')
  const environmentVolumeRange = document.getElementById('menu-environment-volume') as HTMLInputElement | null
  const environmentVolumeValue = document.getElementById('menu-environment-volume-value')
  const effectsVolumeRange = document.getElementById('menu-effects-volume') as HTMLInputElement | null
  const effectsVolumeValue = document.getElementById('menu-effects-volume-value')
  const touchRoot = document.getElementById('touch-controls')
  if (!menuEl) throw new Error('#menu not found')
  if (!titleCoursePickerRoot || !menuCoursePickerRoot) throw new Error('course picker not found')
  const [coursePickerModule, gameMenuModule, hudModule, runResultsModule] = await Promise.all([
    import('./ui/CoursePicker'),
    import('./ui/GameMenu'),
    import('./ui/HUD'),
    import('./ui/RunResults'),
  ])
  const {
    COURSE_PICKER_CATEGORY_STORAGE_KEY,
    COURSE_PICKER_SORT_STORAGE_KEY,
    CoursePicker,
    courseConditionSummary,
    courseMasteryProgressLabel,
    coursePickerCategoryForCourse,
    coursePickerDifficultyForCourse,
    coursePickerDifficultyLabel,
    coursePickerMasteryLabel,
    coursePickerFlightLogLabel,
    coursePickerCopy,
    readCoursePickerCategory,
    readCoursePickerSort,
    normalizeCoursePickerFilter,
    writeCoursePickerCategory,
    writeCoursePickerSort,
  } = coursePickerModule
  const { GameMenu } = gameMenuModule
  const {
    createMissionHudLabelCache,
    createRouteRiskLabelCache,
    fuelHomeCue,
    fuelHomeTimeSeconds,
    fuelHomeWarning,
    hudBackgroundHidden,
    HUD,
    machNumber,
    engineHeatBanner,
    engineHeatCue,
    engineHeatRearmBanner,
    engineFuelAvailabilityBanner,
    emergencyReturnActive,
    flightBriefingHint,
    crosswindDirection,
    crosswindSpeedMps,
    navigationApproachCue,
    navigationLateralCue,
    navigationSpeedCue,
    navigationGlideCueFromTargetDelta,
    weatherCycleBanner,
    waterSurfaceCue,
    terrainRegionLabel,
    visibleGhostPaceDelta,
  } = hudModule
  const { copySortieSummary, flightRecordCueLabel, RunResults } = runResultsModule
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
  const initialCoursePickerCategory = readCoursePickerCategory(qualityStorage)
  const initialCoursePickerSort = readCoursePickerSort(qualityStorage)
  let coursePickerFilter = ''
  const syncCoursePickerBrowseState = (
    source: CoursePickerInstance,
    category: CoursePickerCategory,
    sort: CoursePickerSort,
  ): void => {
    writeCoursePickerCategory(qualityStorage, category)
    writeCoursePickerSort(qualityStorage, sort)
    for (const picker of coursePickers) {
      if (picker !== source) picker.setBrowseState(category, sort)
    }
  }
  const syncCoursePickerFilter = (source: CoursePickerInstance, query: string): void => {
    coursePickerFilter = normalizeCoursePickerFilter(query)
    for (const picker of coursePickers) {
      if (picker !== source) picker.setFilter(coursePickerFilter)
    }
  }
  for (const picker of coursePickers) {
    picker.setBrowseState(initialCoursePickerCategory, initialCoursePickerSort)
    picker.setFilter(coursePickerFilter)
    picker.onBrowseState((category, sort) => syncCoursePickerBrowseState(picker, category, sort))
    picker.onFilter((query) => syncCoursePickerFilter(picker, query))
  }
  pruneRotatingCourseRecords(qualityStorage)
  let opsStreaks: OpsStreakSnapshot = readOpsStreak(qualityStorage)

  let recentCourseIds = readRecentCourseIds(qualityStorage)
  let favoriteCourseIds = readCourseFavoriteIds(qualityStorage)
  let selectedCourseId: CourseId = readSelectedCourseId(qualityStorage)
  const replayParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null
  const replayCourseId = replayParams?.get('course') ?? null
  const replayDayTimestamp = replayCourseId === 'daily-ops'
    ? dailyOpsTimestampForDayKey(replayParams?.get('day'))
    : null
  const replayWeekTimestamp = replayCourseId === 'weekly-ops'
    ? weeklyOpsTimestampForWeekKey(replayParams?.get('week'))
    : null
  const replayMonthTimestamp = replayCourseId === 'monthly-ops'
    ? monthlyOpsTimestampForMonthKey(replayParams?.get('month'))
    : null
  // Keep a single UTC snapshot for this page session so the picker, records,
  // and a retry all refer to the same rotating Ops challenge around a period
  // boundary.
  const opsTimestamp = replayDayTimestamp ?? replayWeekTimestamp ?? replayMonthTimestamp ?? Date.now()
  const selectedCoursePeriodKey = (): string | undefined => {
    if (selectedCourseId === 'daily-ops') return `DAY ${dailyOpsDayKey(opsTimestamp)}`
    if (selectedCourseId === 'weekly-ops') return `WEEK ${weeklyOpsWeekKey(opsTimestamp)}`
    if (selectedCourseId === 'monthly-ops') return `MONTH ${monthlyOpsMonthKey(opsTimestamp)}`
    return undefined
  }
  const selectedCourseReplayKey = (): string | undefined => {
    if (selectedCourseId === 'daily-ops') return dailyOpsDayKey(opsTimestamp)
    if (selectedCourseId === 'weekly-ops') return weeklyOpsWeekKey(opsTimestamp)
    if (selectedCourseId === 'monthly-ops') return monthlyOpsMonthKey(opsTimestamp)
    return undefined
  }
  const selectedCourse = () => resolveCourseDefinition(
    courseDefinitionForId(selectedCourseId),
    opsTimestamp,
  )
  let replaySeed = parseWorldSeed(
    replayParams?.get('seed'),
  )
  let replaySeedFallback = false
  if (replaySeed !== null) selectedCourseId = courseDefinitionForId(replayCourseId).id
  if (titleSeedInput && replaySeed !== null) titleSeedInput.value = formatWorldSeed(replaySeed)
  /** True only after an explicit custom/replay seed successfully built a random world. */
  let seededRandomWorld = false

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
      const resolvedCourse = resolveCourseDefinition(course, opsTimestamp)
      const runId = courseRunId(course, opsTimestamp)
      const record = runId ? readCourseRecord(runId) : null
      const recentRank = recentCourseIds.indexOf(course.id)
      const favoriteRank = favoriteCourseIds.indexOf(course.id)
      const copy = coursePickerCopy({
        course: resolvedCourse,
        history: record?.history ?? null,
        bestScore: record?.bestScore ?? 0,
        badgeCount: record?.badgeCount ?? 0,
        bestPrecisionStreak: record?.bestPrecisionStreak ?? 0,
        contractLabel: sortieContractLabelForSeed(resolvedCourse.seed ?? undefined, 5, resolvedCourse.contractCatalog === true),
        contractDetail: sortieContractDetailForSeed(resolvedCourse.seed ?? undefined, 5, resolvedCourse.contractCatalog === true),
      })
      const difficulty = coursePickerDifficultyForCourse(course)
      const mastery = courseMasteryTierForProgress({
        completionCount: record?.history?.completionCount,
        bestScore: record?.bestScore,
        badgeCount: record?.badgeCount,
        contractWins: record?.history?.contractWins,
        landingQuality: record?.history?.landingQuality,
      })
      return {
        id: course.id,
        label: course.label,
        detail: copy.detail,
        meta: [copy.meta, `DIFF ${coursePickerDifficultyLabel(difficulty)}`, `TIER ${coursePickerMasteryLabel(mastery)}`, opsStreakLabel(opsStreaks, course.id, course.id === 'daily-ops'
          ? dailyOpsDayKey(opsTimestamp)
          : course.id === 'weekly-ops'
            ? weeklyOpsWeekKey(opsTimestamp)
            : course.id === 'monthly-ops'
              ? monthlyOpsMonthKey(opsTimestamp)
              : undefined)].filter(Boolean).join(' · '),
        stats: [copy.stats, coursePickerFlightLogLabel(record?.history ?? null)].filter(Boolean).join(' · '),
        category: coursePickerCategoryForCourse(course),
        recent: recentRank >= 0,
        recentRank: recentRank >= 0 ? recentRank : undefined,
        favorite: favoriteRank >= 0,
        favoriteRank: favoriteRank >= 0 ? favoriteRank : undefined,
        score: record?.bestScore ?? 0,
        time: record?.history?.bestTimeSec,
        runs: record?.history?.completionCount,
        distance: record?.history?.flightDistanceM,
        speed: record?.history?.peakSpeedKts,
        fuel: record?.history?.fuelRemainingPercent,
        landing: record?.history?.landingQuality,
        altitude: record?.history?.peakAltitudeM,
        combo: record?.history?.combo,
        approach: record?.history?.approachScore,
        stunts: record?.history?.stuntRolls,
        discoveries: (Number.isFinite(record?.history?.destinations) ? Math.max(0, Math.floor(record?.history?.destinations ?? 0)) : 0) +
          (Number.isFinite(record?.history?.biomes) ? Math.max(0, Math.floor(record?.history?.biomes ?? 0)) : 0) +
        (Number.isFinite(record?.history?.waterBodies) ? Math.max(0, Math.floor(record?.history?.waterBodies ?? 0)) : 0),
        contractWins: record?.history?.contractWins,
        streak: Math.max(
          Number.isFinite(record?.history?.runStreakRecord) ? Math.max(0, Math.floor(record?.history?.runStreakRecord ?? 0)) : 0,
          Number.isFinite(record?.history?.runStreak) ? Math.max(0, Math.floor(record?.history?.runStreak ?? 0)) : 0,
        ),
        contractStreak: Math.max(
          Number.isFinite(record?.history?.contractStreakRecord) ? Math.max(0, Math.floor(record?.history?.contractStreakRecord ?? 0)) : 0,
          Number.isFinite(record?.history?.contractStreak) ? Math.max(0, Math.floor(record?.history?.contractStreak ?? 0)) : 0,
        ),
        biomes: record?.history?.biomes,
        waterways: record?.history?.waterBodies,
        destinations: record?.history?.destinations,
        positiveG: record?.history?.peakPositiveG,
        negativeG: record?.history?.peakNegativeG,
        precision: record?.bestPrecisionStreak,
        difficulty,
        mastery,
      }
    })
    for (const picker of coursePickers) picker.setItems(items, selectedCourseId)
  }
  const rememberRecentCourse = (id: CourseId): void => {
    const next = rememberCourseId(recentCourseIds, id)
    if (next.length === recentCourseIds.length && next.every((value, index) => value === recentCourseIds[index])) return
    recentCourseIds = next
    writeRecentCourseIds(qualityStorage, recentCourseIds)
    refreshCourseSelectorLabels()
  }
  const setCourseFavorite = (id: string, favorite: boolean): void => {
    const next = toggleCourseFavorite(favoriteCourseIds, id, favorite)
    if (next.length === favoriteCourseIds.length && next.every((value, index) => value === favoriteCourseIds[index])) return
    favoriteCourseIds = next
    writeCourseFavoriteIds(qualityStorage, favoriteCourseIds)
    refreshCourseSelectorLabels()
  }
  const releaseBrowserUi = suppressBrowserUi(canvas)
  const titleStatus = document.getElementById('title-status')
  const titleProgress = document.getElementById('title-progress')
  const titleCommendations = document.getElementById('title-commendations')
  let currentPilotRank: PilotRank = 'cadet'
  let currentPilotCommendations: PilotCommendationId[] = []
  const refreshCourseProgress = (): void => {
    if (!titleProgress) return
    const curated = COURSE_LIBRARY.filter((course) => {
      const resolved = resolveCourseDefinition(course, opsTimestamp)
      return resolved.seed !== null && resolved.profile !== null
    })
    let completed = 0
    let mastered = 0
    const career: PilotCareerProgress = {
      completedCourses: 0,
      totalRuns: 0,
      totalBestScore: 0,
      totalBadges: 0,
      totalContractWins: 0,
      legendCourses: 0,
      totalFlightDistanceM: 0,
      bestPeakSpeedKts: 0,
      bestPeakAltitudeM: 0,
      styleVarietyCount: 0,
    }
    const styleVariety = new Set<string>()
    for (const course of curated) {
      const runId = courseRunId(course, opsTimestamp)
      if (!runId) continue
      const record = readCourseRecord(runId)
      const history = record.history
      if (history?.sortieStyle) styleVariety.add(history.sortieStyle)
      const runCount = history?.completionCount ?? 0
      if (runCount > 0) completed += 1
      career.totalRuns += Number.isFinite(runCount) ? Math.max(0, runCount) : 0
      career.totalBestScore += Number.isFinite(record.bestScore) ? Math.max(0, record.bestScore) : 0
      career.totalBadges += record.badgeCount
      career.totalContractWins += Number.isFinite(history?.contractWins)
        ? Math.max(0, history?.contractWins ?? 0)
        : 0
      career.totalFlightDistanceM = (career.totalFlightDistanceM ?? 0) + (Number.isFinite(history?.flightDistanceM)
        ? Math.max(0, history?.flightDistanceM ?? 0)
        : 0)
      career.bestPeakSpeedKts = Math.max(
        career.bestPeakSpeedKts ?? 0,
        Number.isFinite(history?.peakSpeedKts) ? Math.max(0, history?.peakSpeedKts ?? 0) : 0,
      )
      career.bestPeakAltitudeM = Math.max(
        career.bestPeakAltitudeM ?? 0,
        Number.isFinite(history?.peakAltitudeM) ? Math.max(0, history?.peakAltitudeM ?? 0) : 0,
      )
      if (courseMasteryTierForProgress({
        completionCount: runCount,
        bestScore: record.bestScore,
        badgeCount: record.badgeCount,
        contractWins: history?.contractWins,
        landingQuality: history?.landingQuality,
      }) === 'legend') mastered += 1
    }
    career.completedCourses = completed
    career.legendCourses = mastered
    career.styleVarietyCount = styleVariety.size
    currentPilotRank = pilotRankForProgress(career)
    currentPilotCommendations = pilotCommendationsForProgress(career)
    const rankLabel = pilotRankLabel(currentPilotRank)
    const masteryLabel = courseMasteryProgressLabel(mastered, curated.length)
    const opsBest = bestOpsStreak(opsStreaks)
    const opsLabel = opsBest > 0 ? `OPS BEST X${opsBest}` : ''
    titleProgress.textContent = [rankLabel, `COURSES ${completed}/${curated.length}`, masteryLabel, opsLabel]
      .filter(Boolean).join(' · ')
    titleProgress.setAttribute(
      'aria-label',
      `Pilot rank ${rankLabel}, ${completed} of ${curated.length} curated courses complete, ${mastered} legend courses${opsBest > 0 ? `, best Ops streak ${opsBest}` : ''}`,
    )
    if (titleCommendations) {
      const nextGoal = pilotRankNextGoalLabel(currentPilotRank)
      titleCommendations.textContent = [
        pilotCommendationsLabel(currentPilotCommendations),
        nextGoal,
      ].filter(Boolean).join(' · ')
      titleCommendations.hidden = false
    }
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
  const initialEngineVolume = readAudioChannelVolume(qualityStorage, 'engine')
  const initialEnvironmentVolume = readAudioChannelVolume(qualityStorage, 'environment')
  const initialEffectsVolume = readAudioChannelVolume(qualityStorage, 'effects')
  const initialKeyboardYaw = readKeyboardYawPreference(qualityStorage)
  const initialKeyboardRoll = readKeyboardRollPreference(qualityStorage)
  const initialKeyboardPitch = readKeyboardPitchPreference(qualityStorage)
  const initialKeyboardBindings = readKeyboardBindings(qualityStorage)
  const initialCameraSensitivity = readCameraSensitivityPreference(qualityStorage)
  const initialCameraSpeedFraming = readCameraSpeedFramingPreference(qualityStorage)
  const initialCameraAutoReturn = readCameraAutoReturnPreference(qualityStorage)
  const initialCameraEffects = readCameraEffectsPreference(qualityStorage)
  const initialReducedMotion = readReducedMotionPreference(qualityStorage)
  const initialHudDisplay = readHudDisplayPreference(qualityStorage)
  const initialGhostVisible = readGhostVisibilityPreference(qualityStorage)
  const initialCameraMode = readCameraModePreference(qualityStorage)
  const initialStabilityAssist = readStabilityAssistPreference(qualityStorage)
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

  let applyAircraftQuality: ((quality: RenderQuality) => void) | null = null
  let applyEffectsQuality: ((quality: RenderQuality) => void) | null = null
  let applyEffectsMotion: ((reduced: boolean) => void) | null = null
  let applyCameraQuality: ((quality: RenderQuality) => void) | null = null
  let applyRadarQuality: ((quality: RenderQuality) => void) | null = null
  let applyWorldQuality: ((quality: RenderQuality) => void) | null = null
  let applyRadarMotion: ((reduced: boolean) => void) | null = null
  let applyShadowQuality: ((mapSize: number) => void) | null = null
  let applyAdaptiveDetailScale: (() => void) | null = null
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
    applyWorldQuality?.(next)
    applyAdaptiveDetailScale?.()
    renderer.shadowMap.enabled = profile.shadows
    if (profile.shadows) {
      // A quality switch can re-enable shadows after Low, so refresh on the
      // next visible render instead of waiting for the cadence timer.
      renderer.shadowMap.needsUpdate = true
      shadowUpdateElapsed = SHADOW_UPDATE_STEP
    }
    if (qualitySelect) qualitySelect.value = next
    writeRenderQuality(qualityStorage, next)
  }
  applyRenderQuality(renderQuality)
  const onQualityChange = (): void => {
    if (!qualitySelect) return
    applyRenderQuality(normalizeRenderQuality(qualitySelect.value, renderQuality))
  }
  uiListeners.add(qualitySelect, 'change', onQualityChange)

  const world = new World(renderQuality)
  applyWorldQuality = (quality): void => world.setRenderQuality(quality)
  applyWorldQuality(renderQuality)
  applyAdaptiveDetailScale = (): void => {
    const ceiling = Math.max(.75, resolution.maximum)
    world.setAdaptiveDetailScale(MathUtils.clamp(resolution.ratio / ceiling, .5, 1))
  }
  applyAdaptiveDetailScale()
  if (replaySeed !== null) {
    const requestedReplaySeed = replaySeed
    const replayCourse = selectedCourse()
    world.reseed(
      replaySeed,
      replayCourse.profile ?? undefined,
      replayCourse.weather,
      replayCourse.timeOfDay,
      replayCourse.windSide,
      replayCourse.weatherShift,
    )
    replaySeedFallback = world.lastReseedUsedFallback
    if (titleSeedStatus) titleSeedStatus.textContent = worldSeedLaunchStatus(requestedReplaySeed, replaySeedFallback)
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
  world.setTrafficVisible(false)
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
  const warningObstacleSampler = (x: number, y: number, z: number): boolean =>
    world.hitObstacle(x, y, z, { x: 5.5, y: 2.5, z: 5.5 })
  // Seed the chase rig before the first title frame. Without an explicit pose
  // here, the paused title loop has no render delta to drive CameraSystem and
  // the hero camera stays at the origin until Play is pressed.
  cameras.setMode('chase', aircraft)
  cameras.setTitleFraming(aircraft)
  const applyCameraSensitivity = (next: CameraSensitivity): void => {
    const preference = normalizeCameraSensitivity(next)
    cameras.setLookSensitivity(cameraSensitivityMultiplier(preference) * 0.005)
    if (cameraSensitivitySelect) cameraSensitivitySelect.value = preference
    writeCameraSensitivityPreference(qualityStorage, preference)
  }
  applyCameraSensitivity(initialCameraSensitivity)
  const applyCameraSpeedFraming = (next: CameraSpeedFraming): void => {
    const framing = normalizeCameraSpeedFraming(next)
    cameras.setSpeedFramingScale(cameraSpeedFramingMultiplier(framing))
    if (cameraSpeedFramingSelect) cameraSpeedFramingSelect.value = framing
    writeCameraSpeedFramingPreference(qualityStorage, framing)
  }
  applyCameraSpeedFraming(initialCameraSpeedFraming)
  const applyCameraAutoReturn = (next: boolean): void => {
    const enabled = next === true
    cameras.setAutoReturnEnabled(enabled)
    if (cameraAutoReturnToggle) cameraAutoReturnToggle.checked = enabled
    writeCameraAutoReturnPreference(qualityStorage, enabled)
  }
  applyCameraAutoReturn(initialCameraAutoReturn)
  const applyCameraEffects = (next: boolean): void => {
    const enabled = next === true
    cameras.setCameraEffectsEnabled(enabled)
    if (cameraEffectsToggle) cameraEffectsToggle.checked = enabled
    writeCameraEffectsPreference(qualityStorage, enabled)
  }
  applyCameraEffects(initialCameraEffects)
  applyCameraQuality = (quality): void => cameras.setRenderQuality(quality)
  applyCameraQuality(renderQuality)
  const reducedMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null
  let userReducedMotion = initialReducedMotion
  let reducedMotion = false
  const syncReducedMotion = (): void => {
    // The in-game preference can opt into reduced motion even when the OS
    // setting is unchanged. An OS-level request remains authoritative.
    reducedMotion = userReducedMotion || !!reducedMotionQuery?.matches
    if (reducedMotionToggle) reducedMotionToggle.checked = userReducedMotion
    aircraft.setReducedMotion(reducedMotion)
    cameras.setReducedMotion(reducedMotion)
    world.atmosphere.setReducedMotion(reducedMotion)
    applyEffectsMotion?.(reducedMotion)
    applyRadarMotion?.(reducedMotion)
  }
  const applyReducedMotion = (next: boolean): void => {
    userReducedMotion = next === true
    if (reducedMotionToggle) reducedMotionToggle.checked = userReducedMotion
    writeReducedMotionPreference(qualityStorage, userReducedMotion)
    syncReducedMotion()
  }
  applyReducedMotion(initialReducedMotion)
  const onReducedMotionChange = (): void => syncReducedMotion()
  reducedMotionQuery?.addEventListener?.('change', onReducedMotionChange)
  const input = new InputManager()
  input.setKeyboardYawPreference(initialKeyboardYaw)
  input.setKeyboardRollPreference(initialKeyboardRoll)
  input.setKeyboardPitchPreference(initialKeyboardPitch)
  input.setKeyboardBindings(initialKeyboardBindings)
  input.setStabilityAssist(initialStabilityAssist)
  if (yawSelect) yawSelect.value = initialKeyboardYaw
  if (rollSelect) rollSelect.value = initialKeyboardRoll
  if (pitchSelect) pitchSelect.value = initialKeyboardPitch
  if (boostKeySelect) boostKeySelect.value = initialKeyboardBindings.boost
  if (airbrakeKeySelect) airbrakeKeySelect.value = initialKeyboardBindings.airbrake
  if (gearKeySelect) gearKeySelect.value = initialKeyboardBindings.gear
  if (stabilityAssistToggle) stabilityAssistToggle.checked = initialStabilityAssist
  const touchDevice = touchInputSupported(
    typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
  )
  const touchControls = touchRoot && touchDevice
    ? new TouchControls(touchRoot, (state) => input.setTouchState(state))
    : null
  const time = new Time()
  const hud = new HUD()
  const applyHudDisplay = (next: HudDisplay): void => {
    const display = normalizeHudDisplay(next)
    hud.setMinimal(display === 'minimal')
    if (hudDisplayToggle) hudDisplayToggle.checked = display === 'minimal'
    writeHudDisplayPreference(qualityStorage, display)
  }
  applyHudDisplay(initialHudDisplay)
  const missionLabelCache = createMissionHudLabelCache()
  const routeRiskLabelCache = createRouteRiskLabelCache()
  const collision = new CollisionSystem((jet) =>
    world.hitObstacleSegment(jet.previousPosition, jet.position),
  )
  const crashFx = new CrashFx(world.scene)
  const landingFx = new LandingFx(world.scene)
  const sonicBoomFx = new SonicBoomFx(world.scene)
  const waterWakeFx = new WaterWakeFx(world.scene)
  const speedStreakFx = new SpeedStreakFx(world.scene)
  const machConeFx = new MachConeFx(world.scene)
  const groundWakeFx = new GroundWakeFx(world.scene)
  applyEffectsQuality = (quality): void => {
    crashFx.setRenderQuality(quality)
    landingFx.setRenderQuality(quality)
    sonicBoomFx.setRenderQuality(quality)
    waterWakeFx.setRenderQuality(quality)
    speedStreakFx.setRenderQuality(quality)
    machConeFx.setRenderQuality(quality)
    groundWakeFx.setRenderQuality(quality)
  }
  applyEffectsMotion = (reduced): void => {
    crashFx.setReducedMotion(reduced)
    landingFx.setReducedMotion(reduced)
    sonicBoomFx.setReducedMotion(reduced)
    waterWakeFx.setReducedMotion(reduced)
    speedStreakFx.setReducedMotion(reduced)
    machConeFx.setReducedMotion(reduced)
    groundWakeFx.setReducedMotion(reduced)
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
  const applyKeyboardBindings = (next: KeyboardBindings): void => {
    const bindings = normalizeKeyboardBindings(next)
    input.setKeyboardBindings(bindings)
    if (boostKeySelect) boostKeySelect.value = bindings.boost
    if (airbrakeKeySelect) airbrakeKeySelect.value = bindings.airbrake
    if (gearKeySelect) gearKeySelect.value = bindings.gear
    if (boostKeyLabel) boostKeyLabel.textContent = keyboardBindingLabel(bindings.boost)
    if (airbrakeKeyLabel) airbrakeKeyLabel.textContent = keyboardBindingLabel(bindings.airbrake)
    if (gearKeyLabel) gearKeyLabel.textContent = keyboardBindingLabel(bindings.gear)
    writeKeyboardBindings(qualityStorage, bindings)
  }
  applyKeyboardBindings(initialKeyboardBindings)
  const onKeyboardBindingChange = (action: keyof KeyboardBindings, value: string): void => {
    const bindings = normalizeKeyboardBindings({ ...input.bindings, [action]: value as KeyboardBindingCode })
    applyKeyboardBindings(bindings)
    if (playing && !menu.paused && !results.open) {
      showBanner(`${action.toUpperCase()} KEY ${keyboardBindingLabel(bindings[action])}`, 1500, 'info')
    }
  }
  uiListeners.add(boostKeySelect, 'change', () => {
    if (boostKeySelect) onKeyboardBindingChange('boost', boostKeySelect.value)
  })
  uiListeners.add(airbrakeKeySelect, 'change', () => {
    if (airbrakeKeySelect) onKeyboardBindingChange('airbrake', airbrakeKeySelect.value)
  })
  uiListeners.add(gearKeySelect, 'change', () => {
    if (gearKeySelect) onKeyboardBindingChange('gear', gearKeySelect.value)
  })
  const onCameraSensitivityChange = (): void => {
    if (!cameraSensitivitySelect) return
    const preference = normalizeCameraSensitivity(cameraSensitivitySelect.value)
    applyCameraSensitivity(preference)
    if (playing && !menu.paused && !results.open) {
      showBanner(`CAMERA LOOK ${cameraSensitivityLabel(preference)}`, 1500, 'info')
    }
  }
  uiListeners.add(cameraSensitivitySelect, 'change', onCameraSensitivityChange)
  const onCameraSpeedFramingChange = (): void => {
    if (!cameraSpeedFramingSelect) return
    const framing = normalizeCameraSpeedFraming(cameraSpeedFramingSelect.value)
    applyCameraSpeedFraming(framing)
    if (playing && !menu.paused && !results.open) {
      showBanner(`SPEED FRAMING ${cameraSpeedFramingLabel(framing)}`, 1500, 'info')
    }
  }
  uiListeners.add(cameraSpeedFramingSelect, 'change', onCameraSpeedFramingChange)
  const onCameraAutoReturnChange = (): void => {
    const enabled = cameraAutoReturnToggle?.checked === true
    applyCameraAutoReturn(enabled)
    if (playing && !menu.paused && !results.open) {
      showBanner(enabled ? 'CAMERA AUTO-RETURN ON' : 'CAMERA AUTO-RETURN OFF', 1500, 'info')
    }
  }
  uiListeners.add(cameraAutoReturnToggle, 'change', onCameraAutoReturnChange)
  const onCameraEffectsChange = (): void => {
    const enabled = cameraEffectsToggle?.checked === true
    applyCameraEffects(enabled)
    if (playing && !menu.paused && !results.open) {
      showBanner(enabled ? 'CAMERA EFFECTS ON' : 'CAMERA EFFECTS OFF', 1500, 'info')
    }
  }
  uiListeners.add(cameraEffectsToggle, 'change', onCameraEffectsChange)
  const onReducedMotionChangeByUser = (): void => {
    applyReducedMotion(reducedMotionToggle?.checked === true)
    if (playing && !menu.paused && !results.open) {
      showBanner(reducedMotion ? 'REDUCED MOTION ON' : 'REDUCED MOTION OFF', 1500, 'info')
    }
  }
  uiListeners.add(reducedMotionToggle, 'change', onReducedMotionChangeByUser)
  const onHudDisplayChange = (): void => {
    const display: HudDisplay = hudDisplayToggle?.checked === true ? 'minimal' : 'full'
    applyHudDisplay(display)
    if (playing && !menu.paused && !results.open) {
      showBanner(display === 'minimal' ? 'MINIMAL HUD ON' : 'FULL HUD ON', 1500, 'info')
    }
  }
  uiListeners.add(hudDisplayToggle, 'change', onHudDisplayChange)
  const applyStabilityAssist = (next: boolean): void => {
    const enabled = next === true
    input.setStabilityAssist(enabled)
    if (stabilityAssistToggle) stabilityAssistToggle.checked = enabled
    writeStabilityAssistPreference(qualityStorage, enabled)
  }
  const onStabilityAssistChange = (): void => {
    const enabled = stabilityAssistToggle?.checked === true
    applyStabilityAssist(enabled)
    if (playing && !menu.paused && !results.open) {
      showBanner(
        input.stabilityAssistEnabled ? 'FLIGHT ASSIST ON / PITCH + BANK TRIM' : 'FLIGHT ASSIST OFF',
        1600,
        'info',
      )
    }
  }
  uiListeners.add(stabilityAssistToggle, 'change', onStabilityAssistChange)
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
  const applyAudioChannel = (channel: AudioChannel, next: number): void => {
    const volume = normalizeAudioChannelVolume(next)
    audio.setChannelVolume(channel, volume)
    const range = channel === 'engine'
      ? engineVolumeRange
      : channel === 'environment' ? environmentVolumeRange : effectsVolumeRange
    const output = channel === 'engine'
      ? engineVolumeValue
      : channel === 'environment' ? environmentVolumeValue : effectsVolumeValue
    if (range) range.value = String(Math.round(volume * 100))
    if (output) output.textContent = audioVolumePercent(volume)
    writeAudioChannelVolume(qualityStorage, channel, volume)
  }
  applyAudioChannel('engine', initialEngineVolume)
  applyAudioChannel('environment', initialEnvironmentVolume)
  applyAudioChannel('effects', initialEffectsVolume)
  const onEngineVolumeInput = (): void => {
    if (engineVolumeRange) applyAudioChannel('engine', Number(engineVolumeRange.value) / 100)
  }
  const onEnvironmentVolumeInput = (): void => {
    if (environmentVolumeRange) applyAudioChannel('environment', Number(environmentVolumeRange.value) / 100)
  }
  const onEffectsVolumeInput = (): void => {
    if (effectsVolumeRange) applyAudioChannel('effects', Number(effectsVolumeRange.value) / 100)
  }
  uiListeners.add(engineVolumeRange, 'input', onEngineVolumeInput)
  uiListeners.add(environmentVolumeRange, 'input', onEnvironmentVolumeInput)
  uiListeners.add(effectsVolumeRange, 'input', onEffectsVolumeInput)
  const results = new RunResults()
  const challenge = new ChallengeRun()
  const ghost = new GhostReplay(world.scene, qualityStorage)
  const stunts = new StuntTracker()
  const combo = new FlightComboTracker()
  const altitudeMilestones = new AltitudeMilestoneTracker()
  const warningTracker = new FlightWarningTracker()
  const supersonic = new SupersonicTracker()
  const radar = new RadarSystem()
  applyRadarQuality = (quality): void => radar.setRenderQuality(quality)
  applyRadarQuality(renderQuality)
  applyRadarMotion = (reduced): void => radar.setReducedMotion(reduced)
  applyRadarMotion(reducedMotion)
  let debug: DebugOverlay | null = null
  if (isDebugEnabled()) {
    const { DebugOverlay: DebugOverlayClass } = await import('./debug/DebugOverlay')
    debug = new DebugOverlayClass(world.scene)
    debug.syncPad()
  }

  let disposed = false
  let contextLost = false
  let resizeFrame: number | null = null
  const shareReplayButton = document.getElementById('btn-share-replay') as HTMLButtonElement | null
  results.setShareReplayHandler(() => {
    const seed = world.worldSeed
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    const href = typeof window !== 'undefined' ? window.location.href : ''
    void copyWorldSeedLink(
      seed,
      clipboard,
      href,
      selectedCourseId,
      selectedCourseReplayKey(),
    ).then((copied) => {
      if (disposed || !shareReplayButton) return
      shareReplayButton.textContent = copied ? 'Replay link copied' : 'Copy blocked'
      shareReplayButton.setAttribute(
        'aria-label',
        copied ? 'Replay link copied' : 'Copy replay link blocked by browser permissions',
      )
    })
  })
  results.setCopySummaryHandler(() => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    void copySortieSummary(results.summaryText, clipboard).then((copied) => {
      if (disposed) return
      results.setCopySummaryFeedback(copied)
    })
  })
  results.setCopySeedHandler(() => {
    const seed = world.worldSeed
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    void copyWorldSeed(seed, clipboard).then((copied) => {
      if (disposed) return
      results.setCopySeedFeedback(copied)
    })
  })
  results.setLoadSeedHandler(() => {
    const seed = normalizeWorldSeed(world.worldSeed)
    if (seed === null || !Number.isSafeInteger(seed)) return
    replaySeed = seed
    selectedCourseId = 'random'
    if (titleSeedInput) titleSeedInput.value = formatWorldSeed(seed)
    replaySeedFallback = false
    if (titleSeedStatus) titleSeedStatus.textContent = worldSeedLaunchStatus(seed)
    writeSelectedCourseId(qualityStorage, selectedCourseId)
    for (const picker of coursePickers) picker.setValue(selectedCourseId)
    quitToTitle()
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
    sonicBoomFx.dispose()
    waterWakeFx.dispose()
    speedStreakFx.dispose()
    machConeFx.dispose()
    groundWakeFx.dispose()
    debug?.dispose()
    aircraft.dispose()
    renderer.dispose()
  }
  window.addEventListener('beforeunload', disposeRuntime, { once: true })

  let playing = false
  let ghostVisible = initialGhostVisible
  let cameraPreference = initialCameraMode
  let banner: string | null = null
  let crashMessage = 'CRASH - press R'
  let bannerTone: HudBannerTone = 'info'
  let bannerUntil = 0
  let bannerPausedRemainingMs: number | null = null
  let wasAirborne = false
  let prevAfterburner = false
  let prevAirbrake = false
  let prevAfterburnerLockout = false
  let prevAfterburnerHeatLockout = false
  let prevFuelAvailable = true
  let engineOut = false
  let prevGearDown = true
  let prevLightning = false
  let previousCloudBand: CloudImmersionBand = 'clear'
  let cloudBandPrimed = false
  let thermalLiftActive = false
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
    effectivePower: 0,
    speed: 0,
    rain: 0,
    snow: 0,
    weatherGust: 0,
    cloudImmersion: 0,
    mute: true,
    dt: 1 / 60,
    cockpit: false,
  }
  const hudFrame: Parameters<HudInstance['update']>[0] = {
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
    worldSeed: 0,
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
    liveScore: null,
    gateQuality: null,
    altitudeMilestone: null,
    thermalLift: 0,
    biomeCount: 0,
    waterBodyCount: 0,
    terrainRegion: '',
    navDist: 0,
    navBearing: null,
    navAltDelta: 0,
    combo: 0,
    comboRemaining: 0,
    radar: [],
    trafficAlertSide: null,
    trafficAlertVertical: null,
    trafficAlertDistance: null,
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
  let prevTrafficAlertId = ''
  let trafficAlertUntilMs = 0
  const groundSurface: GroundSurfaceSample = { height: 0, kind: 'land' }
  let terrainClearanceM = 0
  let biomeSurveyCooldown = 0
  let terrainRegion = ''
  let overWater = false
  let refueling = false
  let prevFuelHomeCue: FuelHomeCue = null
  const returnTarget = new Vector3()

  const courseId = (): string => courseSessionId(
    selectedCourseId,
    world.worldSeed,
    world.mission.routeProfile,
    selectedCourseReplayKey(),
    seededRandomWorld,
  )

  let lastInputContextLive: boolean | null = null
  const syncInputContext = (): void => {
    const live = playing && !menu.paused && !results.open
    hud.setPaused(menu.paused)
    hud.setBackgroundHidden(hudBackgroundHidden(menu.open, results.open))
    const contextNow = performance.now()
    if (lastInputContextLive === true && !live && banner) {
      bannerPausedRemainingMs = bannerRemainingMs(contextNow, bannerUntil)
      bannerUntil = Number.POSITIVE_INFINITY
    } else if (lastInputContextLive === false && live && banner && bannerPausedRemainingMs !== null) {
      bannerUntil = bannerUntilFromRemaining(contextNow, bannerPausedRemainingMs)
      bannerPausedRemainingMs = null
    }
    if (live === lastInputContextLive) return
    lastInputContextLive = live
    input.setFlightLive(live)
    setFlightKeyCapture(live)
  }

  const showBanner = (text: string, ms = 2800, tone: HudBannerTone = 'info'): void => {
    banner = text
    bannerTone = tone
    const safeMs = Number.isFinite(ms) ? Math.max(0, Math.min(MAX_BANNER_DURATION_MS, ms)) : 2800
    if (lastInputContextLive === false) {
      bannerPausedRemainingMs = safeMs
      bannerUntil = Number.POSITIVE_INFINITY
    } else {
      bannerPausedRemainingMs = null
      bannerUntil = performance.now() + safeMs
    }
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
    let worldFallback = false
    if (newWorld) {
      const course = selectedCourse()
      world.reseed(
        replaying ? replaySeed! : course.seed ?? undefined,
        course.profile ?? undefined,
        course.weather,
        course.timeOfDay,
        course.windSide,
        course.weatherShift,
      )
      worldFallback = world.lastReseedUsedFallback
      replaySeedFallback = worldFallback
      if (!worldFallback) {
        seededRandomWorld = replaying && selectedCourseId === 'random'
        replaySeed = null
      }
      if (replaying && !worldFallback) {
        if (titleSeedInput) titleSeedInput.value = ''
        if (titleSeedStatus) titleSeedStatus.textContent = ''
      } else if (replaying && titleSeedStatus) {
        titleSeedStatus.textContent = worldSeedLaunchStatus(replaySeed!, true)
      }
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
    sonicBoomFx.reset()
    waterWakeFx.reset()
    speedStreakFx.reset()
    machConeFx.reset()
    groundWakeFx.reset()
    stunts.reset()
    combo.reset()
    altitudeMilestones.reset()
    warningTracker.reset()
    input.clearQueued()
    input.resetFlightControls(0)
    const activeCourseId = courseId()
    if (seededRandomWorld) touchSeededRandomCourseRecord(qualityStorage, activeCourseId)
    challenge.reset(
      activeCourseId,
      world.mission.totalGates,
      world.mission.scoringFocus,
      world.worldSeed,
      selectedCourse().contractCatalog === true,
    )
    ghost.reset(activeCourseId)
    ghost.setVisible(playing && ghostVisible)
    challenge.recordBiome(world.spawn.biome)
    terrainRegion = terrainRegionLabel(world.spawn.biome)
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
    thermalLiftActive = false
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
    prevTrafficAlertId = ''
    trafficAlertUntilMs = 0
    biomeSurveyCooldown = 0
    overWater = false
    refueling = false
    prevFuelHomeCue = null
    controlHintUntilMs = briefing ? performance.now() + 16_000 : 0
    time.reset()
    if (briefing) {
      const resetLabel = worldFallback
        ? 'WORLD REBUILD FAILED / CURRENT WORLD RETAINED'
        : newWorld
        ? replaying
          ? `REPLAY SEED ${formatWorldSeed(world.worldSeed)}`
          : 'NEW WORLD'
          : replaySeed !== null
            ? `REPLAY SEED ${formatWorldSeed(replaySeed)}`
            : 'RETRY SAME COURSE'
      showBanner(`${resetLabel} / ${world.mission.routeBriefing}`, 7000)
    }
  }

  const onCourseChange = (id: string): void => {
    selectedCourseId = courseDefinitionForId(id).id
    seededRandomWorld = false
    replaySeed = null
    replaySeedFallback = false
    if (titleSeedInput) titleSeedInput.value = ''
    if (titleSeedStatus) titleSeedStatus.textContent = ''
    writeSelectedCourseId(qualityStorage, selectedCourseId)
    rememberRecentCourse(selectedCourseId)
    for (const picker of coursePickers) picker.setValue(selectedCourseId)
  }
  for (const picker of coursePickers) {
    picker.onChange(onCourseChange)
    picker.onFavorite(setCourseFavorite)
  }
  const applyCustomSeed = (): void => {
    const seed = parseWorldSeed(titleSeedInput?.value)
    if (seed === null) {
      if (titleSeedStatus) titleSeedStatus.textContent = 'INVALID SEED · USE A SAFE INTEGER'
      return
    }
    replaySeed = seed
    selectedCourseId = 'random'
    seededRandomWorld = false
    if (titleSeedInput) titleSeedInput.value = formatWorldSeed(seed)
    replaySeedFallback = false
    if (titleSeedStatus) titleSeedStatus.textContent = worldSeedLaunchStatus(seed)
    writeSelectedCourseId(qualityStorage, selectedCourseId)
    for (const picker of coursePickers) picker.setValue(selectedCourseId)
  }
  uiListeners.add(titleSeedLoad, 'click', applyCustomSeed)
  uiListeners.add(titleSeedInput, 'keydown', (event: Event) => {
    if ((event as KeyboardEvent).key === 'Enter') applyCustomSeed()
  })
  const onProgressStorageChange = (event: Event): void => {
    const storageEvent = event as StorageEvent
    const key = storageEvent.key
    if (shouldResetSeededRandomWorldForStorageKey(key)) {
      seededRandomWorld = false
      selectedCourseId = readSelectedCourseId(qualityStorage)
      replaySeed = null
      replaySeedFallback = false
      if (titleSeedInput) titleSeedInput.value = ''
      if (titleSeedStatus) titleSeedStatus.textContent = ''
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
    if (key === COURSE_RECENTS_STORAGE_KEY || key === null) {
      recentCourseIds = readRecentCourseIds(qualityStorage)
      refreshCourseSelectorLabels()
    }
    if (key === COURSE_FAVORITES_STORAGE_KEY || key === null) {
      favoriteCourseIds = readCourseFavoriteIds(qualityStorage)
      refreshCourseSelectorLabels()
    }
    if (key === COURSE_PICKER_CATEGORY_STORAGE_KEY || key === COURSE_PICKER_SORT_STORAGE_KEY || key === null) {
      const category = readCoursePickerCategory(qualityStorage)
      const sort = readCoursePickerSort(qualityStorage)
      for (const picker of coursePickers) picker.setBrowseState(category, sort)
    }
  }
  uiListeners.add(window, 'storage', onProgressStorageChange)

  const startGame = (): void => {
    if (playing) return
    rememberRecentCourse(selectedCourseId)
    playing = true
    cameras.setMode(cameraPreference, aircraft)
    world.setSettlementsVisible(true)
    world.setTrafficVisible(true)
    menu.close()
    results.hide()
    titleScreen?.classList.add('is-hidden')
    if (overlay) {
      overlay.hidden = false
      overlay.classList.remove('overlay-hidden')
    }
    resetFlight(shouldRegenerateWorldOnLaunch(selectedCourseId, replaySeed), true)
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
    world.setTrafficVisible(false)
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

  const resetSettings = (): void => {
    resetFlightPreferences(qualityStorage)
    applyRenderQuality(renderQualityFallback)
    applyAudioVolume(1)
    applyAudioChannel('engine', 1)
    applyAudioChannel('environment', 1)
    applyAudioChannel('effects', 1)
    applyKeyboardYaw(DEFAULT_KEYBOARD_YAW)
    applyKeyboardRoll(DEFAULT_KEYBOARD_ROLL)
    applyKeyboardPitch(DEFAULT_KEYBOARD_PITCH)
    applyKeyboardBindings(DEFAULT_KEYBOARD_BINDINGS)
    applyCameraSensitivity(DEFAULT_CAMERA_SENSITIVITY)
    applyCameraSpeedFraming(DEFAULT_CAMERA_SPEED_FRAMING)
    applyCameraAutoReturn(DEFAULT_CAMERA_AUTO_RETURN)
    applyCameraEffects(DEFAULT_CAMERA_EFFECTS)
    applyReducedMotion(DEFAULT_REDUCED_MOTION)
    applyHudDisplay(DEFAULT_HUD_DISPLAY)
    applyStabilityAssist(DEFAULT_STABILITY_ASSIST)
    cameraPreference = DEFAULT_CAMERA_MODE
    writeCameraModePreference(qualityStorage, cameraPreference)
    cameras.setMode(cameraPreference, aircraft)
    ghostVisible = DEFAULT_GHOST_VISIBLE
    writeGhostVisibilityPreference(qualityStorage, ghostVisible)
    ghost.setVisible(ghostVisible && playing)
    if (playing) showBanner('SETTINGS RESET TO DEFAULTS', 1800, 'info')
  }

  uiListeners.add(playBtn, 'click', () => startGame())
  uiListeners.add(resetSettingsButton, 'click', resetSettings)
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
  let lastRenderMs = Number.NaN
  let lastRenderedSimulationLive = false
  const tick = (nowMs: number): void => {
    if (disposed) return
    requestAnimationFrame(tick)

    syncInputContext()
    overlay?.classList.toggle('cockpit-clean', cameras.mode === 'cockpit')
    const simLive = playing && !menu.paused && !results.open
    touchControls?.setVisible(touchDevice && simLive)
    if (!simLive) lastHudUpdateMs = Number.NaN
    const pixelRatio = resolution.update(nowMs - previousFrame, simLive && !document.hidden)
    previousFrame = nowMs
    if (Math.abs(renderer.getPixelRatio() - pixelRatio) > .001) {
      renderer.setPixelRatio(pixelRatio)
      // Pixel density and shader detail recover together. Compare against the
      // active ceiling so a low-DPI device does not shed detail at boot.
      applyAdaptiveDetailScale?.()
    }
    let visualDt = 0
    let simDt = 0
    let stormDrive = 0
    let stormHudDrive = 0
    if (!simLive) {
      time.skipFrame(nowMs)
      aircraft.controls = input.sampleWithDt(0)
      if (!playing) input.resetFlightControls(0)
      aircraft.setStormBuffet(0)
      cameras.setStormBuffet(0)
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
      // Weather drive feeds the HUD cue; gear scale only damps camera / airframe.
      stormHudDrive = stormBuffetDrive(weather.rain, weather.snow, weather.gust, {
        reducedMotion,
        paused: menu.paused,
        playing,
        crashed: aircraft.status === 'crashed',
      })
      stormDrive = stormHudDrive * stormBuffetGearScale(aircraft.controls.gearDown)
      aircraft.setStormBuffet(stormDrive)
      cameras.setStormBuffet(stormDrive)

      if (input.consumeCameraToggle()) {
        const mode = cameras.toggleMode(aircraft)
        cameraPreference = mode
        writeCameraModePreference(qualityStorage, mode)
        showBanner(cameraModeCue(mode), 1200, 'info')
      }
      if (input.consumeGhostToggle()) {
        ghostVisible = !ghostVisible
        writeGhostVisibilityPreference(qualityStorage, ghostVisible)
        ghost.setVisible(ghostVisible && playing)
        showBanner(ghostVisible ? 'GHOST PATH ON' : 'GHOST PATH OFF', 1200, 'info')
      }
      const stabilityAssist = input.consumeStabilityAssistToggle()
      if (stabilityAssist !== null) {
        writeStabilityAssistPreference(qualityStorage, stabilityAssist)
        showBanner(
          stabilityAssist ? 'FLIGHT ASSIST ON / PITCH + BANK TRIM' : 'FLIGHT ASSIST OFF',
          1600,
          'info',
        )
      }
      if (input.consumeWeatherCycle()) {
        if (world.weatherCycleLocked) {
          showBanner('COURSE WEATHER LOCKED', 1800, 'info')
        } else {
          world.cycleWeather()
          showBanner(weatherCycleBanner(world.atmosphere.weatherLabel), 1800, 'info')
        }
      }
      if (input.consumeWorldSeedCopy()) {
        const seed = world.worldSeed
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
        const href = typeof window !== 'undefined' ? window.location.href : ''
        void copyWorldSeedLink(
          seed,
          clipboard,
          href,
          selectedCourseId,
          selectedCourseReplayKey(),
        ).then((copied) => {
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
        const thermalLift = thermalLiftIntensity(
          world.worldSeed,
          aircraft.position.x,
          aircraft.position.y - world.spawn.y,
          aircraft.position.z,
          world.atmosphere.daylight,
          weather.rain,
          weather.snow,
          aircraft.status === 'ok' && !aircraft.onGround,
        )
        aircraft.setThermalLift(thermalLift)
        if (thermalLift >= 0.34 && !thermalLiftActive && (!banner || bannerUntil <= nowMs)) {
          showBanner('THERMAL LIFT / RIDE THE COLUMN', 1400, 'info')
        }
        thermalLiftActive = thermalLift >= 0.2
        aircraft.step(dt, nowMs)
        if (supersonic.update(aircraft.speed) === 'boom') {
          audio.playCue('sonic-boom')
          sonicBoomFx.trigger(aircraft.position, aircraft.orientation)
          if (!banner || bannerUntil <= nowMs) showBanner('MACH 1 / SONIC BOOM', 1500, 'success')
        }
        const comboExpired = combo.update(dt)
        if (combo.consumeExpiryWarning()) showBanner('COMBO ENDING / HIT A GATE OR STUNT', 1100, 'info')
        if (comboExpired) showBanner('COMBO EXPIRED / KEEP FLYING', 1200, 'info')

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
          const alt = aircraft.altitudeAgl
          terrainClearanceM = alt
          if (!aircraft.onGround && alt > 8) {
            wasAirborne = true
            aircraft.clearLanded()
          }
          if (touch === 'crash' || touch === 'ditch') {
            const ditching = touch === 'ditch'
            crashMessage = ditching
              ? 'DITCHING / WATER CONTACT - press R'
              : `CRASH / ${contactFailureLabel(collision.failureReason)} - press R`
            _crashPoint.copy(aircraft.position)
            _crashVelocity.copy(aircraft.velocity)
            if (ditching) waterWakeFx.triggerDitch(_crashPoint, _crashVelocity)
            if (cameras.mode === 'cockpit') cameras.setMode('chase', aircraft)
            aircraft.crash()
            const crashed = challenge.crashDebrief(
              ditching,
              ditching ? 'WATER CONTACT' : contactFailureLabel(collision.failureReason),
            )
            combo.break()
            crashFx.trigger(_crashPoint, _crashVelocity)
            cameras.impulse(1)
            audio.playCue(ditching ? 'ditch' : 'crash')
            showBanner(crashMessage, 1600, 'danger')
            results.show(
              crashed,
              currentPilotRank,
              false,
              [],
              selectedCourse().label,
              courseConditionSummary(
                selectedCourse(),
                selectedCoursePeriodKey(),
              ),
              world.worldSeed,
            )
            syncInputContext()
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
              const previousPilotRank = currentPilotRank
              const previousPilotCommendations = currentPilotCommendations
              ghost.commitIfBest(finished.isNewBest, finished.totalScore)
              ghost.setVisible(false)
              audio.playCue(
                finished.landingLabel === 'BUTTER'
                  ? 'landing-soft'
                  : finished.landingLabel === 'HARD' ? 'landing-hard' : 'landed',
              )
              const opsUpdate = recordOpsCompletion(
                qualityStorage,
                opsStreaks,
                selectedCourseId,
                selectedCourseReplayKey(),
              )
              if (opsUpdate) opsStreaks = opsUpdate.snapshot
              refreshCourseUi()
              const careerRankPromoted = pilotRankRank(currentPilotRank) > pilotRankRank(previousPilotRank)
              const newCareerCommendations = currentPilotCommendations
                .filter(id => !previousPilotCommendations.includes(id))
                .map(pilotCommendationLabel)
              if (flightRecordCueLabel(finished) || finished.masteryTierPromoted || careerRankPromoted || newCareerCommendations.length > 0) {
                audio.playCue('milestone')
              }
              results.show(
                finished,
                currentPilotRank,
                careerRankPromoted,
                newCareerCommendations,
                selectedCourse().label,
                courseConditionSummary(
                  selectedCourse(),
                  selectedCoursePeriodKey(),
                ),
                world.worldSeed,
              )
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
        const contractProgressCue = challenge.consumeContractProgressCue()
        if (contractProgressCue && (!banner || bannerUntil <= nowMs)) {
          showBanner(`CONTRACT UPDATE / ${contractProgressCue}`, 1500, 'info')
        }

        biomeSurveyCooldown = Math.max(0, biomeSurveyCooldown - dt)
        if (biomeSurveyCooldown <= 0 && aircraft.status === 'ok' && !aircraft.onGround) {
          const sampled = world.terrain.sampleMeshSurface(aircraft.position.x, aircraft.position.z) ??
            sampleTerrainSurface(aircraft.position.x, aircraft.position.z)
          terrainRegion = terrainRegionLabel(sampled.biome, sampled.waterBody)
          challenge.recordBiome(sampled.biome)
          challenge.recordWater(sampled.kind === 'water', 0.65, true)
          challenge.recordWaterSkim(sampled.kind === 'water', terrainClearanceM, 0.65, true)
          challenge.recordRidgeRun(sampled.biome, terrainClearanceM, 0.65, true)
          challenge.recordWaterBody(sampled.waterBody, true)
          const biomeCue = challenge.consumeBiomeSurveyCue()
          const waterCue = challenge.consumeWaterBodySurveyCue()
          if (waterCue && (!banner || bannerUntil <= nowMs)) {
            const waterLabel = waterCue === 'sea' ? 'SEA' : waterCue.toUpperCase()
            showBanner(
              `WATERWAY DISCOVERED / ${waterLabel} / X${challenge.waterBodyCount}`,
              1500,
              'info',
            )
          } else if (biomeCue && (!banner || bannerUntil <= nowMs)) {
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
          weather.gust,
          aircraft.thermalLift,
        )
        ghost.record(challenge.elapsedSec, aircraft.position)
      }

      world.mission.setRouteTraceVisible(
        playing && !menu.paused && !results.open && aircraft.status !== 'crashed' && cameras.mode !== 'cockpit',
      )
      world.mission.tick(
        nowMs,
        aircraft.displayPosition.x,
        aircraft.displayPosition.y,
        aircraft.displayPosition.z,
        simLive,
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
    const cloudBand = cloudImmersionBand(world.atmosphere.cloudImmersionLevel)
    if (!cloudBandPrimed) {
      previousCloudBand = cloudBand
      cloudBandPrimed = true
    } else if (
      cloudBand !== previousCloudBand &&
      simLive &&
      playing &&
      !menu.paused &&
      !results.open &&
      aircraft.status !== 'crashed' &&
      (!banner || bannerUntil <= nowMs)
    ) {
      const cue = cloudBand === 'inside'
        ? 'CLOUD ENTRY / VISIBILITY REDUCED'
        : cloudBand === 'edge'
          ? 'CLOUD EDGE / VISIBILITY SHIFTING'
          : 'CLOUD BREAK / VISIBILITY RESTORING'
      showBanner(cue, 1600, 'info')
    }
    previousCloudBand = cloudBand
    const weatherForExposure = world.atmosphere.weatherSnapshot
    const nightReadability = nightWeatherReadability(
      world.atmosphere.daylight,
      Math.max(weatherForExposure.rain, weatherForExposure.snow),
      Math.max(weatherForExposure.lowClouds, weatherForExposure.midClouds * 0.9),
    )
    const exposure = sceneExposure(world.atmosphere.daylight, crashFx.bloom, nightReadability)
    if (Math.abs(renderer.toneMappingExposure - exposure) > 0.001) {
      renderer.toneMappingExposure = exposure
    }
    aircraft.setNightReadability(world.atmosphere.daylight)
    crashFx.update(simLive ? visualDt : 0)
    landingFx.update(simLive ? visualDt : 0)
    sonicBoomFx.update(simLive ? visualDt : 0)
    waterWakeFx.update(
      simLive ? visualDt : 0,
      aircraft.position,
      aircraft.velocity,
      terrainClearanceM,
      overWater,
      aircraft.onGround,
    )
    speedStreakFx.update(
      aircraft.displayPosition,
      aircraft.displayOrientation,
      aircraft.speed,
      aircraft.engineState.afterburnerActive,
      aircraft.onGround,
      playing && simLive && aircraft.status !== 'crashed' && cameras.mode !== 'cockpit',
    )
    machConeFx.update(
      aircraft.displayPosition,
      aircraft.displayOrientation,
      aircraft.speed,
      aircraft.onGround,
      playing && simLive && aircraft.status !== 'crashed' && cameras.mode !== 'cockpit',
    )
    const wakeWeather = world.atmosphere.weatherSnapshot
    waterWakeFx.setWeather(wakeWeather.rain, wakeWeather.snow)
    groundWakeFx.setWeather(wakeWeather.rain, wakeWeather.snow)
    groundWakeFx.update(
      aircraft.displayPosition,
      aircraft.velocity,
      terrainClearanceM,
      overWater,
      aircraft.onGround,
      playing && simLive && aircraft.status !== 'crashed' && cameras.mode !== 'cockpit',
    )

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
    const afterburnerFuelLocked = !aircraft.engineState.fuelAvailable
    const afterburnerHeatLocked = aircraft.engineHeat.afterburnerLocked
    const afterburnerLocked = afterburnerLockReason(
      aircraft.engineState.fuelAvailable,
      afterburnerHeatLocked,
    ) !== null
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
    audioFrame.effectivePower = aircraft.engineState.effectivePower
    audioFrame.airbrake = airbrakeOpen
    audioFrame.speed = aircraft.speed
    const precipitation = world.atmosphere.weatherSnapshot
    audioFrame.rain = precipitation.rain
    audioFrame.snow = precipitation.snow
    audioFrame.weatherGust = precipitation.gust
    audioFrame.cloudImmersion = world.atmosphere.cloudImmersionLevel
    audioFrame.cockpit = cameras.mode === 'cockpit'
    audioFrame.mute =
      audioMuted || document.hidden || !playing || menu.paused || results.open || aircraft.status === 'crashed'
    audioFrame.dt = visualDt || 1 / 60
    audio.update(audioFrame)

    // A hidden tab cannot present a frame. Keep simulation and streaming alive,
    // but avoid submitting camera/debug/render work until the tab is visible.
    if (shouldRenderFrame(document.hidden, contextLost) && staticRenderDue(
      nowMs,
      lastRenderMs,
      simLive,
      lastRenderedSimulationLive,
    )) {
      if (renderer.shadowMap.enabled) {
        shadowUpdateElapsed += Math.max(0, visualDt)
        if (shadowUpdateDue(shadowUpdateElapsed, 0, SHADOW_UPDATE_STEP)) {
          renderer.shadowMap.needsUpdate = true
          shadowUpdateElapsed %= SHADOW_UPDATE_STEP
        }
      }
      cameras.update(aircraft, visualDt)
      const renderStart = debug ? performance.now() : 0
      renderer.render(world.scene, cameras.camera)
      if (debug) {
        debug.update(aircraft, world.spawn, cameras.modeLabel, time.fps, {
          renderMs: performance.now() - renderStart,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          streaming: world.terrain.streamingStats,
        })
      }
      lastRenderMs = nowMs
      lastRenderedSimulationLive = simLive
    }

    if (shouldUpdateLiveHud(playing, simLive) && hudUpdateDue(renderQuality, nowMs, lastHudUpdateMs)) {
      const previousHudUpdateMs = lastHudUpdateMs
      lastHudUpdateMs = nowMs
      const alt = aircraft.onGround ? 0 : aircraft.altitudeAgl
      const pose = attitudeFromOrientation(aircraft.orientation)
      const hudStepSec = Number.isFinite(previousHudUpdateMs) && previousHudUpdateMs >= 0
        ? Math.min(.5, Math.max(0, (nowMs - previousHudUpdateMs) / 1000))
        : 0
      const warn = warningTracker.update(
        evaluateWarnings(aircraft, alt, warningObstacleSampler),
        hudStepSec,
      )
      if (warn.text !== prevWarning) {
        const warningCue = warningCueForState(warn)
        if (warningCue) audio.playCue(warningCue)
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
      let approachPreviewScore = Number.NaN
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
        const baseDx = aircraft.position.x - world.spawn.x
        const baseDz = aircraft.position.z - world.spawn.z
        const headingError = pose.heading - world.spawn.yaw
        approachPreviewScore = landingApproachScore({
          baseDistanceM: Math.hypot(baseDx, baseDz),
          runwayLateralM: lateralOffset,
          headingErrorRad: Math.atan2(Math.sin(headingError), Math.cos(headingError)),
        })
        navLateral = navigationLateralCue(lateralOffset, 'base')
        navSpeed = navigationSpeedCue(aircraft.speed, 'base')
        navGlide = navigationGlideCueFromTargetDelta(navDist, navAltDelta, 'base')
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
      const homeSeconds = returning || emergencyReturn
        ? fuelHomeTimeSeconds(navDist, aircraft.speed)
        : null
      const enduranceSeconds = returning || emergencyReturn
        ? fuelEnduranceSeconds(
          aircraft.fuel.fraction,
          aircraft.engineState.lever,
          aircraft.engineState.afterburnerActive,
        )
        : null
      const homeCue = fuelHomeCue(enduranceSeconds, homeSeconds)
      const fuelWarning = fuelHomeWarning(homeCue, prevFuelHomeCue)
      if (
        fuelWarning &&
        aircraft.status === 'ok' &&
        (!banner || bannerUntil <= nowMs)
      ) {
        showBanner(fuelWarning, 2600, homeCue === 'low' ? 'danger' : 'info')
      }
      prevFuelHomeCue = returning || emergencyReturn ? homeCue : null
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
          world.traffic.getRadarLandmarks(
            aircraft.position.x,
            aircraft.position.z,
            RADAR_RANGE_METERS,
          ),
          aircraft.position.y,
        )
        radarNextUpdateMs = nowMs + RADAR_UPDATE_INTERVAL_MS
        if (radar.consumeLockLost() && (!banner || bannerUntil <= nowMs)) {
          audio.playCue('radar-lost')
          showBanner('RADAR LOCK LOST', 1400, 'danger')
        }
      }
      if (radarTargetCycleQueued) {
        radarTargetCycleQueued = false
        const selected = radar.cycleTarget()
        const selectedKind = selected?.kind === 'city' || selected?.kind === 'village'
          ? selected.kind
          : undefined
        challenge.recordRadarLock(selected !== null, selectedKind, selected?.id)
        audio.playCue(selected ? 'radar-lock' : 'radar-lost')
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
            challenge.recordDestination(selectedRadarTarget.kind, selectedRadarTarget.id)
          }
          showBanner(radarTargetArrivalLabel(selectedRadarTarget.kind), 2000, 'success')
          radar.clearTarget()
        }
      }
      if (aircraft.status === 'ok' && !aircraft.onGround && nowMs >= radarDiscoveryCooldownUntil) {
        for (const contact of radarContacts) {
          if (contact.kind === 'gate' || contact.kind === 'traffic' || !contact.id || radarDiscovered.has(contact.id)) continue
          radarDiscovered.add(contact.id)
          radarDiscoveryCooldownUntil = nowMs + 2400
          showBanner(radarDiscoveryLabel(contact.kind, contact.biome, contact.name), 2800, 'success')
          break
        }
      }
      const trafficAlert = aircraft.status === 'ok' && !aircraft.onGround
        ? world.traffic.closestAlert(
          aircraft.position.x,
          aircraft.position.y,
          aircraft.position.z,
          pose.heading,
        )
        : null
      let trafficSideCue: 'LEFT' | 'RIGHT' | 'AHEAD' | 'BEHIND' | null = null
      let trafficVerticalCue: 'ABOVE' | 'BELOW' | 'LEVEL' | null = null
      if (!trafficAlert) {
        prevTrafficAlertId = ''
      } else {
        trafficSideCue = trafficAlertSide(trafficAlert.bearing)
        trafficVerticalCue = trafficAlertVertical(trafficAlert.verticalOffset)
        const newTrafficContact = trafficAlert.id !== prevTrafficAlertId
        if (newTrafficContact) {
          challenge.recordTrafficPass(trafficAlert.id, trafficAlert.verticalSeparation)
        }
        if (
          newTrafficContact &&
          nowMs >= trafficAlertUntilMs &&
          (!banner || bannerUntil <= nowMs)
        ) {
          showBanner(
            `TRAFFIC ${trafficSideCue} / ${trafficVerticalCue} / ${Math.round(trafficAlert.distance)}M`,
            1600,
            'danger',
          )
          audio.playCue('traffic')
          trafficAlertUntilMs = nowMs + 2200
        }
        prevTrafficAlertId = trafficAlert.id
      }
      if (world.terrain.sampleMeshSurfaceInto(aircraft.position.x, aircraft.position.z, groundSurface)) {
        const water = groundSurface.kind === 'water'
        if (water !== overWater) {
          overWater = water
          if (water && aircraft.status === 'ok' && !aircraft.onGround && (!banner || bannerUntil <= nowMs)) {
            const surface = world.terrain.sampleMeshSurface(aircraft.position.x, aircraft.position.z)
            showBanner(waterSurfaceCue(surface?.waterBody ?? surface?.biome), 2600, 'info')
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
      hudFrame.fuelHomeSeconds = homeSeconds
      hudFrame.refueling = refueling
      const landingPreview = (returning || emergencyReturn) && navDist <= 3_000 && aircraft.controls.gearDown
        ? landingQualityForMetrics({
          verticalSpeed: aircraft.velocity.y,
          groundSpeed: Math.hypot(aircraft.velocity.x, aircraft.velocity.z),
          pitchRad: pose.pitch,
          rollRad: pose.roll,
        })
        : null
      challenge.recordLandingPreview(landingPreview ?? Number.NaN)
      challenge.recordApproachPreview(approachPreviewScore)
      hudFrame.landingPreview = landingPreview
      hudFrame.thermalLift = aircraft.thermalLift
      hudFrame.boost = aircraft.engineState.afterburnerActive
      hudFrame.afterburnerLock = afterburnerLockReason(
        aircraft.engineState.fuelAvailable,
        aircraft.engineHeat.afterburnerLocked,
      )
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
      hudFrame.cloudImmersion = world.atmosphere.cloudImmersionLevel
      hudFrame.heading = pose.heading
      hudFrame.audioMuted = audioMuted
      hudFrame.warning = warn.text
      hudFrame.warningLevel = warn.level
      hudFrame.clock = challenge.clockLabel
      hudFrame.weather = world.atmosphere.weatherLabel
      hudFrame.worldSeed = world.worldSeed
      hudFrame.weatherKind = world.atmosphere.weather
      hudFrame.weatherTransitioning = world.atmosphere.weatherTransitioning
      hudFrame.windX = precipitation.windX
      hudFrame.windZ = precipitation.windZ
      hudFrame.weatherGust = precipitation.gust
      hudFrame.stormBuffetDrive = stormHudDrive
      hudFrame.dayPhase = world.atmosphere.phaseLabel
      const contractLabel = challenge.contractLabel
      hudFrame.mission = missionLabelCache(
        world.mission.routeSummary.label,
        `${world.mission.routeSummary.challengeLabel} ${challenge.objectiveLabel}`,
        contractLabel,
      )
      const routeSummary = world.mission.routeSummary
      const routeRisk = routeSummary.profile === 'free'
        ? null
        : routeRiskLabelCache(routeSummary.difficulty, routeSummary.modifier, routeSummary.maxSlopeDegrees)
      hudFrame.routeRisk = routeRisk?.text ?? ''
      hudFrame.routeRiskAria = routeRisk?.aria ?? ''
      hudFrame.contractLabel = contractLabel
      hudFrame.contractDetail = challenge.contractDetail ?? ''
      hudFrame.contractProgress = challenge.contractProgress
      hudFrame.contractComplete = challenge.contractComplete
      hudFrame.contractFailed = challenge.contractFailed
      hudFrame.contractStreak = challenge.contractStreak
      hudFrame.liveScore = challenge.phase === 'running' || challenge.phase === 'returning'
        ? challenge.currentScorePreview
        : null
      hudFrame.gateQuality = challenge.gatesPassed > 0 ? challenge.currentGateQuality : null
      hudFrame.altitudeMilestone = challenge.phase === 'running' || challenge.phase === 'returning'
        ? altitudeMilestones.nextThresholdM || null
        : null
      hudFrame.biomeCount = challenge.biomeCount
      hudFrame.waterBodyCount = challenge.waterBodyCount
      hudFrame.terrainRegion = terrainRegion
      hudFrame.pace = challenge.gatesPassed > 0 ? challenge.gatePaceLabel : null
      hudFrame.ghostPace = visibleGhostPaceDelta((
        (challenge.phase === 'running' || challenge.phase === 'returning') &&
        cameras.mode !== 'cockpit' &&
        aircraft.status === 'ok'
      ) ? ghost.paceDelta(challenge.elapsedSec) : null, ghostVisible)
      hudFrame.missionPhase = challenge.phase
      hudFrame.missionCurrent = challenge.gatesPassed
      hudFrame.missionTotal = challenge.totalGates
      hudFrame.missionMisses = challenge.gateMisses
      hudFrame.combo = combo.current
      hudFrame.comboRemaining = combo.remainingSeconds
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
      hudFrame.trafficAlertSide = trafficSideCue
      hudFrame.trafficAlertVertical = trafficVerticalCue
      hudFrame.trafficAlertDistance = trafficAlert?.distance ?? null
      hudFrame.controlHint = nowMs < controlHintUntilMs && aircraft.status !== 'crashed'
        ? flightBriefingHint({
          onGround: aircraft.onGround,
          speed: aircraft.speed,
          altitudeM: alt,
          missionPhase: challenge.phase,
          gatesPassed: challenge.gatesPassed,
          gearDown: aircraft.controls.gearDown,
        })
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

      challenge.reset(
        courseId(),
        world.mission.totalGates,
        world.mission.scoringFocus,
        world.worldSeed,
        selectedCourse().contractCatalog === true,
      )
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
