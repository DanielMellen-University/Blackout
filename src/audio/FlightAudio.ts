/**
 * Engine rumble, wind hiss, and precipitation ambience via Web Audio.
 * Procedural noise only (no sample files). Levels follow flight power, airspeed, and weather.
 */
export const EVENT_NOISE_BUFFER_SECONDS = 0.75

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

  /**
   * Per-frame levels. Pass mute on title, pause, or crash.
   * speed is m/s (same as Aircraft.speed).
   */
  update(opts: {
    throttle: number
    boost: boolean
    speed: number
    rain: number
    snow: number
    mute: boolean
    dt: number
    /** True when the player is inside the camera-attached cockpit. */
    cockpit?: boolean
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
    const view = flightAudioViewMix(opts.cockpit === true)
    // Dry lever fills most of the rumble; AB adds a clear bump on top.
    const engLevel = thr * 0.78 + (boost ? 0.35 : 0) * (0.55 + thr * 0.45)
    const eng = Math.min(1, engLevel)

    // Wind starts after a taxi crawl, strong by cruise (~400+ kts).
    const windT = clamp01((opts.speed - 18) / 280)
    const wind = windT * windT
    const precip = precipitationAudioLevel(opts.rain, opts.snow)
    const whine = engineWhineLevel(opts.throttle, boost)

    this.muted = opts.mute
    const masterTarget = opts.mute ? 0 : this.volume
    const engTarget = opts.mute ? 0 : eng * 0.42 * view.engine
    const windTarget = opts.mute ? 0 : wind * 0.28 * view.wind
    const precipTarget = opts.mute ? 0 : precip * 0.18 * view.precipitation
    const whineTarget = opts.mute ? 0 : whine * 0.065 * view.whine

    const now = ctx.currentTime
    const tau = Math.max(0.04, Math.min(0.12, opts.dt * 3))

    this.scheduleTarget(this.master.gain, masterTarget, now, tau)
    this.scheduleTarget(this.engineGain.gain, engTarget, now, tau)
    this.scheduleTarget(this.windGain.gain, windTarget, now, tau)
    this.scheduleTarget(this.precipGain.gain, precipTarget, now, tau)
    this.scheduleTarget(this.engineWhineGain.gain, whineTarget, now, tau, 0.0005)
    if (this.engineSrc) {
      this.scheduleTarget(
        this.engineSrc.playbackRate,
        enginePlaybackRate(opts.throttle, boost),
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
      const cut = (90 + eng * 160 + (boost ? 70 : 0)) * view.engineFilter
      this.scheduleTarget(this.engineFilter.frequency, cut, now, tau, 0.5)
    }
    if (this.windFilter) {
      const cut = (900 + wind * 2200) * view.windFilter
      this.scheduleTarget(this.windFilter.frequency, cut, now, tau, 2)
    }
    if (this.precipFilter) {
      const cut = (1200 + precip * 3000) * view.precipitationFilter
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

  /** Short event cues keep checkpoints and landings readable without assets. */
  playCue(
    kind:
      | 'gate'
      | 'complete'
      | 'landed'
      | 'crash'
      | 'ab'
      | 'ab-off'
      | 'thunder'
      | 'warning'
      | 'overspeed'
      | 'gear-up'
      | 'gear-down',
  ): void {
    if (this.disposed) return
    const ctx = this.ctx
    const output = this.effectsGain
    if (!ctx || !audioContextUsable(ctx.state) || !output || ctx.state === 'suspended' || this.muted || this.volume <= 0) return

    const now = ctx.currentTime
    if (kind === 'gate') {
      this.tone(740, now, 0.11, 'sine', 0.18)
      this.tone(980, now + 0.08, 0.14, 'sine', 0.14)
    } else if (kind === 'complete') {
      this.tone(520, now, 0.13, 'triangle', 0.16)
      this.tone(660, now + 0.11, 0.13, 'triangle', 0.16)
      this.tone(880, now + 0.22, 0.28, 'triangle', 0.18)
    } else if (kind === 'landed') {
      // Soft tire thump: brief brown noise + settling tones.
      this.noiseBurst(now, 0.12, 'brown', 0.22, 180, 90)
      this.tone(380, now + 0.02, 0.14, 'sine', 0.12)
      this.tone(560, now + 0.12, 0.22, 'sine', 0.14)
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
      // terrain cautions without turning the cue into a harsh alarm.
      this.tone(680, now, 0.08, 'sine', 0.06, 520)
      this.tone(470, now + 0.1, 0.1, 'sine', 0.05, 360)
    } else if (kind === 'warning') {
      // A short, soft edge cue. The HUD carries the sustained warning state;
      // audio only announces a new caution so it cannot become a siren.
      this.tone(760, now, 0.09, 'sine', 0.07, 690)
      this.tone(540, now + 0.1, 0.12, 'sine', 0.055, 500)
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
    effectsGain.gain.value = 0.8
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
  if (previous === undefined) return true
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
export function enginePlaybackRate(throttle: number, boost: boolean): number {
  const thr = clamp01(throttle)
  const engineLevel = Math.min(1, thr * 0.78 + (boost ? 0.35 : 0) * (0.55 + thr * 0.45))
  return 0.72 + engineLevel * 0.46 + (boost ? 0.08 : 0)
}

/** Smooth turbine-whine envelope layered above the low engine rumble. */
export function engineWhineLevel(throttle: number, boost: boolean): number {
  const thr = clamp01(throttle)
  if (thr <= 0.16) return 0
  const t = (thr - 0.16) / 0.84
  const smooth = t * t * (3 - 2 * t)
  return Math.min(1, smooth * (boost ? 1 : 0.82))
}

/** Bounded precipitation bed level shared by the audio update and tests. */
export function precipitationAudioLevel(rain: number, snow: number): number {
  return clamp01(clamp01(rain) * 0.9 + clamp01(snow) * 0.18)
}

function clamp01(v: number): number {
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
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  } else {
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = Math.max(-1, Math.min(1, last * 3.5))
    }
  }
  return buf
}
