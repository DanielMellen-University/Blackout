import type { AudioChannel } from './AudioPreferences'

/**
 * Engine rumble, wind hiss, and precipitation ambience via Web Audio.
 * Procedural noise only (no sample files). Levels follow flight power, airspeed, and weather.
 */
export const EVENT_NOISE_BUFFER_SECONDS = 0.75

/** Advance the fixed noise stream used by event and ambience buffers. */
export function nextProceduralNoiseState(state: number): number {
  let next = (Number.isFinite(state) ? Math.trunc(state) : 0) >>> 0
  next = (next + 0x6d2b79f5) >>> 0
  let t = Math.imul(next ^ (next >>> 15), next | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return (t ^ (t >>> 14)) >>> 0
}

/** Conservative output guard for stacked engine, weather, and event cues. */
export const FLIGHT_AUDIO_LIMITER = Object.freeze({
  threshold: -7,
  knee: 12,
  ratio: 10,
  attack: 0.003,
  release: 0.18,
})

export interface FlightAudioViewMix {
  engine: number
  wind: number
  precipitation: number
  whine: number
  engineFilter: number
  windFilter: number
  precipitationFilter: number
}


const EXTERNAL_VIEW_MIX = Object.freeze({
  engine: 1,
  wind: 1,
  precipitation: 1,
  whine: 1,
  engineFilter: 1,
  windFilter: 1,
  precipitationFilter: 1,
}) as FlightAudioViewMix
const COCKPIT_VIEW_MIX = Object.freeze({
  engine: 0.92,
  wind: 0.58,
  precipitation: 0.76,
  whine: 0.84,
  engineFilter: 0.82,
  windFilter: 0.78,
  precipitationFilter: 0.82,
}) as FlightAudioViewMix

/** Enclosed cockpit mix muffles wind and rain while retaining engine presence. */
export function flightAudioViewMix(cockpit: boolean): FlightAudioViewMix {
  return cockpit ? COCKPIT_VIEW_MIX : EXTERNAL_VIEW_MIX
}

/** Return a bounded attenuation factor for world effects inside cloud cover. */
export function cloudAudioAttenuation(value: number, amount: number, floor = 0): number {
  const immersion = clamp01(value)
  const safeAmount = clamp01(amount)
  const safeFloor = clamp01(floor)
  return safeFloor + (1 - safeFloor) * (1 - immersion * safeAmount)
}

/** Add a restrained gust bed without letting weather overpower the engine. */
export function windGustAudioEnvelope(gust: number): number {
  return clamp01(gust) * 0.18
}

export class FlightAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engineGain: GainNode | null = null
  private windGain: GainNode | null = null
  private precipGain: GainNode | null = null
  private effectsGain: GainNode | null = null
  private limiter: DynamicsCompressorNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private precipFilter: BiquadFilterNode | null = null
  private engineWhine: OscillatorNode | null = null
  private engineWhineGain: GainNode | null = null
  private engineSrc: AudioBufferSourceNode | null = null
  private windSrc: AudioBufferSourceNode | null = null
  private precipSrc: AudioBufferSourceNode | null = null
  private eventWhiteBuffer: AudioBuffer | null = null
  private eventBrownBuffer: AudioBuffer | null = null
  private built = false
  private muted = true
  private volume = 1
  private engineVolume = 1
  private environmentVolume = 1
  private effectsVolume = 1
  private disposed = false
  private readonly scheduledTargets = new WeakMap<AudioParam, number>()

  /**
   * Resume (or create) the AudioContext from a user gesture such as Play.
   * Safe to call repeatedly.
   */
  async resume(): Promise<void> {
    if (this.disposed) return
    try {
      if (this.ctx?.state === 'closed') {
        this.ctx = null
        this.built = false
      }
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (!AC) return
        this.ctx = new AC()
      }
      if (!this.built) this.buildGraph(this.ctx)
      if (this.ctx.state === 'suspended') await this.ctx.resume()
    } catch {
      /* Audio unavailable: stay silent */
    }
  }

  /** Suspend the procedural graph while the page is hidden. */
  async suspend(): Promise<void> {
    if (this.disposed) return
    try {
      if (this.ctx?.state === 'running') await this.ctx.suspend()
    } catch {
      /* Audio suspension is optional and browser-dependent. */
    }
  }

  /**
   * Per-frame levels. Pass mute on title, pause, or crash.
   * speed is m/s (same as Aircraft.speed).
   */
  update(opts: {
    throttle: number
    boost: boolean
    /** Authoritative normalized output from Aircraft.engineState. */
    effectivePower?: number
    speed: number
    rain: number
    snow: number
    /** Bounded weather gust intensity used to lift the wind bed. */
    weatherGust?: number
    /** Smoothed local cloud density, 0 clear to 1 inside a formation. */
    cloudImmersion?: number
    mute: boolean
    dt: number
    /** True when the player is inside the camera-attached cockpit. */
    cockpit?: boolean
    /** True while the pilot holds the speed brake. */
    airbrake?: boolean
  }): void {
    if (this.disposed) return
    const ctx = this.ctx
    if (
      !ctx ||
      ctx.state === 'closed' ||
      !this.built ||
      !this.master ||
      !this.engineGain ||
      !this.windGain ||
      !this.precipGain ||
      !this.engineWhineGain ||
      !this.engineWhine
    ) {
      return
    }
    if (ctx.state === 'suspended') return
    if (shouldSkipMutedAudioUpdate(this.muted, opts.mute)) return

    const thr = clamp01(opts.throttle)
    const boost = opts.boost
    const effectivePower = enginePowerLevel(thr, boost, opts.effectivePower)
    const view = flightAudioViewMix(opts.cockpit === true)
    const eng = effectivePower

    // Wind starts after a taxi crawl, strong by cruise (~400+ kts).
    const speed = Number.isFinite(opts.speed) ? Math.max(0, opts.speed) : 0
    const wind = clamp01(
      airbrakeWindEnvelope(speed, opts.airbrake === true) +
      windGustAudioEnvelope(opts.weatherGust ?? 0),
    )
    const precip = precipitationAudioLevel(opts.rain, opts.snow)
    const whine = engineWhineLevel(opts.throttle, boost, opts.effectivePower)
    const cloudImmersion = Number.isFinite(opts.cloudImmersion) ? opts.cloudImmersion! : 0
    const cloudEngine = cloudAudioAttenuation(cloudImmersion, 0.06, 0.9)
    const cloudWind = cloudAudioAttenuation(cloudImmersion, 0.28, 0.7)
    const cloudPrecip = cloudAudioAttenuation(cloudImmersion, 0.18, 0.76)
    const cloudWhine = cloudAudioAttenuation(cloudImmersion, 0.08, 0.9)

    this.muted = opts.mute
    const masterTarget = opts.mute ? 0 : this.volume
    const engTarget = opts.mute ? 0 : eng * 0.42 * view.engine * cloudEngine * this.engineVolume
    const windTarget = opts.mute ? 0 : wind * 0.28 * view.wind * cloudWind * this.environmentVolume
    const precipTarget = opts.mute ? 0 : precip * 0.18 * view.precipitation * cloudPrecip * this.environmentVolume
    const whineTarget = opts.mute ? 0 : whine * 0.065 * view.whine * cloudWhine * this.engineVolume

    const now = ctx.currentTime
    const dt = Number.isFinite(opts.dt) && opts.dt > 0 ? Math.min(opts.dt, 0.25) : 1 / 60
    const tau = Math.max(0.04, Math.min(0.12, dt * 3))

    this.scheduleTarget(this.master.gain, masterTarget, now, tau)
    this.scheduleTarget(this.engineGain.gain, engTarget, now, tau)
    this.scheduleTarget(this.windGain.gain, windTarget, now, tau)
    this.scheduleTarget(this.precipGain.gain, precipTarget, now, tau)
    this.scheduleTarget(this.engineWhineGain.gain, whineTarget, now, tau, 0.0005)
    if (this.engineSrc) {
      this.scheduleTarget(
        this.engineSrc.playbackRate,
        enginePlaybackRate(opts.throttle, boost, opts.effectivePower),
        now,
        tau,
        0.001,
      )
    }
    if (this.engineWhine) {
      const whineHz = 420 + eng * 980 + (boost ? 380 : 0)
      this.scheduleTarget(this.engineWhine.frequency, whineHz, now, tau, 2)
    }

    if (this.engineFilter) {
      // Idle growl stays low; spool opens the filter a bit.
      const cut = (90 + eng * 160 + (boost ? 70 : 0)) * view.engineFilter * cloudEngine
      this.scheduleTarget(this.engineFilter.frequency, cut, now, tau, 0.5)
    }
    if (this.windFilter) {
      const cut = (900 + wind * 2200) * view.windFilter * cloudWind
      this.scheduleTarget(this.windFilter.frequency, cut, now, tau, 2)
    }
    if (this.precipFilter) {
      const cut = (1200 + precip * 3000) * view.precipitationFilter * cloudPrecip
      this.scheduleTarget(this.precipFilter.frequency, cut, now, tau, 2)
    }
  }

  /** Hard silence (e.g. before dispose). */
  silence(): void {
    if (!this.master || !this.ctx || !audioContextUsable(this.ctx.state)) return
    this.muted = true
    this.scheduleTarget(this.master.gain, 0, this.ctx.currentTime, 0.05)
  }

  /** Set the master mix level without changing the mute state. */
  setVolume(volume: number): number {
    this.volume = clamp01(volume)
    if (this.ctx && audioContextUsable(this.ctx.state) && this.master && !this.muted) {
      this.scheduleTarget(this.master.gain, this.volume, this.ctx.currentTime, 0.06)
    }
    return this.volume
  }

  get volumeLevel(): number {
    return this.volume
  }

  /** Set one fixed audio branch without rebuilding the Web Audio graph. */
  setChannelVolume(channel: AudioChannel, volume: number): number {
    const safe = clamp01(volume)
    if (channel === 'engine') this.engineVolume = safe
    else if (channel === 'environment') this.environmentVolume = safe
    else if (channel === 'effects') this.effectsVolume = safe
    else return 0

    if (channel === 'effects' && this.ctx && audioContextUsable(this.ctx.state) && this.effectsGain) {
      this.scheduleTarget(this.effectsGain.gain, 0.8 * this.effectsVolume, this.ctx.currentTime, 0.06)
    }
    return safe
  }

  channelVolumeLevel(channel: AudioChannel): number {
    if (channel === 'engine') return this.engineVolume
    if (channel === 'environment') return this.environmentVolume
    if (channel === 'effects') return this.effectsVolume
    return 0
  }

  /** Short event cues keep checkpoints and landings readable without assets. */
  playCue(
    kind:
      | 'gate'
      | 'streak'
      | 'complete'
      | 'landed'
      | 'landing-soft'
      | 'landing-hard'
      | 'stunt'
      | 'milestone'
      | 'crash'
      | 'ditch'
      | 'ab'
      | 'ab-off'
      | 'thunder'
      | 'warning'
      | 'obstacle'
      | 'overspeed'
      | 'stall'
      | 'gear-warning'
      | 'fuel'
      | 'go-around'
      | 'flare'
      | 'gear-up'
      | 'gear-down'
      | 'airbrake-open'
      | 'airbrake-close'
      | 'traffic'
      | 'radar-lock'
      | 'radar-lost'
      | 'sonic-boom',
  ): void {
    if (this.disposed) return
    const ctx = this.ctx
    const output = this.effectsGain
    if (!ctx || !audioContextUsable(ctx.state) || !output || ctx.state === 'suspended' || this.muted || this.volume <= 0) return

    const now = ctx.currentTime
    if (kind === 'gate') {
      this.tone(740, now, 0.11, 'sine', 0.18)
      this.tone(980, now + 0.08, 0.14, 'sine', 0.14)
    } else if (kind === 'streak') {
      // Bright three-note reward for a precision streak milestone.
      this.tone(620, now, 0.08, 'triangle', 0.12, 760)
      this.tone(820, now + 0.07, 0.09, 'triangle', 0.11, 980)
      this.tone(1040, now + 0.14, 0.13, 'sine', 0.1, 1120)
    } else if (kind === 'complete') {
      this.tone(520, now, 0.13, 'triangle', 0.16)
      this.tone(660, now + 0.11, 0.13, 'triangle', 0.16)
      this.tone(880, now + 0.22, 0.28, 'triangle', 0.18)
    } else if (kind === 'landed') {
      // Soft tire thump: brief brown noise + settling tones.
      this.noiseBurst(now, 0.12, 'brown', 0.22, 180, 90)
      this.tone(380, now + 0.02, 0.14, 'sine', 0.12)
      this.tone(560, now + 0.12, 0.22, 'sine', 0.14)
    } else if (kind === 'landing-soft') {
      // A restrained clean-touchdown reward, lighter than the normal rollout cue.
      this.noiseBurst(now, 0.08, 'brown', 0.12, 220, 110)
      this.tone(520, now, 0.12, 'sine', 0.09, 680)
      this.tone(760, now + 0.1, 0.2, 'sine', 0.1)
    } else if (kind === 'landing-hard') {
      // Firm warning cue stays below the crash envelope and remains event-only.
      this.noiseBurst(now, 0.16, 'brown', 0.28, 150, 70)
      this.tone(260, now, 0.16, 'triangle', 0.1, 170)
      this.tone(170, now + 0.1, 0.2, 'triangle', 0.08, 110)
    } else if (kind === 'stunt') {
      // A bright airshow reward keeps a completed roll distinct from warnings.
      this.tone(660, now, 0.08, 'triangle', 0.1, 820)
      this.tone(880, now + 0.08, 0.1, 'sine', 0.09, 1080)
      this.tone(1180, now + 0.17, 0.16, 'sine', 0.08, 1320)
    } else if (kind === 'milestone') {
      // A short ascending chime marks a climb milestone without a sustained bed.
      this.tone(480, now, 0.09, 'triangle', 0.08, 620)
      this.tone(720, now + 0.08, 0.1, 'sine', 0.075, 920)
      this.tone(1_040, now + 0.18, 0.18, 'sine', 0.065, 1_180)
    } else if (kind === 'ab') {
      // Rising whoosh on engage (not every AB frame).
      this.noiseBurst(now, 0.22, 'white', 0.2, 700, 2800)
      this.tone(220, now, 0.18, 'sawtooth', 0.1, 520)
      this.tone(90, now + 0.04, 0.28, 'triangle', 0.08, 160)
    } else if (kind === 'ab-off') {
      // A short low cooldown cue confirms release without competing with the
      // engine loop or turning boost into a repetitive alarm.
      this.noiseBurst(now, 0.14, 'brown', 0.1, 900, 260)
      this.tone(300, now, 0.14, 'triangle', 0.055, 120)
    } else if (kind === 'airbrake-open' || kind === 'airbrake-close') {
      const opening = kind === 'airbrake-open'
      this.noiseBurst(now, 0.1, opening ? 'white' : 'brown', opening ? 0.075 : 0.055, opening ? 800 : 620, opening ? 2100 : 260)
      this.tone(opening ? 260 : 340, now, 0.11, 'triangle', opening ? 0.045 : 0.035, opening ? 520 : 160)
    } else if (kind === 'traffic') {
      // A restrained double pulse keeps proximity readable without sounding like
      // the sustained stall warning.
      this.tone(540, now, 0.08, 'triangle', 0.06, 430)
      this.tone(540, now + 0.13, 0.09, 'triangle', 0.05, 430)
    } else if (kind === 'radar-lock') {
      // Confirm a deliberate target cycle with a short, rising two-note chirp.
      // Keep this in the event pool so selecting targets never grows the graph.
      this.tone(620, now, 0.07, 'triangle', 0.055, 760)
      this.tone(860, now + 0.075, 0.1, 'sine', 0.05, 980)
    } else if (kind === 'radar-lost') {
      // A low, descending pair makes a lost target obvious without becoming an
      // alarm when a streamed contact briefly leaves the radar range.
      this.tone(360, now, 0.08, 'triangle', 0.045, 260)
      this.tone(220, now + 0.09, 0.11, 'sine', 0.04, 160)
    } else if (kind === 'sonic-boom') {
      // A low, short pressure wave marks Mach crossing without a harsh click.
      this.noiseBurst(now, 0.34, 'brown', 0.2, 150, 48)
      this.tone(96, now, 0.38, 'triangle', 0.1, 42)
      this.tone(180, now + 0.018, 0.2, 'sine', 0.06, 72)
    } else if (kind === 'thunder') {
      // Low, delayed-feeling roll: the sky flash stays readable without a sharp click.
      this.noiseBurst(now, 0.52, 'brown', 0.14, 150, 42)
      this.tone(74, now + 0.04, 0.7, 'triangle', 0.1, 32)
    } else if (kind === 'gear-up' || kind === 'gear-down') {
      // Keep the automatic gear state legible with a quiet mechanical double-click.
      const lowering = kind === 'gear-down'
      const first = lowering ? 150 : 205
      const second = lowering ? 225 : 300
      this.tone(first, now, 0.08, 'triangle', 0.07, lowering ? 118 : 165)
      this.tone(second, now + 0.055, 0.09, 'sine', 0.05, lowering ? 190 : 250)
    } else if (kind === 'overspeed') {
      // A descending pair separates speed-envelope pressure from stall and
      // flight cautions without turning the cue into a harsh alarm.
      this.tone(680, now, 0.08, 'sine', 0.06, 520)
      this.tone(470, now + 0.1, 0.1, 'sine', 0.05, 360)
    } else if (kind === 'stall') {
      // A clear descending pair separates loss-of-lift from speed-envelope
      // pressure while remaining a one-shot edge cue.
      this.tone(920, now, 0.08, 'triangle', 0.065, 700)
      this.tone(620, now + 0.1, 0.12, 'triangle', 0.055, 440)
    } else if (kind === 'gear-warning') {
      // Keep unsafe-approach gear distinct from the mechanical gear toggle.
      this.tone(230, now, 0.08, 'triangle', 0.06, 170)
      this.tone(230, now + 0.15, 0.1, 'triangle', 0.05, 170)
    } else if (kind === 'fuel') {
      // Fuel gets a low, deliberate double pulse so the pilot can distinguish
      // a return-to-base emergency from ordinary threshold cautions.
      this.tone(300, now, 0.09, 'triangle', 0.06, 220)
      this.tone(210, now + 0.14, 0.13, 'triangle', 0.05, 150)
    } else if (kind === 'go-around') {
      // A rising pair confirms the landing escape instruction without the
      // sustained harshness of stall alarms.
      this.tone(430, now, 0.08, 'triangle', 0.07, 590)
      this.tone(680, now + 0.11, 0.13, 'sine', 0.06, 820)
    } else if (kind === 'flare') {
      // A soft descending pair marks the landing flare window as guidance,
      // keeping it distinct from an actual go-around or caution alarm.
      this.tone(620, now, 0.08, 'sine', 0.05, 520)
      this.tone(430, now + 0.11, 0.12, 'sine', 0.04, 360)
    } else if (kind === 'obstacle') {
      // A lower double pulse keeps building closure distinct from other cues while staying event-only and below the crash impact cue.
      this.tone(420, now, 0.09, 'triangle', 0.07, 310)
      this.tone(300, now + 0.12, 0.12, 'triangle', 0.055, 220)
    } else if (kind === 'warning') {
      // A short, soft edge cue. The HUD carries the sustained warning state;
      // audio only announces a new caution so it cannot become a siren.
      this.tone(760, now, 0.09, 'sine', 0.07, 690)
      this.tone(540, now + 0.1, 0.12, 'sine', 0.055, 500)
    } else if (kind === 'ditch') {
      // Water impact gets a broad low splash instead of the harsher ground
      // crash growl, while the HUD still explains the failed contact.
      this.noiseBurst(now, 0.3, 'white', 0.24, 520, 90)
      this.noiseBurst(now + 0.04, 0.46, 'brown', 0.2, 150, 48)
      this.tone(180, now, 0.32, 'triangle', 0.12, 92)
    } else {
      // Impact: noise slap + descending growl.
      this.noiseBurst(now, 0.18, 'white', 0.32, 900, 120)
      this.noiseBurst(now + 0.02, 0.35, 'brown', 0.28, 200, 50)
      this.tone(110, now, 0.45, 'sawtooth', 0.24, 38)
      this.tone(58, now + 0.05, 0.55, 'triangle', 0.2, 24)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    try {
      this.engineSrc?.stop()
      this.windSrc?.stop()
      this.precipSrc?.stop()
      this.engineWhine?.stop()
    } catch {
      /* already stopped */
    }
    this.engineSrc = null
    this.windSrc = null
    this.precipSrc = null
    this.engineWhine = null
    this.engineWhineGain = null
    this.eventWhiteBuffer = null
    this.eventBrownBuffer = null
    this.limiter?.disconnect()
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.engineGain = null
    this.windGain = null
    this.precipGain = null
    this.effectsGain = null
    this.limiter = null
    this.engineFilter = null
    this.windFilter = null
    this.precipFilter = null
    this.built = false
  }

  get isMuted(): boolean {
    return this.muted
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  private scheduleTarget(
    param: AudioParam,
    target: number,
    now: number,
    tau: number,
    epsilon = 0.001,
  ): void {
    const previous = this.scheduledTargets.get(param)
    if (!shouldScheduleAudioTarget(previous, target, epsilon)) return
    this.scheduledTargets.set(param, target)
    param.setTargetAtTime(target, now, tau)
  }

  private buildGraph(ctx: AudioContext): void {
    const master = ctx.createGain()
    master.gain.value = 0
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = FLIGHT_AUDIO_LIMITER.threshold
    limiter.knee.value = FLIGHT_AUDIO_LIMITER.knee
    limiter.ratio.value = FLIGHT_AUDIO_LIMITER.ratio
    limiter.attack.value = FLIGHT_AUDIO_LIMITER.attack
    limiter.release.value = FLIGHT_AUDIO_LIMITER.release
    limiter.connect(ctx.destination)
    master.connect(limiter)

    const engineGain = ctx.createGain()
    engineGain.gain.value = 0
    const engineFilter = ctx.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 120
    engineFilter.Q.value = 0.7
    engineGain.connect(engineFilter)
    engineFilter.connect(master)

    const windGain = ctx.createGain()
    windGain.gain.value = 0
    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 1400
    windFilter.Q.value = 0.55
    windGain.connect(windFilter)
    windFilter.connect(master)

    const precipGain = ctx.createGain()
    precipGain.gain.value = 0
    const precipFilter = ctx.createBiquadFilter()
    precipFilter.type = 'bandpass'
    precipFilter.frequency.value = 1600
    precipFilter.Q.value = 0.45
    precipGain.connect(precipFilter)
    precipFilter.connect(master)

    // A single restrained oscillator adds turbine presence above the brown
    // rumble without allocating nodes while the aircraft is flying.
    const engineWhineGain = ctx.createGain()
    engineWhineGain.gain.value = 0
    const engineWhine = ctx.createOscillator()
    engineWhine.type = 'triangle'
    engineWhine.frequency.value = 420
    engineWhine.connect(engineWhineGain)
    engineWhineGain.connect(master)
    engineWhine.start()

    const effectsGain = ctx.createGain()
    effectsGain.gain.value = 0.8 * this.effectsVolume
    // Route one master level through ambience and event cues alike so the
    // pause-menu volume control actually balances the complete flight mix.
    effectsGain.connect(master)

    const engBuf = makeNoiseBuffer(ctx, 2.5, 'brown')
    const windBuf = makeNoiseBuffer(ctx, 2.0, 'white')
    const precipBuf = makeNoiseBuffer(ctx, 2.2, 'white')
    // One-shot cues reuse these fixed buffers. BufferSource nodes are still
    // short-lived, but repeated crashes and weather cues stop rebuilding PCM.
    this.eventWhiteBuffer = makeNoiseBuffer(ctx, EVENT_NOISE_BUFFER_SECONDS, 'white')
    this.eventBrownBuffer = makeNoiseBuffer(ctx, EVENT_NOISE_BUFFER_SECONDS, 'brown')

    const engineSrc = ctx.createBufferSource()
    engineSrc.buffer = engBuf
    engineSrc.loop = true
    engineSrc.connect(engineGain)
    engineSrc.start()

    const windSrc = ctx.createBufferSource()
    windSrc.buffer = windBuf
    windSrc.loop = true
    windSrc.connect(windGain)
    windSrc.start()

    const precipSrc = ctx.createBufferSource()
    precipSrc.buffer = precipBuf
    precipSrc.loop = true
    precipSrc.connect(precipGain)
    precipSrc.start()

    this.master = master
    this.engineGain = engineGain
    this.windGain = windGain
    this.precipGain = precipGain
    this.effectsGain = effectsGain
    this.limiter = limiter
    this.engineFilter = engineFilter
    this.windFilter = windFilter
    this.precipFilter = precipFilter
    this.engineWhine = engineWhine
    this.engineWhineGain = engineWhineGain
    this.engineSrc = engineSrc
    this.windSrc = windSrc
    this.precipSrc = precipSrc
    this.built = true
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
  ): void {
    const ctx = this.ctx
    const output = this.effectsGain
    if (!ctx || !audioContextUsable(ctx.state) || !output) return

    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(output)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect()
      gain.disconnect()
    })
  }

  /** One-shot filtered noise for impacts and whooshes. */
  private noiseBurst(
    start: number,
    duration: number,
    kind: 'white' | 'brown',
    volume: number,
    startHz: number,
    endHz: number,
  ): void {
    const ctx = this.ctx
    const output = this.effectsGain
    const buffer = kind === 'white' ? this.eventWhiteBuffer : this.eventBrownBuffer
    if (!ctx || !audioContextUsable(ctx.state) || !output || !buffer) return

    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.8
    filter.frequency.setValueAtTime(Math.max(40, startHz), start)
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endHz), start + duration)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(output)
    src.start(start)
    src.stop(start + duration + 0.03)
    src.addEventListener('ended', () => {
      src.disconnect()
      filter.disconnect()
      gain.disconnect()
    })
  }
}

