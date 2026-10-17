import { WEATHER_REVIEW_ROUTES } from './WeatherReviewRoutes'
import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig } from '../aircraft/flightConfig'
import type { TerrainStreamingStats } from '../world/TerrainSystem'
import { sampleTerrainHeight } from '../world/terrainSample'
import { getWorldSeed } from '../world/noise'

export interface SettlementReviewStats { loaded: number; buildings: number; roads: number; pending: number }
interface ReviewRoute { x: number; z: number; y: number; dx: number; dz: number; label: string; agl?: number; weather?: boolean; loopM?: number }
const ROUTES: Record<string, ReviewRoute> = {
  world: { x: 0, z: 0, y: 5000, dx: Math.SQRT1_2, dz: -Math.SQRT1_2, label: 'Original northeast corridor' },
  city: { x: 18000, z: 35000, y: 5000, dx: 1, dz: 0, label: 'Seed-1337 city corridor' },
  'city-low': { x: 18000, z: 35000, y: 5000, dx: 1, dz: 0, agl: 500, label: 'Seed-1337 city corridor, 500 m AGL' },
}

for (const [family, route] of Object.entries(WEATHER_REVIEW_ROUTES)) {
  for (const [level, agl] of [['low', 150], ['high', 7000]] as const)
    ROUTES[`${family}-${level}`] = { ...route, y: 5000, agl, weather: true,
      label: `${family}, ${agl} m AGL` }
}
ROUTES['weather-loop'] = { ...ROUTES['weatherfront-low']!, loopM: 81600,
  label: 'Repeated 81.6 km regional front corridor, 150 m AGL' }

/** Bounded RAF intervals, including hitches. Paused/hidden gaps are excluded explicitly. */
export class ReviewFrames {
  private readonly values: Float64Array
  private readonly hitches: { startMs: number; endMs: number; ms: number }[] = []
  private previous = 0
  private count = 0
  private cursor = 0

  constructor(capacity = 60000) { this.values = new Float64Array(capacity) }

  record(now: number, active: boolean): void {
    if (!active || !Number.isFinite(now)) { this.previous = 0; return }
    const delta = now - this.previous
    if (this.previous && delta > 0) {
      if (delta > 100 && this.hitches.length < 1000) this.hitches.push({ startMs: this.previous, endMs: now, ms: delta })
      this.values[this.cursor] = delta
      this.cursor = (this.cursor + 1) % this.values.length
      this.count = Math.min(this.values.length, this.count + 1)
    }
    this.previous = now
  }

  raw(): number[] {
    return Array.from({ length: this.count }, (_, i) => this.values[(this.cursor - this.count + i + this.values.length) % this.values.length]!)
  }

  longFrames() { return this.hitches }

  summary() {
    const sorted = this.values.slice(0, this.count).sort()
    return { samples: this.count, median: sorted[Math.floor(this.count * .5)] ?? null,
      p95: sorted[Math.floor(this.count * .95)] ?? null, p99: sorted[Math.floor(this.count * .99)] ?? null,
      max: sorted[this.count - 1] ?? null,
      over50: sorted.filter(ms => ms > 50).length, over100: sorted.filter(ms => ms > 100).length }
  }
}

type ReviewPhase = 'ready' | 'loading' | 'flight' | 'finished'
const DURATION = 120
const MAX_DURATION = 900

/** Opt-in development fixture. The real loop still runs physics, collision, HUD,
 * atmosphere, audio and rendering; only the reviewed aircraft trajectory is prescribed. */
