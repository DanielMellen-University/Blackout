import type { Aircraft } from '../aircraft/Aircraft'
import { flightConfig } from '../aircraft/flightConfig'
import type { TerrainStreamingStats } from '../world/TerrainSystem'

/** Bounded RAF intervals, including hitches. Paused/hidden gaps are excluded explicitly. */
export class ReviewFrames {
  private readonly values: Float64Array
  private previous = 0
  private count = 0
  private cursor = 0

  constructor(capacity = 18000) { this.values = new Float64Array(capacity) }

  record(now: number, active: boolean): void {
    if (!active || !Number.isFinite(now)) { this.previous = 0; return }
    const delta = now - this.previous
    if (this.previous && delta > 0) {
      this.values[this.cursor] = delta
      this.cursor = (this.cursor + 1) % this.values.length
      this.count = Math.min(this.values.length, this.count + 1)
    }
    this.previous = now
  }

  summary(): { samples: number; median: number | null; p95: number | null; max: number | null } {
    const sorted = this.values.slice(0, this.count).sort()
    return { samples: this.count, median: sorted[Math.floor(this.count * .5)] ?? null,
      p95: sorted[Math.floor(this.count * .95)] ?? null, max: sorted[this.count - 1] ?? null }
  }
}

type ReviewPhase = 'ready' | 'loading' | 'flight' | 'finished'
const DURATION = 120
const YAW = Math.PI * .75

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
  private coverageMs: number | null = null
  private nextPaint = 0
  private heapStart = 0
  private heapPeak = 0
  private ratioMin = Infinity
  private ratioMax = 0
  private active = false
  private readonly airfieldReadyMs: number

  constructor(airfieldReadyMs: number, launch: () => void) {
    this.airfieldReadyMs = airfieldReadyMs
    this.panel.id = 'flight-review'
    this.panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:10000;padding:12px;background:#091321ed;color:#daeaff;border:1px solid #83c7ff;border-radius:8px;font:11px/1.4 monospace;max-width:calc(100vw - 24px);max-height:45vh;overflow:auto'
    this.button.textContent = 'Run 120-second fixed-route review'
    this.button.onclick = () => {
      this.phase = 'loading'; this.started = performance.now()
      this.button.disabled = true
      launch()
    }
    this.output.style.margin = '8px 0 0'
    this.output.textContent = 'Development only: Free flight, (0, 5000, 0), northeast, maximum speed.\nKeep this tab visible. Paused/hidden time is excluded.'
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
      aircraft.reset({ x: 0, y: 5000, z: 0, yaw: YAW })
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
    if (this.phase === 'flight' && this.active) this.seconds = Math.min(DURATION, this.seconds + dt)
    const distance = this.seconds * flightConfig.maxSpeedBoost
    aircraft.position.set(distance * Math.SQRT1_2, 5000, -distance * Math.SQRT1_2)
    const speed = this.phase === 'flight' ? flightConfig.maxSpeedBoost : 0
    aircraft.velocity.set(speed * Math.SQRT1_2, 0, -speed * Math.SQRT1_2)
    aircraft.angularVelocity.set(0, 0, 0)
    aircraft.orientation.set(0, Math.sin(YAW / 2), 0, Math.cos(YAW / 2))
  }

  frame(now: number, stream: TerrainStreamingStats, quality: string, ratio: number,
    geometries: number, textures: number): void {
    if (!this.active || this.phase === 'ready' || this.phase === 'finished') return
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0
    this.heapPeak = Math.max(this.heapPeak, heap)
    this.ratioMin = Math.min(this.ratioMin, ratio); this.ratioMax = Math.max(this.ratioMax, ratio)
    if (this.phase === 'loading') {
      this.startupFrames.record(now, true)
      if (stream.loaded > 0 && stream.pending === 0 && stream.inFlight === 0 && stream.ready === 0) {
        this.coverageMs = now - this.started
        this.phase = 'flight'; this.heapStart = heap; this.heapPeak = heap
      }
    } else {
      this.flightFrames.record(now, true)
      if (this.seconds >= DURATION) this.phase = 'finished'
    }
    if (now < this.nextPaint && this.phase !== 'finished') return
    this.nextPaint = now + 1000
    this.output.textContent = JSON.stringify({ phase: this.phase, quality,
      viewport: [innerWidth, innerHeight], pixelRatio: ratio, ratioRange: [this.ratioMin, this.ratioMax],
      airfieldReadyMs: this.airfieldReadyMs, launchToCoverageWallMs: this.coverageMs,
      seconds: this.seconds, distanceM: this.seconds * flightConfig.maxSpeedBoost,
      speedMps: flightConfig.maxSpeedBoost, startupFrames: this.startupFrames.summary(),
      flightFrames: this.flightFrames.summary(), heapBytes: { start: this.heapStart, current: heap, peak: this.heapPeak },
      geometries, textures, streaming: stream }, null, 2)
  }

  dispose(): void { this.button.onclick = null; this.panel.remove() }
}