/** Keep tiny floating-point drift from creating redundant AudioParam events. */
export function shouldScheduleAudioTarget(
  previous: number | undefined,
  target: number,
  epsilon = 0.001,
): boolean {
  if (!Number.isFinite(target)) return false
  if (previous === undefined) return true
  if (!Number.isFinite(previous)) return true
  const delta = Math.abs(previous - target)
  return epsilon <= 0 ? delta > 0 : delta >= epsilon
}

/** Skip repeated paused/hidden updates once the output is already muted. */
export function shouldSkipMutedAudioUpdate(previousMuted: boolean, mute: boolean): boolean {
  return previousMuted && mute
}

/** Closed browser contexts reject node and AudioParam operations. */
export function audioContextUsable(state: AudioContextState | string): boolean {
  return state !== 'closed'
}

/** Bounded procedural engine spool rate shared by the audio update and tests. */
export function enginePlaybackRate(throttle: number, boost: boolean, effectivePower?: number): number {
  const thr = clamp01(throttle)
  const engineLevel = enginePowerLevel(thr, boost, effectivePower)
  return 0.72 + engineLevel * 0.46 + (boost ? 0.08 : 0)
}

/** Smooth turbine-whine envelope layered above the low engine rumble. */
export function engineWhineLevel(throttle: number, boost: boolean, effectivePower?: number): number {
  const thr = clamp01(throttle)
  if (thr <= 0.16) return 0
  const t = (thr - 0.16) / 0.84
  const smooth = t * t * (3 - 2 * t)
  if (!Number.isFinite(effectivePower)) return Math.min(1, smooth * (boost ? 1 : 0.82))
  const power = enginePowerLevel(thr, boost, effectivePower)
  const powerScale = boost ? power : Math.min(0.82, power)
  return Math.min(1, smooth * powerScale)
}