export class FlightReview {
  private readonly panel = document.createElement('aside')
  private readonly button = document.createElement('button')
  private readonly output = document.createElement('pre')
  private readonly startupFrames = new ReviewFrames()
  private readonly flightFrames = new ReviewFrames()
  private phase: ReviewPhase = 'ready'
  private initialized = false
  private seconds = 0
  private started = 0
  private flightStarted = 0
  private coverageMs: number | null = null
  private nextPaint = 0
  private heapStart = 0
  private heapPeak = 0
  private ratioMin = Infinity
  private ratioMax = 0
  private active = false
  private readonly airfieldReadyMs: number
  private readonly duration: number
  private readonly routeId: string
  private readonly route: ReviewRoute
  private readonly yaw: number
  private readonly coverageReady: (() => void) | undefined
  private readonly renderedHeight: ((x: number, z: number) => number | null) | undefined
  private readonly settlementPeak: SettlementReviewStats = { loaded: 0, buildings: 0, roads: 0, pending: 0 }
  private resourceCount = 0
  private nextResourceSecond = 0
  private readonly resourceSamples = Array.from({ length: 31 }, () => ({ seconds: 0,
    heapBytes: 0, geometries: 0, textures: 0, loaded: 0, pending: 0, inFlight: 0, ready: 0,
    settlements: 0, buildings: 0, roads: 0, settlementPending: 0 }))

  constructor(airfieldReadyMs: number, launch: () => void, duration = DURATION, route = 'world', renderedHeight?: (x: number, z: number) => number | null, coverageReady?: () => void) {
    this.renderedHeight = renderedHeight
    this.coverageReady = coverageReady
    this.airfieldReadyMs = airfieldReadyMs
    this.duration = Number.isFinite(duration) ? Math.max(DURATION, Math.min(MAX_DURATION, duration)) : DURATION
    this.routeId = Object.hasOwn(ROUTES, route) ? route : 'world'
    this.route = ROUTES[this.routeId]!
    this.yaw = Math.atan2(this.route.dx, this.route.dz)
    this.panel.id = 'flight-review'
    this.panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:10000;padding:12px;background:#091321ed;color:#daeaff;border:1px solid #83c7ff;border-radius:8px;font:11px/1.4 monospace;max-width:calc(100vw - 24px);max-height:45vh;overflow:auto'
    this.button.textContent = `Run ${this.duration}-second fixed-route review`
    this.button.onclick = () => {
      this.phase = 'loading'; this.started = performance.now()
      this.button.disabled = true
      launch()
    }
    this.output.style.margin = '8px 0 0'
    this.output.textContent = `Development only: Free flight, chase camera, ${this.route.label}, maximum speed.\nWindowed review. Keep this tab visible. Paused/hidden time is excluded.`
    this.panel.append(this.button, this.output)
    document.body.append(this.panel)
  }

  visibility(active: boolean): void {
    this.active = active
    if (!active) { this.startupFrames.record(0, false); this.flightFrames.record(0, false) }
  }

  beforeStep(aircraft: Aircraft): void {
    if (this.phase === 'ready') return
    if (!this.initialized) {
      aircraft.reset({ x: this.route.x, y: this.height(this.route.x, this.route.z), z: this.route.z, yaw: this.yaw })
      this.initialized = true
    }
    const c = aircraft.controls
    c.pitch = c.roll = c.yaw = 0
    c.throttle = this.phase === 'flight' && this.active ? 1 : 0
    c.boost = this.phase === 'flight' && this.active
    c.gearDown = c.airbrake = c.stabilityAssist = false
  }

  afterStep(aircraft: Aircraft, dt: number): void {
    if (this.phase === 'ready') return
    if (this.phase === 'flight' && this.active) this.seconds = Math.min(this.duration, this.seconds + dt)
    const distance = this.seconds * flightConfig.maxSpeedBoost
    const period = this.route.loopM ? distance % (this.route.loopM * 2) : distance
    const reverse = this.route.loopM !== undefined && period >= this.route.loopM
    const along = reverse ? this.route.loopM! * 2 - period : period
    const direction = reverse ? -1 : 1
    const yaw = reverse ? this.yaw + Math.PI : this.yaw
    const x = this.route.x + along * this.route.dx, z = this.route.z + along * this.route.dz
    aircraft.position.set(x, this.height(x, z), z)
    const speed = this.phase === 'flight' ? flightConfig.maxSpeedBoost : 0
    aircraft.velocity.set(speed * this.route.dx * direction, 0, speed * this.route.dz * direction)
    aircraft.angularVelocity.set(0, 0, 0)
    aircraft.orientation.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2))
  }

  get weatherRoute(): boolean { return this.route.weather === true }

  private height(x: number, z: number): number {
    return this.route.agl === undefined ? this.route.y : (this.renderedHeight?.(x, z) ?? sampleTerrainHeight(x, z)) + this.route.agl
  }

  frame(now: number, stream: TerrainStreamingStats, quality: string, ratio: number,
    geometries: number, textures: number, camera = 'unreported', settlements?: Readonly<SettlementReviewStats>): void {
    if (!this.active || this.phase === 'ready' || this.phase === 'finished') return
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0
    this.heapPeak = Math.max(this.heapPeak, heap)
    this.ratioMin = Math.min(this.ratioMin, ratio); this.ratioMax = Math.max(this.ratioMax, ratio)
    if (settlements) {
      this.settlementPeak.loaded = Math.max(this.settlementPeak.loaded, settlements.loaded)
      this.settlementPeak.buildings = Math.max(this.settlementPeak.buildings, settlements.buildings)
      this.settlementPeak.roads = Math.max(this.settlementPeak.roads, settlements.roads)
      this.settlementPeak.pending = Math.max(this.settlementPeak.pending, settlements.pending)
    }
    if (this.phase === 'loading') {
      this.startupFrames.record(now, true)
      if (stream.loaded > 0 && stream.pending === 0 && stream.inFlight === 0 && stream.ready === 0) {
        this.coverageMs = now - this.started
        this.phase = 'flight'; this.flightStarted = now; this.heapStart = heap; this.heapPeak = heap
        this.coverageReady?.()
      }
    } else {
      this.flightFrames.record(now, true)
      if (this.seconds >= this.duration) this.phase = 'finished'
    }
    if ((this.phase === 'flight' || this.phase === 'finished') &&
      (this.seconds >= this.nextResourceSecond || this.phase === 'finished') && this.resourceCount < this.resourceSamples.length) {
      const sample = this.resourceSamples[this.resourceCount++]!
      sample.seconds = this.seconds; sample.heapBytes = heap
      sample.geometries = geometries; sample.textures = textures
      sample.loaded = stream.loaded; sample.pending = stream.pending
      sample.inFlight = stream.inFlight; sample.ready = stream.ready
      sample.settlements = settlements?.loaded ?? 0; sample.buildings = settlements?.buildings ?? 0
      sample.roads = settlements?.roads ?? 0; sample.settlementPending = settlements?.pending ?? 0
      this.nextResourceSecond = this.seconds + 30
    }
    if (now < this.nextPaint && this.phase !== 'finished') return
    this.nextPaint = now + 1000
    this.output.textContent = JSON.stringify({ phase: this.phase, seed: getWorldSeed(), quality, camera,
      route: { id: this.routeId, ...this.route },
      viewport: [innerWidth, innerHeight], pixelRatio: ratio, ratioRange: [this.ratioMin, this.ratioMax],
      airfieldReadyMs: this.airfieldReadyMs, launchToCoverageWallMs: this.coverageMs,
      flightWallMs: this.flightStarted ? now - this.flightStarted : null,
      longFrames: this.phase === 'finished' ? { startup: this.startupFrames.longFrames(), flight: this.flightFrames.longFrames() } : undefined,
      rawFrames: this.phase === 'finished' ? { startup: this.startupFrames.raw(), flight: this.flightFrames.raw() } : undefined,
      seconds: this.seconds, durationSeconds: this.duration, distanceM: this.seconds * flightConfig.maxSpeedBoost,
      speedMps: flightConfig.maxSpeedBoost, startupFrames: this.startupFrames.summary(),
      flightFrames: this.flightFrames.summary(), heapBytes: { start: this.heapStart, current: heap, peak: this.heapPeak },
      geometries, textures, streaming: stream,
      settlements: settlements ? { current: settlements, peak: this.settlementPeak } : null,
      resourceSamples: this.resourceSamples.slice(0, this.resourceCount) }, null, 2)
  }

  dispose(): void { this.button.onclick = null; this.panel.remove() }
}