/** Resolve the shared engine output, retaining the legacy fallback for tools and callers without EngineState. */
export function enginePowerLevel(throttle: number, boost: boolean, effectivePower?: number): number {
  if (Number.isFinite(effectivePower)) return clamp01(effectivePower!)
  const thr = clamp01(throttle)
  return Math.min(1, thr * 0.78 + (boost ? 0.35 : 0) * (0.55 + thr * 0.45))
}

/** Bounded precipitation bed level shared by the audio update and tests. */
export function precipitationAudioLevel(rain: number, snow: number): number {
  return clamp01(clamp01(rain) * 0.9 + clamp01(snow) * 0.18)
}

/** Add a bounded speed-brake hiss to the existing wind bed without new nodes. */
export function airbrakeWindEnvelope(speed: number, active: boolean): number {
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0
  const windT = clamp01((safeSpeed - 18) / 280)
  const base = windT * windT
  if (!active) return base
  return clamp01(base + 0.1 + windT * 0.12)
}


function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function makeNoiseBuffer(
  ctx: AudioContext,
  seconds: number,
  kind: 'white' | 'brown',
): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.max(1, Math.floor(rate * seconds))
  const buf = ctx.createBuffer(1, len, rate)
  const data = buf.getChannelData(0)
  let state = kind === 'white' ? 0x243f6a88 : 0x9e3779b9
  if (kind === 'white') {
    for (let i = 0; i < len; i++) {
      state = nextProceduralNoiseState(state)
      data[i] = state / 2147483648 - 1
    }
  } else {
    let last = 0
    for (let i = 0; i < len; i++) {
      state = nextProceduralNoiseState(state)
      const white = state / 2147483648 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = Math.max(-1, Math.min(1, last * 3.5))
    }
  }
  return buf
}
